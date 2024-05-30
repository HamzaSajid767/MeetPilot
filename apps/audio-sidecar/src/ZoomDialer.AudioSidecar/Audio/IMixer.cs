using NAudio.Wave;

namespace ZoomDialer.AudioSidecar.Audio;

public sealed class AudioLevelMeters
{
    public float MicrophonePeak { get; init; }

    public float MicrophoneRms { get; init; }

    public float PlaybackPeak { get; init; }

    public float PlaybackRms { get; init; }

    public float OutputPeak { get; init; }

    public float OutputRms { get; init; }

    public bool MicrophoneClipped { get; init; }

    public bool PlaybackClipped { get; init; }

    public bool OutputClipped { get; init; }
}

public interface IMixer
{
    WaveFormat WaveFormat { get; }

    StemSampleProvider MicrophoneStem { get; }

    StemSampleProvider PlaybackStem { get; }

    ISampleProvider Output { get; }

    float MicrophoneGain { get; set; }

    float PlaybackGain { get; set; }

    float MasterGain { get; set; }

    AudioLevelMeters GetLevels();

    void Reset();
}
