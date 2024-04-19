using System.Text;
using System.Text.Json;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC;

public sealed class JsonMessageSerializer : IMessageSerializer<MessageEnvelope>
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public byte[] Serialize(MessageEnvelope envelope)
    {
        ArgumentNullException.ThrowIfNull(envelope);
        return Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope, Options));
    }

    public MessageEnvelope Deserialize(ReadOnlySpan<byte> payload)
    {
        var envelope = JsonSerializer.Deserialize<MessageEnvelope>(payload, Options);
        if (envelope is null)
        {
            throw new InvalidDataException("Envelope JSON deserialized to null.");
        }

        if (string.IsNullOrWhiteSpace(envelope.Id)
            || string.IsNullOrWhiteSpace(envelope.Type)
            || string.IsNullOrWhiteSpace(envelope.ProtocolVersion)
            || string.IsNullOrWhiteSpace(envelope.Direction)
            || string.IsNullOrWhiteSpace(envelope.Timestamp))
        {
            throw new InvalidDataException("Envelope is missing one or more required fields.");
        }

        return envelope;
    }
}
