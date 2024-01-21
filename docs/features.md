# Features — Master Implementation Tracker

## Purpose

Provide the canonical feature → subfeature → atomic task tracker for Zoom Dialer Companion. This file is the master checkbox source for implementation progress. Domain documents supply deeper detail; this file tracks what must ship.

## Scope

- All product capabilities from MVP through GA
- Cross-cutting platform work (installer, updates, logging) as features
- Out of scope: marking tasks done during the planning-only phase

## Dependencies

- [project-plan.md](project-plan.md) for phase ordering
- Domain docs for elaboration: [backend.md](backend.md), [electron.md](electron.md), [audio-engine.md](audio-engine.md), [virtual-audio.md](virtual-audio.md), [storage.md](storage.md), [testing.md](testing.md), [security.md](security.md), [ui-ux.md](ui-ux.md)

## Deliverables

- Stable feature IDs (`F##`)
- Stable atomic task IDs (`F##-S##-T##`)
- Checkbox hierarchy suitable for one-commit-per-task execution

## Completion Criteria

* [x] Every project goal capability appears as a feature
* [x] Every atomic task is a single checkbox
* [x] Task IDs are unique and stable
* [x] Phase mapping referenced for each feature

### ID Convention

- `F01` Feature
- `F01-S02` Subfeature
- `F01-S02-T03` Atomic task
- Status is only the Markdown checkbox in this file (canonical)

---

## F01 — Virtual Microphone Pass-Through

**Phase:** 2  
**Refs:** [audio-engine.md](audio-engine.md), [virtual-audio.md](virtual-audio.md)

### F01-S01 — Device bind

* [ ] F01-S01-T01 Enumerate capture devices
* [ ] F01-S01-T02 Enumerate render devices
* [ ] F01-S01-T03 Select physical microphone
* [ ] F01-S01-T04 Select VB-CABLE Input as render
* [ ] F01-S01-T05 Persist device IDs

### F01-S02 — Capture → render

* [ ] F01-S02-T01 Open WASAPI capture
* [ ] F01-S02-T02 Open WASAPI render
* [ ] F01-S02-T03 Convert capture to mix format
* [ ] F01-S02-T04 Write silence-free pass-through to cable
* [ ] F01-S02-T05 Verify Zoom hears live mic via CABLE Output

### F01-S03 — Engine lifecycle

* [ ] F01-S03-T01 StartEngine command
* [ ] F01-S03-T02 StopEngine command
* [ ] F01-S03-T03 EngineStateChanged events
* [ ] F01-S03-T04 HealthSnapshot emissions

---

## F02 — Clip Playback Into Call

**Phase:** 3  
**Refs:** [audio-engine.md](audio-engine.md)

### F02-S01 — WAV playback

* [ ] F02-S01-T01 Validate WAV header
* [ ] F02-S01-T02 Decode WAV to PCM worker
* [ ] F02-S01-T03 Buffer into clip ring
* [ ] F02-S01-T04 Mix with mic stem
* [ ] F02-S01-T05 Emit playback lifecycle events

### F02-S02 — MP3 playback

* [ ] F02-S02-T01 Integrate MP3 decoder
* [ ] F02-S02-T02 Validate MP3 container
* [ ] F02-S02-T03 Decode to PCM worker
* [ ] F02-S02-T04 SRC to mix format
* [ ] F02-S02-T05 Mix with mic stem

### F02-S03 — Transport controls

* [ ] F02-S03-T01 PlayClip command
* [ ] F02-S03-T02 StopPlayback command
* [ ] F02-S03-T03 Stop-previous-on-new-play policy
* [ ] F02-S03-T04 PlaybackProgress events

---

## F03 — Live Mic + Clip Mixing

**Phase:** 3  
**Refs:** [audio-engine.md](audio-engine.md)

### F03-S01 — Mixer core

