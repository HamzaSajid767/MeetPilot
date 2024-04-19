namespace ZoomDialer.AudioSidecar.IPC;

public interface IRequestHandler<TEnvelope>
{
    string MessageType { get; }

    Task<TEnvelope?> HandleAsync(TEnvelope request, CancellationToken cancellationToken);
}
