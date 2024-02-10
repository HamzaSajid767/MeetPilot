# Virtual Audio

## Purpose

Document every task related to virtual microphone routing for Zoom Dialer Companion: VB-CABLE as the primary virtual device, optional VoiceMeeter support, Windows audio device discovery, selection, switching, routing guidance, failure scenarios, and recovery.

## Scope

- Virtual audio device detection and health
- Capture/render device selection policies
- Zoom Phone configuration guidance (user-operated; no Zoom APIs)
- Failure and recovery playbooks as implementation tasks
- Out of scope: writing custom WDM drivers

## Dependencies

- Windows 11 audio endpoint enumerator (WASAPI/MMDevice)
- VB-CABLE (VB-Audio Virtual Cable)
- Optional: VoiceMeeter
- [architecture.md](architecture.md), [audio-engine.md](audio-engine.md), [ui-ux.md](ui-ux.md) setup wizard

## Deliverables

- Atomic checklist for device discovery, routing, switching, and recovery
- Failure scenario matrix expressed as tasks
- Setup and verification tasks for Zoom Phone mic selection

## Completion Criteria

* [x] VB-CABLE path fully tasked for MVP
* [x] VoiceMeeter marked optional and non-blocking
* [x] Device change and failure recovery covered
* [x] User-facing setup steps mapped to wizard tasks

---

## 1. Concepts & Naming

* [ ] Document mapping: app “Render Device” = Windows recording endpoint that Zoom uses (CABLE Output)
* [ ] Document mapping: sidecar writes to CABLE Input (playback/render endpoint)
* [ ] Clarify terminology glossary in-app help string source
* [ ] Document that physical speakers remain Zoom’s playback device (unchanged)
* [ ] Document that physical mic is captured by companion, not by Zoom directly (recommended)

---

## 2. VB-CABLE Integration (Primary)

* [ ] Detect presence of device friendly name containing `CABLE Input`
* [ ] Detect presence of device friendly name containing `CABLE Output`
* [ ] Match VB-CABLE devices by stable endpoint IDs when possible
* [ ] Recommend `CABLE Input` as render target for sidecar
* [ ] Instruct user to set Zoom Phone microphone to `CABLE Output`
* [ ] Store known-good VB-CABLE endpoint IDs after first success
* [ ] Provide download/help link to official VB-Audio site in wizard
* [ ] Detect multiple cable devices (CABLE vs CABLE-A/B if installed)
* [ ] Prefer classic VB-CABLE if multiple candidates
* [ ] Warn if CABLE sample rate in Windows differs from engine target
* [ ] Document Windows Sound Control Panel steps to set cable format to 16-bit 48000 Hz
* [ ] Add checklist item for disabling exclusive mode on cable if conflicts appear
* [ ] Verify cable remains available after sleep/resume
* [ ] Verify cable remains available after USB audio hub changes

---

## 3. VoiceMeeter Integration (Optional)

* [ ] Detect VoiceMeeter virtual inputs/outputs by name patterns
* [ ] Document optional routing diagram for VoiceMeeter Banana/Potato
* [ ] Add setting `virtualDeviceProvider`: `vbCable` | `voiceMeeter` | `custom`
* [ ] Provide advanced device picker without requiring VoiceMeeter
* [ ] Skip VoiceMeeter automation APIs in v1 (manual routing only)
* [ ] Add help article stub for VoiceMeeter users
* [ ] Ensure VoiceMeeter tasks do not block MVP exit criteria

---

## 4. Windows Audio Device Discovery

* [ ] Enumerate all active capture endpoints
* [ ] Enumerate all active render endpoints
* [ ] Include device friendly name
* [ ] Include device unique ID
* [ ] Include data flow direction
* [ ] Include whether device is default
* [ ] Include whether device is virtual (heuristic by name)
* [ ] Exclude disabled endpoints
* [ ] Exclude not-present endpoints
* [ ] Refresh list on demand
* [ ] Refresh list on device notification callbacks
* [ ] Debounce rapid device notification storms
* [ ] Sort devices: recommended virtual first, then defaults, then alpha
* [ ] Localize/normalize Unicode friendly names for display

---

## 5. Device Selection Policies

* [ ] Allow manual capture device selection
* [ ] Allow manual render device selection
* [ ] Default capture to current Windows default mic on first run
* [ ] Default render to VB-CABLE Input when detected
* [ ] If VB-CABLE missing, leave render unset and mark setup required
* [ ] Persist selections by device ID
* [ ] On missing ID, attempt friendly-name fuzzy match once
* [ ] If fuzzy match fails, clear selection and notify
* [ ] Prevent selecting same device for capture and render if unsafe
* [ ] Warn when capture device appears to be CABLE Output (feedback risk)
* [ ] Warn when render device is a physical speaker (Zoom won’t hear mix)

---

## 6. Device Switching

* [ ] Implement switch capture device sequence
* [ ] Implement switch render device sequence
* [ ] Stop playback before switching devices
* [ ] Stop engine pumps before closing clients
* [ ] Re-open new devices
* [ ] Restart pass-through
* [ ] Emit DeviceListChanged after switch
* [ ] Emit EngineStateChanged through transition
* [ ] Rollback to previous devices if new open fails
* [ ] Persist only after successful switch
* [ ] UI disable Apply while switch in progress
* [ ] Timeout switch operation and Faulted if hung

