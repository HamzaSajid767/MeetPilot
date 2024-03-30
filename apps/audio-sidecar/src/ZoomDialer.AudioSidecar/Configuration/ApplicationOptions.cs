using System.ComponentModel.DataAnnotations;

namespace ZoomDialer.AudioSidecar.Configuration;

public sealed class ApplicationOptions
{
    public const string SectionName = "Application";

    [Required]
    [MinLength(1)]
    public string Name { get; set; } = "Zoom Dialer Audio Sidecar";

    public string InstanceId { get; set; } = string.Empty;
}
