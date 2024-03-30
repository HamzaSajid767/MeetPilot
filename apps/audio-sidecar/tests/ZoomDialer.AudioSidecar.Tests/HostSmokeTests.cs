using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ZoomDialer.AudioSidecar;
using ZoomDialer.AudioSidecar.Configuration;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class HostSmokeTests
{
    [Fact]
    public async Task Host_Starts_And_Stops_Gracefully()
    {
        using var host = SidecarHostFactory.Create([]);

        var options = host.Services.GetRequiredService<IOptions<ApplicationOptions>>().Value;
        Assert.False(string.IsNullOrWhiteSpace(options.Name));

        var loggerFactory = host.Services.GetRequiredService<ILoggerFactory>();
        Assert.NotNull(loggerFactory);

        await host.StartAsync();

        var lifetime = host.Services.GetRequiredService<IHostApplicationLifetime>();
        Assert.True(lifetime.ApplicationStarted.IsCancellationRequested);

        await host.StopAsync();
        Assert.True(lifetime.ApplicationStopped.IsCancellationRequested);
    }
}
