/**
 * Electron accelerator normalize / validate helpers for global hotkeys.
 * @see https://www.electronjs.org/docs/latest/api/accelerator
 */

export const MODIFIER_ORDER = ['Control', 'Alt', 'Shift', 'Super'] as const
export type ModifierToken = (typeof MODIFIER_ORDER)[number]

const MODIFIER_ALIASES: Record<string, ModifierToken> = {
  control: 'Control',
  ctrl: 'Control',
  cmdorctrl: 'Control',
  commandorcontrol: 'Control',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
  cmd: 'Super',
  command: 'Super',
  win: 'Super',
  windows: 'Super'
}

const PRIMARY_ALIASES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  return: 'Enter',
  enter: 'Enter',
  space: 'Space',
  spacebar: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  ins: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  page_up: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  page_down: 'PageDown',
  pgdn: 'PageDown',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  plus: 'Plus',
  minus: 'Minus',
  '=': 'Plus',
  '-': '-',
  numadd: 'numadd',
  numsub: 'numsub',
  nummult: 'nummult',
  numdiv: 'numdiv',
  numdec: 'numdec',
  numenter: 'Enter'
}

const RESERVED_ACCELERATORS = new Set([
  'Alt+F4',
  'Control+Alt+Delete',
  'Control+Shift+Escape',
  'Super+L'
])

function isFunctionKey(token: string): boolean {
  return /^F([1-9]|1[0-9]|2[0-4])$/i.test(token)
}

function isLetter(token: string): boolean {
  return /^[A-Z]$/i.test(token)
}

function isDigit(token: string): boolean {
  return /^[0-9]$/.test(token)
}

function isNumpad(token: string): boolean {
  return /^num([0-9]|add|sub|mult|div|dec)$/i.test(token)
}

const NAMED_PRIMARIES = new Set([
  'Escape',
  'Enter',
  'Space',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Up',
  'Down',
  'Left',
  'Right',
  'Plus',
  'Minus',
  '-',
  'Capslock'
])

export function canonicalizeToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  const lower = trimmed.toLowerCase()
  if (MODIFIER_ALIASES[lower]) {
    return MODIFIER_ALIASES[lower]
  }
  if (PRIMARY_ALIASES[lower]) {
    return PRIMARY_ALIASES[lower]
  }
  if (isFunctionKey(trimmed)) {
    return trimmed.toUpperCase()
  }
  if (isLetter(trimmed)) {
    return trimmed.toUpperCase()
  }
  if (isDigit(trimmed)) {
    return trimmed
  }
  if (isNumpad(trimmed)) {
    return lower.startsWith('num') ? lower : trimmed
  }
  if (NAMED_PRIMARIES.has(trimmed)) {
    return trimmed
  }
  // Title-case named keys that already match Electron casing
  const titled = trimmed[0]!.toUpperCase() + trimmed.slice(1)
  if (NAMED_PRIMARIES.has(titled)) {
    return titled
  }
  return null
}

export function isModifierToken(token: string): token is ModifierToken {
  return (MODIFIER_ORDER as readonly string[]).includes(token)
}

export function isPrimaryKey(token: string): boolean {
  if (isModifierToken(token)) {
    return false
  }
  return (
    isFunctionKey(token) ||
    isLetter(token) ||
    isDigit(token) ||
    isNumpad(token) ||
    NAMED_PRIMARIES.has(token)
  )
}

export interface ParsedAccelerator {
  readonly modifiers: readonly ModifierToken[]
  readonly key: string
}

export function parseAccelerator(value: string): ParsedAccelerator | null {
  const normalizedAttempt = value.trim()
  if (!normalizedAttempt) {
    return null
  }

  const parts = normalizedAttempt.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0 || parts.length > 4) {
    return null
  }

  const modifiers: ModifierToken[] = []
  let key: string | null = null

  for (const part of parts) {
    const token = canonicalizeToken(part)
    if (!token) {
      return null
    }
    if (isModifierToken(token)) {
      if (modifiers.includes(token)) {
        return null
      }
      modifiers.push(token)
      continue
    }
    if (key != null) {
      return null
    }
    if (!isPrimaryKey(token)) {
      return null
    }
    key = token
  }

  if (key == null) {
    return null
  }

  modifiers.sort(
    (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)
  )

  return { modifiers, key }
}

export function formatAccelerator(parsed: ParsedAccelerator): string {
  return [...parsed.modifiers, parsed.key].join('+')
}

export function normalizeShortcut(value: string): string {
  const parsed = parseAccelerator(value)
  if (!parsed) {
    return value.trim()
  }
  return formatAccelerator(parsed)
}

