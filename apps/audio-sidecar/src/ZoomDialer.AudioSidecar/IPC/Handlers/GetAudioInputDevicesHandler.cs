using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class GetAudioInputDevicesHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IAudioDeviceManager _deviceManager;

    public GetAudioInputDevicesHandler(IAudioDeviceManager deviceManager)
    {
        _deviceManager = deviceManager;
    }

    public string MessageType => ProtocolConstants.Commands.GetAudioInputDevices;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        var devices = await _deviceManager.ListCaptureDevicesAsync(cancellationToken).ConfigureAwait(false);
        var dto = new AudioInputDeviceListDto
        {
            Devices = devices
                .Select(static d => new AudioInputDeviceDto
                {
                    Id = d.Id,
                    FriendlyName = d.FriendlyName,
                    IsDefault = d.IsDefault,
                    DeviceState = d.DeviceState,
                    SupportsCapture = d.SupportsCapture,
                    IsVirtualDevice = d.IsVirtualDevice
                })
                .ToArray()
        };

        return EnvelopeFactory.CreateSuccessResponse(
            request,
            ProtocolConstants.Commands.GetAudioInputDevices,
            dto);
    }
}