* [ ] F03-S01-T01 Float32 summing mixer
* [ ] F03-S01-T02 Per-stem gains
* [ ] F03-S01-T03 Master gain
* [ ] F03-S01-T04 Soft limiter
* [ ] F03-S01-T05 Allocation-free audio thread mix

### F03-S02 — Continue speaking while playing

* [ ] F03-S02-T01 Keep capture running during Playing
* [ ] F03-S02-T02 Manual test: speech intelligible under clip
* [ ] F03-S02-T03 Optional mute-mic-on-play setting (off default)

---

## F04 — Audio Ducking

**Phase:** 3–4  
**Refs:** [audio-engine.md](audio-engine.md)

### F04-S01 — Ducking engine

* [ ] F04-S01-T01 Sidechain detector on clip/TTS
* [ ] F04-S01-T02 Attack envelope
* [ ] F04-S01-T03 Release envelope
* [ ] F04-S01-T04 Threshold/ratio/max attenuation settings
* [ ] F04-S01-T05 Enable/disable toggle

### F04-S02 — Ducking UX

* [ ] F04-S02-T01 Settings controls for ducking params
* [ ] F04-S02-T02 Status indicator when ducking active
* [ ] F04-S02-T03 Persist ducking settings

---

## F05 — Fades & Volume Controls

**Phase:** 3  
**Refs:** [audio-engine.md](audio-engine.md), [electron.md](electron.md)

### F05-S01 — Fades

* [ ] F05-S01-T01 Fade-in on play
* [ ] F05-S01-T02 Fade-out on stop
* [ ] F05-S01-T03 Fade-out near EOF
* [ ] F05-S01-T04 Configurable defaults

### F05-S02 — Volumes

* [ ] F05-S02-T01 Mic volume slider
* [ ] F05-S02-T02 Clip volume slider
* [ ] F05-S02-T03 Master volume slider
* [ ] F05-S02-T04 Per-phrase default gain
* [ ] F05-S02-T05 SetStemGains IPC

---

## F06 — Low Latency Playback

**Phase:** 2–4  
**Refs:** [audio-engine.md](audio-engine.md), [testing.md](testing.md)

### F06-S01 — Buffering

* [ ] F06-S01-T01 Configurable target latency ms
* [ ] F06-S01-T02 Low-latency preset
* [ ] F06-S01-T03 Stable preset
* [ ] F06-S01-T04 Prebuffer minimum before audible start

### F06-S02 — Measurement

* [ ] F06-S02-T01 Hotkey-to-audible harness
* [ ] F06-S02-T02 Pass-through latency harness
* [ ] F06-S02-T03 Meet p95 ≤ 80 ms gate on reference hardware

---

## F07 — Virtual Audio Device Operations

**Phase:** 4  
**Refs:** [virtual-audio.md](virtual-audio.md)

### F07-S01 — VB-CABLE

* [ ] F07-S01-T01 Detect CABLE Input/Output
* [ ] F07-S01-T02 Recommend devices in UI
* [ ] F07-S01-T03 Setup wizard install guidance
* [ ] F07-S01-T04 Format mismatch warnings

### F07-S02 — Discovery & switching

* [ ] F07-S02-T01 Device list refresh
* [ ] F07-S02-T02 Device notification subscription
* [ ] F07-S02-T03 Safe device switch sequence
* [ ] F07-S02-T04 Rollback on failed switch

### F07-S03 — Failure recovery

* [ ] F07-S03-T01 DeviceLost events
* [ ] F07-S03-T02 Recovering state auto-retry
* [ ] F07-S03-T03 Setup Required banner
* [ ] F07-S03-T04 Loop configuration block

### F07-S04 — VoiceMeeter optional

* [ ] F07-S04-T01 Detect VoiceMeeter endpoints
* [ ] F07-S04-T02 Provider setting enum
* [ ] F07-S04-T03 Help doc stub for manual routing

---

## F08 — Electron Application Shell

**Phase:** 5  
**Refs:** [electron.md](electron.md), [backend.md](backend.md)

