using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using ZoomDialer.AudioSidecar.Configuration;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Audio;

public sealed class MicrophoneStartedArgs : EventArgs
{
    public required string DeviceId { get; init; }

    public string? FriendlyName { get; init; }
}

public sealed class MicrophoneStoppedArgs : EventArgs
{
    public string? Reason { get; init; }
}

public sealed class MicrophoneFailedArgs : EventArgs
{
    public required string Code { get; init; }

    public required string Message { get; init; }
}

public sealed class AudioLevelsArgs : EventArgs
{
    public required AudioLevelMeters Levels { get; init; }
}

/// <summary>
/// Coordinates mic capture + playback stems into a single WasapiOut render stream.
/// </summary>
public interface IAudioMixEngine : IAsyncDisposable
{
    bool IsRendererRunning { get; }

    bool IsMicrophoneActive { get; }

    bool IsPlaybackActive { get; }

    string? ActivePlaybackId { get; }

    float MicrophoneGain { get; set; }

    float PlaybackGain { get; set; }

    float MasterGain { get; set; }

    event EventHandler<MicrophoneStartedArgs>? MicrophoneStarted;

    event EventHandler<MicrophoneStoppedArgs>? MicrophoneStopped;

    event EventHandler<MicrophoneFailedArgs>? MicrophoneFailed;

    event EventHandler<AudioLevelsArgs>? LevelsUpdated;

    event EventHandler<PlaybackStartedArgs>? PlaybackStarted;

    event EventHandler<PlaybackCompletedArgs>? PlaybackCompleted;

    event EventHandler<PlaybackFailedArgs>? PlaybackFailed;

    Task StartMicrophoneAsync(CancellationToken cancellationToken);

    Task StopMicrophoneAsync(CancellationToken cancellationToken);

    Task<PlayAudioAccepted> PlayAsync(PlayAudioRequest request, CancellationToken cancellationToken);

    Task<PlayAudioAccepted> PlayTestToneAsync(PlayTestToneRequest request, CancellationToken cancellationToken);

    Task StopPlaybackAsync(CancellationToken cancellationToken);
}

public sealed class PlayTestToneRequest
{
    public required string Kind { get; init; }

    public double FrequencyHz { get; init; } = 440;

    public required double Volume { get; init; }

    public int? DurationMs { get; init; }

    public required string PlaybackId { get; init; }
}

public sealed class AudioMixEngine : IAudioMixEngine
{
    private readonly IMixer _mixer;
    private readonly IMicrophoneCapture _microphoneCapture;
    private readonly IMicrophoneSelector _microphoneSelector;
    private readonly IOutputDeviceSelector _outputDeviceSelector;
    private readonly IAudioDeviceManager _deviceManager;
    private readonly ILogger<AudioMixEngine> _logger;
    private readonly int _bufferMilliseconds;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly object _stateGate = new();
    private readonly FloatRingBuffer _micRing;

    private WasapiOut? _output;
    private MMDevice? _outputDevice;
    private WaveFileReader? _playbackReader;
    private ISampleProvider? _playbackProvider;
    private string? _activePlaybackId;
    private bool _microphoneActive;
    private bool _disposed;
    private CancellationTokenSource? _levelsCts;

    public AudioMixEngine(
        IMixer mixer,
        IMicrophoneCapture microphoneCapture,
        IMicrophoneSelector microphoneSelector,
        IOutputDeviceSelector outputDeviceSelector,
        IAudioDeviceManager deviceManager,
        IOptions<AudioOptions> audioOptions,
        ILogger<AudioMixEngine> logger)
    {
        _mixer = mixer;
        _microphoneCapture = microphoneCapture;
        _microphoneSelector = microphoneSelector;
        _outputDeviceSelector = outputDeviceSelector;
        _deviceManager = deviceManager;
        _logger = logger;
        _bufferMilliseconds = Math.Clamp(audioOptions.Value.BufferMilliseconds, 5, 100);
        var capacity = mixer.WaveFormat.SampleRate * mixer.WaveFormat.Channels * 2; // ~2s
        _micRing = new FloatRingBuffer(capacity);

        _microphoneCapture.CaptureFailed += OnCaptureFailed;
        _microphoneCapture.CaptureStopped += OnCaptureStoppedExternal;
    }

    public bool IsRendererRunning
    {
        get
        {
            lock (_stateGate)
            {
                return _output is not null;
            }
        }
    }

