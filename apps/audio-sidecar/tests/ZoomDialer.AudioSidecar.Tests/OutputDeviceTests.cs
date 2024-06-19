using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using ZoomDialer.AudioSidecar.Audio;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.IPC.Handlers;
using ZoomDialer.AudioSidecar.Models;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class OutputDeviceTests
{
    private static string FixturePath => Path.Combine(AppContext.BaseDirectory, "fixtures", "tone.wav");

    [Fact]
    public async Task Enumerate_Returns_Devices_With_Default_Flagged()
    {
        var manager = new NAudioAudioDeviceManager();
        var devices = await manager.ListRenderDevicesAsync(CancellationToken.None);

        Assert.NotEmpty(devices);
        Assert.Contains(devices, d => d.IsDefault);
        Assert.All(devices, d =>
        {
            Assert.False(string.IsNullOrWhiteSpace(d.Id));
            Assert.False(string.IsNullOrWhiteSpace(d.FriendlyName));
            Assert.False(string.IsNullOrWhiteSpace(d.DeviceState));
        });
        Assert.Single(devices.Where(d => d.IsDefault));
    }

    [Fact]
    public async Task GetAudioOutputDevices_Handler_Returns_List()
    {
        var handler = new GetAudioOutputDevicesHandler(
            new NAudioAudioDeviceManager(),
            NullLogger<GetAudioOutputDevicesHandler>.Instance);
        var request = new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = ProtocolConstants.Commands.GetAudioOutputDevices,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Request,
            Timestamp = DateTimeOffset.UtcNow.ToString("O"),
            Payload = JsonSerializer.SerializeToElement(new { })
        };

        var response = await handler.HandleAsync(request, CancellationToken.None);
        Assert.NotNull(response);
        Assert.True(response!.Payload!.Value.GetProperty("ok").GetBoolean());
        var devices = response.Payload.Value.GetProperty("data").GetProperty("devices");
        Assert.True(devices.GetArrayLength() > 0);
        Assert.Contains(
            devices.EnumerateArray(),
            d => d.GetProperty("isDefault").GetBoolean());
        Assert.All(
            devices.EnumerateArray(),
            d => Assert.True(d.TryGetProperty("isVirtualDevice", out _)));
    }

    [Fact]
    public async Task SetOutputDevice_Accepts_Valid_Render_Device()
    {
        var devices = new NAudioAudioDeviceManager();
        var selector = new OutputDeviceSelector(devices);
        var handler = new SetOutputDeviceHandler(selector, NullLogger<SetOutputDeviceHandler>.Instance);

        var list = await devices.ListRenderDevicesAsync(CancellationToken.None);
        var target = list.First(d => d.SupportsPlayback);

        var response = await handler.HandleAsync(CreateSetRequest(target.Id), CancellationToken.None);
        Assert.NotNull(response);
        Assert.True(response!.Payload!.Value.GetProperty("ok").GetBoolean());
        Assert.Equal(target.Id, response.Payload.Value.GetProperty("data").GetProperty("deviceId").GetString());
        Assert.Equal(target.Id, selector.SelectedDeviceId);
    }

    [Fact]
    public async Task SetOutputDevice_Rejects_Unknown_Id()
    {
        var devices = new NAudioAudioDeviceManager();
        var selector = new OutputDeviceSelector(devices);
        var handler = new SetOutputDeviceHandler(selector, NullLogger<SetOutputDeviceHandler>.Instance);

        var response = await handler.HandleAsync(
            CreateSetRequest($"missing-device-{Guid.NewGuid():N}"),
            CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(
            ProtocolConstants.ErrorCodes.DeviceUnavailable,
            response!.Payload!.Value.GetProperty("code").GetString());
        Assert.Null(selector.SelectedDeviceId);
    }

    [Fact]
    public async Task Play_Routes_To_Selected_Device()
    {
        Assert.True(File.Exists(FixturePath), $"Missing fixture at {FixturePath}");
        var devices = new NAudioAudioDeviceManager();
        var selector = new OutputDeviceSelector(devices);
        var list = await devices.ListRenderDevicesAsync(CancellationToken.None);
        var target = list.First(d => d.SupportsPlayback);
        selector.SetSelectedDevice(target.Id);

        await using var engine = TestPlaybackFactory.CreateEngine(selector, devices);
        var accepted = await engine.PlayAsync(
            new PlayAudioRequest
            {
                Path = FixturePath,
                Volume = 0.1,
                PlaybackId = Guid.NewGuid().ToString("N")
            },
            CancellationToken.None);

        Assert.Equal(target.Id, accepted.OutputDeviceId);
        Assert.False(accepted.UsedFallbackDevice);
        await engine.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Play_Falls_Back_When_Selected_Device_Missing()
    {
        Assert.True(File.Exists(FixturePath), $"Missing fixture at {FixturePath}");
        var fake = new FakeDeviceManager();
        var selector = new OutputDeviceSelector(fake);
        selector.SetSelectedDevice("selected-id");
        fake.RemoveSelected();

        await using var engine = TestPlaybackFactory.CreateEngine(selector, fake);
        var accepted = await engine.PlayAsync(
            new PlayAudioRequest
            {
                Path = FixturePath,
                Volume = 0.1,
                PlaybackId = Guid.NewGuid().ToString("N")
            },
            CancellationToken.None);

        Assert.True(accepted.UsedFallbackDevice);
        Assert.Equal(fake.DefaultId, accepted.OutputDeviceId);
        Assert.Null(selector.SelectedDeviceId);
        Assert.Contains("unavailable", accepted.FallbackReason, StringComparison.OrdinalIgnoreCase);
        await engine.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task SetOutputDevice_While_Playing_Does_Not_Stop_Session()
    {
        Assert.True(File.Exists(FixturePath), $"Missing fixture at {FixturePath}");
        var devices = new NAudioAudioDeviceManager();
        var selector = new OutputDeviceSelector(devices);
        var list = await devices.ListRenderDevicesAsync(CancellationToken.None);
        var playbackCapable = list.Where(d => d.SupportsPlayback).ToList();
        Assert.NotEmpty(playbackCapable);

        // Generate a longer clip so selection mid-play is observable (fixture tone is ~300ms).
        var longWav = Path.Combine(Path.GetTempPath(), $"mix-long-{Guid.NewGuid():N}.wav");
        WriteSilenceWav(longWav, TimeSpan.FromSeconds(3));

        await using var engine = TestPlaybackFactory.CreateEngine(selector, devices);
        try
        {
            var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            engine.PlaybackStarted += (_, _) => started.TrySetResult();

            var playbackId = Guid.NewGuid().ToString("N");
            await engine.PlayAsync(
                new PlayAudioRequest { Path = longWav, Volume = 0.1, PlaybackId = playbackId },
                CancellationToken.None);
            await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
            Assert.Equal(playbackId, engine.ActivePlaybackId);

            var target = playbackCapable[0];
            selector.SetSelectedDevice(target.Id);

            Assert.Equal(playbackId, engine.ActivePlaybackId);
            await engine.StopAsync(CancellationToken.None);
        }
        finally
        {
            try
            {
                File.Delete(longWav);
            }
            catch
            {
                // ignored
            }
        }
    }

    private static void WriteSilenceWav(string path, TimeSpan duration)
    {
        var format = new NAudio.Wave.WaveFormat(48000, 16, 2);
        using var writer = new NAudio.Wave.WaveFileWriter(path, format);
        var bytesPerSecond = format.AverageBytesPerSecond;
        var totalBytes = (int)(bytesPerSecond * duration.TotalSeconds);
        var buffer = new byte[format.BlockAlign * 256];
        var written = 0;
        while (written < totalBytes)
        {
            var chunk = Math.Min(buffer.Length, totalBytes - written);
            writer.Write(buffer, 0, chunk);
            written += chunk;
        }
    }

    private static MessageEnvelope CreateSetRequest(string deviceId)
    {
        return new MessageEnvelope
        {
            Id = Guid.NewGuid().ToString("N"),
            Type = ProtocolConstants.Commands.SetOutputDevice,
            ProtocolVersion = ProtocolConstants.ProtocolVersion,
            Direction = ProtocolConstants.Directions.Request,
            CorrelationId = Guid.NewGuid().ToString("N"),
            Payload = JsonSerializer.SerializeToElement(new { deviceId }),
            Timestamp = DateTimeOffset.UtcNow.ToString("O")
        };
    }

    /// <summary>
    /// Minimal fake that can simulate a selected device disappearing between select and play.
    /// Open* methods are unused because fallback path opens default via OpenDefaultRenderDevice —
    /// for real WASAPI we still need a working default open; this fake only covers selector/resolution.
    /// </summary>
    private sealed class FakeDeviceManager : IAudioDeviceManager
    {
        private readonly AudioDeviceInfo _selected = new()
        {
            Id = "selected-id",
            FriendlyName = "Selected Fake",
            IsDefault = false,
            DeviceState = ProtocolConstants.DeviceStates.Active,
            SupportsPlayback = true
        };

        private readonly AudioDeviceInfo _default = new()
        {
            Id = "default-id",
            FriendlyName = "Default Fake",
            IsDefault = true,
            DeviceState = ProtocolConstants.DeviceStates.Active,
            SupportsPlayback = true
        };

        private bool _selectedPresent = true;

        public string DefaultId => _default.Id;

        public void RemoveSelected() => _selectedPresent = false;

        public Task<IReadOnlyList<AudioDeviceInfo>> ListCaptureDevicesAsync(CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<AudioDeviceInfo>>(Array.Empty<AudioDeviceInfo>());

        public Task<IReadOnlyList<AudioDeviceInfo>> ListRenderDevicesAsync(CancellationToken cancellationToken)
        {
            var list = new List<AudioDeviceInfo> { _default };
            if (_selectedPresent)
            {
                list.Insert(0, _selected);
            }

            return Task.FromResult<IReadOnlyList<AudioDeviceInfo>>(list);
        }

        public AudioDeviceInfo? TryGetRenderDevice(string deviceId)
        {
            if (_selectedPresent && string.Equals(deviceId, _selected.Id, StringComparison.Ordinal))
            {
                return _selected;
            }

            if (string.Equals(deviceId, _default.Id, StringComparison.Ordinal))
            {
                return _default;
            }

            return null;
        }

        public AudioDeviceInfo GetDefaultRenderDevice() => _default;

        public AudioDeviceInfo? TryGetCaptureDevice(string deviceId) => null;

        public AudioDeviceInfo GetDefaultCaptureDevice()
            => new NAudioAudioDeviceManager().GetDefaultCaptureDevice();

        public NAudio.CoreAudioApi.MMDevice? OpenRenderDevice(string deviceId)
        {
            // Delegate opens to the real default device so WasapiOut can still initialize in tests.
            var real = new NAudioAudioDeviceManager();
            if (string.Equals(deviceId, _default.Id, StringComparison.Ordinal)
                || string.Equals(deviceId, _selected.Id, StringComparison.Ordinal))
            {
                return real.OpenDefaultRenderDevice();
            }

            return real.OpenRenderDevice(deviceId) ?? real.OpenDefaultRenderDevice();
        }

        public NAudio.CoreAudioApi.MMDevice OpenDefaultRenderDevice()
            => new NAudioAudioDeviceManager().OpenDefaultRenderDevice();

        public NAudio.CoreAudioApi.MMDevice? OpenCaptureDevice(string deviceId)
            => new NAudioAudioDeviceManager().OpenCaptureDevice(deviceId);

        public NAudio.CoreAudioApi.MMDevice OpenDefaultCaptureDevice()
            => new NAudioAudioDeviceManager().OpenDefaultCaptureDevice();
    }
}
