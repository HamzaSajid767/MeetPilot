export interface TtsVoice {
  readonly id: string
  readonly displayName: string
  readonly language: string
  readonly gender: string | null
}

export interface CreateTtsPhraseRequest {
  readonly name: string
  readonly text: string
  readonly voiceId: string | null
  readonly rate: number
  readonly volume: number
}

export interface PreviewTtsRequest {
  readonly text: string
  readonly voiceId: string | null
  readonly rate: number
  readonly volume: number
}

export const TTS_IPC_CHANNELS = Object.freeze({
  listVoices: 'tts:list-voices',
  preview: 'tts:preview',
  create: 'tts:create'
} as const)

export const TTS_RATE_MIN = -10
export const TTS_RATE_MAX = 10

export function validateTtsText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Text is required')
  }
  if (trimmed.length > 4000) {
    throw new Error('Text must be 4000 characters or fewer')
  }
  return trimmed
}

export function validateTtsName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Phrase name is required')
  }
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i)
    if (code < 32 || '<>:"/\\|?*'.includes(trimmed[i]!)) {
      throw new Error('Phrase name contains invalid characters')
    }
  }
  return trimmed
}

export function clampTtsRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 0
  }
  return Math.min(TTS_RATE_MAX, Math.max(TTS_RATE_MIN, Math.round(rate)))
}

export function clampTtsVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 1
  }
  return Math.min(1, Math.max(0, volume))
}
