using System.Text.Json;
using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;
using ZoomDialer.AudioSidecar.Tts;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class SynthesizeSpeechHandler : IRequestHandler<MessageEnvelope>
{
    private readonly ITtsEngine _ttsEngine;
    private readonly ILogger<SynthesizeSpeechHandler> _logger;

    public SynthesizeSpeechHandler(ITtsEngine ttsEngine, ILogger<SynthesizeSpeechHandler> logger)
    {
        _ttsEngine = ttsEngine;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.SynthesizeSpeech;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        if (!TryParseCommand(request, out var command, out var errorMessage))
        {
            _logger.LogWarning(
                SidecarLogEventIds.TtsRejected,
                "Rejected SynthesizeSpeech: {Reason}",
                errorMessage);
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                errorMessage!,
                retriable: false);
        }

        try
        {
            var result = await _ttsEngine
                .SynthesizeToFileAsync(
                    new SynthesizeSpeechRequest
                    {
                        Text = command!.Text,
                        VoiceId = command.VoiceId,
                        Rate = command.Rate,
                        Volume = command.Volume,
                        OutputPath = command.OutputPath
                    },
                    cancellationToken)
                .ConfigureAwait(false);

            return EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.SynthesizeSpeech,
                new SynthesizeSpeechResultDto
                {
                    Path = result.Path,
                    DurationMs = result.DurationMs,
                    Succeeded = true
                });
        }
        catch (ArgumentException ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                ex.Message,
                retriable: false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(SidecarLogEventIds.TtsFailed, ex, "SynthesizeSpeech failed");
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.TtsFailed,
                ex.Message,
                retriable: true);
        }
    }

    private static bool TryParseCommand(
        MessageEnvelope request,
        out SynthesizeSpeechCommand? command,
        out string? errorMessage)
    {
        command = null;
        errorMessage = null;

        if (request.Payload is not { } payload || payload.ValueKind != JsonValueKind.Object)
        {
            errorMessage = "SynthesizeSpeech payload is required.";
            return false;
        }

        if (!payload.TryGetProperty("text", out var textElement)
            || textElement.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(textElement.GetString()))
        {
            errorMessage = "SynthesizeSpeech.text must be a non-empty string.";
            return false;
        }

        if (!payload.TryGetProperty("outputPath", out var pathElement)
            || pathElement.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(pathElement.GetString()))
        {
            errorMessage = "SynthesizeSpeech.outputPath must be a non-empty string.";
            return false;
        }

        var rate = 0;
        if (payload.TryGetProperty("rate", out var rateElement))
        {
            if (rateElement.ValueKind != JsonValueKind.Number || !rateElement.TryGetInt32(out rate))
            {
                errorMessage = "SynthesizeSpeech.rate must be an integer between -10 and 10.";
                return false;
            }
        }

        var volume = 1.0;
        if (payload.TryGetProperty("volume", out var volumeElement))
        {
            if (volumeElement.ValueKind != JsonValueKind.Number)
            {
                errorMessage = "SynthesizeSpeech.volume must be a number between 0.0 and 1.0.";
                return false;
            }

            volume = volumeElement.GetDouble();
        }

        string? voiceId = null;
        if (payload.TryGetProperty("voiceId", out var voiceElement)
            && voiceElement.ValueKind == JsonValueKind.String)
        {
            var raw = voiceElement.GetString();
            voiceId = string.IsNullOrWhiteSpace(raw) ? null : raw;
        }

        command = new SynthesizeSpeechCommand
        {
            Text = textElement.GetString()!.Trim(),
            VoiceId = voiceId,
            Rate = rate,
            Volume = volume,
            OutputPath = pathElement.GetString()!
        };
        return true;
    }
}
