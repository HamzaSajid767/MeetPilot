using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class HealthCheckHandler : IRequestHandler<MessageEnvelope>
{
    public string MessageType => ProtocolConstants.Commands.HealthCheck;

    public Task<MessageEnvelope?> HandleAsync(MessageEnvelope request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var data = new ApplicationStateDto
        {
            EngineState = ProtocolConstants.EngineStates.Idle,
            IsHealthy = true,
            Detail = "Healthy"
        };

        var response = EnvelopeFactory.CreateSuccessResponse(
            request,
            ProtocolConstants.Commands.HealthCheck,
            data);

        return Task.FromResult<MessageEnvelope?>(response);
    }
}
