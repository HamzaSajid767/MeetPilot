using ZoomDialer.AudioSidecar.Protocol;
using ZoomDialer.AudioSidecar.Utilities;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class GetVersionHandler : IRequestHandler<MessageEnvelope>
{
    public string MessageType => ProtocolConstants.Commands.GetVersion;

    public Task<MessageEnvelope?> HandleAsync(MessageEnvelope request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var data = new VersionInfoDto
        {
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            ApplicationVersion = ApplicationVersion.InformationalVersion,
            MinimumSupportedVersion = ProtocolConstants.MinimumSupportedProtocolVersion
        };

        var response = EnvelopeFactory.CreateSuccessResponse(
            request,
            ProtocolConstants.Commands.GetVersion,
            data);

        return Task.FromResult<MessageEnvelope?>(response);
    }
}
