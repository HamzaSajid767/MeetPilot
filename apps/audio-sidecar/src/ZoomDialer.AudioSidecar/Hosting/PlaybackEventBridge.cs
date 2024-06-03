using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Hosting;

public sealed class PlaybackEventBridge : IHostedService
{
    private readonly IAudioMixEngine _mixEngine;
    private readonly IAudioPipeServer _pipeServer;
    private readonly ILogger<PlaybackEventBridge> _logger;

    public PlaybackEventBridge(
        IAudioMixEngine mixEngine,
        IAudioPipeServer pipeServer,
        ILogger<PlaybackEventBridge> logger)
    {
        _mixEngine = mixEngine;
        _pipeServer = pipeServer;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _mixEngine.PlaybackStarted += OnPlaybackStarted;
        _mixEngine.PlaybackCompleted += OnPlaybackCompleted;
        _mixEngine.PlaybackFailed += OnPlaybackFailed;
        _mixEngine.MicrophoneStarted += OnMicrophoneStarted;
        _mixEngine.MicrophoneStopped += OnMicrophoneStopped;
        _mixEngine.MicrophoneFailed += OnMicrophoneFailed;
        _mixEngine.LevelsUpdated += OnLevelsUpdated;
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _mixEngine.PlaybackStarted -= OnPlaybackStarted;
        _mixEngine.PlaybackCompleted -= OnPlaybackCompleted;
        _mixEngine.PlaybackFailed -= OnPlaybackFailed;
        _mixEngine.MicrophoneStarted -= OnMicrophoneStarted;
        _mixEngine.MicrophoneStopped -= OnMicrophoneStopped;
        _mixEngine.MicrophoneFailed -= OnMicrophoneFailed;
        _mixEngine.LevelsUpdated -= OnLevelsUpdated;
        return Task.CompletedTask;
    }

    private void OnPlaybackStarted(object? sender, PlaybackStartedArgs args)
    {
        _ = SendAsync(
            EnvelopeFactory.CreateEvent(
                ProtocolConstants.Events.PlaybackStarted,
                new PlaybackStartedEvent
                {
                    PhraseId = args.PlaybackId,
                    DurationMs = args.DurationMs
                }));
    }

    private void OnPlaybackCompleted(object? sender, PlaybackCompletedArgs args)
    {
        _ = SendAsync(
            EnvelopeFactory.CreateEvent(
                ProtocolConstants.Events.PlaybackCompleted,
                new PlaybackCompletedEvent { PhraseId = args.PlaybackId }));
    }

    private void OnPlaybackFailed(object? sender, PlaybackFailedArgs args)
    {
        _ = SendAsync(
            EnvelopeFactory.CreateEvent(
                ProtocolConstants.Events.PlaybackFailed,
                new PlaybackFailedEvent
                {
                    PhraseId = args.PlaybackId,
                    Code = args.Code,
                    Message = args.Message
                }));
    }

    private void OnMicrophoneStarted(object? sender, MicrophoneStartedArgs args)
    {
        _ = SendAsync(
            EnvelopeFactory.CreateEvent(
                ProtocolConstants.Events.MicrophoneStarted,
                new MicrophoneStartedEvent
                {
                    DeviceId = args.DeviceId,
                    FriendlyName = args.FriendlyName
                }));
    }

    private void OnMicrophoneStopped(object? sender, MicrophoneStoppedArgs args)
    {
        _ = SendAsync(
            EnvelopeFactory.CreateEvent(
                ProtocolConstants.Events.MicrophoneStopped,
                new MicrophoneStoppedEvent { Reason = args.Reason }));
    }

    private void OnMicrophoneFailed(object? sender, MicrophoneFailedArgs args)
    {
        _ = SendAsync(
            EnvelopeFactory.CreateEvent(
                ProtocolConstants.Events.MicrophoneFailed,
                new MicrophoneFailedEvent
                {
                    Code = args.Code,
                    Message = args.Message
                }));
    }

    private void OnLevelsUpdated(object? sender, AudioLevelsArgs args)
    {
        _ = SendAsync(
            EnvelopeFactory.CreateEvent(
                ProtocolConstants.Events.AudioLevels,
                new AudioLevelsDto
                {
                    MicrophonePeak = args.Levels.MicrophonePeak,
                    MicrophoneRms = args.Levels.MicrophoneRms,
                    PlaybackPeak = args.Levels.PlaybackPeak,
                    PlaybackRms = args.Levels.PlaybackRms,
                    OutputPeak = args.Levels.OutputPeak,
                    OutputRms = args.Levels.OutputRms,
                    MicrophoneClipped = args.Levels.MicrophoneClipped,
                    PlaybackClipped = args.Levels.PlaybackClipped,
                    OutputClipped = args.Levels.OutputClipped
                }));
    }

    private async Task SendAsync(MessageEnvelope envelope)
    {
        try
        {
            await _pipeServer.SendEventAsync(envelope, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                SidecarLogEventIds.PipeFaulted,
                ex,
                "Failed to publish event {EventType}",
                envelope.Type);
        }
    }
}
