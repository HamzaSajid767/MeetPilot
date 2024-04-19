namespace ZoomDialer.AudioSidecar.IPC;

public interface IMessageSerializer<TEnvelope>
{
    byte[] Serialize(TEnvelope envelope);

    TEnvelope Deserialize(ReadOnlySpan<byte> payload);
}
