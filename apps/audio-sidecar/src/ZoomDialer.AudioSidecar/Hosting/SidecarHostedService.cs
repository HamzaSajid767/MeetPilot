using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Configuration;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Utilities;

namespace ZoomDialer.AudioSidecar.Hosting;

public sealed class SidecarHostedService : BackgroundService
{
    private readonly ILogger<SidecarHostedService> _logger;
    private readonly ApplicationOptions _applicationOptions;
    private readonly IAppPaths _appPaths;
    private readonly LoggingSession _session;
    private readonly IAudioPipeServer _pipeServer;
    private readonly IPlaybackEngine _playbackEngine;

    public SidecarHostedService(
        ILogger<SidecarHostedService> logger,
        IOptions<ApplicationOptions> applicationOptions,
        IAppPaths appPaths,
        LoggingSession session,
        IAudioPipeServer pipeServer,
        IPlaybackEngine playbackEngine)
    {
        _logger = logger;
        _applicationOptions = applicationOptions.Value;
        _appPaths = appPaths;
        _session = session;
        _pipeServer = pipeServer;
        _playbackEngine = playbackEngine;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var scope = LogScopes.BeginSessionScope(_logger, _session.SessionId);

        try
        {
            await _appPaths.EnsureCreatedAsync(stoppingToken).ConfigureAwait(false);
            _logger.LogInformation(
                SidecarLogEventIds.AppDataReady,
                "Application data directories ready. LogsDirectoryName={LogsDirectoryName}",
                "logs");

            await _pipeServer.StartAsync(stoppingToken).ConfigureAwait(false);

            _logger.LogInformation(
                SidecarLogEventIds.HostStarted,
                "{ApplicationName} host started. Version={Version} Environment={Environment}",
                _applicationOptions.Name,
                ApplicationVersion.InformationalVersion,
                Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Production");

            await Task.Delay(Timeout.Infinite, stoppingToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Expected during graceful shutdown.
        }
        catch (Exception ex)
        {
            _logger.LogCritical(SidecarLogEventIds.HostFaulted, ex, "Sidecar hosted service faulted");
            throw;
        }

        _logger.LogInformation(SidecarLogEventIds.HostStopping, "Sidecar hosted service stopping");
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation(SidecarLogEventIds.HostStopping, "Sidecar hosted service stop requested");
        try
        {
            await _playbackEngine.StopAsync(cancellationToken).ConfigureAwait(false);
            await _pipeServer.StopAsync(cancellationToken).ConfigureAwait(false);
            await _playbackEngine.DisposeAsync().ConfigureAwait(false);
        }
        finally
        {
            await base.StopAsync(cancellationToken).ConfigureAwait(false);
            _logger.LogInformation(SidecarLogEventIds.HostStopped, "Sidecar hosted service stopped");
        }
    }
}
