# Architecture Decision Records (ADRs)

## Purpose

Record architectural decisions for Zoom Dialer Companion in ADR format so future implementers understand context, alternatives, tradeoffs, and consequences.

## Scope

- Cross-cutting technology and process decisions for v1
- Decisions that constrain implementation checklists in other docs
- Out of scope: day-to-day implementation micro-choices (variable names, CSS details)

## Dependencies

- [architecture.md](architecture.md)
- [README.md](README.md)
- [risks.md](risks.md)

## Deliverables

- Numbered ADRs with Context / Decision / Alternatives / Tradeoffs / Consequences
- Status field per ADR

## Completion Criteria

* [x] Sidecar, NAudio/WASAPI, IPC, VB-CABLE, SQLite, TTS, security, updates, installer, logging, and test strategy decided
* [x] Each ADR lists alternatives and consequences
* [x] Conflicts with docs are resolved in favor of ADRs (then docs updated)

---

## ADR-001 — .NET 8 Audio Sidecar Process

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Real-time WASAPI capture/mix/render needs low-latency, predictable threading, and mature Windows audio APIs. Doing this inside the Electron/Node process risks GC pauses, limited WASAPI ergonomics, and harder crash isolation.
- **Decision:** Run the audio engine as a separate .NET 8 process (sidecar) controlled by Electron main over IPC.
- **Alternatives:**
  - Native Node addon (C++ WASAPI) in-process
  - Pure Node audio libraries
  - External mixer app automation only (VoiceMeeter)
- **Tradeoffs:** Extra process and packaging complexity vs isolation, debuggability, and access to NAudio/.NET ecosystem.
- **Consequences:** Must build SidecarManager, protocol versioning, and dual build pipelines; decoder crashes should not kill UI.

---

## ADR-002 — NAudio + WASAPI Shared Mode

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Need Windows microphone capture and render to a virtual cable with format negotiation.
- **Decision:** Use NAudio (or thin wrappers over WASAPI) in shared mode by default; keep exclusive mode experimental/off.
- **Alternatives:** Raw WASAPI C++; ASIO; exclusive mode default.
- **Tradeoffs:** Shared mode more compatible, slightly less control over latency than exclusive.
- **Consequences:** Implement SRC to a stable internal mix format; document endpoint format recommendations (48 kHz).

---

## ADR-003 — Named Pipes with Versioned JSON Framing

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Electron main and sidecar need local duplex RPC/events with low operational friction on Windows.
- **Decision:** Use Windows named pipes with length-prefixed JSON messages, `protocolVersion` handshake, and per-spawn auth token + user SID ACL.
- **Alternatives:** gRPC over localhost TCP; stdio newline JSON; Memory-mapped files; MessagePack on pipes.
- **Tradeoffs:** JSON easier to debug than binary; slightly higher overhead (acceptable for control plane). Audio PCM does not traverse IPC.
- **Consequences:** Define shared schemas; reject mismatched versions; do not stream PCM over the pipe.

---

## ADR-004 — VB-CABLE as Primary Virtual Microphone

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Zoom Phone must receive mixed audio via a standard Windows recording endpoint without modifying Zoom.
- **Decision:** Standardize on VB-CABLE: sidecar renders to **CABLE Input**; user sets Zoom mic to **CABLE Output**.
- **Alternatives:** VoiceMeeter as primary; custom virtual driver; Zoom APIs (rejected).
- **Tradeoffs:** Third-party driver dependency and setup friction vs proven routing approach.
- **Consequences:** Setup wizard mandatory; detection/health UX; VoiceMeeter optional only.

---

## ADR-005 — Do Not Integrate Undocumented Zoom APIs

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Product requirement forbids modifying Zoom or using undocumented APIs.
- **Decision:** Treat Zoom Phone as an opaque audio consumer; only guide users to select the virtual mic.
- **Alternatives:** Overlay hooks; accessibility UI automation to flip Zoom settings; Zoom SDK call control.
- **Tradeoffs:** Cannot auto-verify Zoom mic selection; some user error remains.
- **Consequences:** Wizard checklists and routing health are best-effort; manual acceptance tests required.

---

## ADR-006 — SQLite for Metadata; Filesystem for Audio Bytes

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Need categories, search, hotkeys, and durable CRUD; audio blobs can be large.
- **Decision:** SQLite (WAL) stores phrase/category/settings metadata and FTS5 indexes; audio files live on disk under AppData assets root.
- **Alternatives:** JSON file library; IndexedDB in renderer; embed BLOBs in SQLite.
- **Tradeoffs:** Two-store consistency must be transactional at the service layer; orphan cleanup needed.
- **Consequences:** Path jail; sha256 metadata; migration runner; no dual-write with JSON in production.