### F08-S01 — Main process

* [ ] F08-S01-T01 Single instance lock
* [ ] F08-S01-T02 BrowserWindow factory
* [ ] F08-S01-T03 Tray menu
* [ ] F08-S01-T04 Secure BrowserWindow prefs
* [ ] F08-S01-T05 Quit sequencing with sidecar stop

### F08-S02 — Preload & IPC

* [ ] F08-S02-T01 contextBridge API surface
* [ ] F08-S02-T02 ipcMain schema validation
* [ ] F08-S02-T03 Event fan-out to renderer
* [ ] F08-S02-T04 CSP production policy

### F08-S03 — Sidecar manager

* [ ] F08-S03-T01 Spawn sidecar with tokenized pipe
* [ ] F08-S03-T02 Handshake
* [ ] F08-S03-T03 Health ping + restart backoff
* [ ] F08-S03-T04 Version compatibility check

---

## F09 — Phrase Library

**Phase:** 6  
**Refs:** [storage.md](storage.md), [electron.md](electron.md)

### F09-S01 — Persistence

* [ ] F09-S01-T01 SQLite bootstrap + migrations
* [ ] F09-S01-T02 Phrases schema
* [ ] F09-S01-T03 Asset store copy-in
* [ ] F09-S01-T04 SHA256 + duration metadata

### F09-S02 — CRUD UI

* [ ] F09-S02-T01 Phrase list
* [ ] F09-S02-T02 Create phrase flow
* [ ] F09-S02-T03 Edit phrase flow
* [ ] F09-S02-T04 Delete phrase with confirm
* [ ] F09-S02-T05 Duplicate phrase

### F09-S03 — Play integration

* [ ] F09-S03-T01 Play selected phrase from UI
* [ ] F09-S03-T02 Highlight playing phrase
* [ ] F09-S03-T03 Update last_used_at and play_count

---

## F10 — Categories

**Phase:** 6  
**Refs:** [storage.md](storage.md), [electron.md](electron.md)

### F10-S01 — Category data

* [ ] F10-S01-T01 Categories schema
* [ ] F10-S01-T02 Seed Uncategorized
* [ ] F10-S01-T03 Reorder support
* [ ] F10-S01-T04 Delete with reassignment

### F10-S02 — Category UI

* [ ] F10-S02-T01 Category manager page
* [ ] F10-S02-T02 Filter library by category
* [ ] F10-S02-T03 Assign category in editor

---

## F11 — Searchable Phrases

**Phase:** 6  
**Refs:** [storage.md](storage.md), [ui-ux.md](ui-ux.md)

### F11-S01 — FTS

* [ ] F11-S01-T01 FTS5 table + triggers
* [ ] F11-S01-T02 Search API
* [ ] F11-S01-T03 Query sanitization

### F11-S02 — Search UX

* [ ] F11-S02-T01 Debounced search box
* [ ] F11-S02-T02 Ctrl+K focus
* [ ] F11-S02-T03 Empty results state
* [ ] F11-S02-T04 Result ranking display order

---

## F12 — Local TTS

**Phase:** 7  
**Refs:** [audio-engine.md](audio-engine.md)

### F12-S01 — SAPI engine

* [ ] F12-S01-T01 Enumerate voices
* [ ] F12-S01-T02 Synthesize to PCM
* [ ] F12-S01-T03 Inject into mixer
* [ ] F12-S01-T04 Cancel synthesis on stop
* [ ] F12-S01-T05 Max text length enforcement

### F12-S02 — TTS UI

* [ ] F12-S02-T01 TTS phrase type option
* [ ] F12-S02-T02 Voice picker
* [ ] F12-S02-T03 Preview TTS
* [ ] F12-S02-T04 Play TTS into engine

---

## F13 — Keyboard Shortcuts

**Phase:** 8  
**Refs:** [backend.md](backend.md), [electron.md](electron.md), [ui-ux.md](ui-ux.md)

### F13-S01 — Global shortcuts

