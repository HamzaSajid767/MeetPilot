using NAudio.Wave;
using ZoomDialer.AudioSidecar.Audio;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class MixerTests
{
    [Fact]
    public void FloatRingBuffer_Write_Read_RoundTrips()
    {
        var ring = new FloatRingBuffer(8);
        Assert.Equal(4, ring.Write(new float[] { 0.1f, 0.2f, 0.3f, 0.4f }));
        var dest = new float[4];
        Assert.Equal(4, ring.Read(dest));
        Assert.Equal(new[] { 0.1f, 0.2f, 0.3f, 0.4f }, dest);
        Assert.Equal(0, ring.Count);
    }

    [Fact]
    public void Stem_Applies_Gain_And_ClipVolume()
    {
        var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
        var stem = new StemSampleProvider(format) { Gain = 0.5f, ClipVolume = 0.5f };
        var source = new ConstantSampleProvider(format, 1f);
        stem.SetProvider(source);

        var buffer = new float[4];
        Assert.Equal(4, stem.Read(buffer, 0, 4));
        Assert.All(buffer, sample => Assert.Equal(0.25f, sample, 3));
    }

    [Fact]
    public void Stem_Gain_HotChange_Affects_Next_Read()
    {
        var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
        var stem = new StemSampleProvider(format) { Gain = 1f };
        stem.SetProvider(new ConstantSampleProvider(format, 1f));

        var first = new float[2];
        stem.Read(first, 0, 2);
        Assert.Equal(1f, first[0], 3);

        stem.Gain = 0.25f;
        var second = new float[2];
        stem.Read(second, 0, 2);
        Assert.Equal(0.25f, second[0], 3);
    }

    [Fact]
    public void Stem_Silent_When_Cleared()
    {
        var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
        var stem = new StemSampleProvider(format);
        stem.SetProvider(new ConstantSampleProvider(format, 0.8f));
        stem.ClearSource();

        var buffer = new float[4];
        stem.Read(buffer, 0, 4);
        Assert.All(buffer, sample => Assert.Equal(0f, sample));
    }

    [Fact]
    public void Stem_Clamps_Overflow_And_NaN()
    {
        var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
        var stem = new StemSampleProvider(format) { Gain = 1f };
        stem.SetProvider(new SequenceSampleProvider(format, new[] { 2f, float.NaN, -3f, float.PositiveInfinity }));

        var buffer = new float[4];
        stem.Read(buffer, 0, 4);
        Assert.Equal(1f, buffer[0]);
        Assert.Equal(0f, buffer[1]);
        Assert.Equal(-1f, buffer[2]);
        Assert.Equal(0f, buffer[3]);
    }

    [Fact]
    public void Mixer_Sums_Mic_And_Playback_Stems()
    {
        var mixer = new FloatAudioMixer();
        mixer.MicrophoneGain = 0.5f;
        mixer.PlaybackGain = 0.5f;
        mixer.MicrophoneStem.SetProvider(new ConstantSampleProvider(mixer.WaveFormat, 0.8f));
        mixer.PlaybackStem.SetProvider(new ConstantSampleProvider(mixer.WaveFormat, 0.6f));
        mixer.PlaybackStem.ClipVolume = 1f;

        var buffer = new float[4];
        Assert.Equal(4, mixer.Output.Read(buffer, 0, 4));
        // MixingSampleProvider sums: 0.8*0.5 + 0.6*0.5 = 0.7
        Assert.All(buffer, sample => Assert.Equal(0.7f, sample, 2));
    }

    [Fact]
    public void Mixer_GetLevels_Includes_Playback_And_Clip_Flags()
    {
        var mixer = new FloatAudioMixer();
        mixer.MicrophoneStem.SetProvider(new ConstantSampleProvider(mixer.WaveFormat, 0.5f));
        mixer.PlaybackStem.SetProvider(new ConstantSampleProvider(mixer.WaveFormat, 0.4f));
        mixer.PlaybackStem.ClipVolume = 1f;

        var buffer = new float[480];
        mixer.Output.Read(buffer, 0, buffer.Length);

        var levels = mixer.GetLevels();
        Assert.True(levels.MicrophonePeak > 0.4f);
        Assert.True(levels.PlaybackPeak > 0.3f);
        Assert.True(levels.OutputPeak > 0.5f);
        Assert.False(levels.MicrophoneClipped);
        Assert.False(levels.PlaybackClipped);
    }

    [Fact]
    public void Stem_Reports_Clip_When_Driven_Over_Unity()
    {
        var format = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
        var stem = new StemSampleProvider(format) { Gain = 1f };
        stem.SetProvider(new ConstantSampleProvider(format, 1.5f));

        var buffer = new float[8];
        stem.Read(buffer, 0, buffer.Length);
        var (_, _, clipped) = stem.ConsumeMeter();
        Assert.True(clipped);
        Assert.All(buffer, sample => Assert.Equal(1f, sample));
    }

    [Fact]
    public void Mixer_MasterGain_Scales_Output()
    {
        var mixer = new FloatAudioMixer();
        mixer.MasterGain = 0.5f;
        mixer.PlaybackStem.SetProvider(new ConstantSampleProvider(mixer.WaveFormat, 0.8f));
        mixer.PlaybackStem.ClipVolume = 1f;

        var buffer = new float[4];
        mixer.Output.Read(buffer, 0, 4);
        Assert.All(buffer, sample => Assert.Equal(0.4f, sample, 2));
    }

    private sealed class ConstantSampleProvider : ISampleProvider
    {
        private readonly float _value;

        public ConstantSampleProvider(WaveFormat waveFormat, float value)
        {
            WaveFormat = waveFormat;
            _value = value;
        }

        public WaveFormat WaveFormat { get; }

        public int Read(float[] buffer, int offset, int count)
        {
            for (var i = 0; i < count; i++)
            {
                buffer[offset + i] = _value;
            }

            return count;
        }
    }

    private sealed class SequenceSampleProvider : ISampleProvider
    {
        private readonly float[] _samples;
        private int _index;

        public SequenceSampleProvider(WaveFormat waveFormat, float[] samples)
        {
            WaveFormat = waveFormat;
            _samples = samples;
        }

        public WaveFormat WaveFormat { get; }

        public int Read(float[] buffer, int offset, int count)
        {
            var n = Math.Min(count, _samples.Length - _index);
            for (var i = 0; i < n; i++)
            {
                buffer[offset + i] = _samples[_index++];
            }

            return n;
        }
    }
}
