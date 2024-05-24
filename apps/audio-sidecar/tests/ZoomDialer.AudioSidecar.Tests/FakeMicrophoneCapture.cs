using NAudio.Wave;
using ZoomDialer.AudioSidecar.Audio;

namespace ZoomDialer.AudioSidecar.Tests;

internal sealed class FakeMicrophoneCapture : IMicrophoneCapture
{
    private readonly object _gate = new();
    private FloatRingBuffer? _destination;
    private bool _capturing;
    private bool _disposed;
    private CancellationTokenSource? _pumpCts;

    public bool IsCapturing
    {
        get
        {
            lock (_gate)
            {
                return _capturing;
            }
        }
    }

    public float SampleValue { get; set; } = 0.25f;

    public event EventHandler? CaptureStarted;

    public event EventHandler<Exception>? CaptureFailed;

    public event EventHandler? CaptureStopped;

    public Task StartAsync(FloatRingBuffer destination, WaveFormat busFormat, CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(destination);
        ArgumentNullException.ThrowIfNull(busFormat);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_gate)
        {
            if (_capturing)
            {
                return Task.CompletedTask;
            }

            _destination = destination;
            _capturing = true;
            _pumpCts = new CancellationTokenSource();
            var token = _pumpCts.Token;
            _ = Task.Run(() => PumpAsync(busFormat, token), CancellationToken.None);
        }

        CaptureStarted?.Invoke(this, EventArgs.Empty);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            if (!_capturing)
            {
                return Task.CompletedTask;
            }

            _pumpCts?.Cancel();
            _pumpCts?.Dispose();
            _pumpCts = null;
            _destination = null;
            _capturing = false;
        }

        CaptureStopped?.Invoke(this, EventArgs.Empty);
        return Task.CompletedTask;
    }

    public void Fail(Exception exception)
    {
        CaptureFailed?.Invoke(this, exception);
    }

    public ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return ValueTask.CompletedTask;
        }

        _disposed = true;
        return new ValueTask(StopAsync(CancellationToken.None));
    }

    private async Task PumpAsync(WaveFormat busFormat, CancellationToken token)
    {
        var frame = new float[busFormat.Channels * Math.Max(1, busFormat.SampleRate / 50)];
        while (!token.IsCancellationRequested)
        {
            FloatRingBuffer? ring;
            lock (_gate)
            {
                ring = _destination;
            }

            if (ring is null)
            {
                break;
            }

            var value = SampleValue;
            for (var i = 0; i < frame.Length; i++)
            {
                frame[i] = value;
            }

            ring.Write(frame);
            try
            {
                await Task.Delay(20, token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