* [ ] F13-S01-T01 Register global play/stop
* [ ] F13-S01-T02 Per-phrase global hotkeys
* [ ] F13-S01-T03 Conflict detection
* [ ] F13-S01-T04 Enable/disable global shortcuts setting

### F13-S02 — In-app shortcuts

* [ ] F13-S02-T01 Search / new / play / stop bindings
* [ ] F13-S02-T02 List arrow navigation
* [ ] F13-S02-T03 Cheatsheet modal
* [ ] F13-S02-T04 Shortcut editor UI

---

## F14 — Import / Export

**Phase:** 10  
**Refs:** [storage.md](storage.md), [security.md](security.md)

### F14-S01 — Phrase packs

* [ ] F14-S01-T01 Manifest schema v1
* [ ] F14-S01-T02 Export zip
* [ ] F14-S01-T03 Import zip with validation
* [ ] F14-S01-T04 Collision policies
* [ ] F14-S01-T05 Zip slip / bomb defenses

### F14-S02 — Backup

* [ ] F14-S02-T01 Manual backup snapshot
* [ ] F14-S02-T02 Restore with confirm
* [ ] F14-S02-T03 Integrity check after restore

---

## F15 — Settings

**Phase:** 9  
**Refs:** [backend.md](backend.md), [electron.md](electron.md)

### F15-S01 — Settings persistence

* [ ] F15-S01-T01 Settings schema
* [ ] F15-S01-T02 Atomic save
* [ ] F15-S01-T03 Defaults factory
* [ ] F15-S01-T04 Schema migration field

### F15-S02 — Settings UI

* [ ] F15-S02-T01 General settings page
* [ ] F15-S02-T02 Audio settings page
* [ ] F15-S02-T03 Shortcuts settings page
* [ ] F15-S02-T04 Reset to defaults confirm

---

## F16 — Logging & Diagnostics

**Phase:** 9  
**Refs:** [backend.md](backend.md), [security.md](security.md)

### F16-S01 — Logging

* [ ] F16-S01-T01 Structured file logs + rotation
* [ ] F16-S01-T02 Redaction rules
* [ ] F16-S01-T03 Open logs action

### F16-S02 — Diagnostics

* [ ] F16-S02-T01 Diagnostics zip export
* [ ] F16-S02-T02 Include versions/devices/health
* [ ] F16-S02-T03 Exclude assets by default

---

## F17 — Error Handling

**Phase:** 9–11  
**Refs:** [backend.md](backend.md), [ui-ux.md](ui-ux.md), [security.md](security.md)

### F17-S01 — Error catalog

* [ ] F17-S01-T01 Define error codes
* [ ] F17-S01-T02 Map to user messages
* [ ] F17-S01-T03 Correlation IDs in dialogs

### F17-S02 — Resilience UX

* [ ] F17-S02-T01 Toasts for non-fatal errors
* [ ] F17-S02-T02 Modal for Faulted engine
* [ ] F17-S02-T03 Safe mode after crash loop
* [ ] F17-S02-T04 Play failure keeps mic pass-through

---

## F18 — Auto Updates

**Phase:** 12  
**Refs:** [backend.md](backend.md), [security.md](security.md)

### F18-S01 — Updater

* [ ] F18-S01-T01 electron-updater integration
* [ ] F18-S01-T02 Check on startup setting
* [ ] F18-S01-T03 Manual check
* [ ] F18-S01-T04 Download + prompt restart
* [ ] F18-S01-T05 Signature verification

### F18-S02 — Channels

* [ ] F18-S02-T01 Stable channel
* [ ] F18-S02-T02 Beta channel setting

---

## F19 — Installer & Packaging

**Phase:** 12  
**Refs:** [project-plan.md](project-plan.md), [security.md](security.md)

### F19-S01 — Build pipeline

