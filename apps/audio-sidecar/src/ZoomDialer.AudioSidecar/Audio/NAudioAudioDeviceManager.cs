using NAudio.CoreAudioApi;
using ZoomDialer.AudioSidecar.Models;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Audio;

public sealed class NAudioAudioDeviceManager : IAudioDeviceManager
{
    public Task<IReadOnlyList<AudioDeviceInfo>> ListCaptureDevicesAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(ListDevices(DataFlow.Capture, captureAdapterNames: null));
    }

    public Task<IReadOnlyList<AudioDeviceInfo>> ListRenderDevicesAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var captureAdapters = CollectAdapterNames(DataFlow.Capture);
        return Task.FromResult(ListDevices(DataFlow.Render, captureAdapters));
    }

    public AudioDeviceInfo? TryGetRenderDevice(string deviceId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(deviceId);

        using var enumerator = new MMDeviceEnumerator();
        try
        {
            using var device = enumerator.GetDevice(deviceId);
            if (device.DataFlow != DataFlow.Render)
            {
                return null;
            }

            var defaultId = GetDefaultId(enumerator, DataFlow.Render);
            var captureAdapters = CollectAdapterNames(DataFlow.Capture);
            return ToInfo(
                device,
                isDefault: string.Equals(device.ID, defaultId, StringComparison.Ordinal),
                captureAdapters);
        }
        catch (Exception)
        {
            return null;
        }
    }

    public AudioDeviceInfo GetDefaultRenderDevice()
    {
        using var enumerator = new MMDeviceEnumerator();
        using var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
        var captureAdapters = CollectAdapterNames(DataFlow.Capture);
        return ToInfo(device, isDefault: true, captureAdapters);
    }

    public AudioDeviceInfo? TryGetCaptureDevice(string deviceId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(deviceId);

        using var enumerator = new MMDeviceEnumerator();
        try
        {
            using var device = enumerator.GetDevice(deviceId);
            if (device.DataFlow != DataFlow.Capture)
            {
                return null;
            }

            var defaultId = GetDefaultId(enumerator, DataFlow.Capture);
            return ToInfo(
                device,
                isDefault: string.Equals(device.ID, defaultId, StringComparison.Ordinal),
                captureAdapterNames: null);
        }
        catch (Exception)
        {
            return null;
        }
    }

    public AudioDeviceInfo GetDefaultCaptureDevice()
    {
        using var enumerator = new MMDeviceEnumerator();
        using var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
        return ToInfo(device, isDefault: true, captureAdapterNames: null);
    }

    public MMDevice? OpenRenderDevice(string deviceId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(deviceId);
        var enumerator = new MMDeviceEnumerator();
        try
        {
            var device = enumerator.GetDevice(deviceId);
            if (device.DataFlow != DataFlow.Render)
            {
                device.Dispose();
                enumerator.Dispose();
                return null;
            }

            // Caller owns the MMDevice; enumerator can be disposed after GetDevice clones the COM ptr.
            enumerator.Dispose();
            return device;
        }
        catch
        {
            enumerator.Dispose();
            return null;
        }
    }

    public MMDevice OpenDefaultRenderDevice()
    {
        var enumerator = new MMDeviceEnumerator();
        try
        {
            return enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
        }
        finally
        {
            enumerator.Dispose();
        }
    }

    public MMDevice? OpenCaptureDevice(string deviceId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(deviceId);
        var enumerator = new MMDeviceEnumerator();
        try
        {
            var device = enumerator.GetDevice(deviceId);
            if (device.DataFlow != DataFlow.Capture)
            {
                device.Dispose();
                enumerator.Dispose();
                return null;
            }

            enumerator.Dispose();
            return device;
        }
        catch
        {
            enumerator.Dispose();
            return null;
        }
    }

    public MMDevice OpenDefaultCaptureDevice()
    {
        var enumerator = new MMDeviceEnumerator();
        try
        {
            return enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
        }
        finally
        {
            enumerator.Dispose();
        }
    }

    private static IReadOnlyList<AudioDeviceInfo> ListDevices(
        DataFlow flow,
        HashSet<string>? captureAdapterNames)
    {
        using var enumerator = new MMDeviceEnumerator();
        var defaultId = GetDefaultId(enumerator, flow);
        // Prefer Active endpoints; also surface Disabled/Unplugged so the UI can show state.
        // NotPresent endpoints often lack property stores and throw when reading FriendlyName.
        var states = DeviceState.Active | DeviceState.Disabled | DeviceState.Unplugged;
        var collection = enumerator.EnumerateAudioEndPoints(flow, states);
        var list = new List<AudioDeviceInfo>(collection.Count);
        foreach (var device in collection)
        {
            using (device)
            {
                try
                {
                    list.Add(
                        ToInfo(
                            device,
                            isDefault: string.Equals(device.ID, defaultId, StringComparison.Ordinal),
                            captureAdapterNames));
                }
                catch
                {
                    // Skip endpoints that cannot be fully described (stale/ghost devices).
                }
            }
        }

        return list;
    }

    private static HashSet<string> CollectAdapterNames(DataFlow flow)
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using var enumerator = new MMDeviceEnumerator();
        var states = DeviceState.Active | DeviceState.Disabled | DeviceState.Unplugged;
        var collection = enumerator.EnumerateAudioEndPoints(flow, states);
        foreach (var device in collection)
        {
            using (device)
            {
                try
                {
                    var adapter = SafeDeviceFriendlyName(device);
                    if (!string.IsNullOrWhiteSpace(adapter))
                    {
                        names.Add(adapter);
                    }
                }
                catch
                {
                    // ignore
                }
            }
        }

        return names;
    }

    private static string? GetDefaultId(MMDeviceEnumerator enumerator, DataFlow flow)
    {
        try
        {
            using var device = enumerator.GetDefaultAudioEndpoint(flow, Role.Multimedia);
            return device.ID;
        }
        catch
        {
            return null;
        }
    }

    private static AudioDeviceInfo ToInfo(
        MMDevice device,
        bool isDefault,
        HashSet<string>? captureAdapterNames)
    {
        var friendlyName = SafeFriendlyName(device);
        var deviceFriendlyName = SafeDeviceFriendlyName(device);
        var instanceId = SafeInstanceId(device);
        var formFactor = TryReadFormFactor(device);
        var paired = !string.IsNullOrWhiteSpace(deviceFriendlyName)
            && captureAdapterNames is not null
            && captureAdapterNames.Contains(deviceFriendlyName);

        var isVirtual = VirtualAudioDeviceDetector.IsLikelyVirtual(
            new VirtualAudioDeviceDetector.Signals(
                InstanceId: instanceId,
                FriendlyName: friendlyName,
                DeviceFriendlyName: deviceFriendlyName,
                FormFactor: formFactor,
                HasPairedCaptureAdapter: paired));

        return new AudioDeviceInfo
        {
            Id = device.ID,
            FriendlyName = friendlyName,
            IsDefault = isDefault,
            DeviceState = MapState(device.State),
            SupportsPlayback = device.DataFlow == DataFlow.Render && device.State == DeviceState.Active,
            SupportsCapture = device.DataFlow == DataFlow.Capture && device.State == DeviceState.Active,
            IsVirtualDevice = isVirtual
        };
    }

    private static string SafeFriendlyName(MMDevice device)
    {
        try
        {
            var name = device.FriendlyName;
            return string.IsNullOrWhiteSpace(name) ? device.ID : name;
        }
        catch
        {
            return device.ID;
        }
    }

    private static string? SafeDeviceFriendlyName(MMDevice device)
    {
        try
        {
            var name = device.DeviceFriendlyName;
            return string.IsNullOrWhiteSpace(name) ? null : name;
        }
        catch
        {
            return null;
        }
    }

    private static string? SafeInstanceId(MMDevice device)
    {
        try
        {
            var id = device.InstanceId;
            return string.IsNullOrWhiteSpace(id) ? null : id;
        }
        catch
        {
            return null;
        }
    }

    private static uint? TryReadFormFactor(MMDevice device)
    {
        try
        {
            var store = device.Properties;
            if (!store.Contains(PropertyKeys.PKEY_AudioEndpoint_FormFactor))
            {
                return null;
            }

            var value = store[PropertyKeys.PKEY_AudioEndpoint_FormFactor];
            return value.Value switch
            {
                uint u => u,
                int i when i >= 0 => (uint)i,
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }

    private static string MapState(DeviceState state)
    {
        return state switch
        {
            DeviceState.Active => ProtocolConstants.DeviceStates.Active,
            DeviceState.Disabled => ProtocolConstants.DeviceStates.Disabled,
            DeviceState.NotPresent => ProtocolConstants.DeviceStates.NotPresent,
            DeviceState.Unplugged => ProtocolConstants.DeviceStates.Unplugged,
            _ => ProtocolConstants.DeviceStates.NotPresent
        };
    }
}
