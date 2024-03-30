using System.Collections.Concurrent;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ZoomDialer.AudioSidecar;
using ZoomDialer.AudioSidecar.Utilities;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class AppPathsTests
{
    [Fact]
    public void LoadDefault_Reads_Shared_Directory_Names()
    {
        var names = AppPathNames.LoadDefault();

        Assert.Equal("ZoomDialerCompanion", names.RootDirectoryName);
        Assert.Equal("config", names.Directories.Config);
        Assert.Equal("database", names.Directories.Database);
        Assert.Equal("logs", names.Directories.Logs);
        Assert.Equal("assets", names.Directories.Assets);
        Assert.Equal("phrases", names.Directories.Phrases);
        Assert.Equal("cache", names.Directories.Cache);
        Assert.Equal("temp", names.Directories.Temp);
        Assert.Equal("imports", names.Directories.Imports);
        Assert.Equal("exports", names.Directories.Exports);
    }

    [Fact]
    public void Service_Resolves_Documented_Directory_Tree()
    {
        var basePath = Path.Combine(Path.GetTempPath(), "zoom-dialer-appdata-resolve", Guid.NewGuid().ToString("N"));
        var names = AppPathNames.LoadDefault();
        var service = new AppPathsService(new FileSystemDirectoryCreator(), basePath, names);

        Assert.Equal(Path.Combine(basePath, names.RootDirectoryName), service.Root);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Config), service.Config);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Database), service.Database);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Logs), service.Logs);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Assets), service.Assets);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Phrases), service.Phrases);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Cache), service.Cache);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Temp), service.Temp);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Imports), service.Imports);
        Assert.Equal(Path.Combine(service.Root, names.Directories.Exports), service.Exports);
    }

    [Fact]
    public async Task EnsureCreated_Creates_Directories_Idempotently()
    {
        var basePath = Path.Combine(Path.GetTempPath(), "zoom-dialer-appdata-create", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(basePath);

        try
        {
            var service = new AppPathsService(new FileSystemDirectoryCreator(), basePath, AppPathNames.LoadDefault());

            await service.EnsureCreatedAsync();
            await service.EnsureCreatedAsync();

            foreach (var directory in service.ListDirectories())
            {
                Assert.True(Directory.Exists(directory), directory);
            }
        }
        finally
        {
            if (Directory.Exists(basePath))
            {
                Directory.Delete(basePath, recursive: true);
            }
        }
    }

    [Fact]
    public async Task EnsureCreated_Is_Safe_Under_Concurrent_Calls()
    {
        var created = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        var creator = new CountingDirectoryCreator(created);
        var basePath = Path.Combine(Path.GetTempPath(), "zoom-dialer-appdata-concurrent", Guid.NewGuid().ToString("N"));
        var service = new AppPathsService(creator, basePath, AppPathNames.LoadDefault());

        await Task.WhenAll(
            service.EnsureCreatedAsync(),
            service.EnsureCreatedAsync(),
            service.EnsureCreatedAsync());

        Assert.Equal(service.ListDirectories().Count, created.Count);
    }

    [Fact]
    public void Constructor_Rejects_Invalid_Base_Paths()
    {
        var creator = new FileSystemDirectoryCreator();
        var names = AppPathNames.LoadDefault();

        Assert.Throws<ArgumentException>(() => new AppPathsService(creator, "relative\\appdata", names));
        Assert.Throws<ArgumentException>(() => new AppPathsService(creator, " ", names));
        Assert.Throws<ArgumentException>(() => new AppPathsService(creator, "C:\\path\0bad", names));
    }

    [Fact]
    public void Host_Registers_AppPaths_As_Singleton()
    {
        using var host = SidecarHostFactory.Create([]);

        var first = host.Services.GetRequiredService<IAppPaths>();
        var second = host.Services.GetRequiredService<IAppPaths>();

        Assert.Same(first, second);
        Assert.Contains("ZoomDialerCompanion", first.Root, StringComparison.Ordinal);
    }

    private sealed class CountingDirectoryCreator(ConcurrentDictionary<string, byte> created) : IDirectoryCreator
    {
        public Task CreateDirectoryAsync(string path, CancellationToken cancellationToken = default)
        {
            created.TryAdd(path, 0);
            Directory.CreateDirectory(path);
            return Task.CompletedTask;
        }
    }
}
