# Project Plan — Master Roadmap

## Purpose

Define the phased implementation roadmap for Zoom Dialer Companion from planning through production release and post-release operations. Each phase lists granular checkbox tasks ordered by dependency. Canonical feature IDs live in [features.md](features.md); this file sequences the work.

## Scope

- Phases 0–13 covering planning, foundations, audio, desktop, library, TTS, UX, hardening, packaging, release
- Exit gates per phase
- Out of scope: executing implementation in this documentation phase

## Dependencies

- [features.md](features.md)
- [architecture.md](architecture.md)
- [decisions.md](decisions.md)
- All domain checklists

## Deliverables

- Ordered phases with atomic tasks
- Exit criteria per phase
- Milestone mapping

## Completion Criteria

* [x] Phases cover planning → GA → post-release
* [x] Tasks are checkbox granular
* [x] Dependencies respected (audio before hotkeys-into-call, etc.)
* [x] Each phase has an explicit exit gate

---

## Phase 0 — Planning (Current)

### Documentation set

* [x] Create `docs/` directory
* [x] Write [README.md](README.md)
* [x] Write [architecture.md](architecture.md)
* [x] Write [backend.md](backend.md)
* [x] Write [electron.md](electron.md)
* [x] Write [audio-engine.md](audio-engine.md)
* [x] Write [virtual-audio.md](virtual-audio.md)
* [x] Write [storage.md](storage.md)
* [x] Write [testing.md](testing.md)
* [x] Write [security.md](security.md)
* [x] Write [ui-ux.md](ui-ux.md)
* [x] Write [features.md](features.md)
* [x] Write [project-plan.md](project-plan.md)
* [x] Write [risks.md](risks.md)
* [x] Write [decisions.md](decisions.md)
* [x] Review docs for Mermaid validity and checkbox granularity
* [x] Stakeholder accept architecture baseline (.NET sidecar)

### Phase 0 exit gate

* [x] All docs present with Purpose/Scope/Dependencies/Deliverables/Completion Criteria
* [x] ADR for audio sidecar accepted
* [x] No source code created in this phase

---

## Phase 1 — Foundations

**Maps to:** F08 (partial), F16 (partial), F20 (infra)

* [x] Initialize git repository
* [x] Create root README pointing to `docs/`
* [x] Scaffold `apps/desktop` Electron+Vite+React+TS
* [x] Scaffold `apps/audio-sidecar` .NET 8 project
* [x] Scaffold `packages/shared-protocol`
* [x] Define protocol envelope + version constant
* [x] Add editorconfig / formatting baselines
* [x] Add ESLint + TypeScript strict for desktop
* [x] Add sidecar analyzers / nullable enable
* [x] Create app data path helpers
* [x] Implement structured logging skeleton in main
* [x] Implement structured logging skeleton in sidecar
* [x] Add unit test runners (Vitest + xUnit)
* [x] Add CI workflow: restore, build, unit test
* [x] Add CODEOWNERS/contributing stubs (optional)
* [x] Verify empty app window launches
* [x] Verify sidecar console host starts

### Phase 1 exit gate

* [x] `dev` launches Electron window
* [x] Sidecar runs hello-world
* [ ] CI green on empty tests

---

## Phase 2 — Core Audio Pass-Through

**Maps to:** F01, F06 (partial), F07 (partial)

* [ ] Implement device enumeration in sidecar
* [ ] Implement GetDevices command/response
* [ ] Open WASAPI capture shared mode
* [ ] Open WASAPI render to VB-CABLE Input
* [ ] Implement float mix format pipeline
* [ ] Implement capture→SRC→render pass-through
* [ ] Implement ring buffers
* [ ] Implement StartEngine/StopEngine
* [ ] Implement EngineStateChanged
* [ ] Implement HealthSnapshot underrun counters
* [ ] Manual: Zoom hears mic via cable
* [ ] Document Windows cable format 48 kHz recommendation
* [ ] Add offline fake capture/render unit tests
* [ ] Tune default buffer ms

### Phase 2 exit gate

