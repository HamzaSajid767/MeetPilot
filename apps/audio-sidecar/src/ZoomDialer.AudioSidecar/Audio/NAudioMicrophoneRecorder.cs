using Microsoft.Extensions.Logging;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using ZoomDialer.AudioSidecar.Logging;

namespace ZoomDialer.AudioSidecar.Audio;

/// <summary>
/// Dedicated WASAPI capture that writes PCM16 mono 48 kHz WAV (independent of mix mic stem).
/// </summary>
public sealed class NAudioMicrophoneRecorder : IMicrophoneRecorder, IAsyncDisposable
{
    public const int TargetSampleRateHz = 48_000;
    public const int MinimumDurationMs = 250;

    private readonly IMicrophoneSelector _selector;
    private readonly IAudioDeviceManager _deviceManager;
    private readonly ILogger<NAudioMicrophoneRecorder> _logger;
    private readonly object _gate = new();

    private WasapiCapture? _capture;
    private MMDevice? _device;
    private WaveFileWriter? _writer;
    private string? _tempPath;
    private string? _outputPath;
    private long _bytesWritten;
    private Exception? _captureError;
    private bool _disposed;

    public NAudioMicrophoneRecorder(
        IMicrophoneSelector selector,
        IAudioDeviceManager deviceManager,
        ILogger<NAudioMicrophoneRecorder> logger)
    {
        _selector = selector;
        _deviceManager = deviceManager;
        _logger = logger;
    }

    public bool IsRecording
    {
        get
        {
            lock (_gate)
            {
                return _capture is not null;
            }
        }
    }

    public Task StartAsync(StartRecordingRequest request, CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();
        ValidateOutputPath(request.OutputPath);

        lock (_gate)
        {
            if (_capture is not null)
            {
                throw new InvalidOperationException("A recording is already in progress.");
            }

            var directory = Path.GetDirectoryName(request.OutputPath)!;
            Directory.CreateDirectory(directory);

            var tempPath = request.OutputPath + $".{Environment.ProcessId}.{Guid.NewGuid():N}.tmp.wav";
            MMDevice device;
            try
            {
                device = ResolveDevice(request.DeviceId);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "Microphone is unavailable for recording.",
                    ex);
            }

            WasapiCapture capture;
            WaveFileWriter writer;
            try
            {
                capture = new WasapiCapture(device) { ShareMode = AudioClientShareMode.Shared };
                writer = new WaveFileWriter(tempPath, new WaveFormat(TargetSampleRateHz, 16, 1));
            }
            catch
            {
                device.Dispose();
                TryDelete(tempPath);
                throw;
            }

            _device = device;
            _capture = capture;
            _writer = writer;
            _tempPath = tempPath;
            _outputPath = request.OutputPath;
            _bytesWritten = 0;
            _captureError = null;

            capture.DataAvailable += OnDataAvailable;
            capture.RecordingStopped += OnRecordingStopped;

            try
            {
                capture.StartRecording();
            }
            catch
            {
                capture.DataAvailable -= OnDataAvailable;
                capture.RecordingStopped -= OnRecordingStopped;
                writer.Dispose();
                capture.Dispose();
                device.Dispose();
                _capture = null;
                _writer = null;
                _device = null;
                _tempPath = null;
                _outputPath = null;
                TryDelete(tempPath);
                throw;
            }
        }

        _logger.LogInformation(
            SidecarLogEventIds.RecordingStarted,
            "Recording started. OutputPath={OutputPath}",
            request.OutputPath);

