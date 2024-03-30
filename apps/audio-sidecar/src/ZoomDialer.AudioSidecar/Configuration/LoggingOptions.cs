namespace ZoomDialer.AudioSidecar.Configuration;

public sealed class LoggingOptions
{
    public const string SectionName = "SidecarLogging";

    /// <summary>
    /// Filename prefix for daily JSONL files under AppPaths.Logs (for example, sidecar-2026-07-22.jsonl).
    /// Log level filtering remains controlled by the standard Logging:LogLevel configuration.
    /// </summary>
    public string FileNamePrefix { get; set; } = "sidecar";

    public bool IncludeScopes { get; set; } = true;
}
