using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace ZoomDialer.AudioSidecar.Audio;

public interface IMicrophoneCapture : IAsyncDisposable
{
    bool IsCapturing { get; }

    event EventHandler? CaptureStarted;

    event EventHandler<Exception>? CaptureFailed;

    event EventHandler? CaptureStopped;

    Task StartAsync(FloatRingBuffer destination, WaveFormat busFormat, CancellationToken cancellationToken);

    Task StopAsync(CancellationToken cancellationToken);
}

public sealed class NAudioMicrophoneCapture : IMicrophoneCapture
{
    private readonly IMicrophoneSelector _selector;
    private readonly IAudioDeviceManager _deviceManager;
    private readonly object _gate = new();

    private WasapiCapture? _capture;
    private MMDevice? _device;
    private FloatRingBuffer? _destination;
    private WaveFormat? _busFormat;
    private bool _disposed;

    public NAudioMicrophoneCapture(IMicrophoneSelector selector, IAudioDeviceManager deviceManager)
    {
        _selector = selector;
        _deviceManager = deviceManager;
    }

    public bool IsCapturing
    {
        get
        {
            lock (_gate)
            {
                return _capture is not null;
            }
        }
    }

    public event EventHandler? CaptureStarted;

    public event EventHandler<Exception>? CaptureFailed;

    public event EventHandler? CaptureStopped;

    public Task StartAsync(
        FloatRingBuffer destination,
        WaveFormat busFormat,
        CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        cancellationToken.ThrowIfCancellationRequested();
        ArgumentNullException.ThrowIfNull(destination);
        ArgumentNullException.ThrowIfNull(busFormat);

        lock (_gate)
        {
            if (_capture is not null)
            {
                return Task.CompletedTask;
            }

            var info = _selector.ResolveForCapture();
            var device = _deviceManager.OpenCaptureDevice(info.Id)
                ?? _deviceManager.OpenDefaultCaptureDevice();

            WasapiCapture capture;
            try
            {
                capture = new WasapiCapture(device) { ShareMode = AudioClientShareMode.Shared };
            }
            catch
            {
                device.Dispose();
                throw;
            }

            _device = device;
            _capture = capture;
            _destination = destination;
            _busFormat = busFormat;
            destination.Clear();

            capture.DataAvailable += OnDataAvailable;
            capture.RecordingStopped += OnRecordingStopped;
            capture.StartRecording();
        }

        CaptureStarted?.Invoke(this, EventArgs.Empty);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        StopInternal(emitStopped: true);
        return Task.CompletedTask;
    }

    public ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return ValueTask.CompletedTask;
        }

        _disposed = true;
        StopInternal(emitStopped: false);
        return ValueTask.CompletedTask;
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        FloatRingBuffer? destination;
        WaveFormat? busFormat;
        WasapiCapture? capture;
        lock (_gate)
        {
            destination = _destination;
            busFormat = _busFormat;
            capture = _capture;
        }

        if (destination is null || busFormat is null || capture is null || e.BytesRecorded <= 0)
        {
            return;
        }

        try
        {
            using var source = new RawSourceWaveStream(e.Buffer, 0, e.BytesRecorded, capture.WaveFormat);
            ISampleProvider samples = source.ToSampleProvider();
            if (samples.WaveFormat.Channels == 1 && busFormat.Channels == 2)
            {
                samples = new MonoToStereoSampleProvider(samples);
            }
            else if (samples.WaveFormat.Channels == 2 && busFormat.Channels == 1)
            {
                samples = new StereoToMonoSampleProvider(samples);
            }

            if (samples.WaveFormat.SampleRate != busFormat.SampleRate)
            {
                samples = new WdlResamplingSampleProvider(samples, busFormat.SampleRate);
            }

            var buffer = new float[Math.Max(256, busFormat.SampleRate / 50 * busFormat.Channels)];
            int read;
            while ((read = samples.Read(buffer, 0, buffer.Length)) > 0)
            {
                destination.Write(buffer.AsSpan(0, read));
            }
        }
        catch
        {
            // Drop chunk; RecordingStopped handles disconnect.
        }
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        var wasCapturing = false;
        lock (_gate)
        {
            wasCapturing = _capture is not null;
        }

        StopInternal(emitStopped: false);

        if (e.Exception is not null)
        {
            CaptureFailed?.Invoke(this, e.Exception);
        }
        else if (wasCapturing)
        {
            CaptureStopped?.Invoke(this, EventArgs.Empty);
        }
    }

    private void StopInternal(bool emitStopped)
    {
        WasapiCapture? capture;
        MMDevice? device;
        lock (_gate)
        {
            capture = _capture;
            device = _device;
            _capture = null;
            _device = null;
            _destination = null;
            _busFormat = null;
        }

        if (capture is null)
        {
            return;
        }

        try
        {
            capture.DataAvailable -= OnDataAvailable;
            capture.RecordingStopped -= OnRecordingStopped;
            if (capture.CaptureState != CaptureState.Stopped)
            {
                capture.StopRecording();
            }
        }
        catch
        {
            // ignored
        }

        try
        {
            capture.Dispose();
        }
        catch
        {
            // ignored
        }

        try
        {
            device?.Dispose();
        }
        catch
        {
            // ignored
        }

        if (emitStopped)
        {
            CaptureStopped?.Invoke(this, EventArgs.Empty);
        }
    }
}
