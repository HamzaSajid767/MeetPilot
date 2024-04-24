using System.IO.Pipes;
using System.Text.Json;
using ZoomDialer.AudioSidecar;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class NamedPipeServerTests
{
    [Fact]
    public async Task Server_Handles_Ping_And_Allows_Reconnect()
    {
        var pipeName = $"ZoomDialerTest-{Guid.NewGuid():N}";
        using var host = SidecarHostFactory.Create(["--pipe-name", pipeName]);

        await host.StartAsync();
        try
        {
            var first = await SendPingAsync(pipeName, "one");
            Assert.Equal("one", first);

            var second = await SendPingAsync(pipeName, "two");
            Assert.Equal("two", second);
        }
        finally
        {
            await host.StopAsync();
        }
    }

    [Fact]
    public async Task Server_Stops_Gracefully_Without_Client()
    {
        var pipeName = $"ZoomDialerTest-{Guid.NewGuid():N}";
        using var host = SidecarHostFactory.Create(["--pipe-name", pipeName]);

        await host.StartAsync();
        await Task.Delay(200);
        await host.StopAsync();
    }

    private static async Task<string> SendPingAsync(string pipeName, string nonce)
    {
        await using var client = new NamedPipeClientStream(
            ".",
            pipeName,
            PipeDirection.InOut,
            PipeOptions.Asynchronous);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await ConnectWithRetryAsync(client, cts.Token);

        var request = new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = ProtocolConstants.Commands.Ping,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Request,
            CorrelationId = Guid.NewGuid().ToString("N"),
            Payload = JsonSerializer.SerializeToElement(new { nonce }),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };

        var serializer = new JsonMessageSerializer();
        var payload = serializer.Serialize(request);
        await LengthPrefixFrameCodec.WriteFrameAsync(client, payload, cts.Token);

        var responseBytes = await LengthPrefixFrameCodec.ReadFrameAsync(
            client,
            ProtocolConstants.MaxPayloadBytes,
            cts.Token);
        Assert.NotNull(responseBytes);

        var response = serializer.Deserialize(responseBytes!);
        Assert.Equal(ProtocolConstants.Commands.Pong, response.Type);
        Assert.Equal(request.Id, response.RequestId);
        Assert.True(response.Payload!.Value.GetProperty("ok").GetBoolean());
        return response.Payload.Value.GetProperty("data").GetProperty("nonce").GetString() ?? string.Empty;
    }

    private static async Task ConnectWithRetryAsync(NamedPipeClientStream client, CancellationToken cancellationToken)
    {
        Exception? last = null;
        for (var attempt = 0; attempt < 40; attempt++)
        {
            try
            {
                await client.ConnectAsync(250, cancellationToken).ConfigureAwait(false);
                return;
            }
            catch (Exception ex) when (ex is TimeoutException or IOException or UnauthorizedAccessException)
            {
                last = ex;
                await Task.Delay(50, cancellationToken).ConfigureAwait(false);
            }
        }

        throw new InvalidOperationException("Unable to connect to the named pipe server.", last);
    }
}
