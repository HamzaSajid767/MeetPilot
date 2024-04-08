namespace ZoomDialer.AudioSidecar.Logging;

public sealed class FileSystemLogFileWriter : ILogFileWriter
{
    public void AppendLine(string filePath, string line)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);
        ArgumentNullException.ThrowIfNull(line);

        var directory = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        File.AppendAllText(filePath, line + "\n");
    }
}
