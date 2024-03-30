using System.ComponentModel.DataAnnotations;

namespace ZoomDialer.AudioSidecar.Configuration;

public sealed class NamedPipeOptions
{
    public const string SectionName = "Pipe";

    [Required]
    [MinLength(1)]
    public string PipeName { get; set; } = string.Empty;

    [Range(1, Protocol.ProtocolConstants.MaxPayloadBytes)]
    public int MaxPayloadBytes { get; set; } = Protocol.ProtocolConstants.MaxPayloadBytes;
}
