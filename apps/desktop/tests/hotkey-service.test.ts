import { describe, expect, it, vi } from 'vitest'
import {
  ALLOWED_SHORTCUTS,
  classifyRegistrationFailure,
  findShortcutConflict,
  isAllowedShortcut,
  normalizeShortcut,
  type Phrase
} from '../src/shared/phrase'
import { HotkeyService, type GlobalShortcutApi } from '../src/main/hotkey-service'
import { PhraseLibrary } from '../src/main/phrase-library'
import { resolveToneFixture } from './sidecar-test-helpers'

function createFakeShortcuts(): GlobalShortcutApi & {
  registered: Map<string, () => void>
  failAccelerators: Set<string>
  throwAccelerators: Set<string>
} {
  const registered = new Map<string, () => void>()
  const failAccelerators = new Set<string>()
  const throwAccelerators = new Set<string>()
  return {
    registered,
    failAccelerators,
    throwAccelerators,
    register(accelerator, callback) {
      if (throwAccelerators.has(accelerator)) {
        throw new Error('boom')
      }
      if (failAccelerators.has(accelerator)) {
        return false
      }
      registered.set(accelerator, callback)
      return true
    },
    unregister(accelerator) {
      registered.delete(accelerator)
    },
    unregisterAll() {
      registered.clear()
    },
    isRegistered(accelerator) {
      return registered.has(accelerator)
    }
  }
}

function silentLogger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
    child: () => silentLogger()
  } as unknown as import('../src/main/logger').Logger
}

describe('shortcut syntax helpers', () => {
  it('accepts any syntactically valid accelerator including letters', () => {
    expect(ALLOWED_SHORTCUTS).toContain('F1')
    expect(isAllowedShortcut(' F5 ')).toBe(true)
    expect(normalizeShortcut(' F5 ')).toBe('F5')
    expect(isAllowedShortcut('A')).toBe(true)
    expect(isAllowedShortcut('Alt+1')).toBe(true)
    expect(isAllowedShortcut('Control+0')).toBe(true)
    expect(isAllowedShortcut('Ctrl+Shift+A')).toBe(true)
    expect(normalizeShortcut('Ctrl+Shift+A')).toBe('Control+Shift+A')
    expect(isAllowedShortcut('Alt+F4')).toBe(true)
    expect(isAllowedShortcut('Control')).toBe(false)
    expect(isAllowedShortcut('NotAKey')).toBe(false)
  })

  it('classifies registration failures', () => {
    expect(classifyRegistrationFailure('Control+1', 'false')).toBe('Shortcut already in use.')
    expect(classifyRegistrationFailure('Alt+F4', 'false')).toBe('Reserved by Windows.')
    expect(classifyRegistrationFailure('A', 'threw')).toBe('Registration failed.')
  })

  it('detects shortcut conflicts', () => {
    const phrases: Phrase[] = [
      {
        id: 'a',
        name: 'A',
        filePath: 'a.wav',
        durationMs: 1,
        category: null,
        enabled: true,
        sortIndex: 0,
        shortcut: 'F1'
      },
      {
        id: 'b',
        name: 'B',
        filePath: 'b.wav',
        durationMs: 1,
        category: null,
        enabled: true,
        sortIndex: 1,
        shortcut: null
      }
    ]
    expect(findShortcutConflict(phrases, 'F1')?.id).toBe('a')
    expect(findShortcutConflict(phrases, 'F1', 'a')).toBeNull()
    expect(findShortcutConflict(phrases, 'F2')).toBeNull()
  })
})

describe('PhraseLibrary.setShortcut', () => {
  it('assigns, clears, reassigns, and rejects duplicates and invalid syntax', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const { imported } = library.importPaths([fixture, fixture])
    const first = imported[0]!
    const second = imported[1]!

    expect(library.setShortcut(first.id, 'F1').shortcut).toBe('F1')
    expect(() => library.setShortcut(second.id, 'F1')).toThrow(/already assigned/i)
    expect(library.setShortcut(first.id, 'Control+2').shortcut).toBe('Control+2')
    expect(library.setShortcut(second.id, 'F1').shortcut).toBe('F1')
    expect(library.setShortcut(first.id, null).shortcut).toBeNull()
    expect(library.setShortcut(first.id, 'A').shortcut).toBe('A')
    expect(() => library.setShortcut(first.id, 'NotAKey')).toThrow(/Unsupported shortcut/i)
  })
})

describe('HotkeyService', () => {
  it('registers enabled shortcuts, skips disabled, and invokes playPhrase', async () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const { imported } = library.importPaths([fixture, fixture])
    const first = imported[0]!
    const second = imported[1]!
    library.setShortcut(first.id, 'F1')
    library.setShortcut(second.id, 'F2')
    library.setEnabled(second.id, false)

    const shortcuts = createFakeShortcuts()
    const playPhrase = vi.fn(async () => undefined)
    const service = new HotkeyService(library, playPhrase, silentLogger(), shortcuts)

    const status = service.sync()
    expect(status).toHaveLength(1)
    expect(status[0]).toMatchObject({
      phraseId: first.id,
      accelerator: 'F1',
      registered: true,
      error: null
    })
    expect(shortcuts.registered.has('F1')).toBe(true)
    expect(shortcuts.registered.has('F2')).toBe(false)

    shortcuts.registered.get('F1')!()
    await vi.waitFor(() => expect(playPhrase).toHaveBeenCalledWith(first.id))

    service.dispose()
    expect(shortcuts.registered.size).toBe(0)
  })

  it('records registration failures and reassigns on library change', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const { imported } = library.importPaths([fixture])
    const phrase = imported[0]!
    library.setShortcut(phrase.id, 'F3')

    const shortcuts = createFakeShortcuts()
    shortcuts.failAccelerators.add('F3')
    const service = new HotkeyService(library, vi.fn(), silentLogger(), shortcuts)

    let status = service.sync()
    expect(status[0]?.registered).toBe(false)
    expect(status[0]?.error).toBe('Shortcut already in use.')

    shortcuts.failAccelerators.delete('F3')
    library.setShortcut(phrase.id, 'F4')
    status = service.getStatus()
    expect(status[0]?.accelerator).toBe('F4')
    expect(status[0]?.registered).toBe(true)
    expect(shortcuts.registered.has('F4')).toBe(true)
    expect(shortcuts.registered.has('F3')).toBe(false)

    service.dispose()
  })

  it('assignShortcut probes registration before saving', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const { imported } = library.importPaths([fixture, fixture])
    const first = imported[0]!
    const second = imported[1]!
    const shortcuts = createFakeShortcuts()
    const service = new HotkeyService(library, vi.fn(), silentLogger(), shortcuts)

    expect(service.assignShortcut(first.id, 'A').shortcut).toBe('A')
    expect(library.list().find((p) => p.id === first.id)?.shortcut).toBe('A')

    expect(() => service.assignShortcut(second.id, 'A')).toThrow(/already assigned/i)
    expect(library.list().find((p) => p.id === second.id)?.shortcut).toBeNull()

    shortcuts.failAccelerators.add('Control+9')
    library.setShortcut(first.id, 'F1')
    service.sync()
    expect(() => service.assignShortcut(first.id, 'Control+9')).toThrow(/already in use/i)
    expect(library.list().find((p) => p.id === first.id)?.shortcut).toBe('F1')

    expect(service.assignShortcut(first.id, null).shortcut).toBeNull()
    service.dispose()
  })
})