---

## 7. Audio Routing (End-to-End)

* [ ] Document recommended routing path in wizard copy
* [ ] Task: verify Windows records companion output on CABLE Output using Voice Recorder (manual test)
* [ ] Task: verify Zoom Phone input meter moves when speaking with companion engine running
* [ ] Task: verify Zoom Phone input meter moves when playing a clip
* [ ] Task: verify user can still hear call audio on headphones (Zoom output unchanged)
* [ ] Task: document disabling Zoom original mic to avoid double-mic if user misconfigures
* [ ] Task: provide “routing health” aggregate: cablePresent && renderSelectedIsCable && engineMixing

---

## 8. Windows Endpoint Format & Enhancements

* [ ] Read current endpoint mix format for selected devices
* [ ] Surface format mismatch warnings in UI
* [ ] Document turning off Windows audio enhancements on mic if glitches occur
* [ ] Document Zoom audio settings interactions (suppress background noise levels)
* [ ] Add diagnostics field for enhancements unknown/unavailable

---

## 9. Default Device Change Handling

* [ ] Subscribe to default device changed notifications
* [ ] If user opted “follow Windows default mic”, switch capture automatically
* [ ] If user locked capture device, ignore default changes
* [ ] Never auto-switch render away from VB-CABLE without user action
* [ ] Notify UI when Windows default changes

---

## 10. Sleep, Resume, and Session Events

* [ ] Detect system sleep/suspend event
* [ ] Stop or park engine before sleep if required
* [ ] On resume, re-enumerate devices
* [ ] On resume, attempt auto-restart engine if previously Mixing
* [ ] Handle Windows audio service restart scenarios
* [ ] Handle Fast User Switch / session lock policy (keep running vs pause setting)

---

## 11. Failure Scenarios — Detection Tasks

* [ ] Detect VB-CABLE not installed
* [ ] Detect VB-CABLE installed but disabled
* [ ] Detect CABLE Input busy/exclusive by another app
* [ ] Detect CABLE Output not selected in Zoom (indirect: user checklist only)
* [ ] Detect capture device unplugged
* [ ] Detect render device unplugged
* [ ] Detect Bluetooth mic profile switches mid-call
* [ ] Detect sample rate change by shared-mode engine
* [ ] Detect permission/privacy mic blocked for companion app
* [ ] Detect another virtual cable software conflicting
* [ ] Detect engine start failure HRESULT classification
* [ ] Detect infinite recovery loop condition

---

## 12. Failure Scenarios — Recovery Tasks

* [ ] Recovery: prompt install VB-CABLE with link
* [ ] Recovery: open Windows Sound settings deep link if available
* [ ] Recovery: retry open device after 500ms/1s/2s backoff
* [ ] Recovery: fall back to Idle and show Setup Required banner
* [ ] Recovery: if capture lost, continue render silence + alert
* [ ] Recovery: if render lost, stop playback and alert critical
* [ ] Recovery: restart sidecar if WASAPI host corrupted
* [ ] Recovery: clear sticky Faulted via user “Retry Audio Engine”
* [ ] Recovery: restore last known-good device pair
* [ ] Recovery: capture diagnostic snapshot on repeated failure

---

## 13. Feedback & Loop Hazard Prevention

* [ ] Detect potential loop: capture from CABLE Output while rendering to CABLE Input
* [ ] Block known loop configurations with error
* [ ] Document why monitoring cable in speakers can cause echo if misrouted
* [ ] Provide safe defaults that avoid loop

---

## 14. Multi-Device & Hotplug Stress Tasks

* [ ] Test unplug USB mic during Mixing
* [ ] Test replug USB mic and reselect
* [ ] Test disable/enable VB-CABLE in Device Manager (manual)
* [ ] Test docking station audio transitions
* [ ] Test HDMI audio device appearing/disappearing
* [ ] Ensure no crash on rapid plug storms

---

## 15. Setup Wizard — Virtual Audio Tasks

* [ ] Wizard detects cable and shows green status
* [ ] Wizard shows red status with install instructions if missing
* [ ] Wizard “Recheck devices” button
* [ ] Wizard copies Zoom configuration steps with screenshots placeholders
* [ ] Wizard asks user to confirm Zoom mic set to CABLE Output (checkbox)
* [ ] Wizard runs engine start after device selection
* [ ] Wizard plays short test WAV into cable
* [ ] Wizard asks user to confirm remote/test hearing (manual)

---

## 16. Observability

* [ ] Include device IDs in health snapshots (not only names)
* [ ] Log device arrive/remove events
* [ ] Log switch timings
* [ ] Expose `routingHealth` boolean to UI
* [ ] Add tray tooltip cue when cable missing

---

## 17. Virtual Audio Completion Gate

* [ ] Fresh Windows VM/machine path: install cable → select devices → Zoom hears mic
* [ ] Fresh path: Zoom hears clip while user speaks
* [ ] Unplug mic → recoverable error → replug → works
* [ ] Disable cable → clear Setup Required UX → re-enable → works
* [ ] VoiceMeeter optional docs present without blocking GA of VB-CABLE path
