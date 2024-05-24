namespace ZoomDialer.AudioSidecar.Audio;

/// <summary>
/// Thread-safe float sample ring buffer for mic capture → mixer pull.
/// </summary>
public sealed class FloatRingBuffer
{
    private readonly float[] _buffer;
    private readonly object _gate = new();
    private int _write;
    private int _read;
    private int _count;

    public FloatRingBuffer(int capacitySamples)
    {
        if (capacitySamples < 2)
        {
            throw new ArgumentOutOfRangeException(nameof(capacitySamples));
        }

        _buffer = new float[capacitySamples];
    }

    public int Count
    {
        get
        {
            lock (_gate)
            {
                return _count;
            }
        }
    }

    public void Clear()
    {
        lock (_gate)
        {
            _write = 0;
            _read = 0;
            _count = 0;
        }
    }

    public int Write(ReadOnlySpan<float> samples)
    {
        lock (_gate)
        {
            var written = 0;
            foreach (var sample in samples)
            {
                if (_count >= _buffer.Length)
                {
                    // Drop oldest sample to keep stream live under overrun.
                    _read = (_read + 1) % _buffer.Length;
                    _count--;
                }

                _buffer[_write] = sample;
                _write = (_write + 1) % _buffer.Length;
                _count++;
                written++;
            }

            return written;
        }
    }

    public int Read(Span<float> destination)
    {
        lock (_gate)
        {
            var toRead = Math.Min(destination.Length, _count);
            for (var i = 0; i < toRead; i++)
            {
                destination[i] = _buffer[_read];
                _read = (_read + 1) % _buffer.Length;
            }

            _count -= toRead;
            return toRead;
        }
    }
}
