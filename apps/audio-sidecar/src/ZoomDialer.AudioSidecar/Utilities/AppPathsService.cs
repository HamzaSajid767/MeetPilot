namespace ZoomDialer.AudioSidecar.Utilities;

public sealed class AppPathsService : IAppPaths
{
    private readonly IDirectoryCreator _directoryCreator;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Task? _ensureTask;

    public AppPathsService(
        IDirectoryCreator directoryCreator,
        string? applicationDataBase = null,
        AppPathNames? names = null)
    {
        ArgumentNullException.ThrowIfNull(directoryCreator);

        var resolvedNames = names ?? AppPathNames.LoadDefault();
        resolvedNames.Validate();

        var basePath = applicationDataBase
            ?? Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

        basePath = AssertAbsoluteBase(basePath);

        Root = Path.GetFullPath(Path.Combine(basePath, resolvedNames.RootDirectoryName));
        Config = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Config));
        Database = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Database));
        Logs = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Logs));
        Assets = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Assets));
        Phrases = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Phrases));
        Cache = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Cache));
        Temp = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Temp));
        Imports = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Imports));
        Exports = Path.GetFullPath(Path.Combine(Root, resolvedNames.Directories.Exports));
        _directoryCreator = directoryCreator;
    }

    public string Root { get; }

    public string Config { get; }

    public string Database { get; }

    public string Logs { get; }

    public string Assets { get; }

    public string Phrases { get; }

    public string Cache { get; }

    public string Temp { get; }

    public string Imports { get; }

    public string Exports { get; }

    public IReadOnlyList<string> ListDirectories() =>
    [
        Root,
        Config,
        Database,
        Logs,
        Assets,
        Phrases,
        Cache,
        Temp,
        Imports,
        Exports
    ];

    public async Task EnsureCreatedAsync(CancellationToken cancellationToken = default)
    {
        if (_ensureTask is { IsCompletedSuccessfully: true })
        {
            return;
        }

        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_ensureTask is { IsCompletedSuccessfully: true })
            {
                return;
            }

            _ensureTask = CreateAllAsync(cancellationToken);
            await _ensureTask.ConfigureAwait(false);
        }
        catch
        {
            _ensureTask = null;
            throw;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task CreateAllAsync(CancellationToken cancellationToken)
    {
        foreach (var directory in ListDirectories())
        {
            await _directoryCreator.CreateDirectoryAsync(directory, cancellationToken).ConfigureAwait(false);
        }
    }

    private static string AssertAbsoluteBase(string applicationDataBase)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationDataBase);

        if (applicationDataBase.Contains('\0', StringComparison.Ordinal))
        {
            throw new ArgumentException(
                "Application data base path must not contain null bytes.",
                nameof(applicationDataBase));
        }

        if (!Path.IsPathFullyQualified(applicationDataBase))
        {
            throw new ArgumentException(
                $"Application data base path must be fully qualified: {applicationDataBase}",
                nameof(applicationDataBase));
        }

        return Path.GetFullPath(applicationDataBase);
    }
}
