using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class StopPlaybackHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IPlaybackEngine _playbackEngine;

    public StopPlaybackHandler(IPlaybackEngine playbackEngine)
    {
        _playbackEngine = playbackEngine;
    }

    public string MessageType => ProtocolConstants.Commands.StopPlayback;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        var activeId = _playbackEngine.ActivePlaybackId;
        await _playbackEngine.StopAsync(cancellationToken).ConfigureAwait(false);

        return EnvelopeFactory.CreateSuccessResponse(
            request,
            ProtocolConstants.Commands.StopPlayback,
            new PlaybackResultDto
            {
                PhraseId = activeId ?? "none",
                Succeeded = true
            });
    }
}
