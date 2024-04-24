using Microsoft.Extensions.Configuration;
using ZoomDialer.AudioSidecar.Configuration;

namespace ZoomDialer.AudioSidecar.Hosting;

public static class PipeArgumentConfigurer
{
    public static void ApplyPipeNameOverrides(IConfigurationManager configuration, string[] args)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(args);

        var pipeName = TryGetArgValue(args, "--pipe-name")
            ?? Environment.GetEnvironmentVariable("ZOOM_DIALER_PIPE_NAME");

        if (string.IsNullOrWhiteSpace(pipeName))
        {
            pipeName = $"ZoomDialerCompanion-{Guid.NewGuid():N}";
        }

        configuration.AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                [$"{NamedPipeOptions.SectionName}:PipeName"] = pipeName.Trim()
            });
    }

    private static string? TryGetArgValue(string[] args, string name)
    {
        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            if (string.Equals(arg, name, StringComparison.OrdinalIgnoreCase)
                && i + 1 < args.Length)
            {
                return args[i + 1];
            }

            var prefix = name + "=";
            if (arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return arg[prefix.Length..];
            }
        }

        return null;
    }
}
