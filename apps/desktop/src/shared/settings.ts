import {
  isAllowedShortcut,
  normalizeShortcut,
  type Phrase
} from './phrase'
import { isPlaybackMode, type PlaybackMode } from './playback'

export const SETTINGS_SCHEMA_VERSION = 1 as const

export type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface PersistedAudioSettings {
  readonly selectedOutputDeviceId: string | null
  readonly selectedInputDeviceId: string | null
  readonly microphoneGain: number
  readonly playbackGain: number
  readonly masterGain: number
}

export interface PersistedCalibrationSettings {
  readonly showRms: boolean
  readonly peakHoldEnabled: boolean
  readonly historyEnabled: boolean
}

export interface PersistedUiSettings {
  readonly categoryFilter: string
}

export interface AppSettingsDocument {
  readonly schemaVersion: typeof SETTINGS_SCHEMA_VERSION
  readonly phrases: readonly Phrase[]
  readonly audio: PersistedAudioSettings
  readonly calibration: PersistedCalibrationSettings
  readonly playbackMode: PlaybackMode
  readonly ui: PersistedUiSettings
}

export interface SettingsStatusSnapshot {
  readonly saveState: SettingsSaveState
  readonly lastSavedAtMs: number | null
  readonly lastError: string | null
  readonly categoryFilter: string
  readonly filePath: string
}

export const SETTINGS_IPC_CHANNELS = Object.freeze({
  getStatus: 'settings:get-status',
  exportFile: 'settings:export',
  importFile: 'settings:import',
  reset: 'settings:reset',
  setCategoryFilter: 'settings:set-category-filter',
  setCalibration: 'settings:set-calibration'
} as const)

export function createDefaultSettings(): AppSettingsDocument {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    phrases: [],
    audio: {
      selectedOutputDeviceId: null,
      selectedInputDeviceId: null,
      microphoneGain: 1,
      playbackGain: 1,
      masterGain: 1
    },
    calibration: {
      showRms: true,
      peakHoldEnabled: true,
      historyEnabled: true
    },
    playbackMode: 'interrupt',
    ui: {
      categoryFilter: ''
    }
  }
}

function clampGain(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(1, Math.max(0, value))
}

function normalizePhrase(raw: unknown, index: number, usedIds: Set<string>): Phrase | null {
  if (raw == null || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  const filePath = typeof candidate.filePath === 'string' ? candidate.filePath.trim() : ''

  if (!id || !name || !filePath || usedIds.has(id)) {
    return null
  }

  usedIds.add(id)

  let shortcut: string | null = null
  if (typeof candidate.shortcut === 'string' && candidate.shortcut.trim() !== '') {
    const normalized = normalizeShortcut(candidate.shortcut)
    if (isAllowedShortcut(normalized)) {
      shortcut = normalized
    }
  }

  const durationMs =
    typeof candidate.durationMs === 'number' && Number.isFinite(candidate.durationMs)
      ? Math.max(0, candidate.durationMs)
      : 0

  const sortIndex =
    typeof candidate.sortIndex === 'number' && Number.isFinite(candidate.sortIndex)
      ? Math.max(0, Math.floor(candidate.sortIndex))
      : index

  const category =
    typeof candidate.category === 'string' && candidate.category.trim() !== ''
      ? candidate.category.trim()
      : null

  return {
    id,
    name,
    filePath,
    durationMs,
    category,
    enabled: candidate.enabled !== false,
    sortIndex,
    shortcut
  }
}

function normalizeAudio(raw: unknown): PersistedAudioSettings {
  const defaults = createDefaultSettings().audio
  if (raw == null || typeof raw !== 'object') {
    return { ...defaults }
  }

  const candidate = raw as Record<string, unknown>
  return {
    selectedOutputDeviceId:
      typeof candidate.selectedOutputDeviceId === 'string' &&
      candidate.selectedOutputDeviceId.trim() !== ''
        ? candidate.selectedOutputDeviceId
        : null,
    selectedInputDeviceId:
      typeof candidate.selectedInputDeviceId === 'string' &&
      candidate.selectedInputDeviceId.trim() !== ''
        ? candidate.selectedInputDeviceId
        : null,
    microphoneGain: clampGain(candidate.microphoneGain, defaults.microphoneGain),
    playbackGain: clampGain(candidate.playbackGain, defaults.playbackGain),
    masterGain: clampGain(candidate.masterGain, defaults.masterGain)
  }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeCalibration(raw: unknown): PersistedCalibrationSettings {
  const defaults = createDefaultSettings().calibration
  if (raw == null || typeof raw !== 'object') {
    return { ...defaults }
  }

  const candidate = raw as Record<string, unknown>
  return {
    showRms: asBoolean(candidate.showRms, defaults.showRms),
    peakHoldEnabled: asBoolean(candidate.peakHoldEnabled, defaults.peakHoldEnabled),
    historyEnabled: asBoolean(candidate.historyEnabled, defaults.historyEnabled)
  }
}

function normalizeUi(raw: unknown): PersistedUiSettings {
  if (raw == null || typeof raw !== 'object') {
    return { categoryFilter: '' }
  }

  const candidate = raw as Record<string, unknown>
  return {
    categoryFilter:
      typeof candidate.categoryFilter === 'string' ? candidate.categoryFilter : ''
  }
}

/**
 * Coerce unknown JSON into a valid settings document.
 * Ignores unknown fields; applies defaults for missing/invalid values.
 */
export function normalizeSettings(raw: unknown): AppSettingsDocument {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Settings must be a JSON object')
  }

  const candidate = raw as Record<string, unknown>
  const defaults = createDefaultSettings()
  const usedIds = new Set<string>()
  const phrasesRaw = Array.isArray(candidate.phrases) ? candidate.phrases : []
  const phrases: Phrase[] = []

  for (let i = 0; i < phrasesRaw.length; i++) {
    const phrase = normalizePhrase(phrasesRaw[i], i, usedIds)
    if (phrase) {
      phrases.push(phrase)
    }
  }

  // Resolve shortcut conflicts: keep first occurrence, clear duplicates.
  const seenShortcuts = new Set<string>()
  const dedupedPhrases = phrases.map((phrase) => {
    if (!phrase.shortcut) {
      return phrase
    }
    if (seenShortcuts.has(phrase.shortcut)) {
      return { ...phrase, shortcut: null }
    }
    seenShortcuts.add(phrase.shortcut)
    return phrase
  })

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    phrases: dedupedPhrases,
    audio: normalizeAudio(candidate.audio),
    calibration: normalizeCalibration(candidate.calibration),
    playbackMode: isPlaybackMode(candidate.playbackMode)
      ? candidate.playbackMode
      : defaults.playbackMode,
    ui: normalizeUi(candidate.ui)
  }
}
