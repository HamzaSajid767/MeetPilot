# Testing

## Purpose

Define the complete testing strategy and atomic test tasks for Zoom Dialer Companion across unit, integration, manual, latency, stress, memory, playback, keyboard, and Windows compatibility layers.

## Scope

- Automated tests for main, renderer (where practical), sidecar, protocol
- Manual audio and Zoom Phone acceptance procedures
- Performance and reliability gates
- Out of scope: testing Zoom Phone itself as a product

## Dependencies

- [architecture.md](architecture.md)
- [audio-engine.md](audio-engine.md)
- [virtual-audio.md](virtual-audio.md)
- [backend.md](backend.md)
- [electron.md](electron.md)
- Vitest/Jest, Playwright/Spectron-alternative, xUnit/NUnit for .NET, Windows 11 test machines

## Deliverables

- Layered test plan as checkboxes
- Latency and reliability SLOs as tasks/gates
- Manual Zoom Phone scripts

## Completion Criteria

* [x] Each critical module has unit and/or integration coverage tasks
* [x] Audio latency measurement is tasked with numeric gates
* [x] Stress and leak testing tasked
* [x] Windows compatibility matrix tasked
* [x] Manual Zoom acceptance checklist exists

---

## 1. Test Infrastructure

* [ ] Add Vitest (or Jest) for Electron main unit tests
* [ ] Add React Testing Library for renderer unit tests
* [ ] Add Playwright for Electron smoke (or equivalent)
* [ ] Add xUnit project for sidecar unit tests
* [ ] Add CI workflow job for unit tests (docs → implement in phase)
* [ ] Add test data fixtures directory plan
* [ ] Add golden WAV fixtures (short tones)
* [ ] Add golden MP3 fixtures (short tones)
* [ ] Add corrupt audio fixtures
* [ ] Add phrase pack zip fixtures
* [ ] Add protocol JSON golden fixtures
* [ ] Add script to run all unit tests
* [ ] Add script to run integration tests
* [ ] Gate PRs on unit tests passing

---

## 2. Unit Tests — Protocol & Validation

* [ ] Test envelope serialization round-trip
* [ ] Test reject unknown command type
* [ ] Test protocol version mismatch handling
* [ ] Test PlayClip schema rejects missing path
* [ ] Test SetDucking schema bounds
* [ ] Test FTS query sanitization escapes special tokens
* [ ] Test path jail rejects relative escape
* [ ] Test mime allowlist rejects `.exe`
* [ ] Test hotkey parser accepts valid accelerators
* [ ] Test hotkey parser rejects invalid accelerators

---

## 3. Unit Tests — Storage

* [ ] Test create phrase
* [ ] Test update phrase
* [ ] Test soft delete phrase
* [ ] Test hard delete removes asset
* [ ] Test category reassignment
* [ ] Test unique hotkey constraint
* [ ] Test search by title
* [ ] Test search by tag
* [ ] Test import collision skip
* [ ] Test import collision replace
* [ ] Test settings migration bump

---

## 4. Unit Tests — Audio Engine

* [ ] Test dB to linear conversion
* [ ] Test mixer sums two sines without NaN
* [ ] Test limiter prevents abs>1 output
* [ ] Test fade-in starts at 0
* [ ] Test fade-out ends at 0
* [ ] Test ducking attack reaches target attenuation
* [ ] Test ducking release returns to unity
* [ ] Test ring buffer underrun returns zeros
* [ ] Test ring buffer overrun policy
* [ ] Test channel upmix mono to stereo
* [ ] Test SRC tone frequency preserved approximately
* [ ] Test illegal state transition rejected
* [ ] Test StopPlayback while idle is no-op success
* [ ] Test Play while Faulted rejected

---

## 5. Unit Tests — Backend Facades

* [ ] Test playPhrase loads asset and sends PlayClip
* [ ] Test playPhrase fails when asset missing
* [ ] Test sidecar restart backoff calculations
* [ ] Test settings atomic save
* [ ] Test shortcut conflict detection helper
* [ ] Test diagnostics zip excludes assets

---

## 6. Unit Tests — Renderer

* [ ] Test PhraseList renders items
* [ ] Test search debounce hook
* [ ] Test play button disabled without selection
* [ ] Test toast queue behavior
* [ ] Test theme class application
* [ ] Test setup wizard step navigation
* [ ] Test keyboard list navigation helper

---

## 7. Integration Tests — Main ↔ Sidecar

* [ ] Start sidecar harness and complete handshake
* [ ] StartEngine with fake devices in test mode
* [ ] PlayClip with WAV fixture produces PlaybackEnded
* [ ] PlayClip with MP3 fixture produces PlaybackEnded
* [ ] StopPlayback mid-clip emits ended/canceled
* [ ] DeviceLost simulation emits event
* [ ] HealthSnapshot received on interval
* [ ] Kill sidecar; main detects disconnect
* [ ] Main restarts sidecar and re-handshakes
* [ ] Protocol mismatch fails handshake clearly

---

## 8. Integration Tests — Storage + UI Invoke

* [ ] Create phrase via ipcMain handler
* [ ] Search via ipcMain handler
* [ ] Export pack and re-import into clean DB
* [ ] Delete category reassigns phrases

---

## 9. Manual Testing — Core Operator Flow

