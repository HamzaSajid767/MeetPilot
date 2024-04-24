using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.IPC.Handlers;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class MessageDispatcherTests
{
    private readonly MessageDispatcher _dispatcher = new(
        [
            new PingHandler(),
            new GetVersionHandler(),
            new HealthCheckHandler()
        ],
        new ExactProtocolVersionValidator(),
        NullLogger<MessageDispatcher>.Instance);

    [Fact]
    public async Task Ping_Returns_Pong_With_Nonce()
    {
        var request = CreateRequest(
            ProtocolConstants.Commands.Ping,
            JsonSerializer.SerializeToElement(new { nonce = "abc123" }));

        var response = await _dispatcher.DispatchAsync(request, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(ProtocolConstants.Commands.Pong, response!.Type);
        Assert.Equal(ProtocolConstants.Directions.Response, response.Direction);
        Assert.Equal(request.Id, response.RequestId);
        Assert.Equal(request.CorrelationId, response.CorrelationId);
        Assert.True(response.Payload!.Value.GetProperty("ok").GetBoolean());
        Assert.Equal("abc123", response.Payload.Value.GetProperty("data").GetProperty("nonce").GetString());
    }

    [Fact]
    public async Task GetVersion_Returns_VersionInfoDto()
    {
        var request = CreateRequest(ProtocolConstants.Commands.GetVersion, null);

        var response = await _dispatcher.DispatchAsync(request, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(ProtocolConstants.Commands.GetVersion, response!.Type);
        var data = response.Payload!.Value.GetProperty("data");
        Assert.Equal(ProtocolConstants.ProtocolVersion, data.GetProperty("protocolVersion").GetString());
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("applicationVersion").GetString()));
    }

    [Fact]
    public async Task HealthCheck_Returns_Healthy_ApplicationState()
    {
        var request = CreateRequest(ProtocolConstants.Commands.HealthCheck, null);

        var response = await _dispatcher.DispatchAsync(request, CancellationToken.None);

        Assert.NotNull(response);
        var data = response!.Payload!.Value.GetProperty("data");
        Assert.True(data.GetProperty("isHealthy").GetBoolean());
        Assert.Equal(ProtocolConstants.EngineStates.Idle, data.GetProperty("engineState").GetString());
    }

    [Fact]
    public async Task Unsupported_Version_Is_Rejected()
    {
        var request = new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = ProtocolConstants.Commands.Ping,
            ProtocolVersion = "9.9.9",
            Direction = ProtocolConstants.Directions.Request,
            CorrelationId = Guid.NewGuid().ToString("N"),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };

        var response = await _dispatcher.DispatchAsync(request, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(
            ProtocolConstants.ErrorCodes.UnsupportedVersion,
            response!.Payload!.Value.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Unknown_Command_Is_Rejected()
    {
        var request = CreateRequest("NotARealCommand", null);

        var response = await _dispatcher.DispatchAsync(request, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(
            ProtocolConstants.ErrorCodes.InvalidMessage,
            response!.Payload!.Value.GetProperty("code").GetString());
    }

    private static MessageEnvelope CreateRequest(string type, JsonElement? payload)
    {
        return new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = type,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Request,
            CorrelationId = Guid.NewGuid().ToString("N"),
            Payload = payload,
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };
    }
}
