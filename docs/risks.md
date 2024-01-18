# Risks

## Purpose

Maintain a comprehensive risk register for Zoom Dialer Companion covering Windows audio, Zoom interactions, process architecture, performance, security, and delivery risks. Each risk includes description, probability, impact, indicators, mitigation, contingency, and owner role.

## Scope

- Technical, product, operational, and compliance/privacy risks relevant to v1
- Living document: update status as mitigations land
- Out of scope: corporate business financing risks

## Dependencies

- [architecture.md](architecture.md)
- [audio-engine.md](audio-engine.md)
- [virtual-audio.md](virtual-audio.md)
- [security.md](security.md)
- [testing.md](testing.md)
- [decisions.md](decisions.md)

## Deliverables

- Structured risk entries R01+
- Mitigation tasks cross-linked to roadmap phases where applicable

## Completion Criteria

* [x] Major audio/Zoom/process risks documented
* [x] Each risk has probability, impact, mitigation, contingency
* [x] Owner roles assigned
* [x] Review cadence defined

### Probability / Impact Scale

- Probability: Low / Medium / High
- Impact: Low / Medium / High / Critical
- Status: Open / Mitigating / Accepted / Closed

---

## R01 — Windows Audio Device Conflicts

- **Description:** Other apps open the mic or VB-CABLE in exclusive mode, preventing engine start or causing glitches.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** Device busy HRESULTs; exclusive mode failures; intermittent silence.
- **Mitigation:** Prefer shared mode; clear errors; detect busy; document closing conflicting apps; avoid exclusive by default.
- **Contingency:** Offer retry; guide user to disable exclusive mode on cable endpoint.
- **Owner:** Audio engineer
- **Status:** Open
- **Related tasks:** Phase 2–4 device open/error mapping

---

## R02 — Zoom Audio Suppression / AGC Attenuates Clips

- **Description:** Zoom Phone noise suppression, AGC, or “suppress background noise” reduces or distorts played clips.
- **Probability:** High
- **Impact:** High
- **Indicators:** Clip quiet vs local preview; pumping artifacts; clipped consonants removed.
- **Mitigation:** Wizard/settings guidance to lower Zoom suppression; provide clip normalization; ducking/limiter controls; document recommended Zoom audio settings.
- **Contingency:** Per-phrase gain boost with limiter; user profile “Zoom-safe” preset.
- **Owner:** Product + audio
- **Status:** Open

---

## R03 — VB-CABLE Missing or Misconfigured

- **Description:** Users skip virtual cable install or select wrong endpoints; Zoom still uses physical mic.
- **Probability:** High
- **Impact:** Critical (feature fails)
- **Indicators:** Setup Required; Zoom meter silent when companion plays; render device not cable.
- **Mitigation:** First-run wizard; detection heuristics; warnings when render isn’t virtual; persistent routing health.
- **Contingency:** Blocking banner until cable detected; deep links to install docs.
- **Owner:** UX + audio
- **Status:** Open

---

## R04 — Device Switching Mid-Call Failures

- **Description:** Switching capture/render during an active Zoom call causes dropouts or Faulted state.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** DeviceLost during switch; prolonged Recovering; call audio path broken.
- **Mitigation:** Stop playback; sequenced stop/reopen/start; timeouts; rollback; discourage mid-call switches in UI copy.
- **Contingency:** Require Stop Engine before Apply Devices (strict mode setting).
- **Owner:** Audio engineer
- **Status:** Open

---

## R05 — Driver / VB-CABLE Instability

- **Description:** Third-party virtual cable driver crashes, disappears after sleep, or breaks after Windows update.
- **Probability:** Medium
- **Impact:** Critical
- **Indicators:** Cable missing after resume; repeated open failures; Windows audio service errors.
- **Mitigation:** Sleep/resume re-enumerate; recovery retries; diagnostics capture; test on multiple Windows builds.
- **Contingency:** Document reinstall VB-CABLE; optional VoiceMeeter path; support runbook.
- **Owner:** Support + audio
- **Status:** Open

---

## R06 — Latency Spikes

- **Description:** Buffer underruns or OS scheduling cause noticeable delay before clip start or echo-like delay on mic path.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** Underrun counters; p95 hotkey latency > SLO; user reports “late” clips.
- **Mitigation:** Render-clocked pipeline; presets; ArrayPool; thread priority care; latency harness gates.
- **Contingency:** Auto-switch to stable preset on underrun burst; notify user.
- **Owner:** Audio engineer
- **Status:** Open

---

## R07 — Race Conditions in Play/Stop/Mix

