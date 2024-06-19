using System.Text.Json;
using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class SetOutputDeviceHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IOutputDeviceSelector _selector;
    private readonly ILogger<SetOutputDeviceHandler> _logger;

    public SetOutputDeviceHandler(IOutputDeviceSelector selector, ILogger<SetOutputDeviceHandler> logger)
    {
        _selector = selector;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.SetOutputDevice;

    public Task<MessageEnvelope?> HandleAsync(MessageEnvelope request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (request.Payload is not { } payload
            || payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("deviceId", out var deviceIdElement)
            || deviceIdElement.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(deviceIdElement.GetString()))
        {
            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateErrorResponse(
                    request,
                    ProtocolConstants.ErrorCodes.InvalidMessage,
                    "SetOutputDevice.deviceId must be a non-empty string.",
                    retriable: false));
        }

        var deviceId = deviceIdElement.GetString()!;

        try
        {
            var device = _selector.SetSelectedDevice(deviceId);
            _logger.LogInformation(
                SidecarLogEventIds.OutputDeviceSelected,
                "Output device selected. DeviceId={DeviceId}",
                device.Id);

            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateSuccessResponse(
                    request,
                    ProtocolConstants.Commands.SetOutputDevice,
                    new SetOutputDeviceResultDto
                    {
                        DeviceId = device.Id,
                        Succeeded = true,
                        FriendlyName = device.FriendlyName
                    }));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(
                SidecarLogEventIds.OutputDeviceRejected,
                "Rejected output device selection: {Reason}",
                ex.Message);

            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateErrorResponse(
                    request,
                    ProtocolConstants.ErrorCodes.DeviceUnavailable,
                    ex.Message,
                    retriable: false));
        }
    }
}
