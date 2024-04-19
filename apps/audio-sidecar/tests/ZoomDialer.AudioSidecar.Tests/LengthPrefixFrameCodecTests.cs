using System.Buffers.Binary;
using System.Text;
using ZoomDialer.AudioSidecar.IPC;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class LengthPrefixFrameCodecTests
{
    [Fact]
    public async Task Encode_And_Read_RoundTrip()
    {
        var payload = Encoding.UTF8.GetBytes("{\"ok\":true}");
        await using var stream = new MemoryStream();
        await LengthPrefixFrameCodec.WriteFrameAsync(stream, payload, CancellationToken.None);

        stream.Position = 0;
        var read = await LengthPrefixFrameCodec.ReadFrameAsync(
            stream,
            ProtocolConstants.MaxPayloadBytes,
            CancellationToken.None);

        Assert.NotNull(read);
        Assert.Equal(payload, read);
    }

    [Fact]
    public async Task Read_Handles_Fragmented_Prefix_And_Body()
    {
        var payload = Encoding.UTF8.GetBytes("fragmented-payload");
        var frame = LengthPrefixFrameCodec.Encode(payload);
        await using var stream = new FragmentingStream(frame, chunkSize: 3);

        var read = await LengthPrefixFrameCodec.ReadFrameAsync(
            stream,
            ProtocolConstants.MaxPayloadBytes,
            CancellationToken.None);

        Assert.Equal(payload, read);
    }

    [Fact]
    public async Task Read_Rejects_Oversized_Frame()
    {
        await using var stream = new MemoryStream();
        var length = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(length, (uint)(ProtocolConstants.MaxPayloadBytes + 1));
        await stream.WriteAsync(length);
        await stream.WriteAsync(new byte[8]);
        stream.Position = 0;

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            LengthPrefixFrameCodec.ReadFrameAsync(stream, ProtocolConstants.MaxPayloadBytes, CancellationToken.None));
    }

    private sealed class FragmentingStream : Stream
    {
        private readonly byte[] _data;
        private readonly int _chunkSize;
        private int _offset;

        public FragmentingStream(byte[] data, int chunkSize)
        {
            _data = data;
            _chunkSize = chunkSize;
        }

        public override bool CanRead => true;

        public override bool CanSeek => false;

        public override bool CanWrite => false;

        public override long Length => _data.Length;

        public override long Position
        {
            get => _offset;
            set => throw new NotSupportedException();
        }

        public override void Flush()
        {
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            if (_offset >= _data.Length)
            {
                return 0;
            }

            var toCopy = Math.Min(Math.Min(count, _chunkSize), _data.Length - _offset);
            Buffer.BlockCopy(_data, _offset, buffer, offset, toCopy);
            _offset += toCopy;
            return toCopy;
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
