using NAudio.CoreAudioApi;
using ZoomDialer.AudioSidecar.Models;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Audio;

public interface IAudioDeviceManager
{
    Task<IReadOnlyList<AudioDeviceInfo>> ListCaptureDevicesAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<AudioDeviceInfo>> ListRenderDevicesAsync(CancellationToken cancellationToken);

    AudioDeviceInfo? TryGetRenderDevice(string deviceId);

    AudioDeviceInfo? TryGetCaptureDevice(string deviceId);

    AudioDeviceInfo GetDefaultRenderDevice();

    AudioDeviceInfo GetDefaultCaptureDevice();

    MMDevice? OpenRenderDevice(string deviceId);

    MMDevice OpenDefaultRenderDevice();

    MMDevice? OpenCaptureDevice(string deviceId);

    MMDevice OpenDefaultCaptureDevice();
}
