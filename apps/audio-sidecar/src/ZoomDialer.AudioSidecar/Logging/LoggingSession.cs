namespace ZoomDialer.AudioSidecar.Logging;

public sealed class LoggingSession
{
    public LoggingSession(string? sessionId = null)
    {
        SessionId = string.IsNullOrWhiteSpace(sessionId)
            ? Guid.NewGuid().ToString("N")
            : sessionId;
    }

    public string SessionId { get; }
}
