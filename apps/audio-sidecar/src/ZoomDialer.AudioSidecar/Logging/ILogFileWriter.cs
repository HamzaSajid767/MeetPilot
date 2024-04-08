namespace ZoomDialer.AudioSidecar.Logging;

public interface ILogFileWriter
{
    void AppendLine(string filePath, string line);
}
