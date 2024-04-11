using System.Text.Json;

namespace ZoomDialer.AudioSidecar.Protocol;

public static class EnvelopeFactory
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public static MessageEnvelope CreateSuccessResponse(
        MessageEnvelope request,
        string responseType,
        object? data)
    {
        JsonElement? dataElement = data is null
            ? null
            : JsonSerializer.SerializeToElement(data, SerializerOptions);

        var success = new SuccessPayload
        {
            Ok = true,
            Data = dataElement
        };

        return new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = responseType,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Response,
            CorrelationId = request.CorrelationId,
            RequestId = request.Id,
            Payload = JsonSerializer.SerializeToElement(success, SerializerOptions),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };
    }

    public static MessageEnvelope CreateErrorResponse(
        MessageEnvelope? request,
        string code,
        string message,
        bool retriable)
    {
        var error = new ErrorPayload
        {
            Code = code,
            Message = message,
            Retriable = retriable
        };

        return new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = request?.Type ?? "Error",
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Response,
            CorrelationId = request?.CorrelationId,
            RequestId = request?.Id,
            Payload = JsonSerializer.SerializeToElement(error, SerializerOptions),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };
    }

    public static MessageEnvelope CreateEvent(
        string eventType,
        object payload,
        string? correlationId = null)
    {
        return new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = eventType,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Event,
            CorrelationId = correlationId,
            Payload = JsonSerializer.SerializeToElement(payload, SerializerOptions),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };
    }
}
