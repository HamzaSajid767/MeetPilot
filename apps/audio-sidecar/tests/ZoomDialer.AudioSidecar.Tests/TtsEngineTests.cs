using System.Speech.Synthesis;
using Microsoft.Extensions.Logging.Abstractions;
using ZoomDialer.AudioSidecar.Tts;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class TtsEngineTests
{
    [Fact]
    public void ListVoices_Returns_Installed_Enabled_Voices()
    {
        var engine = new WindowsSapiTtsEngine(NullLogger<WindowsSapiTtsEngine>.Instance);
        var voices = engine.ListVoices();

        using var synth = new SpeechSynthesizer();
        var expectedCount = synth.GetInstalledVoices().Count(static voice => voice.Enabled);
        Assert.Equal(expectedCount, voices.Count);

        if (voices.Count > 0)
        {
            Assert.False(string.IsNullOrWhiteSpace(voices[0].Id));
            Assert.False(string.IsNullOrWhiteSpace(voices[0].DisplayName));
        }
    }

    [Fact]
    public async Task Synthesize_Rejects_Empty_Text()
    {
        var engine = new WindowsSapiTtsEngine(NullLogger<WindowsSapiTtsEngine>.Instance);
        var path = Path.Combine(Path.GetTempPath(), $"tts-empty-{Guid.NewGuid():N}.wav");

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            engine.SynthesizeToFileAsync(
                new SynthesizeSpeechRequest
                {
                    Text = "   ",
                    Rate = 0,
                    Volume = 1,
                    OutputPath = path
                },
                CancellationToken.None));

        Assert.Contains("text", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Synthesize_Rejects_Invalid_Rate_And_Volume()
    {
        var engine = new WindowsSapiTtsEngine(NullLogger<WindowsSapiTtsEngine>.Instance);
        var path = Path.Combine(Path.GetTempPath(), $"tts-bad-{Guid.NewGuid():N}.wav");

        await Assert.ThrowsAsync<ArgumentException>(() =>
            engine.SynthesizeToFileAsync(
                new SynthesizeSpeechRequest
                {
                    Text = "hello",
                    Rate = 99,
                    Volume = 1,
                    OutputPath = path
                },
                CancellationToken.None));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            engine.SynthesizeToFileAsync(
                new SynthesizeSpeechRequest
                {
                    Text = "hello",
                    Rate = 0,
                    Volume = 2,
                    OutputPath = path
                },
                CancellationToken.None));
    }

    [Fact]
    public async Task Synthesize_Writes_Wav_When_Voice_Available()
    {
        var engine = new WindowsSapiTtsEngine(NullLogger<WindowsSapiTtsEngine>.Instance);
        var voices = engine.ListVoices();
        if (voices.Count == 0)
        {
            return;
        }

        var path = Path.Combine(Path.GetTempPath(), $"tts-ok-{Guid.NewGuid():N}.wav");
        try
        {
            var result = await engine.SynthesizeToFileAsync(
                new SynthesizeSpeechRequest
                {
                    Text = "Zoom dialer companion.",
                    VoiceId = voices[0].Id,
                    Rate = 0,
                    Volume = 0.8,
                    OutputPath = path
                },
                CancellationToken.None);

            Assert.True(File.Exists(result.Path));
            Assert.True(result.DurationMs > 0);

            await using var stream = File.OpenRead(result.Path);
            var header = new byte[4];
            Assert.Equal(4, await stream.ReadAsync(header));
            Assert.Equal((byte)'R', header[0]);
            Assert.Equal((byte)'I', header[1]);
            Assert.Equal((byte)'F', header[2]);
            Assert.Equal((byte)'F', header[3]);
        }
        finally
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
    }
}
