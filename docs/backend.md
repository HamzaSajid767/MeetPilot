# Backend

## Purpose

Enumerate every atomic backend task for Electron main (Node/TypeScript) and the .NET 8 audio sidecar host/orchestration boundary. Audio DSP details live in [audio-engine.md](audio-engine.md); this file owns process management, IPC, services, persistence orchestration, updates, and logging.

## Scope

- Electron main process services
- Named-pipe client and sidecar lifecycle
- Phrase/category/settings/import-export orchestration
- Shared protocol scaffolding
- Logging, diagnostics, auto-update hooks
- Out of scope: React components (see [electron.md](electron.md)), WASAPI internals (see [audio-engine.md](audio-engine.md))

## Dependencies

- [architecture.md](architecture.md)
- [storage.md](storage.md)
- [security.md](security.md)
- [decisions.md](decisions.md) — named pipes, SQLite, sidecar
- Windows named pipes, SQLite, electron-updater

## Deliverables

- Complete checkbox list of backend implementation tasks
- Clear ownership between Node main and sidecar host (non-DSP)

## Completion Criteria

* [x] Every backend concern has atomic `* [ ]` tasks
* [x] Sidecar lifecycle and IPC handshake are fully covered
* [x] Tasks map to future commits without bundling unrelated work
* [x] Cross-references to storage/security/audio docs are present where needed

---

## 1. Repository & Project Bootstrap (Backend-facing)

* [ ] Create `apps/desktop` Electron TypeScript project skeleton (main-only packages first)
* [ ] Create `apps/audio-sidecar` .NET 8 console/worker project skeleton
* [ ] Create `packages/shared-protocol` folder for IPC schema documents
* [ ] Define IPC protocol version constant `1.0.0`
* [ ] Document message envelope fields: `id`, `type`, `protocolVersion`, `payload`, `ts`
* [ ] Define command message type enum list
* [ ] Define event message type enum list
* [ ] Define error payload shape with `code`, `message`, `retriable`
* [ ] Add `.gitignore` entries for `node_modules`, `bin`, `obj`, `dist`, logs (docs note only until scaffold phase)
* [ ] Define app data root path helper: `%APPDATA%/ZoomDialerCompanion`
* [ ] Define logs directory path helper
* [ ] Define assets directory path helper
* [ ] Define database file path helper

---

## 2. Electron Main Bootstrap

* [ ] Implement single-instance application lock
* [ ] Implement `app.whenReady` bootstrap sequence
* [ ] Implement graceful quit handler that stops sidecar first
* [ ] Implement crash/unhandledRejection logging hooks in main
* [ ] Implement tray icon placeholder registration
* [ ] Implement show/hide main window from tray
* [ ] Implement Windows protocol/second-instance focus behavior
* [ ] Wire environment detection: development vs production paths
* [ ] Resolve sidecar executable path for dev
* [ ] Resolve sidecar executable path for packaged builds
* [ ] Add main-process configuration loader for defaults

---

## 3. Logging Service

* [ ] Define structured log event schema (level, scope, message, context)
* [ ] Implement file transport with daily rotation
* [ ] Implement max retained log file count setting
* [ ] Implement console transport for development
* [ ] Implement log level filter setting
* [ ] Redact secrets/tokens from log fields
* [ ] Add `openLogsFolder` main handler
* [ ] Write startup banner with app version and OS version
* [ ] Write shutdown banner with uptime
* [ ] Correlate IPC request IDs in logs

---

## 4. Settings Service

* [ ] Define settings JSON schema
* [ ] Implement load settings from disk
* [ ] Implement save settings atomically (temp file + rename)
* [ ] Implement default settings factory
* [ ] Implement getSetting(key) accessor
* [ ] Implement setSetting(key, value) accessor
* [ ] Implement settings change event bus in main
* [ ] Persist selected capture device ID
* [ ] Persist selected render device ID
* [ ] Persist master/mic/clip volume values
* [ ] Persist ducking parameters
* [ ] Persist theme preference
* [ ] Persist window bounds
* [ ] Persist start-minimized preference
* [ ] Persist auto-start engine preference
* [ ] Persist update channel preference
* [ ] Migrate settings schema version field

---

## 5. Sidecar Process Manager

* [ ] Define SidecarManager interface
* [ ] Implement spawn sidecar with stdio piping for stderr logs
* [ ] Pass pipe name argument to sidecar on launch
* [ ] Pass one-time auth token argument to sidecar on launch
* [ ] Implement wait-for-pipe-ready with timeout
* [ ] Implement sidecar health ping loop
* [ ] Implement restart policy with exponential backoff
* [ ] Cap maximum restart attempts per time window
* [ ] Emit `sidecar:status` events to renderer subscribers
* [ ] Implement graceful stop via Quit command
* [ ] Implement forced kill fallback after stop timeout
* [ ] Ensure sidecar is killed on app quit
* [ ] Detect unexpected sidecar exit codes
* [ ] Map exit codes to user-visible error strings
* [ ] Prevent duplicate sidecar instances
* [ ] Add sidecar version query on handshake
* [ ] Reject incompatible sidecar protocol versions
* [ ] Capture sidecar crash dumps path note in diagnostics (if available)