* [ ] Fresh install on clean Windows 11
* [ ] Install VB-CABLE
* [ ] Complete setup wizard
* [ ] Set Zoom Phone mic to CABLE Output
* [ ] Place Zoom Phone test call
* [ ] Confirm far side hears live mic speech
* [ ] Play WAV phrase during call
* [ ] Confirm far side hears clip and live speech together
* [ ] Play MP3 phrase during call
* [ ] Stop phrase mid-play
* [ ] Speak while clip plays (mix validation)
* [ ] Adjust volumes during call
* [ ] Toggle ducking and confirm effect
* [ ] Assign hotkey and trigger while Zoom focused
* [ ] Import phrase pack
* [ ] Export phrase pack
* [ ] Restart app mid-session and resume

---

## 10. Audio Latency Testing

* [ ] Build latency harness injecting marker tone
* [ ] Measure hotkey-to-first-sample latency
* [ ] Record p50/p95/p99 for hotkey latency
* [ ] Gate: p95 hotkey latency ≤ 80 ms on reference hardware
* [ ] Measure mic-to-cable pass-through latency
* [ ] Gate: pass-through added latency within buffer target + 10 ms
* [ ] Compare low-latency vs stable presets
* [ ] Measure latency under 50% CPU load
* [ ] Measure latency under 90% CPU load
* [ ] Document Zoom-added latency as external factor

---

## 11. Playback Testing

* [ ] Play 1-second WAV
* [ ] Play 30-second WAV
* [ ] Play 3-minute MP3
* [ ] Play successive clips with <100 ms gap
* [ ] Spam play/stop 100 times
* [ ] Play while switching category selection
* [ ] Play missing file shows error and keeps mic alive
* [ ] Play corrupt MP3 shows error
* [ ] Play unsupported codec shows error
* [ ] Verify no audible click at start with fade-in
* [ ] Verify no audible click at stop with fade-out
* [ ] Verify soft limiter prevents harsh clipping on 0 dBFS clips
* [ ] TTS short phrase playback
* [ ] TTS long phrase respects max length

---

## 12. Keyboard Testing

* [ ] Global hotkey fires with app unfocused
* [ ] Global hotkey fires with Zoom focused
* [ ] Global hotkey does not fire when disabled in settings
* [ ] Conflicting hotkey shows warning
* [ ] In-app Ctrl+K focuses search
* [ ] Arrow keys move phrase selection
* [ ] Enter plays selection
* [ ] Escape closes modal
* [ ] Typing in input does not trigger list hotkeys
* [ ] Modifier-only accelerators rejected

---

## 13. Stress Testing

* [ ] Run engine pass-through for 8 hours
* [ ] Play random phrase every 30 seconds for 4 hours
* [ ] Rapid device refresh every 1 second for 10 minutes
* [ ] Import large pack of 500 phrases
* [ ] Search continuously while playing
* [ ] Simulate device notification storms
* [ ] Fill disk almost full and assert graceful error
* [ ] Concurrent export during playback

---

## 14. Memory Leak Testing

* [ ] Baseline sidecar working set after start
* [ ] After 1000 play cycles, working set delta within budget
* [ ] After 8-hour pass-through, no unbounded growth
* [ ] Renderer heap snapshot after 1000 UI navigations
* [ ] Ensure decode workers dispose (handle count stable)
* [ ] Ensure named pipe reconnect does not leak handles
* [ ] Gate: sidecar handle count growth < threshold

---

## 15. Windows Compatibility Testing

* [ ] Windows 11 22H2 reference machine
* [ ] Windows 11 23H2/24H2 reference machine
* [ ] Test with Realtek onboard audio
* [ ] Test with USB headset mic
* [ ] Test with Bluetooth headset (HFP/A2DP caveats documented)
* [ ] Test with docking station
* [ ] Test high DPI 150% and 200%
* [ ] Test multi-monitor
* [ ] Test after modern standby resume
* [ ] Test with Windows microphone privacy enabled/disabled
* [ ] Test alongside Voicemeeter installed but unused
* [ ] Test alongside other virtual cables

---

## 16. Security Testing (Test Layer)

* [ ] Attempt path traversal in import manifest
* [ ] Attempt oversized asset import
* [ ] Attempt zip slip paths
* [ ] Attempt playing path outside assets root via crafted IPC
* [ ] Ensure preload cannot require `fs`
* [ ] Ensure CSP blocks inline unexpected scripts in prod

---

## 17. Accessibility Testing

* [ ] Keyboard-only complete play flow
* [ ] Screen reader announces playback start (spot check)
* [ ] Contrast checks on dark/light themes
* [ ] Focus visible on all controls

---

## 18. Release Test Gates

* [ ] All unit tests green
* [ ] Critical integration tests green
* [ ] Manual Zoom call checklist signed off
* [ ] Latency p95 gate met on reference hardware
* [ ] 8-hour soak without crash
* [ ] Memory budgets met
* [ ] Compatibility matrix minimum set checked
* [ ] Security traversal tests green

---

## 19. Test Completion Gate

* [ ] Testing docs reflected in CI scripts (implementation phase)
* [ ] Fixtures committed
* [ ] Manual test script stored under `tests/manual/` (implementation phase)
* [ ] Failures produce actionable logs
