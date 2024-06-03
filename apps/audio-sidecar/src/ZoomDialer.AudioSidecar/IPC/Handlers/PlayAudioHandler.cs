using System.Text.Json;
using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class PlayAudioHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IPlaybackEngine _playbackEngine;
    private readonly ILogger<PlayAudioHandler> _logger;

    public PlayAudioHandler(IPlaybackEngine playbackEngine, ILogger<PlayAudioHandler> logger)
    {
        _playbackEngine = playbackEngine;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.PlayAudio;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        if (!TryParseCommand(request, out var command, out var errorMessage))
        {
            _logger.LogWarning(
                SidecarLogEventIds.PlaybackRejected,
                "Rejected PlayAudio: {Reason}",
                errorMessage);
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                errorMessage!,
                retriable: false);
        }

        var playbackId = Guid.NewGuid().ToString("N");

        try
        {
            var accepted = await _playbackEngine
                .PlayAsync(
                    new PlayAudioRequest
                    {
                        Path = command!.Path,
                        Volume = command.Volume,
                        PlaybackId = playbackId
                    },
                    cancellationToken)
                .ConfigureAwait(false);

            return EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.PlayAudio,
                new PlayAudioResultDto
                {
                    PhraseId = accepted.PlaybackId,
                    Succeeded = true,
                    DurationMs = accepted.DurationMs,
                    OutputDeviceId = accepted.OutputDeviceId,
                    OutputDeviceName = accepted.OutputDeviceName,
                    UsedFallbackDevice = accepted.UsedFallbackDevice,
                    FallbackReason = accepted.FallbackReason
                });
        }
        catch (FileNotFoundException ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                ex.Message,
                retriable: false);
        }
        catch (ArgumentException ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                ex.Message,
                retriable: false);
        }
        catch (Exception ex)
        {
            _logger.LogError(SidecarLogEventIds.PlaybackFailed, ex, "PlayAudio failed");
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.PlaybackFailed,
                "Unable to start WAV playback.",
                retriable: true);
        }
    }

    private static bool TryParseCommand(
        MessageEnvelope request,
        out PlayAudioCommand? command,
        out string? errorMessage)
    {
        command = null;
        errorMessage = null;

        if (request.Payload is not { } payload || payload.ValueKind != JsonValueKind.Object)
        {
            errorMessage = "PlayAudio payload is required.";
            return false;
        }

        if (!payload.TryGetProperty("path", out var pathElement)
            || pathElement.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(pathElement.GetString()))
        {
            errorMessage = "PlayAudio.path must be a non-empty string.";
            return false;
        }

        if (!payload.TryGetProperty("volume", out var volumeElement)
            || volumeElement.ValueKind != JsonValueKind.Number)
        {
            errorMessage = "PlayAudio.volume must be a number between 0.0 and 1.0.";
            return false;
        }

        var volume = volumeElement.GetDouble();
        if (volume is < 0 or > 1)
        {
            errorMessage = "PlayAudio.volume must be between 0.0 and 1.0.";
            return false;
        }

        command = new PlayAudioCommand
        {
            Path = pathElement.GetString()!,
            Volume = volume
        };
        return true;
    }
}
