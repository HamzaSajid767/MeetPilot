using System.Text.Json;
using System.Text.Json.Serialization;

namespace ZoomDialer.AudioSidecar.Protocol;

/// <summary>
/// Sourced from packages/shared-protocol/schema/envelope.schema.json.
/// </summary>
public sealed class MessageEnvelope
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("protocolVersion")]
    public required string ProtocolVersion { get; init; }

    [JsonPropertyName("direction")]
    public required string Direction { get; init; }

    [JsonPropertyName("correlationId")]
    public string? CorrelationId { get; init; }

    [JsonPropertyName("requestId")]
    public string? RequestId { get; init; }

    [JsonPropertyName("payload")]
    public JsonElement? Payload { get; init; }

    [JsonPropertyName("ts")]
    public required string Timestamp { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/envelope.schema.json SuccessEnvelope.
/// </summary>
public sealed class SuccessPayload
{
    [JsonPropertyName("ok")]
    public bool Ok { get; init; } = true;

    [JsonPropertyName("data")]
    public JsonElement? Data { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/envelope.schema.json ErrorEnvelope.
/// </summary>
public sealed class ErrorPayload
{
    [JsonPropertyName("code")]
    public required string Code { get; init; }

    [JsonPropertyName("message")]
    public required string Message { get; init; }

    [JsonPropertyName("retriable")]
    public required bool Retriable { get; init; }

    [JsonPropertyName("details")]
    public JsonElement? Details { get; init; }
}
