import {
  normalizeShortcut,
  SUGGESTED_SHORTCUTS
} from './shortcut'

export type {
  ApplyShortcutMapMode,
  ApplyShortcutMapPlan,
  ChordState,
  KeyEventLike,
  ModifierToken,
  ParsedAccelerator,
  ShortcutMapDocument
} from './shortcut'

export {
  acceleratorToChord,
  ALLOWED_SHORTCUTS,
  buildShortcutMap,
  canonicalizeToken,
  chordToAccelerator,
  classifyRegistrationFailure,
  describeShortcutError,
  emptyChord,
  eventToAccelerator,
  eventToChord,
  formatAccelerator,
  isAllowedShortcut,
  isModifierToken,
  isPrimaryKey,
  isReservedShortcut,
  MODIFIER_ORDER,
  normalizeShortcut,
  parseAccelerator,
  parseShortcutMap,
  planShortcutMapApply,
  setPrimaryKey,
  SUGGESTED_SHORTCUTS,
  toggleModifier
} from './shortcut'

export interface Phrase {
  readonly id: string
  readonly name: string
  readonly filePath: string
  readonly durationMs: number
  readonly category: string | null
  readonly enabled: boolean
  readonly sortIndex: number
  /** Electron accelerator string, e.g. F1 or Control+1. Null when unbound. */
  readonly shortcut: string | null
}

export interface PhraseFilterOptions {
  readonly search?: string
  readonly category?: string | null
  /** When true, exclude disabled phrases (playable soundboard). Default false. */
  readonly playableOnly?: boolean
}

export interface HotkeyBindingStatus {
  readonly phraseId: string
  readonly accelerator: string
  readonly registered: boolean
  readonly error: string | null
}

export const PHRASE_IPC_CHANNELS = Object.freeze({
  list: 'phrases:list',
  import: 'phrases:import',
  remove: 'phrases:remove',
  rename: 'phrases:rename',
  setEnabled: 'phrases:set-enabled',
  setCategory: 'phrases:set-category',
  reorder: 'phrases:reorder',
  play: 'phrases:play',
  setShortcut: 'phrases:set-shortcut'
} as const)

export type PhraseReorderDirection = 'up' | 'down'

export interface PhraseImportResult {
  readonly imported: readonly Phrase[]
  readonly errors: readonly { readonly path: string; readonly message: string }[]
}

/**
 * Returns the phrase that already owns `accelerator`, or null if free.
 */
export function findShortcutConflict(
  phrases: readonly Phrase[],
  accelerator: string,
  excludePhraseId?: string
): Phrase | null {
  const normalized = normalizeShortcut(accelerator)
  for (const phrase of phrases) {
    if (excludePhraseId && phrase.id === excludePhraseId) {
      continue
    }
    if (phrase.shortcut && normalizeShortcut(phrase.shortcut) === normalized) {
      return phrase
    }
  }
  return null
}

/**
 * Filter phrases by search substring (name/path), optional category, and playable-only flag.
 */
export function filterPhrases(
  phrases: readonly Phrase[],
  options: PhraseFilterOptions = {}
): Phrase[] {
  const search = options.search?.trim().toLowerCase() ?? ''
  const category = options.category
  const playableOnly = options.playableOnly === true

  return phrases
    .filter((phrase) => {
      if (playableOnly && !phrase.enabled) {
        return false
      }

      if (category != null && category !== '' && phrase.category !== category) {
        return false
      }

      if (!search) {
        return true
      }

      return (
        phrase.name.toLowerCase().includes(search) ||
        phrase.filePath.toLowerCase().includes(search) ||
        (phrase.category?.toLowerCase().includes(search) ?? false) ||
        (phrase.shortcut?.toLowerCase().includes(search) ?? false)
      )
    })
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name))
}

export function uniqueCategories(phrases: readonly Phrase[]): string[] {
  const set = new Set<string>()
  for (const phrase of phrases) {
    if (phrase.category && phrase.category.trim()) {
      set.add(phrase.category.trim())
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Suggested shortcuts still free for assignment (finite quick-pick list).
 * Full combinations are validated via isAllowedShortcut, not this list.
 */
export function availableShortcuts(
  phrases: readonly Phrase[],
  keepPhraseId?: string
): string[] {
  const taken = new Set<string>()
  for (const phrase of phrases) {
    if (!phrase.shortcut) {
      continue
    }
    if (keepPhraseId && phrase.id === keepPhraseId) {
      continue
    }
    taken.add(normalizeShortcut(phrase.shortcut))
  }
  return SUGGESTED_SHORTCUTS.filter((accel) => !taken.has(accel))
}
