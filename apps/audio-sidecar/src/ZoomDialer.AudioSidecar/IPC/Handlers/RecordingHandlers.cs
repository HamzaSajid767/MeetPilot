using System.Text.Json;
using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class StartRecordingHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IMicrophoneRecorder _recorder;
    private readonly ILogger<StartRecordingHandler> _logger;

    public StartRecordingHandler(IMicrophoneRecorder recorder, ILogger<StartRecordingHandler> logger)
    {
        _recorder = recorder;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.StartRecording;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        if (!TryParseCommand(request, out var command, out var errorMessage))
        {
            _logger.LogWarning(
                SidecarLogEventIds.RecordingRejected,
                "Rejected StartRecording: {Reason}",
                errorMessage);
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                errorMessage!,
                retriable: false);
        }

        try
        {
            await _recorder
                .StartAsync(
                    new StartRecordingRequest
                    {
                        OutputPath = command!.OutputPath,
                        DeviceId = command.DeviceId
                    },
                    cancellationToken)
                .ConfigureAwait(false);

            return EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.StartRecording,
                new StartRecordingResultDto { Succeeded = true });
        }
        catch (ArgumentException ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                ex.Message,
                retriable: false);
        }
        catch (InvalidOperationException ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.DeviceUnavailable,
                ex.Message,
                retriable: false);
        }
        catch (Exception ex)
        {
            _logger.LogError(SidecarLogEventIds.RecordingFailed, ex, "StartRecording failed");
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.RecordingFailed,
                ex.Message,
                retriable: true);
        }
    }

    private static bool TryParseCommand(
        MessageEnvelope request,
        out StartRecordingCommand? command,
        out string? errorMessage)
    {
        command = null;
        errorMessage = null;

        if (request.Payload is not { } payload || payload.ValueKind != JsonValueKind.Object)
        {
            errorMessage = "StartRecording payload is required.";
            return false;
        }

        if (!payload.TryGetProperty("outputPath", out var pathElement)
            || pathElement.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(pathElement.GetString()))
        {
            errorMessage = "StartRecording.outputPath must be a non-empty string.";
            return false;
        }

        string? deviceId = null;
        if (payload.TryGetProperty("deviceId", out var deviceElement)
            && deviceElement.ValueKind == JsonValueKind.String)
        {
            var raw = deviceElement.GetString();
            deviceId = string.IsNullOrWhiteSpace(raw) ? null : raw;
        }

        command = new StartRecordingCommand
        {
            OutputPath = pathElement.GetString()!,
            DeviceId = deviceId
        };
        return true;
    }
}

public sealed class StopRecordingHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IMicrophoneRecorder _recorder;
    private readonly ILogger<StopRecordingHandler> _logger;

    public StopRecordingHandler(IMicrophoneRecorder recorder, ILogger<StopRecordingHandler> logger)
    {
        _recorder = recorder;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.StopRecording;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _recorder.StopAsync(cancellationToken).ConfigureAwait(false);
            return EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.StopRecording,
                new StopRecordingResultDto
                {
                    Path = result.Path,
                    DurationMs = result.DurationMs,
                    Succeeded = result.Succeeded
                });
        }
        catch (InvalidOperationException ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                ex.Message,
                retriable: false);
        }
        catch (Exception ex)
        {
            _logger.LogError(SidecarLogEventIds.RecordingFailed, ex, "StopRecording failed");
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.RecordingFailed,
                ex.Message,
                retriable: true);
        }
    }
}

public sealed class CancelRecordingHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IMicrophoneRecorder _recorder;
    private readonly ILogger<CancelRecordingHandler> _logger;

    public CancelRecordingHandler(IMicrophoneRecorder recorder, ILogger<CancelRecordingHandler> logger)
    {
        _recorder = recorder;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.CancelRecording;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        try
        {
            await _recorder.CancelAsync(cancellationToken).ConfigureAwait(false);
            return EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.CancelRecording,
                new CancelRecordingResultDto { Succeeded = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(SidecarLogEventIds.RecordingFailed, ex, "CancelRecording failed");
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.RecordingFailed,
                ex.Message,
                retriable: true);
        }
    }
}
