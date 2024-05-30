using NAudio.Wave;

namespace ZoomDialer.AudioSidecar.Audio;

/// <summary>
/// Pull-based stem: silence when inactive, otherwise ring or provider samples with live gain.
/// </summary>
public sealed class StemSampleProvider : ISampleProvider
{
    private readonly object _gate = new();
    private FloatRingBuffer? _ring;
    private ISampleProvider? _provider;
    private float _gain = 1f;
    private float _clipVolume = 1f;
    private float _peak;
    private double _sumSquares;
    private int _meterSamples;
    private bool _clipped;

    public StemSampleProvider(WaveFormat waveFormat)
    {
        WaveFormat = waveFormat;
    }

    public WaveFormat WaveFormat { get; }

    public float Gain
    {
        get
        {
            lock (_gate)
            {
                return _gain;
            }
        }
        set
        {
            lock (_gate)
            {
                _gain = Math.Clamp(value, 0f, 1f);
            }
        }
    }

    public float ClipVolume
    {
        get
        {
            lock (_gate)
            {
                return _clipVolume;
            }
        }
        set
        {
            lock (_gate)
            {
                _clipVolume = Math.Clamp(value, 0f, 1f);
            }
        }
    }

    public void SetRing(FloatRingBuffer? ring)
    {
        lock (_gate)
        {
            _provider = null;
            _ring = ring;
        }
    }

    public void SetProvider(ISampleProvider? provider)
    {
        lock (_gate)
        {
            _ring = null;
            _provider = provider;
        }
    }

    public void ClearSource()
    {
        lock (_gate)
        {
            _ring = null;
            _provider = null;
        }
    }

    public (float Peak, float Rms, bool Clipped) ConsumeMeter()
    {
        lock (_gate)
        {
            var peak = _peak;
            var rms = _meterSamples > 0 ? (float)Math.Sqrt(_sumSquares / _meterSamples) : 0f;
            var clipped = _clipped;
            _peak = 0;
            _sumSquares = 0;
            _meterSamples = 0;
            _clipped = false;
            return (peak, rms, clipped);
        }
    }

    public int Read(float[] buffer, int offset, int count)
    {
        FloatRingBuffer? ring;
        ISampleProvider? provider;
        float gain;
        float clipVolume;
        lock (_gate)
        {
            ring = _ring;
            provider = _provider;
            gain = _gain;
            clipVolume = _clipVolume;
        }

        var read = 0;
        if (ring is not null)
        {
            read = ring.Read(buffer.AsSpan(offset, count));
        }
        else if (provider is not null)
        {
            read = provider.Read(buffer, offset, count);
        }

        for (var i = read; i < count; i++)
        {
            buffer[offset + i] = 0f;
        }

        var scale = gain * clipVolume;
        lock (_gate)
        {
            for (var i = 0; i < count; i++)
            {
                var sample = buffer[offset + i] * scale;
                if (float.IsNaN(sample) || float.IsInfinity(sample))
                {
                    sample = 0f;
                }

                if (Math.Abs(sample) > 1f)
                {
                    _clipped = true;
                }

                sample = Math.Clamp(sample, -1f, 1f);
                buffer[offset + i] = sample;
                var abs = Math.Abs(sample);
                if (abs > _peak)
                {
                    _peak = abs;
                }

                // Treat near-full-scale as clip for monitoring even if already clamped.
                if (abs >= 0.99f)
                {
                    _clipped = true;
                }

                _sumSquares += sample * sample;
                _meterSamples++;
            }
        }

        return count;
    }
}
