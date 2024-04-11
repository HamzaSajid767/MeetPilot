using System.Text.Json.Serialization;

namespace ZoomDialer.AudioSidecar.Protocol;

/// <summary>
/// Sourced from packages/shared-protocol/schema/dtos.schema.json.
/// </summary>
public sealed class VersionInfoDto
{
    [JsonPropertyName("protocolVersion")]
    public required string ProtocolVersion { get; init; }

    [JsonPropertyName("applicationVersion")]
    public required string ApplicationVersion { get; init; }

    [JsonPropertyName("minimumSupportedVersion")]
    public string? MinimumSupportedVersion { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/dtos.schema.json.
/// </summary>
public sealed class ApplicationStateDto
{
    [JsonPropertyName("engineState")]
    public required string EngineState { get; init; }

    [JsonPropertyName("isHealthy")]
    public required bool IsHealthy { get; init; }

    [JsonPropertyName("detail")]
    public string? Detail { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/commands.schema.json.
/// </summary>
public sealed class PingCommand
{
    [JsonPropertyName("nonce")]
    public string? Nonce { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/commands.schema.json.
/// </summary>
public sealed class PongCommand
{
    [JsonPropertyName("nonce")]
    public required string Nonce { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/commands.schema.json.
/// </summary>
public sealed class PlayAudioCommand
{
    [JsonPropertyName("path")]
    public required string Path { get; init; }

    [JsonPropertyName("volume")]
    public required double Volume { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/dtos.schema.json.
/// </summary>
public sealed class PlaybackResultDto
{
    [JsonPropertyName("phraseId")]
    public required string PhraseId { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }

    [JsonPropertyName("durationMs")]
    public int? DurationMs { get; init; }

    [JsonPropertyName("errorCode")]
    public string? ErrorCode { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/dtos.schema.json.
/// </summary>
public sealed class AudioOutputDeviceDto
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("friendlyName")]
    public required string FriendlyName { get; init; }

    [JsonPropertyName("isDefault")]
    public required bool IsDefault { get; init; }

    [JsonPropertyName("deviceState")]
    public required string DeviceState { get; init; }

    [JsonPropertyName("supportsPlayback")]
    public required bool SupportsPlayback { get; init; }

    [JsonPropertyName("isVirtualDevice")]
    public required bool IsVirtualDevice { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/dtos.schema.json.
/// </summary>
public sealed class AudioOutputDeviceListDto
{
    [JsonPropertyName("devices")]
    public required IReadOnlyList<AudioOutputDeviceDto> Devices { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/dtos.schema.json.
/// </summary>
public sealed class SetOutputDeviceResultDto
{
    [JsonPropertyName("deviceId")]
    public required string DeviceId { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }

    [JsonPropertyName("friendlyName")]
    public string? FriendlyName { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/dtos.schema.json.
/// </summary>
public sealed class PlayAudioResultDto
{
    [JsonPropertyName("phraseId")]
    public required string PhraseId { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }

    [JsonPropertyName("durationMs")]
    public int? DurationMs { get; init; }

    [JsonPropertyName("outputDeviceId")]
    public string? OutputDeviceId { get; init; }

    [JsonPropertyName("outputDeviceName")]
    public string? OutputDeviceName { get; init; }

    [JsonPropertyName("usedFallbackDevice")]
    public bool? UsedFallbackDevice { get; init; }

    [JsonPropertyName("fallbackReason")]
    public string? FallbackReason { get; init; }

    [JsonPropertyName("errorCode")]
    public string? ErrorCode { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/events.schema.json.
/// </summary>
public sealed class PlaybackStartedEvent
{
    [JsonPropertyName("phraseId")]
    public required string PhraseId { get; init; }

    [JsonPropertyName("durationMs")]
    public int? DurationMs { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/events.schema.json.
/// </summary>
public sealed class PlaybackCompletedEvent
{
    [JsonPropertyName("phraseId")]
    public required string PhraseId { get; init; }
}

/// <summary>
/// Sourced from packages/shared-protocol/schema/events.schema.json.
/// </summary>
public sealed class PlaybackFailedEvent
{
    [JsonPropertyName("phraseId")]
    public required string PhraseId { get; init; }

    [JsonPropertyName("code")]
    public required string Code { get; init; }

    [JsonPropertyName("message")]
    public required string Message { get; init; }
}

public sealed class AudioInputDeviceDto
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("friendlyName")]
    public required string FriendlyName { get; init; }

    [JsonPropertyName("isDefault")]
    public required bool IsDefault { get; init; }

    [JsonPropertyName("deviceState")]
    public required string DeviceState { get; init; }

    [JsonPropertyName("supportsCapture")]
    public required bool SupportsCapture { get; init; }

    [JsonPropertyName("isVirtualDevice")]
    public required bool IsVirtualDevice { get; init; }
}

public sealed class AudioInputDeviceListDto
{
    [JsonPropertyName("devices")]
    public required IReadOnlyList<AudioInputDeviceDto> Devices { get; init; }
}

public sealed class SetMicrophoneResultDto
{
    [JsonPropertyName("deviceId")]
    public required string DeviceId { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }

    [JsonPropertyName("friendlyName")]
    public string? FriendlyName { get; init; }
}

public sealed class SetMixerGainsResultDto
{
    [JsonPropertyName("microphoneGain")]
    public required double MicrophoneGain { get; init; }

    [JsonPropertyName("playbackGain")]
    public required double PlaybackGain { get; init; }

    [JsonPropertyName("masterGain")]
    public required double MasterGain { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }
}

public sealed class AudioLevelsDto
{
    [JsonPropertyName("microphonePeak")]
    public required double MicrophonePeak { get; init; }

    [JsonPropertyName("microphoneRms")]
    public required double MicrophoneRms { get; init; }

    [JsonPropertyName("playbackPeak")]
    public required double PlaybackPeak { get; init; }

    [JsonPropertyName("playbackRms")]
    public required double PlaybackRms { get; init; }

    [JsonPropertyName("outputPeak")]
    public required double OutputPeak { get; init; }

    [JsonPropertyName("outputRms")]
    public required double OutputRms { get; init; }

    [JsonPropertyName("microphoneClipped")]
    public required bool MicrophoneClipped { get; init; }

    [JsonPropertyName("playbackClipped")]
    public required bool PlaybackClipped { get; init; }

    [JsonPropertyName("outputClipped")]
    public required bool OutputClipped { get; init; }
}

public sealed class PlayTestToneResultDto
{
    [JsonPropertyName("playbackId")]
    public required string PlaybackId { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }

    [JsonPropertyName("durationMs")]
    public int? DurationMs { get; init; }

    [JsonPropertyName("kind")]
    public required string Kind { get; init; }
}

public sealed class MicrophoneStartedEvent
{
    [JsonPropertyName("deviceId")]
    public required string DeviceId { get; init; }

    [JsonPropertyName("friendlyName")]
    public string? FriendlyName { get; init; }
}

public sealed class MicrophoneStoppedEvent
{
    [JsonPropertyName("reason")]
    public string? Reason { get; init; }
}

public sealed class MicrophoneFailedEvent
{
    [JsonPropertyName("code")]
    public required string Code { get; init; }

    [JsonPropertyName("message")]
    public required string Message { get; init; }
}

public sealed class TtsVoiceDto
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("displayName")]
    public required string DisplayName { get; init; }

    [JsonPropertyName("language")]
    public required string Language { get; init; }

    [JsonPropertyName("gender")]
    public string? Gender { get; init; }
}

public sealed class AvailableVoicesDto
{
    [JsonPropertyName("voices")]
    public required IReadOnlyList<TtsVoiceDto> Voices { get; init; }
}

public sealed class SynthesizeSpeechCommand
{
    [JsonPropertyName("text")]
    public required string Text { get; init; }

    [JsonPropertyName("voiceId")]
    public string? VoiceId { get; init; }

    [JsonPropertyName("rate")]
    public required int Rate { get; init; }

    [JsonPropertyName("volume")]
    public required double Volume { get; init; }

    [JsonPropertyName("outputPath")]
    public required string OutputPath { get; init; }
}

public sealed class SynthesizeSpeechResultDto
{
    [JsonPropertyName("path")]
    public required string Path { get; init; }

    [JsonPropertyName("durationMs")]
    public required int DurationMs { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }
}

public sealed class StartRecordingCommand
{
    [JsonPropertyName("outputPath")]
    public required string OutputPath { get; init; }

    [JsonPropertyName("deviceId")]
    public string? DeviceId { get; init; }
}

public sealed class StartRecordingResultDto
{
    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }
}

public sealed class StopRecordingResultDto
{
    [JsonPropertyName("path")]
    public required string Path { get; init; }

    [JsonPropertyName("durationMs")]
    public required int DurationMs { get; init; }

    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }
}

public sealed class CancelRecordingResultDto
{
    [JsonPropertyName("succeeded")]
    public required bool Succeeded { get; init; }
}
