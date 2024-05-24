namespace ZoomDialer.AudioSidecar.Contracts;

public enum EngineState
{
    Idle = 0,
    Armed = 1,
    Mixing = 2,
    Playing = 3,
    Recovering = 4,
    Faulted = 5
}
