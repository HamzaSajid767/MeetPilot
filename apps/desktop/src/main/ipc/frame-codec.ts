import { PROTOCOL_LIMITS } from '../../shared/protocol'

export const LENGTH_PREFIX_BYTES = 4

export class FrameCodecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FrameCodecError'
  }
}

export function encodeFrame(
  payload: Uint8Array,
  maxPayloadBytes = PROTOCOL_LIMITS.maxPayloadBytes
): Buffer {
  if (payload.byteLength === 0 || payload.byteLength > maxPayloadBytes) {
    throw new FrameCodecError(
      `Payload length ${payload.byteLength} is outside the allowed range 1..${maxPayloadBytes}.`
    )
  }

  const frame = Buffer.allocUnsafe(LENGTH_PREFIX_BYTES + payload.byteLength)
  frame.writeUInt32LE(payload.byteLength, 0)
  Buffer.from(payload).copy(frame, LENGTH_PREFIX_BYTES)
  return frame
}

export function encodeJsonFrame(
  value: unknown,
  maxPayloadBytes = PROTOCOL_LIMITS.maxPayloadBytes
): Buffer {
  return encodeFrame(Buffer.from(JSON.stringify(value), 'utf8'), maxPayloadBytes)
}

export class FrameDecoder {
  private buffer = Buffer.alloc(0)

  constructor(private readonly maxPayloadBytes = PROTOCOL_LIMITS.maxPayloadBytes) {}

  push(chunk: Buffer): Buffer[] {
    this.buffer =
      this.buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.buffer, chunk])
    const frames: Buffer[] = []

    while (this.buffer.length >= LENGTH_PREFIX_BYTES) {
      const length = this.buffer.readUInt32LE(0)
      if (length === 0) {
        this.buffer = this.buffer.subarray(LENGTH_PREFIX_BYTES)
        continue
      }

      if (length > this.maxPayloadBytes) {
        throw new FrameCodecError(
          `Frame length ${length} exceeds the configured maximum of ${this.maxPayloadBytes} bytes.`
        )
      }

      const total = LENGTH_PREFIX_BYTES + length
      if (this.buffer.length < total) {
        break
      }

      frames.push(this.buffer.subarray(LENGTH_PREFIX_BYTES, total))
      this.buffer = this.buffer.subarray(total)
    }

    return frames
  }

  reset(): void {
    this.buffer = Buffer.alloc(0)
  }
}
