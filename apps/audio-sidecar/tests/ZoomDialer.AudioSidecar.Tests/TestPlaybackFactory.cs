using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Configuration;

namespace ZoomDialer.AudioSidecar.Tests;

internal static class TestPlaybackFactory
{
    public static (IAudioMixEngine Mix, IPlaybackEngine Playback, FakeMicrophoneCapture Capture) CreateMixEngine(
        IOutputDeviceSelector? outputSelector = null,
        IAudioDeviceManager? devices = null,
        IMicrophoneSelector? micSelector = null,
        FakeMicrophoneCapture? capture = null)
    {
        var deviceManager = devices ?? new NAudioAudioDeviceManager();
        var outputs = outputSelector ?? new OutputDeviceSelector(deviceManager);
        var mics = micSelector ?? new MicrophoneSelector(deviceManager);
        var mixer = new FloatAudioMixer();
        var micCapture = capture ?? new FakeMicrophoneCapture();
        var options = Options.Create(new AudioOptions());
        var mix = new AudioMixEngine(
            mixer,
            micCapture,
            mics,
            outputs,
            deviceManager,
            options,
            NullLogger<AudioMixEngine>.Instance);
        var playback = new NAudioPlaybackEngine(mix, NullLogger<NAudioPlaybackEngine>.Instance);
        return (mix, playback, micCapture);
    }

    public static IPlaybackEngine CreateEngine(
        IOutputDeviceSelector? selector = null,
        IAudioDeviceManager? devices = null)
    {
        var (mix, playback, _) = CreateMixEngine(selector, devices);
        return new OwningPlaybackEngine(mix, playback);
    }

    private sealed class OwningPlaybackEngine : IPlaybackEngine
    {
        private readonly IAudioMixEngine _mix;
        private readonly IPlaybackEngine _inner;

        public OwningPlaybackEngine(IAudioMixEngine mix, IPlaybackEngine inner)
        {
            _mix = mix;
            _inner = inner;
            _inner.PlaybackStarted += (_, args) => PlaybackStarted?.Invoke(this, args);
            _inner.PlaybackCompleted += (_, args) => PlaybackCompleted?.Invoke(this, args);
            _inner.PlaybackFailed += (_, args) => PlaybackFailed?.Invoke(this, args);
        }

        public event EventHandler<PlaybackStartedArgs>? PlaybackStarted;

        public event EventHandler<PlaybackCompletedArgs>? PlaybackCompleted;

        public event EventHandler<PlaybackFailedArgs>? PlaybackFailed;

        public string? ActivePlaybackId => _inner.ActivePlaybackId;

        public Task<PlayAudioAccepted> PlayAsync(PlayAudioRequest request, CancellationToken cancellationToken)
            => _inner.PlayAsync(request, cancellationToken);

        public Task StopAsync(CancellationToken cancellationToken)
            => _inner.StopAsync(cancellationToken);

        public ValueTask DisposeAsync() => _mix.DisposeAsync();
    }
}
