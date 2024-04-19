using System.Buffers.Binary;
using System.Text;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC;

public static class LengthPrefixFrameCodec
{
    public const int LengthPrefixBytes = 4;

    public static byte[] Encode(ReadOnlySpan<byte> payload)
    {
        if (payload.Length is 0 or > ProtocolConstants.MaxPayloadBytes)
        {
            throw new InvalidDataException(
                $"Payload length {payload.Length} is outside the allowed range 1..{ProtocolConstants.MaxPayloadBytes}.");
        }

        var frame = new byte[LengthPrefixBytes + payload.Length];
        BinaryPrimitives.WriteUInt32LittleEndian(frame.AsSpan(0, LengthPrefixBytes), (uint)payload.Length);
        payload.CopyTo(frame.AsSpan(LengthPrefixBytes));
        return frame;
    }

    public static byte[] EncodeUtf8Json(string json)
    {
        ArgumentException.ThrowIfNullOrEmpty(json);
        return Encode(Encoding.UTF8.GetBytes(json));
    }

    public static async Task WriteFrameAsync(
        Stream stream,
        ReadOnlyMemory<byte> payload,
        CancellationToken cancellationToken)
    {
        var frame = Encode(payload.Span);
        await stream.WriteAsync(frame, cancellationToken).ConfigureAwait(false);
        await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
    }

    public static async Task<byte[]?> ReadFrameAsync(
        Stream stream,
        int maxPayloadBytes,
        CancellationToken cancellationToken)
    {
        var lengthBuffer = new byte[LengthPrefixBytes];
        if (!await ReadExactAsync(stream, lengthBuffer, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        var length = BinaryPrimitives.ReadUInt32LittleEndian(lengthBuffer);
        if (length == 0)
        {
            // Treat a zero-length prefix as a clean disconnect signal.
            return null;
        }

        if (length > (uint)maxPayloadBytes)
        {
            throw new InvalidDataException(
                $"Frame length {length} exceeds the configured maximum of {maxPayloadBytes} bytes.");
        }

        var payload = new byte[length];
        if (!await ReadExactAsync(stream, payload, cancellationToken).ConfigureAwait(false))
        {
            throw new EndOfStreamException("Connection closed before the full frame payload was received.");
        }

        return payload;
    }

    private static async Task<bool> ReadExactAsync(
        Stream stream,
        Memory<byte> buffer,
        CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await stream
                .ReadAsync(buffer[offset..], cancellationToken)
                .ConfigureAwait(false);
            if (read == 0)
            {
                return offset == 0;
            }

            offset += read;
        }

        return true;
    }
}
