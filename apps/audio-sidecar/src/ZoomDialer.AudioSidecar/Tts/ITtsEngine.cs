namespace ZoomDialer.AudioSidecar.Tts;

public sealed class TtsVoiceInfo
{
    public required string Id { get; init; }

    public required string DisplayName { get; init; }

    public required string Language { get; init; }

    public string? Gender { get; init; }
}

public sealed class SynthesizeSpeechRequest
{
    public required string Text { get; init; }

    public string? VoiceId { get; init; }

    /// <summary>SAPI rate scale from -10 to 10.</summary>
    public int Rate { get; init; }

    /// <summary>Linear volume from 0.0 to 1.0.</summary>
    public double Volume { get; init; } = 1.0;

    public required string OutputPath { get; init; }
}

public sealed class SynthesizeSpeechResult
{
    public required string Path { get; init; }

    public required int DurationMs { get; init; }
}

public interface ITtsEngine
{
    IReadOnlyList<TtsVoiceInfo> ListVoices();

    Task<SynthesizeSpeechResult> SynthesizeToFileAsync(
        SynthesizeSpeechRequest request,
        CancellationToken cancellationToken);
}
