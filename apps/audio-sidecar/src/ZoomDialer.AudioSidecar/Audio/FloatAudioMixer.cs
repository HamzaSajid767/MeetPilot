using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace ZoomDialer.AudioSidecar.Audio;

/// <summary>
/// 48 kHz stereo float mixer summing microphone and playback stems.
/// </summary>
public sealed class FloatAudioMixer : IMixer
{
    private readonly MixingSampleProvider _mix;
    private readonly StemSampleProvider _outputMeter;

    public FloatAudioMixer(int sampleRateHz = 48000, int channels = 2)
    {
        WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(sampleRateHz, channels);
        MicrophoneStem = new StemSampleProvider(WaveFormat);
        PlaybackStem = new StemSampleProvider(WaveFormat);
        _mix = new MixingSampleProvider(WaveFormat)
        {
            ReadFully = true
        };
        _mix.AddMixerInput(MicrophoneStem);
        _mix.AddMixerInput(PlaybackStem);
        _outputMeter = new StemSampleProvider(WaveFormat)
        {
            Gain = 1f,
            ClipVolume = 1f
        };
        _outputMeter.SetProvider(_mix);
        Output = _outputMeter;
    }

    public WaveFormat WaveFormat { get; }

    public StemSampleProvider MicrophoneStem { get; }

    public StemSampleProvider PlaybackStem { get; }

    public ISampleProvider Output { get; }

    public float MicrophoneGain
    {
        get => MicrophoneStem.Gain;
        set => MicrophoneStem.Gain = value;
    }

    public float PlaybackGain
    {
        get => PlaybackStem.Gain;
        set => PlaybackStem.Gain = value;
    }

    public float MasterGain
    {
        get => _outputMeter.Gain;
        set => _outputMeter.Gain = value;
    }

    public AudioLevelMeters GetLevels()
    {
        var (micPeak, micRms, micClipped) = MicrophoneStem.ConsumeMeter();
        var (playPeak, playRms, playClipped) = PlaybackStem.ConsumeMeter();
        var (outPeak, outRms, outClipped) = _outputMeter.ConsumeMeter();
        return new AudioLevelMeters
        {
            MicrophonePeak = micPeak,
            MicrophoneRms = micRms,
            PlaybackPeak = playPeak,
            PlaybackRms = playRms,
            OutputPeak = outPeak,
            OutputRms = outRms,
            MicrophoneClipped = micClipped,
            PlaybackClipped = playClipped,
            OutputClipped = outClipped
        };
    }

    public void Reset()
    {
        MicrophoneStem.ClearSource();
        PlaybackStem.ClearSource();
        MicrophoneStem.Gain = 1f;
        PlaybackStem.Gain = 1f;
        PlaybackStem.ClipVolume = 1f;
        MasterGain = 1f;
    }
}
