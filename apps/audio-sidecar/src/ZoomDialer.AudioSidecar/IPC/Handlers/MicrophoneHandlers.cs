using System.Text.Json;
using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC.Handlers;

public sealed class SetMicrophoneHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IMicrophoneSelector _selector;
    private readonly ILogger<SetMicrophoneHandler> _logger;

    public SetMicrophoneHandler(IMicrophoneSelector selector, ILogger<SetMicrophoneHandler> logger)
    {
        _selector = selector;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.SetMicrophone;

    public Task<MessageEnvelope?> HandleAsync(MessageEnvelope request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (request.Payload is not { } payload
            || payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("deviceId", out var deviceIdElement)
            || deviceIdElement.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(deviceIdElement.GetString()))
        {
            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateErrorResponse(
                    request,
                    ProtocolConstants.ErrorCodes.InvalidMessage,
                    "SetMicrophone.deviceId must be a non-empty string.",
                    retriable: false));
        }

        try
        {
            var device = _selector.SetSelectedDevice(deviceIdElement.GetString()!);
            _logger.LogInformation(
                SidecarLogEventIds.MicrophoneStarted,
                "Microphone device selected. DeviceId={DeviceId}",
                device.Id);

            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateSuccessResponse(
                    request,
                    ProtocolConstants.Commands.SetMicrophone,
                    new SetMicrophoneResultDto
                    {
                        DeviceId = device.Id,
                        Succeeded = true,
                        FriendlyName = device.FriendlyName
                    }));
        }
        catch (InvalidOperationException ex)
        {
            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateErrorResponse(
                    request,
                    ProtocolConstants.ErrorCodes.DeviceUnavailable,
                    ex.Message,
                    retriable: false));
        }
    }
}

public sealed class StartMicrophoneHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IAudioMixEngine _mixEngine;

    public StartMicrophoneHandler(IAudioMixEngine mixEngine)
    {
        _mixEngine = mixEngine;
    }

    public string MessageType => ProtocolConstants.Commands.StartMicrophone;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        try
        {
            await _mixEngine.StartMicrophoneAsync(cancellationToken).ConfigureAwait(false);
            return EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.StartMicrophone,
                new { succeeded = true });
        }
        catch (Exception ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.DeviceUnavailable,
                ex.Message,
                retriable: true);
        }
    }
}

public sealed class StopMicrophoneHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IAudioMixEngine _mixEngine;

    public StopMicrophoneHandler(IAudioMixEngine mixEngine)
    {
        _mixEngine = mixEngine;
    }

    public string MessageType => ProtocolConstants.Commands.StopMicrophone;

    public async Task<MessageEnvelope?> HandleAsync(
        MessageEnvelope request,
        CancellationToken cancellationToken)
    {
        await _mixEngine.StopMicrophoneAsync(cancellationToken).ConfigureAwait(false);
        return EnvelopeFactory.CreateSuccessResponse(
            request,
            ProtocolConstants.Commands.StopMicrophone,
            new { succeeded = true });
    }
}

public sealed class SetMixerGainsHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IAudioMixEngine _mixEngine;

    public SetMixerGainsHandler(IAudioMixEngine mixEngine)
    {
        _mixEngine = mixEngine;
    }

    public string MessageType => ProtocolConstants.Commands.SetMixerGains;

    public Task<MessageEnvelope?> HandleAsync(MessageEnvelope request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (request.Payload is not { } payload
            || payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("microphoneGain", out var micElement)
            || micElement.ValueKind != JsonValueKind.Number
            || !payload.TryGetProperty("playbackGain", out var playElement)
            || playElement.ValueKind != JsonValueKind.Number)
        {
            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateErrorResponse(
                    request,
                    ProtocolConstants.ErrorCodes.InvalidMessage,
                    "SetMixerGains requires microphoneGain and playbackGain numbers between 0 and 1.",
                    retriable: false));
        }

        var mic = micElement.GetDouble();
        var play = playElement.GetDouble();
        if (mic is < 0 or > 1 || play is < 0 or > 1)
        {
            return Task.FromResult<MessageEnvelope?>(
                EnvelopeFactory.CreateErrorResponse(
                    request,
                    ProtocolConstants.ErrorCodes.InvalidMessage,
                    "SetMixerGains gains must be between 0.0 and 1.0.",
                    retriable: false));
        }

        var master = 1.0;
        if (payload.TryGetProperty("masterGain", out var masterElement))
        {
            if (masterElement.ValueKind != JsonValueKind.Number)
            {
                return Task.FromResult<MessageEnvelope?>(
                    EnvelopeFactory.CreateErrorResponse(
                        request,
                        ProtocolConstants.ErrorCodes.InvalidMessage,
                        "SetMixerGains.masterGain must be a number between 0 and 1.",
                        retriable: false));
            }

            master = masterElement.GetDouble();
            if (master is < 0 or > 1)
            {
                return Task.FromResult<MessageEnvelope?>(
                    EnvelopeFactory.CreateErrorResponse(
                        request,
                        ProtocolConstants.ErrorCodes.InvalidMessage,
                        "SetMixerGains gains must be between 0.0 and 1.0.",
                        retriable: false));
            }
        }

        _mixEngine.MicrophoneGain = (float)mic;
        _mixEngine.PlaybackGain = (float)play;
        _mixEngine.MasterGain = (float)master;

        return Task.FromResult<MessageEnvelope?>(
            EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.SetMixerGains,
                new SetMixerGainsResultDto
                {
                    MicrophoneGain = mic,
                    PlaybackGain = play,
                    MasterGain = master,
                    Succeeded = true
                }));
    }
}

