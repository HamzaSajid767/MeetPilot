using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC;

public interface IProtocolVersionValidator
{
    bool IsSupported(string protocolVersion);
}

public sealed class ExactProtocolVersionValidator : IProtocolVersionValidator
{
    public bool IsSupported(string protocolVersion)
    {
        return string.Equals(
            protocolVersion,
            ProtocolConstants.ProtocolVersion,
            StringComparison.Ordinal);
    }
}