---

## 6. Named Pipe Client (Main)

* [ ] Define PipeClient interface
* [ ] Implement connect to named pipe
* [ ] Implement reconnect after disconnect
* [ ] Implement length-prefixed frame writer
* [ ] Implement length-prefixed frame reader
* [ ] Implement JSON serialize command helper
* [ ] Implement JSON deserialize event helper
* [ ] Implement request/response correlation by message `id`
* [ ] Implement per-command timeout
* [ ] Implement cancel in-flight requests on disconnect
* [ ] Implement command queue while reconnecting
* [ ] Drop or fail queued commands after max reconnect wait
* [ ] Validate event payloads against schema
* [ ] Emit typed events to internal EventEmitter
* [ ] Add metrics counters: sent, received, timeouts, decode errors

---

## 7. Sidecar Host (Non-DSP)

* [ ] Create .NET generic host builder
* [ ] Register DI services for IPC, devices, engine
* [ ] Parse CLI args for pipe name and token
* [ ] Validate auth token on first handshake
* [ ] Implement named pipe server listener
* [ ] Accept single client connection (v1)
* [ ] Reject additional clients while connected (v1 policy)
* [ ] Dispatch commands to handlers by type
* [ ] Return error responses for unknown commands
* [ ] Implement graceful cancellation token shutdown
* [ ] Forward engine events to pipe writer
* [ ] Implement heartbeat responder
* [ ] Log unhandled exceptions without terminating audio mid-frame when possible
* [ ] Add assembly version endpoint/command

---

## 8. Shared Protocol Tasks

* [ ] Author `Handshake` command schema
* [ ] Author `HandshakeResult` event/response schema
* [ ] Author `StartEngine` command schema
* [ ] Author `StopEngine` command schema
* [ ] Author `SetDevices` command schema
* [ ] Author `PlayClip` command schema
* [ ] Author `PlayTts` command schema
* [ ] Author `StopPlayback` command schema
* [ ] Author `SetStemGains` command schema
* [ ] Author `SetDucking` command schema
* [ ] Author `GetHealth` command schema
* [ ] Author `GetDevices` command schema
* [ ] Author `EngineStateChanged` event schema
* [ ] Author `DeviceListChanged` event schema
* [ ] Author `DeviceLost` event schema
* [ ] Author `PlaybackStarted` event schema
* [ ] Author `PlaybackProgress` event schema
* [ ] Author `PlaybackEnded` event schema
* [ ] Author `PlaybackError` event schema
* [ ] Author `Underrun` event schema
* [ ] Author `Overrun` event schema
* [ ] Author `HealthSnapshot` event schema
* [ ] Author `Quit` command schema
* [ ] Generate TypeScript types from protocol schemas
* [ ] Generate or hand-mirror C# records from protocol schemas
* [ ] Add protocol compatibility test fixtures (JSON samples)

---

## 9. Phrase Service (Main)

* [ ] Define Phrase domain model TypeScript interface
* [ ] Implement createPhrase with validation
* [ ] Implement updatePhrase with validation
* [ ] Implement deletePhrase soft-delete option flag
* [ ] Implement deletePhrase hard-delete with asset cleanup
* [ ] Implement getPhraseById
* [ ] Implement listPhrases with pagination
* [ ] Implement listPhrasesByCategory
* [ ] Implement assignPhraseHotkey
* [ ] Implement clearPhraseHotkey
* [ ] Implement setPhraseDefaultGain
* [ ] Implement touchPhraseLastUsedAt on play
* [ ] Implement duplicatePhrase
* [ ] Reject create when title empty
* [ ] Reject create when asset missing
* [ ] Emit phraseChanged events for UI refresh

---

## 10. Category Service (Main)

* [ ] Define Category domain model
* [ ] Implement createCategory
* [ ] Implement renameCategory
* [ ] Implement deleteCategory and reassign phrases policy
* [ ] Implement reorderCategories
* [ ] Implement listCategories tree/flatten
* [ ] Prevent deleting default Uncategorized category
* [ ] Validate unique category names per parent

---

## 11. Search Service (Main)

* [ ] Implement FTS search query builder
* [ ] Implement search by title
* [ ] Implement search by tags
* [ ] Implement search by notes/transcript field
* [ ] Implement combined multi-field search
* [ ] Implement search result ranking order
* [ ] Implement empty-query fallback to recent phrases
* [ ] Escape FTS user input safely
* [ ] Limit maximum search result count

---

## 12. Asset Storage Orchestration (Main)

* [ ] Implement copyImportedFileIntoAssetStore
* [ ] Generate content-addressed or UUID asset filename
* [ ] Store original filename in metadata
* [ ] Compute and store file sha256 hash
* [ ] Compute and store durationMs via sidecar or decoder helper
* [ ] Delete orphan assets not referenced by phrases
* [ ] Implement asset existence check before PlayClip
* [ ] Resolve absolute path only inside assets root
* [ ] Reject symlink escape attempts

---

## 13. Audio Command Facade (Main)

