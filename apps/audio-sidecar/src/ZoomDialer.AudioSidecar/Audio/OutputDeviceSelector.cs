using ZoomDialer.AudioSidecar.Models;

namespace ZoomDialer.AudioSidecar.Audio;

public interface IOutputDeviceSelector
{
    string? SelectedDeviceId { get; }

    void ClearSelection();

    AudioDeviceInfo SetSelectedDevice(string deviceId);

    ResolvedOutputDevice ResolveForPlayback();
}

public sealed class ResolvedOutputDevice
{
    public required string DeviceId { get; init; }

    public required string FriendlyName { get; init; }

    public required bool UsedFallback { get; init; }

    public string? FallbackReason { get; init; }

    public required bool IsDefault { get; init; }
}

public sealed class OutputDeviceSelector : IOutputDeviceSelector
{
    private readonly IAudioDeviceManager _deviceManager;
    private readonly object _gate = new();
    private string? _selectedDeviceId;

    public OutputDeviceSelector(IAudioDeviceManager deviceManager)
    {
        _deviceManager = deviceManager;
    }

    public string? SelectedDeviceId
    {
        get
        {
            lock (_gate)
            {
                return _selectedDeviceId;
            }
        }
    }

    public void ClearSelection()
    {
        lock (_gate)
        {
            _selectedDeviceId = null;
        }
    }

    public AudioDeviceInfo SetSelectedDevice(string deviceId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(deviceId);
        var device = _deviceManager.TryGetRenderDevice(deviceId)
            ?? throw new InvalidOperationException($"Output device '{deviceId}' was not found.");

        if (!device.SupportsPlayback)
        {
            throw new InvalidOperationException($"Output device '{device.FriendlyName}' is not available for playback.");
        }

        lock (_gate)
        {
            _selectedDeviceId = device.Id;
        }

        return device;
    }

    public ResolvedOutputDevice ResolveForPlayback()
    {
        string? selected;
        lock (_gate)
        {
            selected = _selectedDeviceId;
        }

        if (!string.IsNullOrWhiteSpace(selected))
        {
            var device = _deviceManager.TryGetRenderDevice(selected);
            if (device is not null && device.SupportsPlayback)
            {
                return new ResolvedOutputDevice
                {
                    DeviceId = device.Id,
                    FriendlyName = device.FriendlyName,
                    UsedFallback = false,
                    IsDefault = device.IsDefault
                };
            }

            lock (_gate)
            {
                if (string.Equals(_selectedDeviceId, selected, StringComparison.Ordinal))
                {
                    _selectedDeviceId = null;
                }
            }

            var fallback = _deviceManager.GetDefaultRenderDevice();
            return new ResolvedOutputDevice
            {
                DeviceId = fallback.Id,
                FriendlyName = fallback.FriendlyName,
                UsedFallback = true,
                FallbackReason = $"Selected output device is unavailable; fell back to default '{fallback.FriendlyName}'.",
                IsDefault = true
            };
        }

        var defaultDevice = _deviceManager.GetDefaultRenderDevice();
        return new ResolvedOutputDevice
        {
            DeviceId = defaultDevice.Id,
            FriendlyName = defaultDevice.FriendlyName,
            UsedFallback = false,
            IsDefault = true
        };
    }
}
