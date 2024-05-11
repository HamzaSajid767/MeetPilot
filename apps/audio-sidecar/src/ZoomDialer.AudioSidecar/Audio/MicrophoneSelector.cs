using ZoomDialer.AudioSidecar.Models;

namespace ZoomDialer.AudioSidecar.Audio;

public interface IMicrophoneSelector
{
    string? SelectedDeviceId { get; }

    void ClearSelection();

    AudioDeviceInfo SetSelectedDevice(string deviceId);

    AudioDeviceInfo ResolveForCapture();
}

public sealed class MicrophoneSelector : IMicrophoneSelector
{
    private readonly IAudioDeviceManager _deviceManager;
    private readonly object _gate = new();
    private string? _selectedDeviceId;

    public MicrophoneSelector(IAudioDeviceManager deviceManager)
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
        var device = _deviceManager.TryGetCaptureDevice(deviceId)
            ?? throw new InvalidOperationException($"Capture device '{deviceId}' was not found.");

        if (!device.SupportsCapture)
        {
            throw new InvalidOperationException($"Capture device '{device.FriendlyName}' is not available.");
        }

        lock (_gate)
        {
            _selectedDeviceId = device.Id;
        }

        return device;
    }

    public AudioDeviceInfo ResolveForCapture()
    {
        string? selected;
        lock (_gate)
        {
            selected = _selectedDeviceId;
        }

        if (!string.IsNullOrWhiteSpace(selected))
        {
            var device = _deviceManager.TryGetCaptureDevice(selected);
            if (device is not null && device.SupportsCapture)
            {
                return device;
            }

            lock (_gate)
            {
                if (string.Equals(_selectedDeviceId, selected, StringComparison.Ordinal))
                {
                    _selectedDeviceId = null;
                }
            }
        }

        return _deviceManager.GetDefaultCaptureDevice();
    }
}
