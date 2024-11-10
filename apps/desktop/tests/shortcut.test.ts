import { describe, expect, it } from 'vitest'
import {
  acceleratorToChord,
  buildShortcutMap,
  chordToAccelerator,
  emptyChord,
  eventToAccelerator,
  isAllowedShortcut,
  normalizeShortcut,
  parseShortcutMap,
  planShortcutMapApply,
  setPrimaryKey,
  toggleModifier
} from '../src/shared/shortcut'
import { findShortcutConflict, type Phrase } from '../src/shared/phrase'

function phrase(partial: Partial<Phrase> & Pick<Phrase, 'id' | 'name'>): Phrase {
  return {
    filePath: `${partial.id}.wav`,
    durationMs: 100,
    category: null,
    enabled: true,
    sortIndex: 0,
    shortcut: null,
    ...partial
  }
}

describe('shortcut normalize and validate', () => {
  it('normalizes single-key shortcuts', () => {
    expect(normalizeShortcut('f5')).toBe('F5')
    expect(normalizeShortcut(' A ')).toBe('A')
    expect(normalizeShortcut('1')).toBe('1')
    expect(isAllowedShortcut('F1')).toBe(true)
    expect(isAllowedShortcut('Space')).toBe(true)
  })

  it('normalizes multi-key shortcuts', () => {
    expect(normalizeShortcut('ctrl+shift+a')).toBe('Control+Shift+A')
    expect(normalizeShortcut('Alt+F2')).toBe('Alt+F2')
    expect(normalizeShortcut('Control+Alt+1')).toBe('Control+Alt+1')
    expect(normalizeShortcut('Shift+Space')).toBe('Shift+Space')
    expect(normalizeShortcut('Control+Shift+F5')).toBe('Control+Shift+F5')
    expect(isAllowedShortcut('Control+Shift+A')).toBe(true)
  })

  it('rejects invalid syntax only (not a fixed allowlist)', () => {
    expect(isAllowedShortcut('')).toBe(false)
    expect(isAllowedShortcut('Control')).toBe(false)
    expect(isAllowedShortcut('Control+Alt+Shift+Super+A')).toBe(false)
    expect(isAllowedShortcut('Alt+F4')).toBe(true)
    expect(isAllowedShortcut('A')).toBe(true)
    expect(isAllowedShortcut('NotAKey')).toBe(false)
  })
})

describe('keyboard recording mapping', () => {
  it('maps physical key events to accelerators', () => {
    expect(
      eventToAccelerator({
        key: 'a',
        code: 'KeyA',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false
      })
    ).toBe('Control+Shift+A')

    expect(
      eventToAccelerator({
        key: 'F8',
        code: 'F8',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false
      })
    ).toBe('F8')

    expect(
      eventToAccelerator({
        key: 'Control',
        code: 'ControlLeft',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false
      })
    ).toBeNull()
  })
})

describe('mouse assignment chord builder', () => {
  it('builds chords via toggleModifier and setPrimaryKey', () => {
    let chord = emptyChord()
    chord = toggleModifier(chord, 'Control')
    chord = toggleModifier(chord, 'Shift')
    chord = setPrimaryKey(chord, 'F4')
    expect(chordToAccelerator(chord)).toBe('Control+Shift+F4')
    chord = toggleModifier(chord, 'Shift')
    expect(chordToAccelerator(chord)).toBe('Control+F4')
    expect(acceleratorToChord('Alt+1')).toEqual({ modifiers: ['Alt'], key: '1' })
  })
})

describe('conflict detection and replace plan', () => {
  it('detects conflicts and plans replace', () => {
    const phrases = [
      phrase({ id: 'a', name: 'Alpha', shortcut: 'F1' }),
      phrase({ id: 'b', name: 'Beta', shortcut: null })
    ]
    expect(findShortcutConflict(phrases, 'F1')?.id).toBe('a')
    expect(findShortcutConflict(phrases, 'F1', 'a')).toBeNull()

    const map = buildShortcutMap([
      { id: 'b', shortcut: 'F1' },
      { id: 'a', shortcut: null }
    ])
    const plan = planShortcutMapApply(phrases, map, 'replace')
    expect(plan.assign).toEqual(
      expect.arrayContaining([
        { phraseId: 'a', shortcut: null },
        { phraseId: 'b', shortcut: 'F1' }
      ])
    )
  })

  it('skips conflicts when requested', () => {
    const phrases = [
      phrase({ id: 'a', name: 'Alpha', shortcut: 'F1' }),
      phrase({ id: 'b', name: 'Beta', shortcut: null })
    ]
    const map = parseShortcutMap({
      version: 1,
      bindings: [{ phraseId: 'b', shortcut: 'F1' }]
    })
    const plan = planShortcutMapApply(phrases, map, 'skipConflicts')
    expect(plan.assign).toEqual([])
    expect(plan.skipped[0]?.phraseId).toBe('b')
  })
})

describe('shortcut map import/export', () => {
  it('round-trips export and import documents', () => {
    const doc = buildShortcutMap([
      { id: 'a', shortcut: 'Control+1' },
      { id: 'b', shortcut: null }
    ])
    const parsed = parseShortcutMap(JSON.parse(JSON.stringify(doc)) as unknown)
    expect(parsed).toEqual(doc)
  })

  it('rejects invalid import payloads', () => {
    expect(() => parseShortcutMap({ version: 2, bindings: [] })).toThrow(/version/i)
    expect(() =>
      parseShortcutMap({ version: 1, bindings: [{ phraseId: 'a', shortcut: 'NotAKey' }] })
    ).toThrow(/Unsupported/i)
  })
})
