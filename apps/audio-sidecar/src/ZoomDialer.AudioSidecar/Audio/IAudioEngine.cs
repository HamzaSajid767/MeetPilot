namespace ZoomDialer.AudioSidecar.Audio;

public interface IAudioEngine
{
    Task StartAsync(CancellationToken cancellationToken);

    Task StopAsync(CancellationToken cancellationToken);
}
