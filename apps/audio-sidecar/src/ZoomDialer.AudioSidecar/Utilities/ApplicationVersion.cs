namespace ZoomDialer.AudioSidecar.Utilities;

public static class ApplicationVersion
{
    public const string ProductName = "Zoom Dialer Audio Sidecar";

    public static string InformationalVersion { get; } =
        typeof(ApplicationVersion).Assembly.GetName().Version?.ToString() ?? "0.0.0";
}
