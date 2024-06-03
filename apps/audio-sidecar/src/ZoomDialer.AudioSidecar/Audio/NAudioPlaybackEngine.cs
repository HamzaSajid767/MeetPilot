using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Logging;

namespace ZoomDialer.AudioSidecar.Audio;

/// <summary>
/// Thin adapter keeping IPlaybackEngine while routing through the mix engine.
/// </summary>
public sealed class NAudioPlaybackEngine : IPlaybackEngine
{
    private readonly IAudioMixEngine _mixEngine;
    private readonly ILogger<NAudioPlaybackEngine> _logger;

    public NAudioPlaybackEngine(IAudioMixEngine mixEngine, ILogger<NAudioPlaybackEngine> logger)
    {
        _mixEngine = mixEngine;
        _logger = logger;
        _mixEngine.PlaybackStarted += (_, args) => PlaybackStarted?.Invoke(this, args);
        _mixEngine.PlaybackCompleted += (_, args) => PlaybackCompleted?.Invoke(this, args);
        _mixEngine.PlaybackFailed += (_, args) => PlaybackFailed?.Invoke(this, args);
    }

    public event EventHandler<PlaybackStartedArgs>? PlaybackStarted;

    public event EventHandler<PlaybackCompletedArgs>? PlaybackCompleted;

    public event EventHandler<PlaybackFailedArgs>? PlaybackFailed;

    public string? ActivePlaybackId => _mixEngine.ActivePlaybackId;

    public Task<PlayAudioAccepted> PlayAsync(PlayAudioRequest request, CancellationToken cancellationToken)
    {
        _logger.LogDebug(SidecarLogEventIds.PlaybackStarted, "Delegating PlayAudio to mix engine");
        return _mixEngine.PlayAsync(request, cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken)
        => _mixEngine.StopPlaybackAsync(cancellationToken);

    public ValueTask DisposeAsync()
    {
        // Mix engine lifetime is owned by DI.
        return ValueTask.CompletedTask;
    }
}