export function isReservedShortcut(value: string): boolean {
  const normalized = normalizeShortcut(value)
  return RESERVED_ACCELERATORS.has(normalized)
}

/**
 * Syntax-only check: parseable Electron accelerator with one primary key.
 * Does not consult a fixed allowlist; OS acceptance is probed via globalShortcut.
 */
export function isAllowedShortcut(value: string): boolean {
  return parseAccelerator(value) != null
}

export function describeShortcutError(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return 'Shortcut cannot be empty.'
  }
  if (!parseAccelerator(trimmed)) {
    return 'Unsupported shortcut.'
  }
  return 'Unsupported shortcut.'
}

export type RegistrationFailureCause = 'false' | 'threw' | 'unknown'

/**
 * Maps probe/register outcomes to stable user-facing messages.
 */
export function classifyRegistrationFailure(
  accelerator: string,
  cause: RegistrationFailureCause = 'false'
): string {
  const normalized = normalizeShortcut(accelerator)
  if (isReservedShortcut(normalized)) {
    return 'Reserved by Windows.'
  }
  if (cause === 'threw') {
    return 'Registration failed.'
  }
  if (cause === 'false') {
    return 'Shortcut already in use.'
  }
  return 'Registration failed.'
}

/** Common suggested shortcuts for quick picks (not an exhaustive allowlist). */
export const SUGGESTED_SHORTCUTS: readonly string[] = Object.freeze([
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `Control+${i + 1}`)
])

/** @deprecated Use SUGGESTED_SHORTCUTS; kept for compatibility with older tests/UI. */
export const ALLOWED_SHORTCUTS: readonly string[] = SUGGESTED_SHORTCUTS

export interface ChordState {
  readonly modifiers: readonly ModifierToken[]
  readonly key: string | null
}

export function emptyChord(): ChordState {
  return { modifiers: [], key: null }
}

export function toggleModifier(state: ChordState, modifier: ModifierToken): ChordState {
  const has = state.modifiers.includes(modifier)
  const modifiers = has
    ? state.modifiers.filter((entry) => entry !== modifier)
    : [...state.modifiers, modifier].sort(
        (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)
      )
  return { modifiers, key: state.key }
}

export function setPrimaryKey(state: ChordState, key: string): ChordState {
  const token = canonicalizeToken(key)
  if (!token || !isPrimaryKey(token) || isModifierToken(token)) {
    return state
  }
  return { modifiers: state.modifiers, key: token }
}

export function chordToAccelerator(state: ChordState): string | null {
  if (!state.key) {
    return null
  }
  return formatAccelerator({ modifiers: state.modifiers, key: state.key })
}

export function acceleratorToChord(value: string | null): ChordState {
  if (!value) {
    return emptyChord()
  }
  const parsed = parseAccelerator(value)
  if (!parsed) {
    return emptyChord()
  }
  return { modifiers: parsed.modifiers, key: parsed.key }
}

export interface KeyEventLike {
  readonly key: string
  readonly code: string
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
  readonly repeat?: boolean
}

export function eventToChord(event: KeyEventLike): ChordState {
  const modifiers: ModifierToken[] = []
  if (event.ctrlKey) {
    modifiers.push('Control')
  }
  if (event.altKey) {
    modifiers.push('Alt')
  }
  if (event.shiftKey) {
    modifiers.push('Shift')
  }
  if (event.metaKey) {
    modifiers.push('Super')
  }

  const keyFromCode = codeToPrimary(event.code)
  const keyFromKey = canonicalizeToken(event.key === ' ' ? 'Space' : event.key)
  let key = keyFromCode ?? (keyFromKey && isPrimaryKey(keyFromKey) ? keyFromKey : null)

  // Ignore pure modifier presses as the primary key
  if (key && isModifierToken(key)) {
    key = null
  }
  if (keyFromKey && isModifierToken(keyFromKey)) {
    key = null
  }

  return {
    modifiers: modifiers.sort(
      (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)
    ),
    key
  }
}

export function eventToAccelerator(event: KeyEventLike): string | null {
  return chordToAccelerator(eventToChord(event))
}

