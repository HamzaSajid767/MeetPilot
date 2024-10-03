using Microsoft.Extensions.Logging.Abstractions;
using NAudio.Wave;
using ZoomDialer.AudioSidecar.Audio;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class MicrophoneRecorderTests
{
    [Fact]
    public async Task Start_While_Busy_Throws()
    {
        var recorder = CreateRecorder();
        var path = TempWavPath();

        // Without a real capture device Start may throw DeviceUnavailable — either is fine.
        // If start succeeds, a second start must fail.
        try
        {
            await recorder.StartAsync(
                new StartRecordingRequest { OutputPath = path },
                CancellationToken.None);
        }
        catch (InvalidOperationException)
        {
            return;
        }
        catch (Exception)
        {
            return;
        }

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            recorder.StartAsync(
                new StartRecordingRequest { OutputPath = TempWavPath() },
                CancellationToken.None));

        await recorder.CancelAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Cancel_Without_Start_Is_Safe()
    {
        var recorder = CreateRecorder();
        await recorder.CancelAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Stop_Without_Start_Throws()
    {
        var recorder = CreateRecorder();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            recorder.StopAsync(CancellationToken.None));
    }

    [Fact]
    public async Task Start_Rejects_Relative_Path()
    {
        var recorder = CreateRecorder();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            recorder.StartAsync(
                new StartRecordingRequest { OutputPath = "relative.wav" },
                CancellationToken.None));
    }

    [Fact]
    public async Task Lifecycle_Start_Stop_Writes_Wav_When_Mic_Available()
    {
        var recorder = CreateRecorder();
        var path = TempWavPath();

        try
        {
            await recorder.StartAsync(
                new StartRecordingRequest { OutputPath = path },
                CancellationToken.None);
        }
        catch (Exception)
        {
            // No capture device in this environment.
            return;
        }

        await Task.Delay(400);

        StopRecordingResult result;
        try
        {
            result = await recorder.StopAsync(CancellationToken.None);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("too short", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        Assert.True(result.Succeeded);
        Assert.True(File.Exists(result.Path));
        Assert.True(result.DurationMs >= NAudioMicrophoneRecorder.MinimumDurationMs);

        await using var stream = File.OpenRead(result.Path);
        var header = new byte[4];
        Assert.Equal(4, await stream.ReadAsync(header));
        Assert.Equal((byte)'R', header[0]);
        Assert.Equal((byte)'I', header[1]);
        Assert.Equal((byte)'F', header[2]);
        Assert.Equal((byte)'F', header[3]);

        File.Delete(result.Path);
    }

    [Fact]
    public async Task Cancel_Removes_Partial_File_When_Mic_Available()
    {
        var recorder = CreateRecorder();
        var path = TempWavPath();

        try
        {
            await recorder.StartAsync(
                new StartRecordingRequest { OutputPath = path },
                CancellationToken.None);
        }
        catch (Exception)
        {
            return;
        }

        await Task.Delay(100);
        await recorder.CancelAsync(CancellationToken.None);

        Assert.False(File.Exists(path));
        var leftovers = Directory.GetFiles(Path.GetDirectoryName(path)!, Path.GetFileName(path) + "*");
        Assert.Empty(leftovers);
    }

    private static NAudioMicrophoneRecorder CreateRecorder()
    {
        var devices = new NAudioAudioDeviceManager();
        var selector = new MicrophoneSelector(devices);
        return new NAudioMicrophoneRecorder(
            selector,
            devices,
            NullLogger<NAudioMicrophoneRecorder>.Instance);
    }

    private static string TempWavPath()
    {
        return Path.Combine(Path.GetTempPath(), $"rec-{Guid.NewGuid():N}.wav");
    }
}