    public bool IsMicrophoneActive
    {
        get
        {
            lock (_stateGate)
            {
                return _microphoneActive;
            }
        }
    }

    public bool IsPlaybackActive
    {
        get
        {
            lock (_stateGate)
            {
                return _activePlaybackId is not null;
            }
        }
    }

    public string? ActivePlaybackId
    {
        get
        {
            lock (_stateGate)
            {
                return _activePlaybackId;
            }
        }
    }

    public float MicrophoneGain
    {
        get => _mixer.MicrophoneGain;
        set => _mixer.MicrophoneGain = value;
    }

    public float PlaybackGain
    {
        get => _mixer.PlaybackGain;
        set => _mixer.PlaybackGain = value;
    }

    public float MasterGain
    {
        get => _mixer.MasterGain;
        set => _mixer.MasterGain = value;
    }

    public event EventHandler<MicrophoneStartedArgs>? MicrophoneStarted;

    public event EventHandler<MicrophoneStoppedArgs>? MicrophoneStopped;

    public event EventHandler<MicrophoneFailedArgs>? MicrophoneFailed;

    public event EventHandler<AudioLevelsArgs>? LevelsUpdated;

    public event EventHandler<PlaybackStartedArgs>? PlaybackStarted;

    public event EventHandler<PlaybackCompletedArgs>? PlaybackCompleted;

    public event EventHandler<PlaybackFailedArgs>? PlaybackFailed;

    public async Task StartMicrophoneAsync(CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_microphoneActive)
            {
                return;
            }

            await EnsureRendererUnlockedAsync().ConfigureAwait(false);
            _mixer.MicrophoneStem.SetRing(_micRing);
            await _microphoneCapture
                .StartAsync(_micRing, _mixer.WaveFormat, cancellationToken)
                .ConfigureAwait(false);

            var device = _microphoneSelector.ResolveForCapture();
            lock (_stateGate)
            {
                _microphoneActive = true;
            }

            _logger.LogInformation(
                SidecarLogEventIds.MicrophoneStarted,
                "Microphone capture started. DeviceId={DeviceId}",
                device.Id);

