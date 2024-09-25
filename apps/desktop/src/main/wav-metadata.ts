import { openSync, readSync, closeSync, fstatSync, existsSync } from 'node:fs'
import path from 'node:path'

export interface WavMetadata {
  readonly durationMs: number
  readonly sampleRate: number
  readonly channels: number
  readonly bitsPerSample: number
  readonly audioFormat: number
}

const WAVE_FORMAT_PCM = 1
const WAVE_FORMAT_IEEE_FLOAT = 3
const WAVE_FORMAT_EXTENSIBLE = 0xfffe

/**
 * Read and validate a WAV file header; return duration and format metadata.
 * Supports PCM and IEEE float (including WAVE_FORMAT_EXTENSIBLE wrapping those).
 */
export function readWavMetadata(filePath: string): WavMetadata {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('WAV path is required')
  }

  if (!path.isAbsolute(filePath) && !path.win32.isAbsolute(filePath)) {
    // Allow relative paths in tests; still must exist.
  }

  if (!stringEndsWithWav(filePath)) {
    throw new Error('Only .wav files are supported')
  }

  if (!existsSync(filePath)) {
    throw new Error(`WAV file was not found: ${filePath}`)
  }

  const fd = openSync(filePath, 'r')
  try {
    const fileSize = fstatSync(fd).size
    if (fileSize < 44) {
      throw new Error('WAV file is too small to contain a valid header')
    }

    const header = Buffer.alloc(Math.min(fileSize, 12))
    readSync(fd, header, 0, header.length, 0)
    if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('File is not a valid RIFF/WAVE file')
    }

    let offset = 12
    let audioFormat = 0
    let channels = 0
    let sampleRate = 0
    let byteRate = 0
    let bitsPerSample = 0
    let dataSize: number | null = null
    let foundFmt = false

    while (offset + 8 <= fileSize) {
      const chunkHeader = Buffer.alloc(8)
      readSync(fd, chunkHeader, 0, 8, offset)
      const chunkId = chunkHeader.toString('ascii', 0, 4)
      const chunkSize = chunkHeader.readUInt32LE(4)
      const dataOffset = offset + 8

      if (chunkId === 'fmt ') {
        if (chunkSize < 16) {
          throw new Error('WAV fmt chunk is too small')
        }

        const fmt = Buffer.alloc(Math.min(chunkSize, 40))
        readSync(fd, fmt, 0, fmt.length, dataOffset)
        audioFormat = fmt.readUInt16LE(0)
        channels = fmt.readUInt16LE(2)
        sampleRate = fmt.readUInt32LE(4)
        byteRate = fmt.readUInt32LE(8)
        bitsPerSample = fmt.readUInt16LE(14)

        if (audioFormat === WAVE_FORMAT_EXTENSIBLE && fmt.length >= 40) {
          // SubFormat GUID first two bytes = actual format (PCM/IEEE float).
          audioFormat = fmt.readUInt16LE(24)
        }

        if (audioFormat !== WAVE_FORMAT_PCM && audioFormat !== WAVE_FORMAT_IEEE_FLOAT) {
          throw new Error(
            `Unsupported WAV audio format ${audioFormat}; only PCM and IEEE float are allowed`
          )
        }

        if (channels < 1 || sampleRate < 1 || bitsPerSample < 8 || byteRate < 1) {
          throw new Error('WAV fmt chunk contains invalid format fields')
        }

        foundFmt = true
      } else if (chunkId === 'data') {
        dataSize = chunkSize
        // Prefer first data chunk once fmt is known; keep scanning only if fmt missing.
        if (foundFmt) {
          break
        }
      }

      // Chunk sizes are word-aligned.
      offset = dataOffset + chunkSize + (chunkSize % 2)
    }

    if (!foundFmt) {
      throw new Error('WAV file is missing a fmt chunk')
    }

    if (dataSize == null || dataSize < 0) {
      throw new Error('WAV file is missing a data chunk')
    }

    const durationMs = Math.max(0, Math.round((dataSize / byteRate) * 1000))
    return {
      durationMs,
      sampleRate,
      channels,
      bitsPerSample,
      audioFormat
    }
  } finally {
    closeSync(fd)
  }
}

function stringEndsWithWav(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.wav'
}