public sealed class PlayTestToneHandler : IRequestHandler<MessageEnvelope>
{
    private readonly IAudioMixEngine _mixEngine;
    private readonly ILogger<PlayTestToneHandler> _logger;

    public PlayTestToneHandler(IAudioMixEngine mixEngine, ILogger<PlayTestToneHandler> logger)
    {
        _mixEngine = mixEngine;
        _logger = logger;
    }

    public string MessageType => ProtocolConstants.Commands.PlayTestTone;

    public async Task<MessageEnvelope?> HandleAsync(MessageEnvelope request, CancellationToken cancellationToken)
    {
        if (!TryParse(request, out var kind, out var frequencyHz, out var volume, out var durationMs, out var error))
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                error!,
                retriable: false);
        }

        var playbackId = Guid.NewGuid().ToString("N");
        try
        {
            var accepted = await _mixEngine
                .PlayTestToneAsync(
                    new PlayTestToneRequest
                    {
                        Kind = kind!,
                        FrequencyHz = frequencyHz,
                        Volume = volume,
                        DurationMs = durationMs,
                        PlaybackId = playbackId
                    },
                    cancellationToken)
                .ConfigureAwait(false);

            return EnvelopeFactory.CreateSuccessResponse(
                request,
                ProtocolConstants.Commands.PlayTestTone,
                new PlayTestToneResultDto
                {
                    PlaybackId = accepted.PlaybackId,
                    Succeeded = true,
                    DurationMs = accepted.DurationMs,
                    Kind = kind!
                });
        }
        catch (ArgumentException ex)
        {
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                ex.Message,
                retriable: false);
        }
        catch (Exception ex)
        {
            _logger.LogError(SidecarLogEventIds.PlaybackFailed, ex, "PlayTestTone failed");
            return EnvelopeFactory.CreateErrorResponse(
                request,
                ProtocolConstants.ErrorCodes.PlaybackFailed,
                "Unable to start test tone.",
                retriable: true);
        }
    }

    private static bool TryParse(
        MessageEnvelope request,
        out string? kind,
        out double frequencyHz,
        out double volume,
        out int? durationMs,
        out string? error)
    {
        kind = null;
        frequencyHz = 440;
        volume = 0;
        durationMs = null;
        error = null;

        if (request.Payload is not { } payload || payload.ValueKind != JsonValueKind.Object)
        {
            error = "PlayTestTone payload is required.";
            return false;
        }

        if (!payload.TryGetProperty("kind", out var kindElement)
            || kindElement.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(kindElement.GetString()))
        {
            error = "PlayTestTone.kind must be sine, pink, or white.";
            return false;
        }

        kind = kindElement.GetString()!.Trim().ToLowerInvariant();
        if (kind is not ("sine" or "pink" or "white"))
        {
            error = "PlayTestTone.kind must be sine, pink, or white.";
            return false;
        }

        if (!payload.TryGetProperty("volume", out var volumeElement)
            || volumeElement.ValueKind != JsonValueKind.Number)
        {
            error = "PlayTestTone.volume must be a number between 0.0 and 1.0.";
            return false;
        }

        volume = volumeElement.GetDouble();
        if (volume is < 0 or > 1)
        {
            error = "PlayTestTone.volume must be between 0.0 and 1.0.";
            return false;
        }

        if (payload.TryGetProperty("frequencyHz", out var freqElement))
        {
            if (freqElement.ValueKind != JsonValueKind.Number)
            {
                error = "PlayTestTone.frequencyHz must be a number.";
                return false;
            }

            frequencyHz = freqElement.GetDouble();
            if (frequencyHz is <= 0 or > 20_000)
            {
                error = "PlayTestTone.frequencyHz must be between 0 and 20000.";
                return false;
            }
        }

        if (payload.TryGetProperty("durationMs", out var durationElement))
        {
            if (durationElement.ValueKind != JsonValueKind.Number)
            {
                error = "PlayTestTone.durationMs must be a number.";
                return false;
            }

            var raw = durationElement.GetDouble();
            if (raw < 0 || raw > int.MaxValue)
            {
                error = "PlayTestTone.durationMs must be a non-negative integer.";
                return false;
            }

            durationMs = (int)raw;
        }

        return true;
    }
}
