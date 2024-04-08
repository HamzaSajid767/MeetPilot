using Microsoft.Extensions.Logging;

namespace ZoomDialer.AudioSidecar.Logging;

public static class SidecarLogEventIds
{
    public static readonly EventId HostStarting = new(1000, "host.starting");

    public static readonly EventId HostStarted = new(1001, "host.started");

    public static readonly EventId HostStopping = new(1002, "host.stopping");

    public static readonly EventId HostStopped = new(1003, "host.stopped");

    public static readonly EventId HostFaulted = new(1004, "host.faulted");

    public static readonly EventId AppDataReady = new(1005, "app.data_ready");

    public static readonly EventId SmokeSucceeded = new(1006, "host.smoke_succeeded");

    public static readonly EventId PipeListening = new(1100, "pipe.listening");

    public static readonly EventId PipeClientConnected = new(1101, "pipe.client_connected");

    public static readonly EventId PipeClientDisconnected = new(1102, "pipe.client_disconnected");

    public static readonly EventId PipeMalformedFrame = new(1103, "pipe.malformed_frame");

    public static readonly EventId PipeVersionRejected = new(1104, "pipe.version_rejected");

    public static readonly EventId PipeUnknownCommand = new(1105, "pipe.unknown_command");

    public static readonly EventId PipeHandlerFaulted = new(1106, "pipe.handler_faulted");

    public static readonly EventId PipeFaulted = new(1107, "pipe.faulted");

    public static readonly EventId PipeStopped = new(1108, "pipe.stopped");

    public static readonly EventId PlaybackStarted = new(1200, "playback.started");

    public static readonly EventId PlaybackCompleted = new(1201, "playback.completed");

    public static readonly EventId PlaybackFailed = new(1202, "playback.failed");

    public static readonly EventId PlaybackRejected = new(1203, "playback.rejected");

    public static readonly EventId OutputDeviceSelected = new(1210, "output.device_selected");

    public static readonly EventId OutputDeviceRejected = new(1211, "output.device_rejected");

    public static readonly EventId OutputDeviceFallback = new(1212, "output.device_fallback");

    public static readonly EventId OutputDeviceVirtualDetected = new(1213, "output.device_virtual_detected");

    public static readonly EventId MicrophoneStarted = new(1220, "microphone.started");

    public static readonly EventId MicrophoneStopped = new(1221, "microphone.stopped");

    public static readonly EventId MicrophoneFailed = new(1222, "microphone.failed");

    public static readonly EventId MixRendererFaulted = new(1230, "mix.renderer_faulted");

    public static readonly EventId TtsSynthesized = new(1240, "tts.synthesized");

    public static readonly EventId TtsFailed = new(1241, "tts.failed");

    public static readonly EventId TtsRejected = new(1242, "tts.rejected");

    public static readonly EventId RecordingStarted = new(1250, "recording.started");

    public static readonly EventId RecordingStopped = new(1251, "recording.stopped");

    public static readonly EventId RecordingCancelled = new(1252, "recording.cancelled");

    public static readonly EventId RecordingFailed = new(1253, "recording.failed");

    public static readonly EventId RecordingRejected = new(1254, "recording.rejected");
}
