import { describe, expect, it } from 'vitest'
import {
  encodeFrame,
  encodeJsonFrame,
  FrameDecoder,
  FrameCodecError
} from '../src/main/ipc/frame-codec'

describe('frame codec', () => {
  it('round-trips a JSON payload', () => {
    const frame = encodeJsonFrame({ ok: true, value: 42 })
    const decoder = new FrameDecoder()
    const payloads = decoder.push(frame)
    expect(payloads).toHaveLength(1)
    expect(JSON.parse(payloads[0]!.toString('utf8'))).toEqual({ ok: true, value: 42 })
  })

  it('handles fragmented frames', () => {
    const frame = encodeFrame(Buffer.from('hello-world', 'utf8'))
    const decoder = new FrameDecoder()
    expect(decoder.push(frame.subarray(0, 2))).toEqual([])
    expect(decoder.push(frame.subarray(2, 7))).toEqual([])
    const payloads = decoder.push(frame.subarray(7))
    expect(payloads).toHaveLength(1)
    expect(payloads[0]!.toString('utf8')).toBe('hello-world')
  })

  it('rejects oversized frames', () => {
    const decoder = new FrameDecoder(8)
    const header = Buffer.alloc(4)
    header.writeUInt32LE(16, 0)
    expect(() => decoder.push(Buffer.concat([header, Buffer.alloc(16)]))).toThrow(FrameCodecError)
  })
})
