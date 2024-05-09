using System.Text.Json;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class PingHandler : IRequestHandler<MessageEnvelope>
{
    public string MessageType => ProtocolConstants.Commands.Ping;

    public Task<MessageEnvelope?> HandleAsync(MessageEnvelope request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        string nonce = string.Empty;
        if (request.Payload is { } payload && payload.ValueKind == JsonValueKind.Object)
        {
            if (payload.TryGetProperty("nonce", out var nonceElement)
                && nonceElement.ValueKind is JsonValueKind.String or JsonValueKind.Null)
            {
                nonce = nonceElement.ValueKind == JsonValueKind.String
                    ? nonceElement.GetString() ?? string.Empty
                    : string.Empty;
            }
        }

        var response = EnvelopeFactory.CreateSuccessResponse(
            request,
            ProtocolConstants.Commands.Pong,
            new PongCommand { Nonce = nonce });

        return Task.FromResult<MessageEnvelope?>(response);
    }
}