---

## ADR-007 — Internal Mix Format 48 kHz float32

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Devices and files disagree on rates/formats; mixing in integers invites clipping.
- **Decision:** Convert all stems to 48 kHz float32 for mixing; convert to device format on output; apply soft limiter after sum.
- **Alternatives:** Match whatever render mix format is without fixed target; int16 mix bus.
- **Tradeoffs:** SRC CPU cost vs consistency and headroom.
- **Consequences:** SRC mandatory on mismatched capture/clips; latency presets include SRC cost.

---

## ADR-008 — Render Device as Master Clock

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Capture and render clocks drift; pull model needed for stable cable output.
- **Decision:** Drive the mix from the WASAPI render cadence; capture feeds a ring adapted to that clock.
- **Alternatives:** Capture-driven push; independent wall clock timer.
- **Tradeoffs:** Slightly more complex adaptive capture buffering.
- **Consequences:** Underrun policy inserts silence; health metrics required.

---

## ADR-009 — Local TTS via Windows SAPI Behind Interface

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Need offline TTS without cloud dependency.
- **Decision:** Implement `ITtsEngine` with Windows SAPI adapter; synthesize to PCM then reuse clip path (fades/duck/gain).
- **Alternatives:** Cloud TTS; bundled neural TTS engine; Azure Speech offline.
- **Tradeoffs:** Voice quality varies by Windows install; SAPI quirks.
- **Consequences:** Voice enumeration UX; timeouts; max text length; future engines swappable.

---

## ADR-010 — Electron + React + TypeScript UI

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Need desktop UI with rich library management and settings on Windows.
- **Decision:** Electron main + React renderer + TypeScript throughout desktop app; preload `contextBridge` only.
- **Alternatives:** WPF/.NET UI; WinUI; Tauri.
- **Tradeoffs:** Larger footprint vs web-skill leverage and packaging ecosystem (updater/installer).
- **Consequences:** Strict Electron security defaults; dual TS/.NET skills on team.

---

## ADR-011 — Renderer State Library

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** UI needs engine/playback/phrase caches with event reconciliation.
- **Decision:** Use Zustand (preferred) or Redux Toolkit equivalently; keep authoritative engine state in sidecar, mirrored via events.
- **Alternatives:** React Query only; plain Context; MobX.
- **Tradeoffs:** Lightweight store vs ecosystem opinions.
- **Consequences:** No renderer-owned audio truth; optimistic UI must reconcile errors.

---

## ADR-012 — Mic Continues During Playback (True Mix)

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Requirement to continue speaking while clip plays.
- **Decision:** Default behavior mixes mic + clip; optional setting may mute mic during play (off by default).
- **Alternatives:** Replace mic with clip only; duck-only without simultaneous speech.
- **Tradeoffs:** Higher clipping risk; needs limiter/ducking.
- **Consequences:** Ducking defaults should be sensible; far-side clarity testing mandatory.

---

## ADR-013 — Ducking Applies to Mic Under Clip

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Simultaneous speech + clip can mask intelligibility.
- **Decision:** When ducking enabled, reduce mic stem while clip/TTS is active using attack/release envelope.
- **Alternatives:** Duck clip under mic; no ducking; hard mute mic.
- **Tradeoffs:** May sound “radio-like”; parameters need UX.
- **Consequences:** Settings page for threshold/ratio/attack/release; unit tests for envelopes.

---

## ADR-014 — Security: Sandboxed Renderer + Path Jail + Pipe Token

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Local malicious packs and IPC abuse are realistic threats.
- **Decision:** Enforce Electron sandbox/CSP/contextIsolation; schema-validate IPC; quarantine+validate imports; path jail assets; named pipe ACL+token.
- **Alternatives:** Trust local user fully without pipe auth; validate only extensions.
- **Tradeoffs:** More engineering on validation paths.
- **Consequences:** Security tests in Phase 11 are release gates.

---

## ADR-015 — Privacy: No Cloud Analytics by Default

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** App handles mic audio and phrase content; users may discuss sensitive topics on calls.
- **Decision:** v1 sends no phrase content or audio to the cloud; analytics off by default (opt-in only if ever added); diagnostics export is user-initiated.
- **Alternatives:** Always-on telemetry; automatic crash upload.
- **Tradeoffs:** Harder proactive monitoring.
- **Consequences:** Support relies on user-exported diagnostics; document clearly in wizard/help.