* [ ] Stable pass-through for 30+ minutes
* [ ] Zoom Phone call hears live speech via CABLE Output
* [ ] Underruns near zero on reference hardware at idle

---

## Phase 3 — Playback Mixing

**Maps to:** F02, F03, F05, F04 (basic)

* [ ] Implement WAV decode path
* [ ] Implement MP3 decode path
* [ ] Implement PlayClip/StopPlayback
* [ ] Mix clip with live mic
* [ ] Soft limiter
* [ ] Stem gains + master
* [ ] Fade in/out
* [ ] Basic ducking enable
* [ ] Playback events
* [ ] Unit tests for mixer/fades/ducking envelopes
* [ ] Manual: clip + speech both audible in Zoom

### Phase 3 exit gate

* [ ] WAV and MP3 play into call with simultaneous mic
* [ ] Stop is click-free with fades
* [ ] Play failure does not kill pass-through

---

## Phase 4 — Virtual Audio Operations

**Maps to:** F07, F06 measurement

* [ ] Device notification watcher
* [ ] Safe device switching
* [ ] DeviceLost + Recovering flow
* [ ] Loop hazard detection
* [ ] VB-CABLE detection heuristics
* [ ] VoiceMeeter optional detection (non-blocking)
* [ ] Sleep/resume re-init
* [ ] Latency harness + record baseline
* [ ] Stress hotplug tests

### Phase 4 exit gate

* [ ] Unplug/replug mic recovers
* [ ] Missing cable surfaces Setup Required
* [ ] Latency p95 baseline documented

---

## Phase 5 — Electron Shell & IPC

**Maps to:** F08, F23 (partial)

* [ ] SidecarManager spawn + token pipe
* [x] PipeClient framing + reconnect
* [ ] Handshake + version gate
* [x] Preload API surface
* [ ] ipcMain handlers for audio/devices/app
* [ ] Status bar engine state
* [ ] Devices page MVP
* [ ] Tray + close-to-tray
* [ ] Secure window prefs + CSP draft
* [x] Integration tests main↔sidecar

### Phase 5 exit gate

* [ ] UI can start engine and play a fixture clip via IPC
* [ ] Sidecar crash auto-restarts
* [ ] Renderer cannot access Node fs

---

## Phase 6 — Phrase Library & Storage

**Maps to:** F09, F10, F11, F23

* [ ] SQLite migrations + WAL
* [ ] Phrases/categories/tags schemas
* [ ] FTS5 search
* [ ] Asset store with path jail
* [ ] Phrase CRUD APIs
* [ ] Library UI list/editor
* [ ] Categories UI
* [ ] Search UI + Ctrl+K
* [ ] Setup wizard complete flow
* [ ] Play phrase by id end-to-end
* [ ] Storage unit tests

### Phase 6 exit gate

* [ ] CRUD survives restart
* [ ] Search finds titles/tags
* [ ] Wizard completes on clean machine checklist

---

## Phase 7 — Local TTS

**Maps to:** F12

* [ ] SAPI adapter
* [ ] Voice enumeration
* [ ] PlayTts command path
* [ ] TTS UI create/play
* [ ] Timeouts and max length
* [ ] Manual Zoom TTS test

### Phase 7 exit gate

* [ ] TTS audible in call mixed with mic
* [ ] Cancel TTS works

---

## Phase 8 — Shortcuts & Operator UX

**Maps to:** F13, F22 (partial)

* [ ] Global play/stop shortcuts
* [ ] Per-phrase hotkeys
* [ ] Conflict detection UI
* [ ] In-app keyboard navigation
* [ ] Cheatsheet
* [ ] Theme light/dark/system
* [ ] Call-time UX acceptance (≤3 keystrokes)

### Phase 8 exit gate

* [ ] Hotkey plays while Zoom focused
* [ ] Keyboard-only happy path works

---

## Phase 9 — Settings, Logging, Errors

**Maps to:** F15, F16, F17

* [ ] Settings schema + pages
* [ ] Audio/ducking settings persistence
* [ ] Log rotation + open logs
* [ ] Diagnostics zip
* [ ] Error code catalog
* [ ] Toasts + Faulted modal
* [ ] Crash loop safe mode

