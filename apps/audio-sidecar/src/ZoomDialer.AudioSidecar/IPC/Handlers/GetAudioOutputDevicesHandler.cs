using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class GetAudioOutputDevicesHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IAudioDeviceManager _deviceManager;
    private readonly ILogger<GetAudioOutputDevicesHandler> _logger;

    public GetAudioOutputDevicesHandler(
        IAudioDeviceManager deviceManager,
        ILogger<GetAudioOutputDevicesHandler> logger)
    {
        _deviceManager = deviceManager;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.GetAudioOutputDevices;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        var devices = await _deviceManager.ListRenderDevicesAsync(cancellationToken).ConfigureAwait(false);
        foreach (var device in devices.Where(static d => d.IsVirtualDevice))
        {
            _logger.LogInformation(
                SidecarLogEventIds.OutputDeviceVirtualDetected,
                "Virtual output device detected. DeviceId={DeviceId} FriendlyName={FriendlyName}",
                device.Id,
                device.FriendlyName);
        }

        var dto = new AudioOutputDeviceListDto
        {
            Devices = devices
                .Select(static d => new AudioOutputDeviceDto
                {
                    Id = d.Id,
                    FriendlyName = d.FriendlyName,
                    IsDefault = d.IsDefault,
                    DeviceState = d.DeviceState,
                    SupportsPlayback = d.SupportsPlayback,
                    IsVirtualDevice = d.IsVirtualDevice
                })
                .ToArray()
        };

        return EnvelopeFactory.CreateSuccessResponse(
            request,
            ProtocolConstants.Commands.GetAudioOutputDevices,
            dto);
    }
}