- **Description:** Concurrent Play/Stop/SetGain commands corrupt buffers or state.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** Clicks; stuck Playing; NaN samples; intermittent crashes.
- **Mitigation:** Command queue drained at buffer boundaries; atomic snapshots; stress spam tests; state machine illegality checks.
- **Contingency:** Engine reset command; sidecar restart.
- **Owner:** Audio engineer
- **Status:** Open

---

## R08 — Deadlocks Between IPC and Audio Threads

- **Description:** Locks shared between pipe handlers and audio callback cause freeze.
- **Probability:** Low
- **Impact:** Critical
- **Indicators:** Stop hangs; UI freeze waiting on IPC; watchdog timeouts.
- **Mitigation:** No blocking locks on audio thread; lock-free rings; stop timeouts; deadlock detection logs.
- **Contingency:** Kill/restart sidecar; safe mode.
- **Owner:** Backend + audio
- **Status:** Open

---

## R09 — Audio Clipping / Distortion

- **Description:** Summing mic + loud clips exceeds full scale; harsh distortion on far side.
- **Probability:** High
- **Impact:** Medium
- **Indicators:** Limiter GR high; user complaints; sample peaks at ±1 constantly.
- **Mitigation:** Soft limiter; default conservative clip gain; offline normalization option; meters.
- **Contingency:** Auto-reduce clip stem on repeated GR events.
- **Owner:** Audio engineer
- **Status:** Open

---

## R10 — Sample Rate Mismatch

- **Description:** Capture, clip, and render rates differ; poor SRC causes pitch/noise issues.
- **Probability:** High
- **Impact:** High
- **Indicators:** Chipmunk/slow audio; crackle; format mismatch warnings.
- **Mitigation:** Explicit internal 48 kHz mix; quality SRC; warn on endpoint format drift; recommend cable format.
- **Contingency:** Force re-open devices; block start until formats sane.
- **Owner:** Audio engineer
- **Status:** Open

---

## R11 — CPU Spikes / Thermal Throttling

- **Description:** Decode + SRC + mix on low-end CPUs spikes, causing underruns.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** High render callback durations; fan-up; underruns under play.
- **Mitigation:** Prefetch/decode off audio thread; pool buffers; optional lower SRC quality mode; avoid UI work on hot path.
- **Contingency:** Stable preset; discourage huge MP3s; recommend WAV for critical phrases.
- **Owner:** Audio engineer
- **Status:** Open

---

## R12 — Sidecar Process Crash During Call

- **Description:** Unhandled exception kills sidecar; Zoom suddenly gets silence or wrong mic if user switches back manually.
- **Probability:** Medium
- **Impact:** Critical
- **Indicators:** Pipe disconnect; process exit; tray error.
- **Mitigation:** Isolation of decoder faults; auto-restart; restore devices; keep Zoom on cable (silence better than wrong routing if documented).
- **Contingency:** Crash loop → safe mode; prompt user temporary Zoom mic fallback instructions.
- **Owner:** Backend
- **Status:** Open

---

## R13 — Named Pipe Impersonation / Local Abuse

- **Description:** Another local process connects to pipe and issues PlayClip with arbitrary paths.
- **Probability:** Low
- **Impact:** High
- **Indicators:** Auth failure logs; unexpected commands.
- **Mitigation:** Random pipe name; per-spawn token; user SID ACL; path jail regardless of caller.
- **Contingency:** Disable engine until restart; security patch release.
- **Owner:** Security + backend
- **Status:** Open

---

## R14 — Malicious Phrase Pack / Decoder Exploit

- **Description:** Crafted MP3/WAV or zip slip used to escape sandbox or crash decoder.
- **Probability:** Low
- **Impact:** Critical
- **Indicators:** Import crashes; unexpected file writes outside assets.
- **Mitigation:** Zip slip/bomb checks; magic bytes; size/duration limits; decoder in sidecar; fuzz fixtures.
- **Contingency:** Disable import temporarily via update; kill switch setting.
- **Owner:** Security
- **Status:** Open

---

## R15 — Electron Security Regression

- **Description:** Accidental `nodeIntegration` or weak CSP enables XSS → RCE.
- **Probability:** Low
- **Impact:** Critical
- **Indicators:** Security review findings; unexpected preload surface growth.
- **Mitigation:** Locked BrowserWindow defaults; CSP; schema validation; security checklist in CI review.
- **Contingency:** Emergency patch release.
- **Owner:** Desktop lead
- **Status:** Open

---

## R16 — Global Hotkey Conflicts

