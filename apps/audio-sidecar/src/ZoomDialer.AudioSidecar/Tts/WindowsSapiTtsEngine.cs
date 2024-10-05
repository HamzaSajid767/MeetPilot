using System.Globalization;
using System.Speech.Synthesis;
using Microsoft.Extensions.Logging;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using ZoomDialer.AudioSidecar.Logging;

namespace ZoomDialer.AudioSidecar.Tts;

/// <summary>
/// Offline Windows SAPI synthesis via System.Speech.
/// </summary>
public sealed class WindowsSapiTtsEngine : ITtsEngine
{
    private readonly ILogger<WindowsSapiTtsEngine> _logger;
    private readonly object _gate = new();

    public WindowsSapiTtsEngine(ILogger<WindowsSapiTtsEngine> logger)
    {
        _logger = logger;
    }

    public IReadOnlyList<TtsVoiceInfo> ListVoices()
    {
        lock (_gate)
        {
            using var synthesizer = new SpeechSynthesizer();
            return synthesizer.GetInstalledVoices()
                .Where(static voice => voice.Enabled)
                .Select(static voice =>
                {
                    var info = voice.VoiceInfo;
                    return new TtsVoiceInfo
                    {
                        Id = info.Name,
                        DisplayName = info.Name,
                        Language = info.Culture?.Name ?? string.Empty,
                        Gender = info.Gender.ToString()
                    };
                })
                .OrderBy(static voice => voice.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
    }

    public Task<SynthesizeSpeechResult> SynthesizeToFileAsync(
        SynthesizeSpeechRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidateRequest(request);

        return Task.Run(
            () =>
            {
                cancellationToken.ThrowIfCancellationRequested();
                lock (_gate)
                {
                    return SynthesizeLocked(request, cancellationToken);
                }
            },
            cancellationToken);
    }

    private SynthesizeSpeechResult SynthesizeLocked(
        SynthesizeSpeechRequest request,
        CancellationToken cancellationToken)
    {
        var directory = Path.GetDirectoryName(request.OutputPath);
        if (string.IsNullOrWhiteSpace(directory))
        {
            throw new ArgumentException("SynthesizeSpeech.outputPath must include a directory.");
        }

        Directory.CreateDirectory(directory);

        var tempPath = request.OutputPath + $".{Environment.ProcessId}.{Guid.NewGuid():N}.tmp.wav";

        try
        {
            using (var synthesizer = new SpeechSynthesizer())
            {
                SelectVoice(synthesizer, request.VoiceId);
                synthesizer.Rate = request.Rate;
                synthesizer.Volume = (int)Math.Round(request.Volume * 100.0);

                synthesizer.SetOutputToWaveFile(tempPath);
                try
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    synthesizer.Speak(request.Text);
                }
                finally
                {
                    synthesizer.SetOutputToNull();
                }
            }

            cancellationToken.ThrowIfCancellationRequested();

            // Prefer a mix-friendly PCM WAV when possible; fall back to SAPI output as-is.
            var durationMs = RewriteAsPcm16Mono48kOrCopy(tempPath, request.OutputPath);

            _logger.LogInformation(
                SidecarLogEventIds.TtsSynthesized,
                "Synthesized TTS wav. Path={Path} DurationMs={DurationMs} Voice={VoiceId}",
                request.OutputPath,
                durationMs,
                request.VoiceId ?? "(default)");

            return new SynthesizeSpeechResult
            {
                Path = request.OutputPath,
                DurationMs = durationMs
            };
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex) when (ex is not ArgumentException and not InvalidOperationException)
        {
            _logger.LogError(SidecarLogEventIds.TtsFailed, ex, "TTS synthesis failed");
            throw new InvalidOperationException("Unable to synthesize speech to WAV.", ex);
        }
        finally
        {
            TryDelete(tempPath);
        }
    }

    private static void ValidateRequest(SynthesizeSpeechRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            throw new ArgumentException("SynthesizeSpeech.text must be a non-empty string.");
        }

        if (string.IsNullOrWhiteSpace(request.OutputPath))
        {
            throw new ArgumentException("SynthesizeSpeech.outputPath must be a non-empty string.");
        }

        if (!Path.IsPathRooted(request.OutputPath))
        {
            throw new ArgumentException("SynthesizeSpeech.outputPath must be an absolute path.");
        }

        if (!request.OutputPath.EndsWith(".wav", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("SynthesizeSpeech.outputPath must end with .wav.");
        }

        if (request.Rate is < -10 or > 10)
        {
            throw new ArgumentException("SynthesizeSpeech.rate must be between -10 and 10.");
        }

        if (request.Volume is < 0 or > 1)
        {
            throw new ArgumentException("SynthesizeSpeech.volume must be between 0.0 and 1.0.");
        }
    }

    private static void SelectVoice(SpeechSynthesizer synthesizer, string? voiceId)
    {
        if (string.IsNullOrWhiteSpace(voiceId))
        {
            return;
        }

        try
        {
            synthesizer.SelectVoice(voiceId);
        }
        catch (ArgumentException)
        {
            throw new ArgumentException(
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"Unknown TTS voice '{voiceId}'."));
        }
    }

    private static int RewriteAsPcm16Mono48kOrCopy(string sourcePath, string destinationPath)
    {
        using var reader = new WaveFileReader(sourcePath);
        var durationMs = (int)Math.Round(reader.TotalTime.TotalMilliseconds);

        try
        {
            ISampleProvider sampleProvider = reader.ToSampleProvider();
            if (sampleProvider.WaveFormat.Channels == 2)
            {
                sampleProvider = new StereoToMonoSampleProvider(sampleProvider);
            }
            else if (sampleProvider.WaveFormat.Channels != 1)
            {
                File.Copy(sourcePath, destinationPath, overwrite: true);
                return durationMs;
            }

            if (sampleProvider.WaveFormat.SampleRate != 48_000)
            {
                sampleProvider = new WdlResamplingSampleProvider(sampleProvider, 48_000);
            }

            var wave16 = new SampleToWaveProvider16(sampleProvider);
            WaveFileWriter.CreateWaveFile(destinationPath, wave16);
            return durationMs;
        }
        catch
        {
            File.Copy(sourcePath, destinationPath, overwrite: true);
            return durationMs;
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // Best-effort cleanup.
        }
    }
}