        return Task.CompletedTask;
    }

    public Task<StopRecordingResult> StopAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        string? outputPath;
        string? tempPath;
        Exception? captureError;
        long bytesWritten;

        lock (_gate)
        {
            if (_capture is null && _tempPath is null)
            {
                throw new InvalidOperationException("No recording is in progress.");
            }

            outputPath = _outputPath;
            tempPath = _tempPath;
        }

        StopCaptureInternal();

        lock (_gate)
        {
            bytesWritten = _bytesWritten;
            captureError = _captureError;
            _bytesWritten = 0;
            _captureError = null;
            _tempPath = null;
            _outputPath = null;
        }

        if (captureError is not null)
        {
            TryDelete(tempPath);
            TryDelete(outputPath);
            throw new InvalidOperationException(
                "Recording failed because the microphone disconnected or failed.",
                captureError);
        }

        if (string.IsNullOrWhiteSpace(tempPath) || string.IsNullOrWhiteSpace(outputPath))
        {
            throw new InvalidOperationException("Recording state was lost.");
        }

        var durationMs = BytesToDurationMs(bytesWritten);
        if (durationMs < MinimumDurationMs)
        {
            TryDelete(tempPath);
            TryDelete(outputPath);
            throw new InvalidOperationException(
                $"Recording is too short ({durationMs} ms). Minimum is {MinimumDurationMs} ms.");
        }

        try
        {
            if (File.Exists(outputPath))
            {
                File.Delete(outputPath);
            }

            File.Move(tempPath, outputPath);
        }
        catch (Exception ex)
        {
            TryDelete(tempPath);
            TryDelete(outputPath);
            throw new InvalidOperationException("Unable to write recording WAV file.", ex);
        }

        _logger.LogInformation(
            SidecarLogEventIds.RecordingStopped,
            "Recording stopped. Path={Path} DurationMs={DurationMs}",
            outputPath,
            durationMs);

        return Task.FromResult(
            new StopRecordingResult
            {
                Path = outputPath,
                DurationMs = durationMs,
                Succeeded = true
            });
    }

    public Task CancelAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        string? tempPath;
        string? outputPath;
        lock (_gate)
        {
            if (_capture is null && _tempPath is null)
            {
                return Task.CompletedTask;
            }

            tempPath = _tempPath;
            outputPath = _outputPath;
        }

        StopCaptureInternal();

        lock (_gate)
        {
            _bytesWritten = 0;
            _captureError = null;
            _tempPath = null;
            _outputPath = null;
        }

        TryDelete(tempPath);
        TryDelete(outputPath);

        _logger.LogInformation(SidecarLogEventIds.RecordingCancelled, "Recording cancelled");
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        await CancelAsync(CancellationToken.None).ConfigureAwait(false);
    }

    private MMDevice ResolveDevice(string? deviceId)
    {
        if (!string.IsNullOrWhiteSpace(deviceId))
        {
            var opened = _deviceManager.OpenCaptureDevice(deviceId);
            if (opened is not null)
            {
                return opened;
            }
        }

        var info = _selector.ResolveForCapture();
        return _deviceManager.OpenCaptureDevice(info.Id)
            ?? _deviceManager.OpenDefaultCaptureDevice();
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        WaveFileWriter? writer;
        WasapiCapture? capture;
        lock (_gate)
        {
            writer = _writer;
            capture = _capture;
        }

        if (writer is null || capture is null || e.BytesRecorded <= 0)
        {
            return;
        }

        try
        {
            using var source = new RawSourceWaveStream(e.Buffer, 0, e.BytesRecorded, capture.WaveFormat);
            ISampleProvider samples = source.ToSampleProvider();
            if (samples.WaveFormat.Channels == 2)
            {
                samples = new StereoToMonoSampleProvider(samples);
            }
            else if (samples.WaveFormat.Channels != 1)
            {
                return;
            }

            if (samples.WaveFormat.SampleRate != TargetSampleRateHz)
            {
                samples = new WdlResamplingSampleProvider(samples, TargetSampleRateHz);
            }

            var wave16 = new SampleToWaveProvider16(samples);
            var buffer = new byte[Math.Max(512, TargetSampleRateHz / 25 * 2)];
            int read;
            while ((read = wave16.Read(buffer, 0, buffer.Length)) > 0)
            {
                lock (_gate)
                {
                    if (_writer is null)
                    {
                        return;
                    }

                    _writer.Write(buffer, 0, read);
                    _bytesWritten += read;
                }
            }
        }
        catch (Exception ex)
        {
            lock (_gate)
            {
                _captureError ??= ex;
            }
        }
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        if (e.Exception is not null)
        {
            lock (_gate)
            {
                _captureError ??= e.Exception;
            }
        }

        // Capture already stopping; release handles without requiring StopAsync.
        StopCaptureInternal();
    }

    private void StopCaptureInternal()
    {
        WasapiCapture? capture;
        MMDevice? device;
        WaveFileWriter? writer;
        lock (_gate)
        {
            capture = _capture;
            device = _device;
            writer = _writer;
            _capture = null;
            _device = null;
            _writer = null;
        }

        if (capture is not null)
        {
            capture.DataAvailable -= OnDataAvailable;
            capture.RecordingStopped -= OnRecordingStopped;
            try
            {
                if (capture.CaptureState != CaptureState.Stopped)
                {
                    capture.StopRecording();
                }
            }
            catch
            {
                // Best-effort stop.
            }

            capture.Dispose();
        }

        writer?.Dispose();
        device?.Dispose();
    }

    private static void ValidateOutputPath(string outputPath)
    {
        if (string.IsNullOrWhiteSpace(outputPath))
        {
            throw new ArgumentException("StartRecording.outputPath must be a non-empty string.");
        }

        if (!Path.IsPathRooted(outputPath))
        {
            throw new ArgumentException("StartRecording.outputPath must be an absolute path.");
        }

        if (!outputPath.EndsWith(".wav", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("StartRecording.outputPath must end with .wav.");
        }
    }

    private static int BytesToDurationMs(long bytesWritten)
    {
        // PCM16 mono @ 48 kHz → 2 bytes per sample
        var samples = bytesWritten / 2;
        return (int)Math.Round(samples * 1000.0 / TargetSampleRateHz);
    }

    private static void TryDelete(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return;
        }

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
