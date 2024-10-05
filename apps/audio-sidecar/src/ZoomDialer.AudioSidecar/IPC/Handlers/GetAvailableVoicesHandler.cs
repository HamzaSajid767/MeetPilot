using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;
using ZoomDialer.AudioSidecar.Tts;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class GetAvailableVoicesHandler : IRequestHandler<MessageEnvelope>
{
    private readonly ITtsEngine _ttsEngine;
    private readonly ILogger<GetAvailableVoicesHandler> _logger;

    public GetAvailableVoicesHandler(ITtsEngine ttsEngine, ILogger<GetAvailableVoicesHandler> logger)
    {
        _ttsEngine = ttsEngine;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.GetAvailableVoices;

    public Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        try
        {
            var voices = _ttsEngine.ListVoices();
            var dto = new AvailableVoicesDto
            {
                Voices = voices
                    .Select(static voice => new TtsVoiceDto
                    {
                        Id = voice.Id,
                        DisplayName = voice.DisplayName,
                        Language = voice.Language,
                        Gender = voice.Gender
                    })
                    .ToArray()
            };

            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateSuccessResponse(
                    request,
                    ProtocolConstants.Commands.GetAvailableVoices,
                    dto));
        }
        catch (Exception ex)
        {
            _logger.LogError(SidecarLogEventIds.TtsFailed, ex, "GetAvailableVoices failed");
            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateErrorResponse(
                    request,
                    ProtocolConstants.ErrorCodes.TtsFailed,
                    "Unable to enumerate installed TTS voices.",
                    retriable: true));
        }
    }
}
