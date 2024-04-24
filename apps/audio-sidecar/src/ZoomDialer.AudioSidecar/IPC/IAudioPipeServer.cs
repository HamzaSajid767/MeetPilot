namespace ZoomDialer.AudioSidecar.IPC;

public interface IAudioPipeServer
{
    Task StartAsync(CancellationToken cancellationToken);

    Task StopAsync(CancellationToken cancellationToken);

    Task SendEventAsync(Protocol.MessageEnvelope envelope, CancellationToken cancellationToken);
}