* [ ] F19-S01-T01 Package Electron app
* [ ] F19-S01-T02 Bundle sidecar binaries
* [ ] F19-S01-T03 NSIS installer via electron-builder
* [ ] F19-S01-T04 Code signing
* [ ] F19-S01-T05 CI build artifacts

### F19-S02 — First-run packaging concerns

* [ ] F19-S02-T01 Installer does not silently install VB-CABLE (document manual)
* [ ] F19-S02-T02 Shortcut/start menu entries
* [ ] F19-S02-T03 Uninstall cleans app data optional checkbox

---

## F20 — Testing Program

**Phase:** 11 (ongoing earlier)  
**Refs:** [testing.md](testing.md)

### F20-S01 — Automated

* [ ] F20-S01-T01 Unit test suites main/sidecar/renderer
* [ ] F20-S01-T02 Integration pipe tests
* [ ] F20-S01-T03 CI gate

### F20-S02 — Manual & nonfunctional

* [ ] F20-S02-T01 Zoom call acceptance script
* [ ] F20-S02-T02 Latency gates
* [ ] F20-S02-T03 Stress + leak gates
* [ ] F20-S02-T04 Compatibility matrix

---

## F21 — Security Hardening

**Phase:** 11  
**Refs:** [security.md](security.md)

### F21-S01 — Boundaries

* [ ] F21-S01-T01 Electron sandbox hardening
* [ ] F21-S01-T02 Pipe ACL + token
* [ ] F21-S01-T03 Path jail
* [ ] F21-S01-T04 Audio/pack validation
* [ ] F21-S01-T05 CSP + openExternal allowlist

---

## F22 — Theme & Accessibility

**Phase:** 8–9  
**Refs:** [ui-ux.md](ui-ux.md), [electron.md](electron.md)

### F22-S01 — Theme

* [ ] F22-S01-T01 Light theme tokens
* [ ] F22-S01-T02 Dark theme tokens
* [ ] F22-S01-T03 System theme follow

### F22-S02 — A11y

* [ ] F22-S02-T01 Focus rings + aria-labels
* [ ] F22-S02-T02 Live regions for playback
* [ ] F22-S02-T03 Keyboard-only acceptance

---

## F23 — Setup Wizard

**Phase:** 5–6  
**Refs:** [ui-ux.md](ui-ux.md), [virtual-audio.md](virtual-audio.md)

### F23-S01 — Wizard steps

* [ ] F23-S01-T01 Welcome
* [ ] F23-S01-T02 VB-CABLE install guidance
* [ ] F23-S01-T03 Device detection/selection
* [ ] F23-S01-T04 Zoom mic configuration instructions
* [ ] F23-S01-T05 Test confirmation
* [ ] F23-S01-T06 Persist wizardCompleted

---

## Traceability Matrix (Goals → Features)

| Goal | Features |
|---|---|
| Make calls with Zoom Phone | External; F07/F23 guidance |
| Hotkey/button play during call | F02, F08, F13 |
| Prerecorded clip or local TTS | F02, F12 |
| Continue speaking while playing | F03 |
| Mix mic + playback | F03, F05 |
| Never modify Zoom / no undocumented APIs | Architecture constraint; F07 |
| Virtual microphone | F01, F07 |
| Electron UI | F08, F09–F11, F15, F22, F23 |
| Node backend | F08, F09, F15–F17 |
| MP3/WAV | F02 |
| Search + categories | F10, F11 |
| Import/export | F14 |
| Volume + ducking + low latency | F04, F05, F06 |
| Settings, logging, errors | F15–F17 |
| Auto updates + installer + CI | F18, F19 |
| Testing | F20 |
| Security | F21 |

---

## Master Tracker Hygiene

* [ ] When starting work, check the atomic box only after the commit lands
* [ ] Do not check planning-phase documentation boxes as product complete
* [ ] Prefer linking PR/commit SHA in commit message with task ID
* [ ] If a task splits, add new IDs rather than overloading one checkbox
* [ ] Keep [project-plan.md](project-plan.md) phase lists aligned when adding features