function codeToPrimary(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3)
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5)
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return code
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return `num${code.slice(6)}`
  }
  switch (code) {
    case 'NumpadAdd':
      return 'numadd'
    case 'NumpadSubtract':
      return 'numsub'
    case 'NumpadMultiply':
      return 'nummult'
    case 'NumpadDivide':
      return 'numdiv'
    case 'NumpadDecimal':
      return 'numdec'
    case 'NumpadEnter':
      return 'Enter'
    case 'Space':
      return 'Space'
    case 'Enter':
      return 'Enter'
    case 'Tab':
      return 'Tab'
    case 'Backspace':
      return 'Backspace'
    case 'Delete':
      return 'Delete'
    case 'Insert':
      return 'Insert'
    case 'Home':
      return 'Home'
    case 'End':
      return 'End'
    case 'PageUp':
      return 'PageUp'
    case 'PageDown':
      return 'PageDown'
    case 'ArrowUp':
      return 'Up'
    case 'ArrowDown':
      return 'Down'
    case 'ArrowLeft':
      return 'Left'
    case 'ArrowRight':
      return 'Right'
    case 'Escape':
      return 'Escape'
    case 'Minus':
      return '-'
    case 'Equal':
      return 'Plus'
    default:
      return null
  }
}

export interface ShortcutMapDocument {
  readonly version: 1
  readonly bindings: readonly {
    readonly phraseId: string
    readonly shortcut: string | null
  }[]
}

export function buildShortcutMap(
  phrases: readonly { readonly id: string; readonly shortcut: string | null }[]
): ShortcutMapDocument {
  return {
    version: 1,
    bindings: phrases.map((phrase) => ({
      phraseId: phrase.id,
      shortcut: phrase.shortcut
    }))
  }
}

export function parseShortcutMap(raw: unknown): ShortcutMapDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Shortcut map must be a JSON object.')
  }
  const doc = raw as { version?: unknown; bindings?: unknown }
  if (doc.version !== 1) {
    throw new Error('Unsupported shortcut map version.')
  }
  if (!Array.isArray(doc.bindings)) {
    throw new Error('Shortcut map bindings must be an array.')
  }
  const bindings = doc.bindings.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid binding at index ${index}.`)
    }
    const row = entry as { phraseId?: unknown; shortcut?: unknown }
    if (typeof row.phraseId !== 'string' || row.phraseId.trim() === '') {
      throw new Error(`Invalid phraseId at index ${index}.`)
    }
    if (row.shortcut != null && typeof row.shortcut !== 'string') {
      throw new Error(`Invalid shortcut at index ${index}.`)
    }
    if (row.shortcut != null && row.shortcut.trim() !== '') {
      const normalized = normalizeShortcut(row.shortcut)
      if (!isAllowedShortcut(normalized)) {
        throw new Error(describeShortcutError(row.shortcut))
      }
      return { phraseId: row.phraseId, shortcut: normalized }
    }
    return { phraseId: row.phraseId, shortcut: null }
  })
  return { version: 1, bindings }
}

export type ApplyShortcutMapMode = 'replace' | 'skipConflicts'

export interface ApplyShortcutMapPlan {
  readonly assign: readonly { readonly phraseId: string; readonly shortcut: string | null }[]
  readonly skipped: readonly { readonly phraseId: string; readonly reason: string }[]
}

/**
 * Plan assignments for an imported map against current phrases.
 * Does not mutate; caller applies via setShortcut.
 */
export function planShortcutMapApply(
  phrases: readonly { readonly id: string; readonly shortcut: string | null; readonly name: string }[],
  map: ShortcutMapDocument,
  mode: ApplyShortcutMapMode
): ApplyShortcutMapPlan {
  const byId = new Map(phrases.map((phrase) => [phrase.id, phrase]))
  const working = new Map(phrases.map((phrase) => [phrase.id, phrase.shortcut]))
  const assign: { phraseId: string; shortcut: string | null }[] = []
  const skipped: { phraseId: string; reason: string }[] = []

  for (const binding of map.bindings) {
    if (!byId.has(binding.phraseId)) {
      skipped.push({ phraseId: binding.phraseId, reason: 'Phrase not found' })
      continue
    }
    if (binding.shortcut == null) {
      assign.push({ phraseId: binding.phraseId, shortcut: null })
      working.set(binding.phraseId, null)
      continue
    }
    const ownerId = [...working.entries()].find(
      ([id, shortcut]) => id !== binding.phraseId && shortcut === binding.shortcut
    )?.[0]
    if (ownerId) {
      if (mode === 'skipConflicts') {
        skipped.push({
          phraseId: binding.phraseId,
          reason: `Conflicts with ${byId.get(ownerId)?.name ?? ownerId}`
        })
        continue
      }
      assign.push({ phraseId: ownerId, shortcut: null })
      working.set(ownerId, null)
    }
    assign.push({ phraseId: binding.phraseId, shortcut: binding.shortcut })
    working.set(binding.phraseId, binding.shortcut)
  }

  return { assign, skipped }
}
