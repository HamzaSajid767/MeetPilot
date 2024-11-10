import { EventEmitter } from 'node:events'
import {
  classifyRegistrationFailure,
  findShortcutConflict,
  isAllowedShortcut,
  normalizeShortcut,
  type HotkeyBindingStatus,
  type Phrase
} from '../shared/phrase'
import type { Logger } from './logger'
import type { PhraseLibrary } from './phrase-library'

export interface GlobalShortcutApi {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
  unregisterAll(): void
  isRegistered(accelerator: string): boolean
}

export type PlayPhraseHandler = (phraseId: string) => Promise<unknown>

/**
 * Registers Electron global shortcuts for phrase playback.
 * Syncs from PhraseLibrary on every change; releases all on dispose.
 */
export class HotkeyService extends EventEmitter {
  private readonly registered = new Set<string>()
  private bindings: HotkeyBindingStatus[] = []
  private disposed = false
  private readonly onLibraryChange: () => void

  constructor(
    private readonly library: PhraseLibrary,
    private readonly playPhrase: PlayPhraseHandler,
    private readonly logger: Logger,
    private readonly shortcuts: GlobalShortcutApi
  ) {
    super()
    this.onLibraryChange = () => this.sync()
    this.library.on('change', this.onLibraryChange)
  }

  getStatus(): readonly HotkeyBindingStatus[] {
    return this.bindings
  }

  /**
   * Normalize, conflict-check, probe Electron registration, then persist only on success.
   * On probe failure the previous phrase shortcut is left unchanged.
   */
  assignShortcut(phraseId: string, shortcut: string | null): Phrase {
    if (this.disposed) {
      throw new Error('Registration failed.')
    }

    if (shortcut == null || shortcut.trim() === '') {
      return this.library.setShortcut(phraseId, null)
    }

    const normalized = normalizeShortcut(shortcut)
    if (!isAllowedShortcut(normalized)) {
      throw new Error('Unsupported shortcut.')
    }

    const conflict = findShortcutConflict(this.library.list(), normalized, phraseId)
    if (conflict) {
      throw new Error(`Shortcut ${normalized} is already assigned to "${conflict.name}".`)
    }

    this.unregisterOwned()
    let probeOk = false
    let probeThrew = false
    try {
      probeOk = this.shortcuts.register(normalized, () => {
        /* probe only */
      })
      if (probeOk) {
        try {
          this.shortcuts.unregister(normalized)
        } catch {
          // best effort
        }
      }
    } catch (error) {
      probeThrew = true
      this.logger.warn(
        'Hotkey probe registration threw',
        {
          accelerator: normalized,
          phraseId,
          error: error instanceof Error ? error.message : String(error)
        },
        'hotkey.probe_failed'
      )
    }

    if (!probeOk) {
      this.sync()
      throw new Error(
        classifyRegistrationFailure(normalized, probeThrew ? 'threw' : 'false')
      )
    }

    return this.library.setShortcut(phraseId, normalized)
  }

  sync(): readonly HotkeyBindingStatus[] {
    if (this.disposed) {
      return this.bindings
    }

    this.unregisterOwned()
    const next: HotkeyBindingStatus[] = []

    for (const phrase of this.library.list()) {
      if (!phrase.shortcut || !phrase.enabled) {
        continue
      }

      const accelerator = phrase.shortcut
      const result = this.tryRegister(accelerator, phrase)
      next.push({
        phraseId: phrase.id,
        accelerator,
        registered: result.ok,
        error: result.ok ? null : result.error
      })
    }

    this.bindings = next
    this.emit('status', this.bindings)
    return this.bindings
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.library.off('change', this.onLibraryChange)
    this.unregisterOwned()
    this.bindings = []
    this.emit('status', this.bindings)
  }

  private tryRegister(
    accelerator: string,
    phrase: Phrase
  ): { ok: true } | { ok: false; error: string } {
    try {
      const registered = this.shortcuts.register(accelerator, () => {
        void this.playPhrase(phrase.id).catch((error: unknown) => {
          this.logger.warn(
            'Hotkey playPhrase failed',
            {
              phraseId: phrase.id,
              accelerator,
              error: error instanceof Error ? error.message : String(error)
            },
            'hotkey.play_failed'
          )
        })
      })

      if (registered) {
        this.registered.add(accelerator)
        return { ok: true }
      }
      return {
        ok: false,
        error: classifyRegistrationFailure(accelerator, 'false')
      }
    } catch (error) {
      this.logger.warn(
        'Hotkey registration threw',
        {
          accelerator,
          phraseId: phrase.id,
          error: error instanceof Error ? error.message : String(error)
        },
        'hotkey.register_failed'
      )
      return {
        ok: false,
        error: classifyRegistrationFailure(accelerator, 'threw')
      }
    }
  }

  private unregisterOwned(): void {
    for (const accelerator of this.registered) {
      try {
        this.shortcuts.unregister(accelerator)
      } catch {
        // ignored — best effort cleanup
      }
    }
    this.registered.clear()
  }
}
