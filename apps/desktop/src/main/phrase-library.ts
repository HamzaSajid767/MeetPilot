import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import type {
  Phrase,
  PhraseImportResult,
  PhraseReorderDirection
} from '../shared/phrase'
import {
  findShortcutConflict,
  isAllowedShortcut,
  normalizeShortcut
} from '../shared/phrase'
import { readWavMetadata } from './wav-metadata'

export class PhraseLibrary extends EventEmitter {
  private readonly phrases = new Map<string, Phrase>()

  list(): Phrase[] {
    return [...this.phrases.values()].sort(
      (a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name)
    )
  }

  get(id: string): Phrase | undefined {
    return this.phrases.get(id)
  }

  /**
   * Replace the entire library (e.g. hydrate from settings). Emits `change`.
   */
  replaceAll(phrases: readonly Phrase[]): Phrase[] {
    this.phrases.clear()
    const ordered = [...phrases].sort(
      (a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name)
    )
    ordered.forEach((phrase, index) => {
      this.phrases.set(phrase.id, { ...phrase, sortIndex: index })
    })
    const list = this.list()
    this.emit('change', list)
    return list
  }

  /**
   * Add a generated WAV (e.g. TTS) as a normal phrase entry.
   */
  addGeneratedPhrase(input: {
    readonly id: string
    readonly name: string
    readonly filePath: string
    readonly durationMs: number
    readonly category?: string | null
  }): Phrase {
    const id = input.id.trim()
    const name = input.name.trim()
    const filePath = path.resolve(input.filePath)

    if (!id) {
      throw new Error('Phrase id is required')
    }
    if (!name) {
      throw new Error('Phrase name must be a non-empty string')
    }
    if (this.phrases.has(id)) {
      throw new Error(`Phrase already exists: ${id}`)
    }

    const phrase: Phrase = {
      id,
      name,
      filePath,
      durationMs: Math.max(0, input.durationMs),
      category:
        input.category == null || input.category.trim() === ''
          ? null
          : input.category.trim(),
      enabled: true,
      sortIndex: this.nextSortIndex(),
      shortcut: null
    }

    this.phrases.set(phrase.id, phrase)
    this.emit('change', this.list())
    return phrase
  }

  importPaths(filePaths: readonly string[]): PhraseImportResult {
    const imported: Phrase[] = []
    const errors: { path: string; message: string }[] = []
    let nextIndex = this.nextSortIndex()

    for (const filePath of filePaths) {
      try {
        const absolute = path.resolve(filePath)
        const meta = readWavMetadata(absolute)
        const phrase: Phrase = {
          id: randomUUID().replaceAll('-', ''),
          name: defaultNameFromPath(absolute),
          filePath: absolute,
          durationMs: meta.durationMs,
          category: null,
          enabled: true,
          sortIndex: nextIndex++,
          shortcut: null
        }
        this.phrases.set(phrase.id, phrase)
        imported.push(phrase)
      } catch (error) {
        errors.push({
          path: filePath,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (imported.length > 0) {
      this.emit('change', this.list())
    }

    return { imported, errors }
  }

  remove(id: string): boolean {
    const removed = this.phrases.delete(id)
    if (removed) {
      this.reindex()
      this.emit('change', this.list())
    }
    return removed
  }

  rename(id: string, name: string): Phrase {
    const phrase = this.require(id)
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Phrase name must be a non-empty string')
    }

    const updated: Phrase = { ...phrase, name: trimmed }
    this.phrases.set(id, updated)
    this.emit('change', this.list())
    return updated
  }

  setEnabled(id: string, enabled: boolean): Phrase {
    const phrase = this.require(id)
    const updated: Phrase = { ...phrase, enabled }
    this.phrases.set(id, updated)
    this.emit('change', this.list())
    return updated
  }

  setCategory(id: string, category: string | null): Phrase {
    const phrase = this.require(id)
    const normalized =
      category == null || category.trim() === '' ? null : category.trim()
    const updated: Phrase = { ...phrase, category: normalized }
    this.phrases.set(id, updated)
    this.emit('change', this.list())
    return updated
  }

  setShortcut(id: string, shortcut: string | null): Phrase {
    const phrase = this.require(id)

    if (shortcut == null || shortcut.trim() === '') {
      const cleared: Phrase = { ...phrase, shortcut: null }
      this.phrases.set(id, cleared)
      this.emit('change', this.list())
      return cleared
    }

    const normalized = normalizeShortcut(shortcut)
    if (!isAllowedShortcut(normalized)) {
      throw new Error('Unsupported shortcut.')
    }

    const conflict = findShortcutConflict(this.list(), normalized, id)
    if (conflict) {
      throw new Error(
        `Shortcut ${normalized} is already assigned to "${conflict.name}".`
      )
    }

    const updated: Phrase = { ...phrase, shortcut: normalized }
    this.phrases.set(id, updated)
    this.emit('change', this.list())
    return updated
  }

  reorder(id: string, direction: PhraseReorderDirection): Phrase {
    const ordered = this.list()
    const index = ordered.findIndex((phrase) => phrase.id === id)
    if (index < 0) {
      throw new Error(`Phrase not found: ${id}`)
    }

    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (swapWith < 0 || swapWith >= ordered.length) {
      return ordered[index]!
    }

    const current = ordered[index]!
    const neighbor = ordered[swapWith]!
    const currentIndex = current.sortIndex
    this.phrases.set(current.id, { ...current, sortIndex: neighbor.sortIndex })
    this.phrases.set(neighbor.id, { ...neighbor, sortIndex: currentIndex })
    this.emit('change', this.list())
    return this.phrases.get(id)!
  }

  private require(id: string): Phrase {
    const phrase = this.phrases.get(id)
    if (!phrase) {
      throw new Error(`Phrase not found: ${id}`)
    }
    return phrase
  }

  private nextSortIndex(): number {
    let max = -1
    for (const phrase of this.phrases.values()) {
      if (phrase.sortIndex > max) {
        max = phrase.sortIndex
      }
    }
    return max + 1
  }

  private reindex(): void {
    const ordered = this.list()
    ordered.forEach((phrase, index) => {
      if (phrase.sortIndex !== index) {
        this.phrases.set(phrase.id, { ...phrase, sortIndex: index })
      }
    })
  }
}

function defaultNameFromPath(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath))
  return base || 'Untitled phrase'
}
