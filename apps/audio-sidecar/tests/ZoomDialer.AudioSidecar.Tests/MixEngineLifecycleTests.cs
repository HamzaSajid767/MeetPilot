using ZoomDialer.AudioSidecar.Audio;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class MixEngineLifecycleTests
{
    private static string FixturePath => Path.Combine(AppContext.BaseDirectory, "fixtures", "tone.wav");

    [Fact]
    public async Task Start_Microphone_Only_Starts_Renderer()
    {
        var (mix, _, _) = TestPlaybackFactory.CreateMixEngine();
        await using var engine = mix;

        var started = new TaskCompletionSource<MicrophoneStartedArgs>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.MicrophoneStarted += (_, args) => started.TrySetResult(args);

        await engine.StartMicrophoneAsync(CancellationToken.None);

        Assert.True(engine.IsMicrophoneActive);
        Assert.True(engine.IsRendererRunning);
        Assert.False(engine.IsPlaybackActive);
        var args = await started.Task.WaitAsync(TimeSpan.FromSeconds(3));
        Assert.False(string.IsNullOrWhiteSpace(args.DeviceId));
    }

    [Fact]
    public async Task Play_Only_Starts_Renderer_Without_Mic()
    {
        Assert.True(File.Exists(FixturePath));
        var (mix, playback, _) = TestPlaybackFactory.CreateMixEngine();
        await using var engine = mix;

        await playback.PlayAsync(
            new PlayAudioRequest
            {
                Path = FixturePath,
                Volume = 0.1,
                PlaybackId = Guid.NewGuid().ToString("N")
            },
            CancellationToken.None);

        Assert.True(engine.IsRendererRunning);
        Assert.True(engine.IsPlaybackActive);
        Assert.False(engine.IsMicrophoneActive);
    }

    [Fact]
    public async Task StopPlayback_Keeps_Microphone_Running()
    {
        Assert.True(File.Exists(FixturePath));
        var (mix, playback, _) = TestPlaybackFactory.CreateMixEngine();
        await using var engine = mix;

        await engine.StartMicrophoneAsync(CancellationToken.None);
        await playback.PlayAsync(
            new PlayAudioRequest
            {
                Path = FixturePath,
                Volume = 0.1,
                PlaybackId = Guid.NewGuid().ToString("N")
            },
            CancellationToken.None);

        await playback.StopAsync(CancellationToken.None);

        Assert.True(engine.IsMicrophoneActive);
        Assert.True(engine.IsRendererRunning);
        Assert.False(engine.IsPlaybackActive);
    }

    [Fact]
    public async Task StopMicrophone_Keeps_Playback_Running()
    {
        Assert.True(File.Exists(FixturePath));
        var (mix, playback, _) = TestPlaybackFactory.CreateMixEngine();
        await using var engine = mix;

        await engine.StartMicrophoneAsync(CancellationToken.None);
        await playback.PlayAsync(
            new PlayAudioRequest
            {
                Path = FixturePath,
                Volume = 0.1,
                PlaybackId = Guid.NewGuid().ToString("N")
            },
            CancellationToken.None);

        await engine.StopMicrophoneAsync(CancellationToken.None);

        Assert.False(engine.IsMicrophoneActive);
        Assert.True(engine.IsPlaybackActive);
        Assert.True(engine.IsRendererRunning);
    }

    [Fact]
    public async Task Both_Idle_Stops_Renderer()
    {
        var (mix, _, _) = TestPlaybackFactory.CreateMixEngine();
        await using var engine = mix;

        await engine.StartMicrophoneAsync(CancellationToken.None);
        await engine.StopMicrophoneAsync(CancellationToken.None);

        Assert.False(engine.IsMicrophoneActive);
        Assert.False(engine.IsRendererRunning);
    }

    [Fact]
    public async Task Capture_Fail_Clears_Mic_But_Playback_Continues()
    {
        Assert.True(File.Exists(FixturePath));
        var capture = new FakeMicrophoneCapture();
        var (mix, playback, _) = TestPlaybackFactory.CreateMixEngine(capture: capture);
        await using var engine = mix;

        var failed = new TaskCompletionSource<MicrophoneFailedArgs>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.MicrophoneFailed += (_, args) => failed.TrySetResult(args);

        await engine.StartMicrophoneAsync(CancellationToken.None);
        await playback.PlayAsync(
            new PlayAudioRequest
            {
                Path = FixturePath,
                Volume = 0.1,
                PlaybackId = Guid.NewGuid().ToString("N")
            },
            CancellationToken.None);

        capture.Fail(new InvalidOperationException("capture disconnected"));

        var failArgs = await failed.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal("capture disconnected", failArgs.Message);

        await Task.Delay(100);
        Assert.False(engine.IsMicrophoneActive);
        Assert.True(engine.IsPlaybackActive);
        Assert.True(engine.IsRendererRunning);
    }

    [Fact]
    public async Task Gains_Hot_Swap_Without_Restart()
    {
        var (mix, _, _) = TestPlaybackFactory.CreateMixEngine();
        await using var engine = mix;

        await engine.StartMicrophoneAsync(CancellationToken.None);
        engine.MicrophoneGain = 0.3f;
        engine.PlaybackGain = 0.7f;
        engine.MasterGain = 0.5f;

        Assert.Equal(0.3f, engine.MicrophoneGain, 3);
        Assert.Equal(0.7f, engine.PlaybackGain, 3);
        Assert.Equal(0.5f, engine.MasterGain, 3);
        Assert.True(engine.IsMicrophoneActive);
        Assert.True(engine.IsRendererRunning);
    }

    [Fact]
    public async Task PlayTestTone_Sine_Starts_Playback()
    {
        var (mix, _, _) = TestPlaybackFactory.CreateMixEngine();
        await using var engine = mix;

        var started = new TaskCompletionSource<PlaybackStartedArgs>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.PlaybackStarted += (_, args) => started.TrySetResult(args);

        var accepted = await engine.PlayTestToneAsync(
            new PlayTestToneRequest
            {
                Kind = "sine",
                FrequencyHz = 440,
                Volume = 0.2,
                DurationMs = 250,
                PlaybackId = Guid.NewGuid().ToString("N")
            },
            CancellationToken.None);

        Assert.True(engine.IsPlaybackActive);
        Assert.True(engine.IsRendererRunning);
        Assert.Equal(250, accepted.DurationMs);
        var args = await started.Task.WaitAsync(TimeSpan.FromSeconds(3));
        Assert.Equal(accepted.PlaybackId, args.PlaybackId);

        await engine.StopPlaybackAsync(CancellationToken.None);
        Assert.False(engine.IsPlaybackActive);
    }
}
