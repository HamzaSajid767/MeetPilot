using Microsoft.Extensions.Logging;

namespace ZoomDialer.AudioSidecar.Logging;

public static class LogScopes
{
    public const string Host = "Host";

    public const string Ipc = "Ipc";

    public const string Audio = "Audio";

    public const string Program = "Program";

    public const string SessionIdKey = "sessionId";

    public const string CorrelationIdKey = "correlationId";

    public const string RequestIdKey = "requestId";

    public static IDisposable? BeginSessionScope(ILogger logger, string sessionId)
    {
        ArgumentNullException.ThrowIfNull(logger);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId);

        return logger.BeginScope(new Dictionary<string, object>
        {
            [SessionIdKey] = sessionId
        });
    }

    public static IDisposable? BeginCorrelationScope(
        ILogger logger,
        string? correlationId = null,
        string? requestId = null)
    {
        ArgumentNullException.ThrowIfNull(logger);

        var scope = new Dictionary<string, object>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(correlationId))
        {
            scope[CorrelationIdKey] = correlationId;
        }

        if (!string.IsNullOrWhiteSpace(requestId))
        {
            scope[RequestIdKey] = requestId;
        }

        return scope.Count == 0 ? null : logger.BeginScope(scope);
    }
}
