namespace ZoomDialer.AudioSidecar.Utilities;

public sealed class FileSystemDirectoryCreator : IDirectoryCreator
{
    public Task CreateDirectoryAsync(string path, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Directory.CreateDirectory(path);
        return Task.CompletedTask;
    }
}
