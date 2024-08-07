import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createDefaultSettings,
  normalizeSettings,
  SETTINGS_SCHEMA_VERSION
} from '../src/shared/settings'
import { SettingsStore } from '../src/main/settings-store'
import { PhraseLibrary } from '../src/main/phrase-library'
import type { Phrase } from '../src/shared/phrase'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true })
    })
  )
})

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zoom-dialer-settings-'))
  tempRoots.push(root)
  return root
}

function samplePhrase(id: string, name: string, sortIndex: number): Phrase {
  return {
    id,
    name,
    filePath: `C:\\audio\\${name}.wav`,
    durationMs: 1200,
    category: 'Greetings',
    enabled: true,
    sortIndex,
    shortcut: id === 'a' ? 'F1' : null
  }
}

describe('normalizeSettings', () => {
  it('applies defaults and ignores unknown fields', () => {
    const normalized = normalizeSettings({
      schemaVersion: 99,
      unknownTop: true,
      phrases: [],
      audio: { microphoneGain: 2, playbackGain: -1, extra: 1 },
      playbackMode: 'not-a-mode',
      ui: { categoryFilter: 'Ops', theme: 'dark' }
    })

    expect(normalized.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
    expect(normalized.audio.microphoneGain).toBe(1)
    expect(normalized.audio.playbackGain).toBe(0)
    expect(normalized.audio.masterGain).toBe(1)
    expect(normalized.calibration.showRms).toBe(true)
    expect(normalized.playbackMode).toBe('interrupt')
    expect(normalized.ui.categoryFilter).toBe('Ops')
  })

  it('rejects non-object roots', () => {
    expect(() => normalizeSettings([])).toThrow(/JSON object/)
    expect(() => normalizeSettings(null)).toThrow(/JSON object/)
  })

  it('drops invalid phrases and conflicting shortcuts', () => {
    const normalized = normalizeSettings({
      phrases: [
        samplePhrase('a', 'Alpha', 0),
        { id: 'b', name: 'Beta', filePath: 'C:\\b.wav', shortcut: 'F1', sortIndex: 1 },
        { id: '', name: 'Bad', filePath: 'C:\\x.wav' },
        samplePhrase('a', 'Dup', 2)
      ]
    })

    expect(normalized.phrases).toHaveLength(2)
    expect(normalized.phrases[0]!.shortcut).toBe('F1')
    expect(normalized.phrases[1]!.shortcut).toBeNull()
  })
})

describe('SettingsStore', () => {
  it('loads defaults when the file is missing', async () => {
    const dir = await createTempDir()
    const filePath = path.join(dir, 'settings.json')
    const store = new SettingsStore(filePath, undefined, 0)

    const loaded = await store.load()
    expect(loaded).toEqual(createDefaultSettings())
    expect(store.getStatus().saveState).toBe('saved')
    expect(store.getStatus().lastSavedAtMs).toBeTypeOf('number')

    const onDisk = JSON.parse(await readFile(filePath, 'utf8')) as unknown
    expect(normalizeSettings(onDisk)).toEqual(createDefaultSettings())
  })

  it('saves and reloads phrases, audio, mode, and category', async () => {
    const dir = await createTempDir()
    const filePath = path.join(dir, 'settings.json')
    const store = new SettingsStore(filePath, undefined, 0)
    await store.load()

    const document = {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      phrases: [samplePhrase('a', 'Alpha', 0), samplePhrase('b', 'Beta', 1)],
      audio: {
        selectedOutputDeviceId: 'out-1',
        selectedInputDeviceId: 'in-1',
        microphoneGain: 0.4,
        playbackGain: 0.6
      },
      playbackMode: 'queue' as const,
      ui: { categoryFilter: 'Greetings' }
    }

    store.replace(document, { immediate: true })
    await store.saveNow()

    const reloaded = new SettingsStore(filePath, undefined, 0)
    const again = await reloaded.load()
    expect(again.phrases).toHaveLength(2)
    expect(again.phrases[0]!.shortcut).toBe('F1')
    expect(again.audio.selectedOutputDeviceId).toBe('out-1')
    expect(again.audio.microphoneGain).toBe(0.4)
    expect(again.playbackMode).toBe('queue')
    expect(again.ui.categoryFilter).toBe('Greetings')
  })

  it('backs up corrupt files and restores defaults', async () => {
    const dir = await createTempDir()
    const filePath = path.join(dir, 'settings.json')
    await writeFile(filePath, '{not-json', 'utf8')

    const store = new SettingsStore(filePath, undefined, 0)
    const loaded = await store.load()
    expect(loaded).toEqual(createDefaultSettings())

    const files = await readdir(dir)
    expect(files.some((name) => name.startsWith('settings.corrupt-'))).toBe(true)
    expect(files).toContain('settings.json')
  })

  it('exports readable JSON and imports after validation', async () => {
    const dir = await createTempDir()
    const filePath = path.join(dir, 'settings.json')
    const exportPath = path.join(dir, 'export.json')
    const store = new SettingsStore(filePath, undefined, 0)
    await store.load()

    store.replace(
      {
        ...createDefaultSettings(),
        playbackMode: 'ignore',
        ui: { categoryFilter: 'Ops' },
        phrases: [samplePhrase('z', 'Zulu', 0)]
      },
      { immediate: true }
    )
    await store.saveNow()
    await store.exportTo(exportPath)

    const exportedText = await readFile(exportPath, 'utf8')
    expect(JSON.parse(exportedText)).toMatchObject({
      playbackMode: 'ignore',
      ui: { categoryFilter: 'Ops' }
    })

    const other = new SettingsStore(path.join(dir, 'other.json'), undefined, 0)
    await other.load()
    const imported = await other.importFrom(exportPath)
    expect(imported.playbackMode).toBe('ignore')
    expect(imported.phrases[0]!.name).toBe('Zulu')
  })

  it('rejects invalid import JSON', async () => {
    const dir = await createTempDir()
    const filePath = path.join(dir, 'settings.json')
    const badPath = path.join(dir, 'bad.json')
    await writeFile(badPath, 'not-json', 'utf8')

    const store = new SettingsStore(filePath, undefined, 0)
    await store.load()
    await expect(store.importFrom(badPath)).rejects.toThrow(/valid JSON/)
  })

  it('accepts unknown fields on import for schema compatibility', async () => {
    const dir = await createTempDir()
    const filePath = path.join(dir, 'settings.json')
    const importPath = path.join(dir, 'future.json')
    await writeFile(
      importPath,
      JSON.stringify({
        schemaVersion: 1,
        phrases: [],
        audio: {
          selectedOutputDeviceId: null,
          selectedInputDeviceId: null,
          microphoneGain: 0.5,
          playbackGain: 0.5
        },
        playbackMode: 'interrupt',
        ui: { categoryFilter: '' },
        futureFeature: { enabled: true }
      }),
      'utf8'
    )

    const store = new SettingsStore(filePath, undefined, 0)
    await store.load()
    const imported = await store.importFrom(importPath)
    expect(imported.audio.microphoneGain).toBe(0.5)
    expect('futureFeature' in imported).toBe(false)
  })

  it('resets to defaults', async () => {
    const dir = await createTempDir()
    const filePath = path.join(dir, 'settings.json')
    const store = new SettingsStore(filePath, undefined, 0)
    await store.load()
    store.setCategoryFilter('KeepMe')
    await store.saveNow()

    const reset = await store.resetToDefaults()
    expect(reset).toEqual(createDefaultSettings())
    expect(store.get().ui.categoryFilter).toBe('')
  })
})

describe('PhraseLibrary.replaceAll', () => {
  it('hydrates order and shortcuts from persisted phrases', () => {
    const library = new PhraseLibrary()
    const list = library.replaceAll([
      samplePhrase('b', 'Beta', 5),
      samplePhrase('a', 'Alpha', 1)
    ])

    expect(list.map((phrase) => phrase.id)).toEqual(['a', 'b'])
    expect(list[0]!.sortIndex).toBe(0)
    expect(list[1]!.sortIndex).toBe(1)
    expect(list[0]!.shortcut).toBe('F1')
  })
})
