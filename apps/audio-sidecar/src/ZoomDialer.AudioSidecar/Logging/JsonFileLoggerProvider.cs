using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ZoomDialer.AudioSidecar.Configuration;
using ZoomDialer.AudioSidecar.Utilities;

namespace ZoomDialer.AudioSidecar.Logging;

[ProviderAlias("JsonFile")]
public sealed partial class JsonFileLoggerProvider : ILoggerProvider, ISupportExternalScope
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private readonly IAppPaths _appPaths;
    private readonly LoggingSession _session;
    private readonly IOptions<LoggingOptions> _options;
    private readonly ILogFileWriter _fileWriter;
    private readonly Func<DateTimeOffset> _clock;
    private readonly ConcurrentDictionary<string, JsonFileLogger> _loggers = new(StringComparer.Ordinal);
    private IExternalScopeProvider? _scopeProvider;
    private bool _disposed;

    public JsonFileLoggerProvider(
        IAppPaths appPaths,
        LoggingSession session,
        IOptions<LoggingOptions> options,
        ILogFileWriter fileWriter)
        : this(appPaths, session, options, fileWriter, static () => DateTimeOffset.UtcNow)
    {
    }

    public JsonFileLoggerProvider(
        IAppPaths appPaths,
        LoggingSession session,
        IOptions<LoggingOptions> options,
        ILogFileWriter fileWriter,
        Func<DateTimeOffset> clock)
    {
        _appPaths = appPaths ?? throw new ArgumentNullException(nameof(appPaths));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _fileWriter = fileWriter ?? throw new ArgumentNullException(nameof(fileWriter));
        _clock = clock ?? throw new ArgumentNullException(nameof(clock));
    }

    public ILogger CreateLogger(string categoryName)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        return _loggers.GetOrAdd(
            categoryName,
            static (name, provider) => new JsonFileLogger(name, provider),
            this);
    }

    public void SetScopeProvider(IExternalScopeProvider scopeProvider)
    {
        _scopeProvider = scopeProvider;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _loggers.Clear();
    }

    internal void Write<TState>(
        string category,
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        if (_disposed)
        {
            return;
        }

        try
        {
            var options = _options.Value;
            var prefix = string.IsNullOrWhiteSpace(options.FileNamePrefix)
                ? "sidecar"
                : options.FileNamePrefix.Trim();

            Directory.CreateDirectory(_appPaths.Logs);

            var now = _clock();
            var filePath = Path.Combine(_appPaths.Logs, $"{prefix}-{now:yyyy-MM-dd}.jsonl");

            var context = new Dictionary<string, object?>(StringComparer.Ordinal);
            string? correlationId = null;
            string? requestId = null;

            CollectState(state, context, ref correlationId, ref requestId);

            if (options.IncludeScopes)
            {
                var scopeBox = new ScopeBox(context, correlationId, requestId);
                _scopeProvider?.ForEachScope(
                    static (scope, box) => CollectState(scope, box.Context, ref box.CorrelationId, ref box.RequestId),
                    scopeBox);
                correlationId = scopeBox.CorrelationId;
                requestId = scopeBox.RequestId;
                context.Remove(LogScopes.CorrelationIdKey);
                context.Remove(LogScopes.RequestIdKey);
                context.Remove(LogScopes.SessionIdKey);
            }

            RedactInPlace(context);

            var payload = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["ts"] = now.ToString("O"),
                ["level"] = ToLevelName(logLevel),
                ["category"] = category,
                ["message"] = formatter(state, exception),
                ["sessionId"] = _session.SessionId
            };

            if (!string.IsNullOrWhiteSpace(eventId.Name))
            {
                payload["eventId"] = eventId.Name;
            }
            else if (eventId.Id != 0)
            {
                payload["eventId"] = eventId.Id.ToString(System.Globalization.CultureInfo.InvariantCulture);
            }

            if (!string.IsNullOrWhiteSpace(correlationId))
            {
                payload["correlationId"] = correlationId;
            }

            if (!string.IsNullOrWhiteSpace(requestId))
            {
                payload["requestId"] = requestId;
            }

            if (context.Count > 0)
            {
                payload["context"] = context;
            }

            if (exception is not null)
            {
                payload["exception"] = new Dictionary<string, object?>
                {
                    ["type"] = exception.GetType().FullName,
                    ["message"] = exception.Message,
                    ["stack"] = exception.StackTrace
                };
            }

            var line = JsonSerializer.Serialize(payload, SerializerOptions);
            _fileWriter.AppendLine(filePath, line);
        }
        catch
        {
            // File sink failures must never crash the application.
        }
    }

    private sealed class ScopeBox(
        Dictionary<string, object?> context,
        string? correlationId,
        string? requestId)
    {
        public Dictionary<string, object?> Context { get; } = context;

        public string? CorrelationId = correlationId;

        public string? RequestId = requestId;
    }

    private static void CollectState(
        object? state,
        Dictionary<string, object?> context,
        ref string? correlationId,
        ref string? requestId)
    {
        if (state is null)
        {
            return;
        }

        if (state is IEnumerable<KeyValuePair<string, object?>> pairs)
        {
            foreach (var pair in pairs)
            {
                if (string.Equals(pair.Key, "{OriginalFormat}", StringComparison.Ordinal))
                {
                    continue;
                }

                Assign(pair.Key, pair.Value, context, ref correlationId, ref requestId);
            }

            return;
        }

        if (state is IEnumerable<KeyValuePair<string, object>> nonNullPairs)
        {
            foreach (var pair in nonNullPairs)
            {
                if (string.Equals(pair.Key, "{OriginalFormat}", StringComparison.Ordinal))
                {
                    continue;
                }

                Assign(pair.Key, pair.Value, context, ref correlationId, ref requestId);
            }
        }
    }

    private static void Assign(
        string key,
        object? value,
        Dictionary<string, object?> context,
        ref string? correlationId,
        ref string? requestId)
    {
        if (string.Equals(key, LogScopes.CorrelationIdKey, StringComparison.Ordinal))
        {
            correlationId ??= value as string;
            return;
        }

        if (string.Equals(key, LogScopes.RequestIdKey, StringComparison.Ordinal))
        {
            requestId ??= value as string;
            return;
        }

        if (string.Equals(key, LogScopes.SessionIdKey, StringComparison.Ordinal))
        {
            return;
        }

        context[key] = value;
    }

    private static void RedactInPlace(Dictionary<string, object?> context)
    {
        foreach (var key in context.Keys.ToArray())
        {
            if (SensitiveKeyRegex().IsMatch(key))
            {
                context[key] = "[Redacted]";
                continue;
            }

            if (context[key] is Dictionary<string, object?> nested)
            {
                RedactInPlace(nested);
            }
        }
    }

    private static string ToLevelName(LogLevel level) =>
        level switch
        {
            LogLevel.Trace => "trace",
            LogLevel.Debug => "debug",
            LogLevel.Information => "info",
            LogLevel.Warning => "warn",
            LogLevel.Error => "error",
            LogLevel.Critical => "critical",
            _ => "info"
        };

    [GeneratedRegex("(token|secret|password|passwd|authorization|api[_-]?key|auth)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex SensitiveKeyRegex();
}

internal sealed class JsonFileLogger(string categoryName, JsonFileLoggerProvider provider) : ILogger
{
    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        ArgumentNullException.ThrowIfNull(formatter);

        if (!IsEnabled(logLevel))
        {
            return;
        }

        provider.Write(categoryName, logLevel, eventId, state, exception, formatter);
    }
}
