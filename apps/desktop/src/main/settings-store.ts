import { rename, readFile, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import {
  createDefaultSettings,
  normalizeSettings,
  type AppSettingsDocument,
  type SettingsSaveState,
  type SettingsStatusSnapshot
} from '../shared/settings'

export interface SettingsFileSystem {
  readFile(filePath: string, encoding: 'utf8'): Promise<string>
  writeFile(filePath: string, data: string, encoding: 'utf8'): Promise<void>
  rename(from: string, to: string): Promise<void>
  unlink(filePath: string): Promise<void>
}

const defaultFs: SettingsFileSystem = {
  readFile: (filePath, encoding) => readFile(filePath, encoding),
  writeFile: (filePath, data, encoding) => writeFile(filePath, data, encoding),
  rename,
  unlink
}

const SAVE_DEBOUNCE_MS = 400

export class SettingsStore {
  private document: AppSettingsDocument = createDefaultSettings()
  private saveState: SettingsSaveState = 'idle'
  private lastSavedAtMs: number | null = null
  private lastError: string | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private saveChain: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<(status: SettingsStatusSnapshot) => void>()

  constructor(
    private readonly filePath: string,
    private readonly fs: SettingsFileSystem = defaultFs,
    private readonly debounceMs = SAVE_DEBOUNCE_MS
  ) {}

  getFilePath(): string {
    return this.filePath
  }

  get(): AppSettingsDocument {
    return this.document
  }

  getStatus(): SettingsStatusSnapshot {
    return {
      saveState: this.saveState,
      lastSavedAtMs: this.lastSavedAtMs,
      lastError: this.lastError,
      categoryFilter: this.document.ui.categoryFilter,
      filePath: this.filePath
    }
  }

  onStatusChanged(listener: (status: SettingsStatusSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async load(): Promise<AppSettingsDocument> {
    try {
      const rawText = await this.fs.readFile(this.filePath, 'utf8')
      let parsed: unknown
      try {
        parsed = JSON.parse(rawText) as unknown
      } catch {
        await this.backupCorruptFile()
        this.document = createDefaultSettings()
        await this.writeAtomic(this.document)
        this.emitStatus()
        return this.document
      }

      try {
        this.document = normalizeSettings(parsed)
      } catch {
        await this.backupCorruptFile()
        this.document = createDefaultSettings()
      }

      await this.writeAtomic(this.document)
      this.emitStatus()
      return this.document
    } catch (error) {
      if (isNotFoundError(error)) {
        this.document = createDefaultSettings()
        await this.writeAtomic(this.document)
        this.emitStatus()
        return this.document
      }

      this.lastError = error instanceof Error ? error.message : String(error)
      this.saveState = 'error'
      this.document = createDefaultSettings()
      this.emitStatus()
      return this.document
    }
  }

  replace(document: AppSettingsDocument, options?: { immediate?: boolean }): void {
    this.document = normalizeSettings(document)
    if (options?.immediate) {
      this.scheduleSave(0)
    } else {
      this.scheduleSave(this.debounceMs)
    }
    this.emitStatus()
  }

  setCategoryFilter(categoryFilter: string): SettingsStatusSnapshot {
    this.document = {
      ...this.document,
      ui: { categoryFilter }
    }
    this.scheduleSave(this.debounceMs)
    this.emitStatus()
    return this.getStatus()
  }

  setCalibration(
    calibration: import('../shared/settings').PersistedCalibrationSettings
  ): SettingsStatusSnapshot {
    this.document = {
      ...this.document,
      calibration: { ...calibration }
    }
    this.scheduleSave(this.debounceMs)
    this.emitStatus()
    return this.getStatus()
  }

  async saveNow(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    await this.enqueueSave()
  }

  async exportTo(targetPath: string): Promise<void> {
    const payload = `${JSON.stringify(this.document, null, 2)}\n`
    const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`
    await this.fs.writeFile(tempPath, payload, 'utf8')
    await this.fs.rename(tempPath, targetPath)
  }

  async importFrom(sourcePath: string): Promise<AppSettingsDocument> {
    const rawText = await this.fs.readFile(sourcePath, 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText) as unknown
    } catch {
      throw new Error('Import file is not valid JSON')
    }

    const normalized = normalizeSettings(parsed)
    this.document = normalized
    await this.writeAtomic(this.document)
    this.emitStatus()
    return this.document
  }

  async resetToDefaults(): Promise<AppSettingsDocument> {
    this.document = createDefaultSettings()
    await this.writeAtomic(this.document)
    this.emitStatus()
    return this.document
  }

  private scheduleSave(delayMs: number): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveState = 'saving'
    this.emitStatus()
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.enqueueSave()
    }, delayMs)
  }

  private enqueueSave(): Promise<void> {
    this.saveChain = this.saveChain
      .then(async () => {
        await this.writeAtomic(this.document)
      })
      .catch((error: unknown) => {
        this.lastError = error instanceof Error ? error.message : String(error)
        this.saveState = 'error'
        this.emitStatus()
      })
    return this.saveChain
  }

  private async writeAtomic(document: AppSettingsDocument): Promise<void> {
    this.saveState = 'saving'
    this.emitStatus()
    const payload = `${JSON.stringify(document, null, 2)}\n`
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    try {
      await this.fs.writeFile(tempPath, payload, 'utf8')
      await this.fs.rename(tempPath, this.filePath)
      this.lastSavedAtMs = Date.now()
      this.lastError = null
      this.saveState = 'saved'
      this.emitStatus()
    } catch (error) {
      try {
        await this.fs.unlink(tempPath)
      } catch {
        // ignore cleanup errors
      }
      this.lastError = error instanceof Error ? error.message : String(error)
      this.saveState = 'error'
      this.emitStatus()
      throw error
    }
  }

  private async backupCorruptFile(): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(
      path.dirname(this.filePath),
      `settings.corrupt-${stamp}.json`
    )
    try {
      await this.fs.rename(this.filePath, backupPath)
    } catch {
      // If rename fails, leave original; defaults will overwrite atomically.
    }
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const listener of this.listeners) {
      listener(status)
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  )
}
