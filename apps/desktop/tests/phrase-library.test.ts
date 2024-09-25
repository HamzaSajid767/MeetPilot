import { describe, expect, it } from 'vitest'
import { filterPhrases, uniqueCategories, type Phrase } from '../src/shared/phrase'
import { PhraseLibrary } from '../src/main/phrase-library'
import { resolveToneFixture } from './sidecar-test-helpers'

function phrase(partial: Partial<Phrase> & Pick<Phrase, 'id' | 'name'>): Phrase {
  return {
    filePath: partial.filePath ?? `C:\\audio\\${partial.name}.wav`,
    durationMs: partial.durationMs ?? 1000,
    category: partial.category ?? null,
    enabled: partial.enabled ?? true,
    sortIndex: partial.sortIndex ?? 0,
    shortcut: partial.shortcut ?? null,
    ...partial
  }
}

describe('PhraseLibrary', () => {
  it('imports multiple valid WAVs and assigns sort indexes', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const result = library.importPaths([fixture, fixture])
    expect(result.errors).toHaveLength(0)
    expect(result.imported).toHaveLength(2)
    expect(library.list()).toHaveLength(2)
    expect(library.list()[0]!.sortIndex).toBe(0)
    expect(library.list()[1]!.sortIndex).toBe(1)
    expect(library.list()[0]!.enabled).toBe(true)
    expect(library.list()[0]!.durationMs).toBeGreaterThan(0)
  })

  it('records import errors for invalid files without aborting valid ones', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const result = library.importPaths([fixture, 'C:\\does-not-exist\\missing.wav'])
    expect(result.imported).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.message).toMatch(/not found|WAV/i)
  })

  it('supports rename, enable, category, reorder, and remove', () => {
    const library = new PhraseLibrary()
    const fixture = resolveToneFixture()
    const { imported } = library.importPaths([fixture, fixture])
    const first = imported[0]!
    const second = imported[1]!

    expect(library.rename(first.id, 'Greeting').name).toBe('Greeting')
    expect(library.setEnabled(first.id, false).enabled).toBe(false)
    expect(library.setCategory(first.id, 'Hold').category).toBe('Hold')
    expect(library.setCategory(first.id, '  ').category).toBeNull()

    library.reorder(second.id, 'up')
    const ordered = library.list()
    expect(ordered[0]!.id).toBe(second.id)

    expect(library.remove(first.id)).toBe(true)
    expect(library.get(first.id)).toBeUndefined()
    expect(library.list()).toHaveLength(1)
  })
})

describe('filterPhrases', () => {
  const phrases = [
    phrase({ id: '1', name: 'Hello', category: 'Greet', sortIndex: 0 }),
    phrase({ id: '2', name: 'Hold please', category: 'Hold', sortIndex: 1 }),
    phrase({ id: '3', name: 'Bye', category: 'Greet', enabled: false, sortIndex: 2 })
  ]

  it('filters by search and category', () => {
    expect(filterPhrases(phrases, { search: 'hold' })).toHaveLength(1)
    expect(filterPhrases(phrases, { category: 'Greet' })).toHaveLength(2)
    expect(filterPhrases(phrases, { search: 'he', category: 'Greet' })[0]!.name).toBe('Hello')
  })

  it('can hide disabled phrases for playable lists', () => {
    expect(filterPhrases(phrases, { playableOnly: true })).toHaveLength(2)
    expect(filterPhrases(phrases, { playableOnly: true, category: 'Greet' })).toHaveLength(1)
  })

  it('lists unique categories', () => {
    expect(uniqueCategories(phrases)).toEqual(['Greet', 'Hold'])
  })
})
