using ZoomDialer.AudioSidecar.Contracts;

namespace ZoomDialer.AudioSidecar.Diagnostics;

public interface IHealthService
{
    Task<HealthSnapshot> GetSnapshotAsync(CancellationToken cancellationToken);
}

public sealed class HealthSnapshot
{
    public required EngineState EngineState { get; init; }

    public DateTimeOffset CapturedAt { get; init; }
}
