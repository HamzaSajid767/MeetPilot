using System.IO.Pipes;
using System.Text.Json;
using ZoomDialer.AudioSidecar;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class MixPipeIntegrationTests
{
    private static string FixturePath => Path.Combine(AppContext.BaseDirectory, "fixtures", "tone.wav");

    [Fact]
    public async Task StartMicrophone_PlayAudio_SetMixerGains_Succeed()
    {
        Assert.True(File.Exists(FixturePath), $"Missing fixture at {FixturePath}");
        var pipeName = $"ZoomDialerMix-{Guid.NewGuid():N}";
        using var host = SidecarHostFactory.Create(["--pipe-name", pipeName]);
        await host.StartAsync();

        try
        {
            await using var client = await ConnectAsync(pipeName);

            var inputs = await RequestAsync(client, ProtocolConstants.Commands.GetAudioInputDevices, new { });
            Assert.True(inputs.GetProperty("ok").GetBoolean());
            Assert.True(inputs.GetProperty("data").GetProperty("devices").GetArrayLength() > 0);

            var gains = await RequestAsync(
                client,
                ProtocolConstants.Commands.SetMixerGains,
                new { microphoneGain = 0.4, playbackGain = 0.6 });
            Assert.True(gains.GetProperty("ok").GetBoolean());
            Assert.Equal(0.4, gains.GetProperty("data").GetProperty("microphoneGain").GetDouble(), 3);
            Assert.Equal(0.6, gains.GetProperty("data").GetProperty("playbackGain").GetDouble(), 3);

            var startMic = await RequestAsync(client, ProtocolConstants.Commands.StartMicrophone, new { });
            Assert.True(startMic.GetProperty("ok").GetBoolean());

            var play = await RequestAsync(
                client,
                ProtocolConstants.Commands.PlayAudio,
                new { path = FixturePath, volume = 0.2 });
            Assert.True(play.GetProperty("ok").GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(play.GetProperty("data").GetProperty("phraseId").GetString()));

            // Drain events briefly while both stems are active.
            _ = await TryReadEventAsync(client, ProtocolConstants.Events.AudioLevels, TimeSpan.FromSeconds(1.5));

            var stopPlay = await RequestAsync(client, ProtocolConstants.Commands.StopPlayback, new { });
            Assert.True(stopPlay.GetProperty("ok").GetBoolean());

            var stopMic = await RequestAsync(client, ProtocolConstants.Commands.StopMicrophone, new { });
            Assert.True(stopMic.GetProperty("ok").GetBoolean());
        }
        finally
        {
            await host.StopAsync();
        }
    }

    private static async Task<NamedPipeClientStream> ConnectAsync(string pipeName)
    {
        var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        Exception? last = null;
        for (var attempt = 0; attempt < 50; attempt++)
        {
            try
            {
                await client.ConnectAsync(250, cts.Token);
                return client;
            }
            catch (Exception ex) when (ex is TimeoutException or IOException or UnauthorizedAccessException)
            {
                last = ex;
                await Task.Delay(50, cts.Token);
            }
        }

        await client.DisposeAsync();
        throw new InvalidOperationException("Unable to connect to mix pipe server.", last);
    }

    private static async Task<JsonElement> RequestAsync(
        NamedPipeClientStream client,
        string type,
        object payload)
    {
        var serializer = new JsonMessageSerializer();
        var request = new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = type,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Request,
            CorrelationId = Guid.NewGuid().ToString("N"),
            Payload = JsonSerializer.SerializeToElement(payload),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };

        await LengthPrefixFrameCodec.WriteFrameAsync(
            client,
            serializer.Serialize(request),
            CancellationToken.None);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        while (!cts.IsCancellationRequested)
        {
            var bytes = await LengthPrefixFrameCodec.ReadFrameAsync(
                client,
                ProtocolConstants.MaxPayloadBytes,
                cts.Token);
            Assert.NotNull(bytes);
            var envelope = serializer.Deserialize(bytes!);
            if (envelope.Direction == ProtocolConstants.Directions.Event)
            {
                continue;
            }

            Assert.Equal(request.Id, envelope.RequestId);
            Assert.NotNull(envelope.Payload);
            return envelope.Payload!.Value;
        }

        throw new TimeoutException($"Timed out waiting for response to {type}");
    }

    private static async Task<bool> TryReadEventAsync(
        NamedPipeClientStream client,
        string eventType,
        TimeSpan timeout)
    {
        var serializer = new JsonMessageSerializer();
        using var cts = new CancellationTokenSource(timeout);
        try
        {
            while (!cts.IsCancellationRequested)
            {
                var bytes = await LengthPrefixFrameCodec.ReadFrameAsync(
                    client,
                    ProtocolConstants.MaxPayloadBytes,
                    cts.Token);
                if (bytes is null)
                {
                    return false;
                }

                var envelope = serializer.Deserialize(bytes);
                if (envelope.Direction == ProtocolConstants.Directions.Event
                    && string.Equals(envelope.Type, eventType, StringComparison.Ordinal))
                {
                    return true;
                }
            }
        }
        catch (OperationCanceledException)
        {
            return false;
        }

        return false;
    }
}