* [ ] Implement `playPhrase(id)` facade: load → validate → PlayClip
* [ ] Implement `stopPlayback()` facade
* [ ] Implement `previewPhrase(id)` using local render device (optional path)
* [ ] Implement `setVolumes` facade mapping settings → SetStemGains
* [ ] Implement `applyDuckingFromSettings` facade
* [ ] Implement `startEngineWithSavedDevices` facade
* [ ] Implement `refreshDevices` facade
* [ ] Debounce rapid repeat hotkey plays according to setting
* [ ] Ignore play requests when engine not Mixing/Playing unless auto-start enabled
* [ ] Auto-start engine on first play if setting enabled

---

## 14. Device Coordination (Main)

* [ ] Cache last known device list from sidecar events
* [ ] Persist user device selections after successful SetDevices
* [ ] Clear persisted device if reported missing
* [ ] Expose getDeviceStatus aggregate for UI
* [ ] Trigger setup-required flag when VB-CABLE not found
* [ ] Map DeviceLost to user notification payload

---

## 15. Shortcut Service (Main)

* [ ] Register globalShortcut for play selected phrase
* [ ] Register globalShortcut for stop playback
* [ ] Register per-phrase global shortcuts from DB
* [ ] Unregister all shortcuts on quit
* [ ] Detect registration failure (conflict)
* [ ] Persist conflict list for UI
* [ ] Validate accelerator string format
* [ ] Disable global shortcuts when setting turned off
* [ ] Support push-to-talk-style hold vs toggle policy flag (document behavior)

---

## 16. Import / Export Service (Main)

* [ ] Define phrase pack manifest schema version
* [ ] Export selected phrases to zip pack
* [ ] Export all phrases to zip pack
* [ ] Include assets and manifest in pack
* [ ] Import pack with dry-run validation
* [ ] Import pack committing metadata + assets
* [ ] Skip or rename on ID collision per policy
* [ ] Validate audio files during import
* [ ] Rollback import on mid-failure
* [ ] Export settings backup JSON
* [ ] Import settings backup JSON with schema check

---

## 17. Diagnostics Service (Main)

* [ ] Collect app version, electron version, OS build
* [ ] Collect sidecar version and protocol version
* [ ] Collect selected devices snapshot
* [ ] Collect recent health snapshots
* [ ] Write diagnostics zip for support
* [ ] Include last N log files in diagnostics zip
* [ ] Exclude audio assets from diagnostics by default

---

## 18. Auto-Update Service (Main)

* [ ] Integrate electron-updater configuration hooks
* [ ] Check for updates on startup (setting-gated)
* [ ] Check for updates on interval
* [ ] Download update in background
* [ ] Prompt user to restart to apply
* [ ] Support manual check from settings
* [ ] Handle update errors with toast payload
* [ ] Verify update signature/publisher policy
* [ ] Respect update channel (stable/beta)

---

## 19. Main IPC Host (Electron ipcMain)

* [ ] Register `phrases.list` handler
* [ ] Register `phrases.get` handler
* [ ] Register `phrases.create` handler
* [ ] Register `phrases.update` handler
* [ ] Register `phrases.delete` handler
* [ ] Register `phrases.search` handler
* [ ] Register `phrases.play` handler
* [ ] Register `phrases.stop` handler
* [ ] Register `categories.*` handlers
* [ ] Register `devices.list` handler
* [ ] Register `devices.select` handler
* [ ] Register `devices.refresh` handler
* [ ] Register `settings.get` handler
* [ ] Register `settings.set` handler
* [ ] Register `shortcuts.list` handler
* [ ] Register `shortcuts.set` handler
* [ ] Register `importExport.import` handler
* [ ] Register `importExport.export` handler
* [ ] Register `app.getVersion` handler
* [ ] Register `app.openLogs` handler
* [ ] Register `app.exportDiagnostics` handler
* [ ] Register `updates.check` handler
* [ ] Validate every handler payload with schema
* [ ] Return normalized error objects to renderer
* [ ] Forward sidecar events to renderer via `webContents.send`

---

## 20. Error Handling (Backend)

* [ ] Define error code catalog
* [ ] Map SQLite constraint errors to user messages
* [ ] Map pipe timeouts to user messages
* [ ] Map device errors to user messages
* [ ] Map decode errors to user messages
* [ ] Ensure failed play does not stop mic pass-through
* [ ] Ensure failed device set rolls back UI selection
* [ ] Add retry helper for transient pipe errors
* [ ] Record error telemetry counters locally

---

## 21. Backend Testing Hooks

* [ ] Add fake PipeClient for main unit tests
* [ ] Add in-memory settings store for tests
* [ ] Add temporary assets directory fixture helper
* [ ] Add protocol golden-file loader for contract tests
* [ ] Add sidecar host test mode that fakes engine

---

## 22. Backend Completion Gate

* [ ] Main can spawn sidecar and complete handshake
* [ ] Main can start engine and receive EngineStateChanged
* [ ] Main can play a phrase end-to-end via facade
* [ ] Main persists settings across restart
* [ ] Main recovers from sidecar crash with backoff
* [ ] All ipcMain channels documented and schema-validated
