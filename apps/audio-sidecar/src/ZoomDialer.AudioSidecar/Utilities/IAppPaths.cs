namespace ZoomDialer.AudioSidecar.Utilities;

public interface IAppPaths
{
    string Root { get; }

    string Config { get; }

    string Database { get; }

    string Logs { get; }

    string Assets { get; }

    string Phrases { get; }

    string Cache { get; }

    string Temp { get; }

    string Imports { get; }

    string Exports { get; }

    IReadOnlyList<string> ListDirectories();

    Task EnsureCreatedAsync(CancellationToken cancellationToken = default);
}
