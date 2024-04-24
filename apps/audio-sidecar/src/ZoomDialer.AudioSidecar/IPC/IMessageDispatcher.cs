namespace ZoomDialer.AudioSidecar.IPC;

public interface IMessageDispatcher<TEnvelope>
{
    Task<TEnvelope?> DispatchAsync(TEnvelope envelope, CancellationToken cancellationToken);
}
