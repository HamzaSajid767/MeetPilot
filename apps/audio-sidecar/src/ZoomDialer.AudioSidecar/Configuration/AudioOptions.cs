namespace ZoomDialer.AudioSidecar.Configuration;

public sealed class AudioOptions
{
    public const string SectionName = "Audio";

    public int TargetSampleRateHz { get; set; } = 48000;

    public int BufferMilliseconds { get; set; } = 20;

    public string? PreferredCaptureDeviceId { get; set; }

    public string? PreferredRenderDeviceId { get; set; }
}