---

## ADR-016 — Installer via electron-builder (NSIS) + Code Signing

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Need Windows installer delivering Electron app + sidecar.
- **Decision:** Package with electron-builder NSIS; sign binaries; do not silently install VB-CABLE (guide users).
- **Alternatives:** MSIX only; WiX; separate MSI for sidecar.
- **Tradeoffs:** Users must install VB-CABLE manually.
- **Consequences:** Wizard + docs must be excellent; bundle sidecar path resolution carefully.

---

## ADR-017 — Auto-Updates via electron-updater

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Need safe delivery of fixes especially for audio/security issues.
- **Decision:** Use electron-updater with HTTPS channel, signature verification, stable/beta channels.
- **Alternatives:** Manual downloads only; custom updater service.
- **Tradeoffs:** Infra for update hosting required.
- **Consequences:** Staging channel testing before GA; revoke plan in risks.

---

## ADR-018 — Logging Strategy

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Audio issues are hard to repro without structured logs.
- **Decision:** Structured logs in main and sidecar; file rotation under AppData; correlation IDs for IPC; redact tokens; default Info in prod.
- **Alternatives:** Console-only; Windows Event Log only.
- **Tradeoffs:** Disk use; privacy of titles in logs.
- **Consequences:** Diagnostics zip includes recent logs; privacy option to exclude titles.

---

## ADR-019 — Test Strategy

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Pure unit tests cannot prove Zoom far-side quality.
- **Decision:** Pyramid: unit (mix/storage/protocol) + integration (pipe) + mandatory manual Zoom acceptance + latency/soak/leak gates before GA.
- **Alternatives:** Manual-only; full UI E2E for everything.
- **Tradeoffs:** Manual Zoom tests need human operators/hardware.
- **Consequences:** Phase exit gates include manual scripts; CI still blocks on unit/integration.

---

## ADR-020 — Play-While-Playing Policy

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Operators may mash hotkeys.
- **Decision:** New PlayClip stops current playback (with short fade-out) then starts new clip; no deep queue in v1.
- **Alternatives:** FIFO queue; ignore new plays while playing.
- **Tradeoffs:** Cannot schedule multi-clip sequences yet.
- **Consequences:** Simpler state machine; spam stress tests required.

---

## ADR-021 — Channel Policy for Mix Bus

- **Status:** Accepted
- **Date:** 2026-07-22
- **Context:** Mics often mono; cable may be stereo.
- **Decision:** Mix internally as stereo; mono inputs upmixed by duplicating to L/R; downmix only if render is mono.
- **Alternatives:** Mono-only mix bus.
- **Tradeoffs:** Slightly more CPU than mono.
- **Consequences:** Upmix/downmix helpers and tests.

---

## ADR Index

| ID | Title | Status |
|---|---|---|
| ADR-001 | .NET 8 Audio Sidecar | Accepted |
| ADR-002 | NAudio + WASAPI Shared | Accepted |
| ADR-003 | Named Pipes JSON IPC | Accepted |
| ADR-004 | VB-CABLE Primary | Accepted |
| ADR-005 | No Undocumented Zoom APIs | Accepted |
| ADR-006 | SQLite + Filesystem Assets | Accepted |
| ADR-007 | 48 kHz float32 Mix | Accepted |
| ADR-008 | Render Master Clock | Accepted |
| ADR-009 | SAPI TTS Interface | Accepted |
| ADR-010 | Electron React TS | Accepted |
| ADR-011 | Zustand/RTK UI State | Accepted |
| ADR-012 | True Mix Default | Accepted |
| ADR-013 | Duck Mic Under Clip | Accepted |
| ADR-014 | Security Hardening Baseline | Accepted |
| ADR-015 | No Default Cloud Analytics | Accepted |
| ADR-016 | NSIS Installer + Signing | Accepted |
| ADR-017 | electron-updater | Accepted |
| ADR-018 | Structured Logging | Accepted |
| ADR-019 | Test Pyramid + Zoom Manual | Accepted |
| ADR-020 | Stop-Previous Play Policy | Accepted |
| ADR-021 | Stereo Mix Bus | Accepted |

---

## ADR Process Checkboxes

* [ ] Propose new ADR when a decision changes architecture
* [ ] Mark superseded ADRs with pointer to replacement
* [ ] Update domain docs when ADR accepted
* [ ] Review ADRs at Phase 0 exit and before GA
