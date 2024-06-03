namespace ZoomDialer.AudioSidecar.Audio;

public sealed class PlaybackStartedArgs
{
    public required string PlaybackId { get; init; }

    public int? DurationMs { get; init; }
}

public sealed class PlaybackCompletedArgs
{
    public required string PlaybackId { get; init; }
}

public sealed class PlaybackFailedArgs
{
    public required string PlaybackId { get; init; }

    public required string Code { get; init; }

    public required string Message { get; init; }
}

public sealed class PlayAudioRequest
{
    public required string Path { get; init; }

    public required double Volume { get; init; }

    public required string PlaybackId { get; init; }
}

public sealed class PlayAudioAccepted
{
    public required string PlaybackId { get; init; }

    public int? DurationMs { get; init; }

    public required string OutputDeviceId { get; init; }

    public required string OutputDeviceName { get; init; }

    public required bool UsedFallbackDevice { get; init; }

    public string? FallbackReason { get; init; }
}

public interface IPlaybackEngine : IAsyncDisposable
{
    event EventHandler<PlaybackStartedArgs>? PlaybackStarted;

    event EventHandler<PlaybackCompletedArgs>? PlaybackCompleted;

    event EventHandler<PlaybackFailedArgs>? PlaybackFailed;

    string? ActivePlaybackId { get; }

    Task<PlayAudioAccepted> PlayAsync(PlayAudioRequest request, CancellationToken cancellationToken);

    Task StopAsync(CancellationToken cancellationToken);
}
