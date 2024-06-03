using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.IPC.Handlers;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class PlayAudioHandlerTests
{
    private static string FixturePath => Path.Combine(AppContext.BaseDirectory, "fixtures", "tone.wav");

    [Fact]
    public async Task Handler_Rejects_Invalid_Volume()
    {
        var handler = new PlayAudioHandler(
            TestPlaybackFactory.CreateEngine(),
            NullLogger<PlayAudioHandler>.Instance);

        var request = CreateRequest(new { path = FixturePath, volume = 1.5 });
        var response = await handler.HandleAsync(request, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(
            ProtocolConstants.ErrorCodes.InvalidMessage,
            response!.Payload!.Value.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Handler_Accepts_Valid_PlayAudio()
    {
        Assert.True(File.Exists(FixturePath), $"Missing fixture at {FixturePath}");
        await using var engine = TestPlaybackFactory.CreateEngine();
        var handler = new PlayAudioHandler(engine, NullLogger<PlayAudioHandler>.Instance);

        var request = CreateRequest(new { path = FixturePath, volume = 0.25 });
        var response = await handler.HandleAsync(request, CancellationToken.None);

        Assert.NotNull(response);
        Assert.True(response!.Payload!.Value.GetProperty("ok").GetBoolean());
        Assert.False(
            string.IsNullOrWhiteSpace(
                response.Payload.Value.GetProperty("data").GetProperty("phraseId").GetString()));

        await engine.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task StopPlayback_Handler_Succeeds_When_Idle()
    {
        await using var engine = TestPlaybackFactory.CreateEngine();
        var handler = new StopPlaybackHandler(engine);
        var request = new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = ProtocolConstants.Commands.StopPlayback,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Request,
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };

        var response = await handler.HandleAsync(request, CancellationToken.None);
        Assert.NotNull(response);
        Assert.True(response!.Payload!.Value.GetProperty("ok").GetBoolean());
    }

    private static MessageEnvelope CreateRequest(object payload)
    {
        return new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = ProtocolConstants.Commands.PlayAudio,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Request,
            CorrelationId = Guid.NewGuid().ToString("N"),
            Payload = JsonSerializer.SerializeToElement(payload),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };
    }
}
