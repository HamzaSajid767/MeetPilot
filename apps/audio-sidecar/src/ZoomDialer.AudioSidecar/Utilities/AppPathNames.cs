using System.Text.Json;
using System.Text.Json.Serialization;

namespace ZoomDialer.AudioSidecar.Utilities;

public sealed class AppPathNames
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = false
    };

    [JsonPropertyName("rootDirectoryName")]
    public required string RootDirectoryName { get; init; }

    [JsonPropertyName("directories")]
    public required AppPathDirectoryNames Directories { get; init; }

    public static AppPathNames LoadFromFile(string filePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);

        if (!Path.IsPathFullyQualified(filePath))
        {
            throw new ArgumentException("App path constants file must be a fully qualified path.", nameof(filePath));
        }

        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("App path constants file was not found.", filePath);
        }

        var json = File.ReadAllText(filePath);
        var names = JsonSerializer.Deserialize<AppPathNames>(json, SerializerOptions)
            ?? throw new InvalidOperationException("App path constants file deserialized to null.");

        names.Validate();
        return names;
    }

    public static AppPathNames LoadDefault()
    {
        var filePath = Path.Combine(AppContext.BaseDirectory, "app-paths.constants.json");
        return LoadFromFile(filePath);
    }

    public void Validate()
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(RootDirectoryName);
        ArgumentNullException.ThrowIfNull(Directories);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Config);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Database);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Logs);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Assets);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Phrases);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Cache);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Temp);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Imports);
        ArgumentException.ThrowIfNullOrWhiteSpace(Directories.Exports);
    }
}

public sealed class AppPathDirectoryNames
{
    [JsonPropertyName("config")]
    public required string Config { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }

    [JsonPropertyName("logs")]
    public required string Logs { get; init; }

    [JsonPropertyName("assets")]
    public required string Assets { get; init; }

    [JsonPropertyName("phrases")]
    public required string Phrases { get; init; }

    [JsonPropertyName("cache")]
    public required string Cache { get; init; }

    [JsonPropertyName("temp")]
    public required string Temp { get; init; }

    [JsonPropertyName("imports")]
    public required string Imports { get; init; }

    [JsonPropertyName("exports")]
    public required string Exports { get; init; }
}
