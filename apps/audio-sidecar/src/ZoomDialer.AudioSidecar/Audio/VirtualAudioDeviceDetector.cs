namespace ZoomDialer.AudioSidecar.Audio;

/// <summary>
/// Heuristic classification of WASAPI endpoints as virtual/software cables.
/// Does not hardcode a single product name (e.g. VB-CABLE).
/// </summary>
public static class VirtualAudioDeviceDetector
{
    // EndpointFormFactor from mmdeviceapi.h
    private const uint FormFactorUnknownDigitalPassthrough = 7;
    private const uint FormFactorUnknown = 10;

    private static readonly string[] NameFamilyTokens =
    [
        "virtual",
        "vb-audio",
        "voicemeeter",
        "cable",
        "vac ",
        "vac-",
        "obs ",
        "obs-",
        "sonic"
    ];

    public readonly record struct Signals(
        string? InstanceId,
        string? FriendlyName,
        string? DeviceFriendlyName,
        uint? FormFactor,
        bool HasPairedCaptureAdapter);

    public static bool IsLikelyVirtual(Signals signals)
    {
        if (HasSoftwareEnumeratorPath(signals.InstanceId))
        {
            return true;
        }

        if (IsVirtualLikeFormFactor(signals.FormFactor))
        {
            return true;
        }

        if (MatchesNameFamily(signals.FriendlyName) || MatchesNameFamily(signals.DeviceFriendlyName))
        {
            return true;
        }

        if (signals.HasPairedCaptureAdapter
            && !string.IsNullOrWhiteSpace(signals.DeviceFriendlyName))
        {
            return true;
        }

        return false;
    }

    public static bool HasSoftwareEnumeratorPath(string? instanceId)
    {
        if (string.IsNullOrWhiteSpace(instanceId))
        {
            return false;
        }

        return instanceId.Contains("SWD\\", StringComparison.OrdinalIgnoreCase)
            || instanceId.Contains("ROOT\\", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsVirtualLikeFormFactor(uint? formFactor)
    {
        return formFactor is FormFactorUnknown or FormFactorUnknownDigitalPassthrough;
    }

    public static bool MatchesNameFamily(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return false;
        }

        var normalized = " " + name.Trim().ToLowerInvariant() + " ";
        foreach (var token in NameFamilyTokens)
        {
            if (normalized.Contains(token, StringComparison.Ordinal))
            {
                return true;
            }
        }

        // "VAC" as a standalone token (common Virtual Audio Cable abbreviation)
        if (normalized.Contains(" vac ", StringComparison.Ordinal)
            || normalized.StartsWith("vac ", StringComparison.Ordinal)
            || normalized.EndsWith(" vac", StringComparison.Ordinal)
            || string.Equals(name.Trim(), "VAC", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }
}
