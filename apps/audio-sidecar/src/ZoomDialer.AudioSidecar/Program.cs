using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Configuration;
using ZoomDialer.AudioSidecar.Hosting;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.IPC.Handlers;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;
using ZoomDialer.AudioSidecar.Tts;
using ZoomDialer.AudioSidecar.Utilities;

namespace ZoomDialer.AudioSidecar;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        IHost? host = null;

        try
        {
            host = SidecarHostFactory.Create(args);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Sidecar host construction failed: {ex}");
            return 1;
        }

        using (host)
        {
            var logger = host.Services.GetRequiredService<ILoggerFactory>().CreateLogger(LogScopes.Program);
            var session = host.Services.GetRequiredService<LoggingSession>();

            using (LogScopes.BeginSessionScope(logger, session.SessionId))
            {
                logger.LogInformation(
                    SidecarLogEventIds.HostStarting,
                    "Starting {ApplicationName} v{Version}",
                    ApplicationVersion.ProductName,
                    ApplicationVersion.InformationalVersion);

                if (args.Contains("--smoke", StringComparer.OrdinalIgnoreCase))
                {
                    return await RunSmokeAsync(host, logger).ConfigureAwait(false);
                }

                try
                {
                    await host.RunAsync().ConfigureAwait(false);
                    logger.LogInformation(SidecarLogEventIds.HostStopped, "Sidecar shut down gracefully");
                    return 0;
                }
                catch (Exception ex)
                {
                    logger.LogCritical(SidecarLogEventIds.HostFaulted, ex, "Sidecar terminated unexpectedly");
                    return 1;
                }
            }
        }
    }

    private static async Task<int> RunSmokeAsync(IHost host, ILogger logger)
    {
        try
        {
            await host.StartAsync().ConfigureAwait(false);
            logger.LogInformation(SidecarLogEventIds.SmokeSucceeded, "Smoke start succeeded");

            await host.StopAsync().ConfigureAwait(false);
            logger.LogInformation(SidecarLogEventIds.SmokeSucceeded, "Smoke stop succeeded");
            return 0;
        }
        catch (Exception ex)
        {
            logger.LogCritical(SidecarLogEventIds.HostFaulted, ex, "Smoke verification failed");
            return 1;
        }
    }
}

public static class SidecarHostFactory
{
    public static IHost Create(string[] args, Action<IServiceCollection>? configureServices = null)
    {
        var builder = Host.CreateApplicationBuilder(args);
        PipeArgumentConfigurer.ApplyPipeNameOverrides(builder.Configuration, args);

        builder.Services
            .AddOptions<ApplicationOptions>()
            .Bind(builder.Configuration.GetSection(ApplicationOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        builder.Services
            .AddOptions<LoggingOptions>()
            .Bind(builder.Configuration.GetSection(LoggingOptions.SectionName));

        builder.Services
            .AddOptions<AudioOptions>()
            .Bind(builder.Configuration.GetSection(AudioOptions.SectionName));

        builder.Services
            .AddOptions<NamedPipeOptions>()
            .Bind(builder.Configuration.GetSection(NamedPipeOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        builder.Services.AddSingleton<LoggingSession>();
        builder.Services.AddSingleton<IDirectoryCreator, FileSystemDirectoryCreator>();
        builder.Services.AddSingleton<IAppPaths, AppPathsService>();
        builder.Services.AddSingleton<ILogFileWriter, FileSystemLogFileWriter>();
        builder.Services.AddSingleton<JsonFileLoggerProvider>();

        builder.Services.AddSingleton<IAudioDeviceManager, NAudioAudioDeviceManager>();
        builder.Services.AddSingleton<IOutputDeviceSelector, OutputDeviceSelector>();
        builder.Services.AddSingleton<IMicrophoneSelector, MicrophoneSelector>();
        builder.Services.AddSingleton<IMixer>(_ => new FloatAudioMixer());
        builder.Services.AddSingleton<IMicrophoneCapture, NAudioMicrophoneCapture>();
        builder.Services.AddSingleton<IMicrophoneRecorder, NAudioMicrophoneRecorder>();
        builder.Services.AddSingleton<IAudioMixEngine, AudioMixEngine>();
        builder.Services.AddSingleton<IPlaybackEngine, NAudioPlaybackEngine>();
        builder.Services.AddSingleton<ITtsEngine, WindowsSapiTtsEngine>();
        builder.Services.AddSingleton<IMessageSerializer<MessageEnvelope>, JsonMessageSerializer>();
        builder.Services.AddSingleton<IProtocolVersionValidator, ExactProtocolVersionValidator>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, PingHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, GetVersionHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, HealthCheckHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, PlayAudioHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, StopPlaybackHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, GetAudioOutputDevicesHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, SetOutputDeviceHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, GetAudioInputDevicesHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, SetMicrophoneHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, StartMicrophoneHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, StopMicrophoneHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, SetMixerGainsHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, PlayTestToneHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, GetAvailableVoicesHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, SynthesizeSpeechHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, StartRecordingHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, StopRecordingHandler>();
        builder.Services.AddSingleton<IRequestHandler<MessageEnvelope>, CancelRecordingHandler>();
        builder.Services.AddSingleton<IMessageDispatcher<MessageEnvelope>, MessageDispatcher>();
        builder.Services.AddSingleton<IAudioPipeServer, AudioPipeServer>();

        builder.Logging.ClearProviders();
        builder.Logging.AddConfiguration(builder.Configuration.GetSection("Logging"));
        builder.Logging.AddConsole();
        // Register after ClearProviders so the JSONL sink is not removed.
        builder.Services.AddSingleton<ILoggerProvider>(static sp => sp.GetRequiredService<JsonFileLoggerProvider>());
        builder.Services.AddHostedService<PlaybackEventBridge>();
        builder.Services.AddHostedService<SidecarHostedService>();

        configureServices?.Invoke(builder.Services);

        return builder.Build();
    }
}
