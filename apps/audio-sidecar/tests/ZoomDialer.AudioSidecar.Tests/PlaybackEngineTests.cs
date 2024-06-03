using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class PlaybackEngineTests
{
    private static string FixturePath => Path.Combine(AppContext.BaseDirectory, "fixtures", "tone.wav");

    [Fact]
    public async Task Play_Rejects_Missing_File()
    {
        await using var engine = TestPlaybackFactory.CreateEngine();

        await Assert.ThrowsAsync<FileNotFoundException>(() =>
            engine.PlayAsync(
                new PlayAudioRequest
                {
                    Path = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.wav"),
                    Volume = 0.5,
                    PlaybackId = Guid.NewGuid().ToString("N")
                },
                CancellationToken.None));
    }

    [Fact]
    public async Task Play_Rejects_Non_Wav_Extension()
    {
        await using var engine = TestPlaybackFactory.CreateEngine();
        var temp = Path.Combine(Path.GetTempPath(), $"not-wav-{Guid.NewGuid():N}.mp3");
        await File.WriteAllTextAsync(temp, "nope");

        try
        {
            await Assert.ThrowsAsync<ArgumentException>(() =>
                engine.PlayAsync(
                    new PlayAudioRequest
                    {
                        Path = temp,
                        Volume = 0.5,
                        PlaybackId = Guid.NewGuid().ToString("N")
                    },
                    CancellationToken.None));
        }
        finally
        {
            File.Delete(temp);
        }
    }

    [Fact]
    public async Task Play_Emits_Started_And_Completed()
    {
        Assert.True(File.Exists(FixturePath), $"Missing fixture at {FixturePath}");
        await using var engine = TestPlaybackFactory.CreateEngine();

        var started = new TaskCompletionSource<PlaybackStartedArgs>(TaskCreationOptions.RunContinuationsAsynchronously);
        var completed = new TaskCompletionSource<PlaybackCompletedArgs>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.PlaybackStarted += (_, args) => started.TrySetResult(args);
        engine.PlaybackCompleted += (_, args) => completed.TrySetResult(args);

        var playbackId = Guid.NewGuid().ToString("N");
        var accepted = await engine.PlayAsync(
            new PlayAudioRequest
            {
                Path = FixturePath,
                Volume = 0.2,
                PlaybackId = playbackId
            },
            CancellationToken.None);

        Assert.Equal(playbackId, accepted.PlaybackId);
        Assert.True(accepted.DurationMs is > 0);

        var startedArgs = await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(playbackId, startedArgs.PlaybackId);

        var completedArgs = await completed.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(playbackId, completedArgs.PlaybackId);
    }

    [Fact]
    public async Task Second_Play_Stop_And_Replaces()
    {
        Assert.True(File.Exists(FixturePath), $"Missing fixture at {FixturePath}");
        await using var engine = TestPlaybackFactory.CreateEngine();

        var completedIds = new List<string>();
        var gate = new object();
        var secondStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        engine.PlaybackCompleted += (_, args) =>
        {
            lock (gate)
            {
                completedIds.Add(args.PlaybackId);
            }
        };
        engine.PlaybackStarted += (_, args) =>
        {
            if (args.PlaybackId.EndsWith("2", StringComparison.Ordinal))
            {
                secondStarted.TrySetResult();
            }
        };

        var firstId = Guid.NewGuid().ToString("N") + "1";
        var secondId = Guid.NewGuid().ToString("N") + "2";

        await engine.PlayAsync(
            new PlayAudioRequest { Path = FixturePath, Volume = 0.2, PlaybackId = firstId },
            CancellationToken.None);

        await engine.PlayAsync(
            new PlayAudioRequest { Path = FixturePath, Volume = 0.2, PlaybackId = secondId },
            CancellationToken.None);

        await secondStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(secondId, engine.ActivePlaybackId);

        await engine.StopAsync(CancellationToken.None);
        await Task.Delay(200);

        lock (gate)
        {
            Assert.Contains(firstId, completedIds);
            Assert.Contains(secondId, completedIds);
        }
    }

    [Fact]
    public async Task Stop_While_Idle_Succeeds()
    {
        await using var engine = TestPlaybackFactory.CreateEngine();
        await engine.StopAsync(CancellationToken.None);
        Assert.Null(engine.ActivePlaybackId);
    }
}