- **Description:** Shortcuts fail to register or steal keys from other apps.
- **Probability:** High
- **Impact:** Medium
- **Indicators:** Registration false; user reports; conflict badges.
- **Mitigation:** Configurable accelerators; conflict detection; defaults chosen carefully; disable globals option.
- **Contingency:** In-app only mode.
- **Owner:** Desktop + UX
- **Status:** Open

---

## R17 — Bluetooth Headset Profile Switching

- **Description:** BT devices switch HFP/A2DP causing capture format changes and dropouts.
- **Probability:** High
- **Impact:** Medium
- **Indicators:** DeviceListChanged storms; Recovering during calls.
- **Mitigation:** Document BT caveats; prefer wired USB for operators; recovery path; don’t follow unstable defaults blindly.
- **Contingency:** Pin capture device; recommend wired mic.
- **Owner:** Support + UX
- **Status:** Open

---

## R18 — SQLite Corruption / Disk Full

- **Description:** Power loss or full disk corrupts DB or fails writes mid-import.
- **Probability:** Low
- **Impact:** High
- **Indicators:** integrity_check fail; SQLITE errors; import rollback.
- **Mitigation:** WAL; atomic writes; backups; integrity checks; disk-full error UX.
- **Contingency:** Restore backup; rebuild FTS.
- **Owner:** Backend
- **Status:** Open

---

## R19 — Auto-Update Supply Chain Failure

- **Description:** Compromised update channel or signature mismatch breaks trust or blocks updates.
- **Probability:** Low
- **Impact:** Critical
- **Indicators:** Signature verify fail; mass update failures.
- **Mitigation:** HTTPS; code signing; publisher checks; staged rollout.
- **Contingency:** Revoke channel; manual signed installer distribution.
- **Owner:** Release engineer
- **Status:** Open

---

## R20 — Scope Creep / Dual Audio Backends

- **Description:** Attempting VoiceMeeter automation + exclusive mode + cloud sync delays MVP.
- **Probability:** Medium
- **Impact:** High (schedule)
- **Indicators:** Phase exit gates slipping; optional work blocking.
- **Mitigation:** ADR constraints; VoiceMeeter optional non-blocking; phase gates enforced.
- **Contingency:** Cut optional features from GA.
- **Owner:** Tech lead
- **Status:** Open

---

## R21 — Feedback Loop / Echo

- **Description:** Mis-selected devices capture cable output while rendering to cable input, creating loop.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** Howling; maxed meters; immediate overload.
- **Mitigation:** Block known loop pairs; warn on capturing CABLE Output; wizard defaults.
- **Contingency:** Hard stop engine on sustained full-scale feedback detector (optional).
- **Owner:** Audio + UX
- **Status:** Open

---

## R22 — Memory Leaks in Long Sessions

- **Description:** Handle/memory growth over 8-hour operator shifts.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** Working set growth; handle count growth; eventual underruns.
- **Mitigation:** Leak tests; ArrayPool; dispose decoders; reconnect handle audits.
- **Contingency:** Soft restart engine every N hours setting (last resort).
- **Owner:** Audio + backend
- **Status:** Open

---

## R23 — Legal / Policy Confusion About Call Recording

- **Description:** Users confuse playback injection with call recording; compliance misunderstanding.
- **Probability:** Medium
- **Impact:** Medium
- **Indicators:** Support questions; misuse reports.
- **Mitigation:** Clear product copy: plays audio into mic path; does not record Zoom calls in v1.
- **Contingency:** FAQ + support macros.
- **Owner:** Product
- **Status:** Open

---

## R24 — Test Environment Drift from Real Zoom Phone

- **Description:** Passing local cable tests but failing real Zoom processing pipeline.
- **Probability:** Medium
- **Impact:** High
- **Indicators:** Preview OK; far-side reports bad audio.
- **Mitigation:** Mandatory manual Zoom acceptance in Phase 3/11; multiple Zoom settings profiles tested.
- **Contingency:** Delay GA; ship Zoom-settings guide prominently.
- **Owner:** QA
- **Status:** Open

---

## Risk Review Cadence

* [ ] Review open High/Critical risks at each phase exit gate
* [ ] Update status when mitigations merge
* [ ] Add new risks when incidents occur
* [ ] Before GA, no Critical risks in Open without executive accept

---

## Risk Completion Gate

* [ ] Register covers audio, Zoom, IPC, security, delivery
* [ ] Owners assigned
* [ ] Phase 11 verifies mitigations for R06–R11, R13–R15, R22
* [ ] GA known-limitations include R02, R17