            MicrophoneStarted?.Invoke(
                this,
                new MicrophoneStartedArgs
                {
                    DeviceId = device.Id,
                    FriendlyName = device.FriendlyName
                });
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task StopMicrophoneAsync(CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await StopMicrophoneUnlockedAsync(reason: "stopped").ConfigureAwait(false);
            await MaybeStopRendererUnlockedAsync().ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<PlayAudioAccepted> PlayAsync(
        PlayAudioRequest request,
        CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(request);
        ValidatePlayRequest(request);

        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await StopPlaybackUnlockedAsync(emitCompleted: true).ConfigureAwait(false);

            WaveFileReader reader;
            try
            {
                reader = new WaveFileReader(request.Path);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Unable to open WAV file '{request.Path}'.", ex);
            }

            var durationMs = (int)Math.Round(reader.TotalTime.TotalMilliseconds);
            ISampleProvider samples;
            try
            {
                samples = ConvertToBus(reader.ToSampleProvider(), _mixer.WaveFormat);
            }
            catch
            {
                reader.Dispose();
                throw;
            }

            var resolved = await EnsureRendererUnlockedAsync().ConfigureAwait(false);
            _mixer.PlaybackStem.ClipVolume = (float)request.Volume;
            _mixer.PlaybackStem.SetProvider(new PlaybackEndDetector(samples, OnPlaybackProviderEnded));

            lock (_stateGate)
            {
                _playbackReader = reader;
                _playbackProvider = samples;
                _activePlaybackId = request.PlaybackId;
            }

            _logger.LogInformation(
                SidecarLogEventIds.PlaybackStarted,
                "Playback started via mixer. PlaybackId={PlaybackId} DurationMs={DurationMs} OutputDeviceId={OutputDeviceId}",
                request.PlaybackId,
                durationMs,
                resolved.DeviceId);

            PlaybackStarted?.Invoke(
                this,
                new PlaybackStartedArgs
                {
                    PlaybackId = request.PlaybackId,
                    DurationMs = durationMs
                });

            return new PlayAudioAccepted
            {
                PlaybackId = request.PlaybackId,
                DurationMs = durationMs,
                OutputDeviceId = resolved.DeviceId,
                OutputDeviceName = resolved.FriendlyName,
                UsedFallbackDevice = resolved.UsedFallback,
                FallbackReason = resolved.FallbackReason
            };
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<PlayAudioAccepted> PlayTestToneAsync(
        PlayTestToneRequest request,
        CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(request);
        ValidateTestToneRequest(request);

        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await StopPlaybackUnlockedAsync(emitCompleted: true).ConfigureAwait(false);

            var generatorType = request.Kind.ToLowerInvariant() switch
            {
                "sine" => SignalGeneratorType.Sin,
                "pink" => SignalGeneratorType.Pink,
                "white" => SignalGeneratorType.White,
                _ => throw new ArgumentException("Unsupported test tone kind.", nameof(request))
            };

            var durationMs = request.DurationMs is null or <= 0 ? 2000 : request.DurationMs.Value;
            var generator = new SignalGenerator(_mixer.WaveFormat.SampleRate, 1)
            {
                Gain = 1.0,
                Frequency = request.FrequencyHz,
                Type = generatorType
            };

            ISampleProvider samples = generator.Take(TimeSpan.FromMilliseconds(durationMs));
            samples = ConvertToBus(samples, _mixer.WaveFormat);

            var resolved = await EnsureRendererUnlockedAsync().ConfigureAwait(false);
            _mixer.PlaybackStem.ClipVolume = (float)request.Volume;
            _mixer.PlaybackStem.SetProvider(new PlaybackEndDetector(samples, OnPlaybackProviderEnded));

            lock (_stateGate)
            {
                _playbackReader = null;
                _playbackProvider = samples;
                _activePlaybackId = request.PlaybackId;
            }

            _logger.LogInformation(
                SidecarLogEventIds.PlaybackStarted,
                "Test tone started via mixer. PlaybackId={PlaybackId} Kind={Kind} DurationMs={DurationMs} OutputDeviceId={OutputDeviceId}",
                request.PlaybackId,
                request.Kind,
                durationMs,
                resolved.DeviceId);

            PlaybackStarted?.Invoke(
                this,
                new PlaybackStartedArgs
                {
                    PlaybackId = request.PlaybackId,
                    DurationMs = durationMs
                });

            return new PlayAudioAccepted
            {
                PlaybackId = request.PlaybackId,
                DurationMs = durationMs,
                OutputDeviceId = resolved.DeviceId,
                OutputDeviceName = resolved.FriendlyName,
                UsedFallbackDevice = resolved.UsedFallback,
                FallbackReason = resolved.FallbackReason
            };
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task StopPlaybackAsync(CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await StopPlaybackUnlockedAsync(emitCompleted: true).ConfigureAwait(false);
            await MaybeStopRendererUnlockedAsync().ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            await StopMicrophoneUnlockedAsync(reason: null).ConfigureAwait(false);
            await StopPlaybackUnlockedAsync(emitCompleted: false).ConfigureAwait(false);
            StopRendererUnlocked();
        }
        finally
        {
            _gate.Release();
            _gate.Dispose();
            await _microphoneCapture.DisposeAsync().ConfigureAwait(false);
        }
    }

    private void OnPlaybackProviderEnded()
    {
        _ = Task.Run(async () =>
        {
            await _gate.WaitAsync().ConfigureAwait(false);
            try
            {
                string? id;
                lock (_stateGate)
                {
                    id = _activePlaybackId;
                }

                await StopPlaybackUnlockedAsync(emitCompleted: true).ConfigureAwait(false);
                await MaybeStopRendererUnlockedAsync().ConfigureAwait(false);
                if (id is not null)
                {
                    // completed already emitted in StopPlaybackUnlocked when emitCompleted
                }
            }
            finally
            {
                _gate.Release();
            }
        });
    }

    private async Task StopMicrophoneUnlockedAsync(string? reason)
    {
        if (!_microphoneActive && !_microphoneCapture.IsCapturing)
        {
            return;
        }

        await _microphoneCapture.StopAsync(CancellationToken.None).ConfigureAwait(false);
        _mixer.MicrophoneStem.ClearSource();
        _micRing.Clear();
        lock (_stateGate)
        {
            _microphoneActive = false;
        }

        if (reason is not null)
        {
            MicrophoneStopped?.Invoke(this, new MicrophoneStoppedArgs { Reason = reason });
        }
    }

    private async Task StopPlaybackUnlockedAsync(bool emitCompleted)
    {
        string? playbackId;
        WaveFileReader? reader;
        lock (_stateGate)
        {
            playbackId = _activePlaybackId;
            reader = _playbackReader;
            _activePlaybackId = null;
            _playbackReader = null;
            _playbackProvider = null;
        }

        _mixer.PlaybackStem.ClearSource();
        _mixer.PlaybackStem.ClipVolume = 1f;
        try
        {
            reader?.Dispose();
        }
        catch
        {
            // ignored
        }

        if (emitCompleted && playbackId is not null)
        {
            PlaybackCompleted?.Invoke(this, new PlaybackCompletedArgs { PlaybackId = playbackId });
        }

        await Task.CompletedTask.ConfigureAwait(false);
    }

    private async Task<ResolvedOutputDevice> EnsureRendererUnlockedAsync()
    {
        lock (_stateGate)
        {
            if (_output is not null)
            {
                var current = _outputDeviceSelector.ResolveForPlayback();
                return current;
            }
        }

        var resolved = _outputDeviceSelector.ResolveForPlayback();
        var mmDevice = _deviceManager.OpenRenderDevice(resolved.DeviceId)
            ?? _deviceManager.OpenDefaultRenderDevice();

        if (!string.Equals(mmDevice.ID, resolved.DeviceId, StringComparison.Ordinal)
            && !resolved.UsedFallback)
        {
            resolved = new ResolvedOutputDevice
            {
                DeviceId = mmDevice.ID,
                FriendlyName = mmDevice.FriendlyName,
                UsedFallback = true,
                FallbackReason = "Selected output device could not be opened; using default.",
                IsDefault = true
            };
        }

        var output = new WasapiOut(mmDevice, AudioClientShareMode.Shared, useEventSync: false, latency: _bufferMilliseconds);
        output.Init(_mixer.Output.ToWaveProvider());
        output.PlaybackStopped += OnRendererStopped;
        output.Play();

        lock (_stateGate)
        {
            _output = output;
            _outputDevice = mmDevice;
        }

        StartLevelsLoop();
        if (resolved.UsedFallback)
        {
            _logger.LogWarning(
                SidecarLogEventIds.OutputDeviceFallback,
                "Mix renderer falling back to default output. Reason={Reason}",
                resolved.FallbackReason);
        }

        await Task.CompletedTask.ConfigureAwait(false);
        return resolved;
    }

    private async Task MaybeStopRendererUnlockedAsync()
    {
        bool mic;
        bool play;
        lock (_stateGate)
        {
            mic = _microphoneActive;
            play = _activePlaybackId is not null;
        }

        if (!mic && !play)
        {
            StopRendererUnlocked();
        }

        await Task.CompletedTask.ConfigureAwait(false);
    }

    private void StopRendererUnlocked()
    {
        WasapiOut? output;
        MMDevice? device;
        lock (_stateGate)
        {
            output = _output;
            device = _outputDevice;
            _output = null;
            _outputDevice = null;
        }

        StopLevelsLoop();

        if (output is null)
        {
            return;
        }

        try
        {
            output.PlaybackStopped -= OnRendererStopped;
            if (output.PlaybackState != PlaybackState.Stopped)
            {
                output.Stop();
            }
        }
        catch
        {
            // ignored
        }

        try
        {
            output.Dispose();
        }
        catch
        {
            // ignored
        }

        try
        {
            device?.Dispose();
        }
        catch
        {
            // ignored
        }
    }

    private void OnRendererStopped(object? sender, StoppedEventArgs e)
    {
        if (e.Exception is null)
        {
            return;
        }

        _logger.LogError(SidecarLogEventIds.MixRendererFaulted, e.Exception, "Mix renderer stopped with error");
        string? playbackId;
        lock (_stateGate)
        {
            playbackId = _activePlaybackId;
        }

        if (playbackId is not null)
        {
            PlaybackFailed?.Invoke(
                this,
                new PlaybackFailedArgs
                {
                    PlaybackId = playbackId,
                    Code = ProtocolConstants.ErrorCodes.PlaybackFailed,
                    Message = e.Exception.Message
                });
        }

        _ = Task.Run(async () =>
        {
            await _gate.WaitAsync().ConfigureAwait(false);
            try
            {
                StopRendererUnlocked();
                if (_microphoneActive || _activePlaybackId is not null)
                {
                    try
                    {
                        await EnsureRendererUnlockedAsync().ConfigureAwait(false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(SidecarLogEventIds.MixRendererFaulted, ex, "Failed to recover mix renderer");
                    }
                }
            }
            finally
            {
                _gate.Release();
            }
        });
    }

    private void OnCaptureFailed(object? sender, Exception ex)
    {
        _logger.LogWarning(SidecarLogEventIds.MicrophoneFailed, ex, "Microphone capture failed");
        _ = Task.Run(async () =>
        {
            await _gate.WaitAsync().ConfigureAwait(false);
            try
            {
                lock (_stateGate)
                {
                    _microphoneActive = false;
                }

                _mixer.MicrophoneStem.ClearSource();
                _micRing.Clear();
                MicrophoneFailed?.Invoke(
                    this,
                    new MicrophoneFailedArgs
                    {
                        Code = ProtocolConstants.ErrorCodes.DeviceUnavailable,
                        Message = ex.Message
                    });
                await MaybeStopRendererUnlockedAsync().ConfigureAwait(false);
            }
            finally
            {
                _gate.Release();
            }
        });
    }

    private void OnCaptureStoppedExternal(object? sender, EventArgs e)
    {
        // Handled via explicit Stop or failure path.
    }

    private void StartLevelsLoop()
    {
        StopLevelsLoop();
        var cts = new CancellationTokenSource();
        _levelsCts = cts;
        _ = Task.Run(async () =>
        {
            while (!cts.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(100, cts.Token).ConfigureAwait(false);
                    var levels = _mixer.GetLevels();
                    LevelsUpdated?.Invoke(this, new AudioLevelsArgs { Levels = levels });
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        });
    }

    private void StopLevelsLoop()
    {
        try
        {
            _levelsCts?.Cancel();
            _levelsCts?.Dispose();
        }
        catch
        {
            // ignored
        }

        _levelsCts = null;
    }

    private static ISampleProvider ConvertToBus(ISampleProvider source, WaveFormat busFormat)
    {
        ISampleProvider samples = source;
        if (samples.WaveFormat.Channels == 1 && busFormat.Channels == 2)
        {
            samples = new MonoToStereoSampleProvider(samples);
        }
        else if (samples.WaveFormat.Channels == 2 && busFormat.Channels == 1)
        {
            samples = new StereoToMonoSampleProvider(samples);
        }

        if (samples.WaveFormat.SampleRate != busFormat.SampleRate)
        {
            samples = new WdlResamplingSampleProvider(samples, busFormat.SampleRate);
        }

        return samples;
    }

    private static void ValidateTestToneRequest(PlayTestToneRequest request)
    {
        var kind = request.Kind?.Trim().ToLowerInvariant();
        if (kind is not ("sine" or "pink" or "white"))
        {
            throw new ArgumentException("Test tone kind must be sine, pink, or white.", nameof(request));
        }

        if (request.Volume is < 0 or > 1)
        {
            throw new ArgumentOutOfRangeException(nameof(request), "Volume must be between 0.0 and 1.0.");
        }

        if (request.FrequencyHz is <= 0 or > 20_000)
        {
            throw new ArgumentOutOfRangeException(nameof(request), "FrequencyHz must be between 0 and 20000.");
        }

        if (request.DurationMs is < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(request), "DurationMs must be non-negative.");
        }
    }

    private static void ValidatePlayRequest(PlayAudioRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Path))
        {
            throw new ArgumentException("WAV path is required.", nameof(request));
        }

        if (request.Volume is < 0 or > 1)
        {
            throw new ArgumentOutOfRangeException(nameof(request), "Volume must be between 0.0 and 1.0.");
        }

        if (!string.Equals(Path.GetExtension(request.Path), ".wav", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Only .wav files are supported.", nameof(request));
        }

        if (!File.Exists(request.Path))
        {
            throw new FileNotFoundException("WAV file was not found.", request.Path);
        }

        if (string.IsNullOrWhiteSpace(request.PlaybackId))
        {
            throw new ArgumentException("PlaybackId is required.", nameof(request));
        }
    }

    private sealed class PlaybackEndDetector : ISampleProvider
    {
        private readonly ISampleProvider _source;
        private readonly Action _onEnded;
        private bool _ended;

        public PlaybackEndDetector(ISampleProvider source, Action onEnded)
        {
            _source = source;
            _onEnded = onEnded;
        }

        public WaveFormat WaveFormat => _source.WaveFormat;

        public int Read(float[] buffer, int offset, int count)
        {
            var read = _source.Read(buffer, offset, count);
            if (read < count)
            {
                Array.Clear(buffer, offset + read, count - read);
                if (!_ended && read == 0)
                {
                    _ended = true;
                    _onEnded();
                }
            }

            return count;
        }
    }
}
