namespace ZoomDialer.AudioSidecar.Audio;

public sealed class StartRecordingRequest
{
    public required string OutputPath { get; init; }

    public string? DeviceId { get; init; }
}

public sealed class StopRecordingResult
{
    public required string Path { get; init; }

    public required int DurationMs { get; init; }

    public required bool Succeeded { get; init; }
}

public interface IMicrophoneRecorder
{
    bool IsRecording { get; }

    Task StartAsync(StartRecordingRequest request, CancellationToken cancellationToken);

    Task<StopRecordingResult> StopAsync(CancellationToken cancellationToken);

    Task CancelAsync(CancellationToken cancellationToken);
}
