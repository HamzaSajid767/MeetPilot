namespace ZoomDialer.AudioSidecar.Models;

public sealed class AudioDeviceInfo
{
    public required string Id { get; init; }

    public required string FriendlyName { get; init; }

    public bool IsDefault { get; init; }

    public required string DeviceState { get; init; }

    public bool SupportsPlayback { get; init; }

    public bool SupportsCapture { get; init; }

    public bool IsVirtualDevice { get; init; }
}
