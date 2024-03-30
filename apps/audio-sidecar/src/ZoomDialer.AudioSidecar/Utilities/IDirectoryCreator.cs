namespace ZoomDialer.AudioSidecar.Utilities;

public interface IDirectoryCreator
{
    Task CreateDirectoryAsync(string path, CancellationToken cancellationToken = default);
}
