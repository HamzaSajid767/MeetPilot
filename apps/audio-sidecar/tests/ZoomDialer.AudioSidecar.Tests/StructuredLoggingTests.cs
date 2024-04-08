using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ZoomDialer.AudioSidecar;
using ZoomDialer.AudioSidecar.Configuration;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Utilities;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class StructuredLoggingTests
{
    [Fact]
    public void Host_Resolves_Logging_Infrastructure_Through_DI()
    {
        using var host = SidecarHostFactory.Create([]);

        var session = host.Services.GetRequiredService<LoggingSession>();
        var loggerFactory = host.Services.GetRequiredService<ILoggerFactory>();
        var providers = host.Services.GetServices<ILoggerProvider>().ToArray();

        Assert.False(string.IsNullOrWhiteSpace(session.SessionId));
        Assert.Contains(providers, provider => provider is JsonFileLoggerProvider);

        var logger = loggerFactory.CreateLogger(LogScopes.Host);
        logger.LogInformation(SidecarLogEventIds.HostStarting, "host wiring ok");
    }

    [Fact]
    public void JsonFileLogger_Writes_Structured_Event_To_AppPaths_Logs()
    {
        var tempRoot = CreateTempRoot();
        try
        {
            var appPaths = new AppPathsService(new FileSystemDirectoryCreator(), tempRoot, AppPathNames.LoadDefault());
            Directory.CreateDirectory(appPaths.Logs);

            var lines = new ConcurrentQueue<string>();
            var writer = new CapturingLogFileWriter(lines);
            var session = new LoggingSession("session-test-1");
            var options = Options.Create(new LoggingOptions
            {
                FileNamePrefix = "sidecar",
                IncludeScopes = true
            });

            using var provider = new JsonFileLoggerProvider(
                appPaths,
                session,
                options,
                writer,
                static () => new DateTimeOffset(2026, 7, 22, 12, 0, 0, TimeSpan.Zero));

            var factory = LoggerFactory.Create(builder =>
            {
                builder.SetMinimumLevel(LogLevel.Trace);
                builder.AddProvider(provider);
            });

            var logger = factory.CreateLogger(LogScopes.Host);
            using (LogScopes.BeginSessionScope(logger, session.SessionId))
            using (LogScopes.BeginCorrelationScope(logger, "corr-1", "req-1"))
            {
                logger.LogInformation(
                    SidecarLogEventIds.HostStarted,
                    "Started with {RetryCount} and token {AccessToken}",
                    3,
                    "super-secret");
            }

            Assert.True(lines.TryDequeue(out var line));
            Assert.Contains("sidecar-2026-07-22.jsonl", writer.LastPath, StringComparison.OrdinalIgnoreCase);

            using var document = JsonDocument.Parse(line);
            var root = document.RootElement;
            Assert.Equal("info", root.GetProperty("level").GetString());
            Assert.Equal(LogScopes.Host, root.GetProperty("category").GetString());
            Assert.Equal("host.started", root.GetProperty("eventId").GetString());
            Assert.Equal("session-test-1", root.GetProperty("sessionId").GetString());
            Assert.Equal("corr-1", root.GetProperty("correlationId").GetString());
            Assert.Equal("req-1", root.GetProperty("requestId").GetString());
            Assert.Equal(3, root.GetProperty("context").GetProperty("RetryCount").GetInt32());
            Assert.Equal("[Redacted]", root.GetProperty("context").GetProperty("AccessToken").GetString());
            Assert.Contains(appPaths.Logs, writer.LastPath, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Cleanup(tempRoot);
        }
    }

    [Fact]
    public void JsonFileLogger_Respects_Minimum_Level_Filter()
    {
        var tempRoot = CreateTempRoot();
        try
        {
            var appPaths = new AppPathsService(new FileSystemDirectoryCreator(), tempRoot, AppPathNames.LoadDefault());
            var lines = new ConcurrentQueue<string>();
            using var provider = new JsonFileLoggerProvider(
                appPaths,
                new LoggingSession("session-filter"),
                Options.Create(new LoggingOptions()),
                new CapturingLogFileWriter(lines),
                static () => new DateTimeOffset(2026, 7, 22, 0, 0, 0, TimeSpan.Zero));

            var factory = LoggerFactory.Create(builder =>
            {
                builder.SetMinimumLevel(LogLevel.Information);
                builder.AddProvider(provider);
            });

            var logger = factory.CreateLogger("FilterTest");
            logger.LogDebug("hidden");
            logger.LogInformation("visible");

            Assert.Single(lines);
            Assert.Contains("visible", lines.Single(), StringComparison.Ordinal);
        }
        finally
        {
            Cleanup(tempRoot);
        }
    }

    [Fact]
    public void JsonFileLogger_Isolates_Sink_Failures()
    {
        var tempRoot = CreateTempRoot();
        try
        {
            var appPaths = new AppPathsService(new FileSystemDirectoryCreator(), tempRoot, AppPathNames.LoadDefault());
            using var provider = new JsonFileLoggerProvider(
                appPaths,
                new LoggingSession("session-fail"),
                Options.Create(new LoggingOptions()),
                new ThrowingLogFileWriter(),
                static () => new DateTimeOffset(2026, 7, 22, 0, 0, 0, TimeSpan.Zero));

            var logger = provider.CreateLogger("FaultTest");
            var exception = Record.Exception(() =>
                logger.LogInformation(SidecarLogEventIds.HostStarted, "should not throw"));

            Assert.Null(exception);
        }
        finally
        {
            Cleanup(tempRoot);
        }
    }

    [Fact]
    public async Task Host_Startup_Writes_File_Under_Configured_AppPaths()
    {
        var tempRoot = CreateTempRoot();
        try
        {
            var appPaths = new AppPathsService(new FileSystemDirectoryCreator(), tempRoot, AppPathNames.LoadDefault());
            await appPaths.EnsureCreatedAsync();

            using var host = SidecarHostFactory.Create([], services =>
            {
                services.AddSingleton<IAppPaths>(appPaths);
                services.AddSingleton<LoggingSession>(new LoggingSession("session-host-file"));
            });

            await host.StartAsync();
            await host.StopAsync();

            var logFile = Directory.EnumerateFiles(appPaths.Logs, "sidecar-*.jsonl").FirstOrDefault();
            Assert.NotNull(logFile);
            var contents = await File.ReadAllTextAsync(logFile);
            Assert.Contains("session-host-file", contents, StringComparison.Ordinal);
            Assert.Contains("app.data_ready", contents, StringComparison.Ordinal);
            Assert.DoesNotContain(appPaths.Root.Replace("\\", "\\\\", StringComparison.Ordinal), contents, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Cleanup(tempRoot);
        }
    }

    private static string CreateTempRoot() =>
        Path.Combine(Path.GetTempPath(), "zoom-dialer-logging", Guid.NewGuid().ToString("N"));

    private static void Cleanup(string path)
    {
        if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive: true);
        }
    }

    private sealed class CapturingLogFileWriter(ConcurrentQueue<string> lines) : ILogFileWriter
    {
        public string LastPath { get; private set; } = string.Empty;

        public void AppendLine(string filePath, string line)
        {
            LastPath = filePath;
            lines.Enqueue(line);
        }
    }

    private sealed class ThrowingLogFileWriter : ILogFileWriter
    {
        public void AppendLine(string filePath, string line) =>
            throw new IOException("disk full");
    }
}
