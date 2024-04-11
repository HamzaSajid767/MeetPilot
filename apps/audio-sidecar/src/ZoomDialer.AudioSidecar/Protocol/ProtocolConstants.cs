namespace ZoomDialer.AudioSidecar.Protocol;

/// <summary>
/// Sourced from packages/shared-protocol/schema/protocol.constants.json.
/// </summary>
public static class ProtocolConstants
{
    public const string ProtocolVersion = "1.0.0";

    public const string MinimumSupportedProtocolVersion = "1.0.0";

    public const int MaxPayloadBytes = 1_048_576;

    public const int MaxMessageNameLength = 128;

    public const int MaxCorrelationIdLength = 64;

    public const int DefaultRequestTimeoutMilliseconds = 10_000;

    public static class Commands
    {
        public const string Ping = "Ping";

        public const string Pong = "Pong";

        public const string HealthCheck = "HealthCheck";

        public const string GetVersion = "GetVersion";

        public const string PlayAudio = "PlayAudio";

        public const string StopPlayback = "StopPlayback";

        public const string GetAudioOutputDevices = "GetAudioOutputDevices";

        public const string SetOutputDevice = "SetOutputDevice";

        public const string GetAudioInputDevices = "GetAudioInputDevices";

        public const string SetMicrophone = "SetMicrophone";

        public const string StartMicrophone = "StartMicrophone";

        public const string StopMicrophone = "StopMicrophone";

        public const string SetMixerGains = "SetMixerGains";

        public const string PlayTestTone = "PlayTestTone";

        public const string GetAvailableVoices = "GetAvailableVoices";

        public const string SynthesizeSpeech = "SynthesizeSpeech";

        public const string StartRecording = "StartRecording";

        public const string StopRecording = "StopRecording";

        public const string CancelRecording = "CancelRecording";
    }

    public static class Events
    {
        public const string PlaybackStarted = "PlaybackStarted";

        public const string PlaybackCompleted = "PlaybackCompleted";

        public const string PlaybackFailed = "PlaybackFailed";

        public const string MicrophoneStarted = "MicrophoneStarted";

        public const string MicrophoneStopped = "MicrophoneStopped";

        public const string MicrophoneFailed = "MicrophoneFailed";

        public const string AudioLevels = "AudioLevels";
    }

    public static class Directions
    {
        public const string Request = "request";

        public const string Response = "response";

        public const string Event = "event";
    }

    public static class ErrorCodes
    {
        public const string UnknownError = "UnknownError";

        public const string InvalidMessage = "InvalidMessage";

        public const string UnsupportedVersion = "UnsupportedVersion";

        public const string Timeout = "Timeout";

        public const string DeviceUnavailable = "DeviceUnavailable";

        public const string PlaybackFailed = "PlaybackFailed";

        public const string TtsFailed = "TtsFailed";

        public const string RecordingFailed = "RecordingFailed";

        public const string InternalError = "InternalError";
    }

    public static class DeviceStates
    {
        public const string Active = "Active";

        public const string Disabled = "Disabled";

        public const string NotPresent = "NotPresent";

        public const string Unplugged = "Unplugged";
    }

    public static class EngineStates
    {
        public const string Idle = "Idle";
    }
}