### Phase 9 exit gate

* [ ] Settings persist
* [ ] Diagnostics zip usable for support
* [ ] Friendly errors for top 10 failure modes

---

## Phase 10 — Import / Export / Backup

**Maps to:** F14

* [ ] Phrase pack export zip
* [ ] Phrase pack import with validation
* [ ] Collision policies
* [ ] Zip slip/bomb defenses
* [ ] Manual backup/restore
* [ ] Round-trip tests

### Phase 10 exit gate

* [ ] Round-trip preserves sha256
* [ ] Malicious zip rejected

---

## Phase 11 — Hardening

**Maps to:** F20, F21, F06 gates

* [ ] Complete security checklist implementation
* [ ] Path jail + IPC validation audits
* [ ] Pipe ACL verification
* [ ] Stress 8-hour soak
* [ ] Memory leak budgets
* [ ] Latency p95 gate on reference hardware
* [ ] Compatibility matrix minimum
* [ ] Accessibility spot check
* [ ] Fix P0/P1 defects from hardening

### Phase 11 exit gate

* [ ] All release test gates in [testing.md](testing.md) checked
* [ ] Security completion gate checked
* [ ] No open P0 bugs

---

## Phase 12 — Packaging, Signing, Auto-Update

**Maps to:** F18, F19

* [ ] electron-builder NSIS config
* [ ] Bundle sidecar next to app resources
* [ ] Code signing certificates wired
* [ ] Auto-update staging server/channel
* [ ] Signature verification test
* [ ] Install/uninstall test on clean VM
* [ ] SBOM generation (optional but recommended)
* [ ] Crash reporting decision finalized (ADR)

### Phase 12 exit gate

* [ ] Signed installer installs and runs pass-through
* [ ] Update applies on staging channel

---

## Phase 13 — Beta → GA → Post-Release

### Beta

* [ ] Closed beta with Zoom Phone users
* [ ] Collect diagnostics from failures
* [ ] Fix beta P0/P1
* [ ] Finalize in-app help copy
* [ ] Support runbook draft

### GA

* [ ] Tag version 1.0.0
* [ ] Publish stable update channel
* [ ] Publish install guide (VB-CABLE + Zoom mic)
* [ ] Verify telemetry/privacy stance matches ADR
* [ ] Announce known limitations (Bluetooth caveats, Zoom AGC)

### Post-release ops

* [ ] Monitor update failure rates
* [ ] Triage incoming diagnostics
* [ ] Schedule latency re-baseline quarterly
* [ ] Backlog: VoiceMeeter deeper integration
* [ ] Backlog: additional codecs
* [ ] Backlog: cloud sync (if ever)

### Phase 13 exit gate

* [ ] GA published
* [ ] Support runbook live
* [ ] Post-release backlog groomed

---

## Milestone Mapping

| Milestone | Phase completion |
|---|---|
| M0 Spec Complete | Phase 0 |
| M1 Pass-Through Audio | Phase 2 |
| M2 Clip Into Call | Phase 3 (+ Phase 5 minimum IPC harness) |
| M3 Library MVP | Phase 6 |
| M4 Operator Ready | Phases 7–9 |
| M5 Hardened Beta | Phase 11 + Beta |
| M6 GA | Phase 12–13 |

---

## Parallelization Notes

* [ ] After Phase 2, UI scaffolding (Phase 5 early) can proceed in parallel with Phase 3 using fixture IPC
* [ ] Storage (Phase 6) can start once Phase 5 IPC patterns exist
* [ ] TTS (Phase 7) depends on mixer from Phase 3
* [ ] Packaging (Phase 12) should not start until Phase 11 P0s closed
* [ ] VoiceMeeter work never blocks VB-CABLE MVP gates

---

## Execution Rules

* [ ] One checkbox → one focused commit when practical
* [ ] Include task ID from [features.md](features.md) in commit message
* [ ] Do not skip phase exit gates
* [ ] Update risk status in [risks.md](risks.md) when mitigations land
* [ ] Add new ADRs when decisions change
