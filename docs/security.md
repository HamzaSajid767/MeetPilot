# Security

## Purpose

Define security requirements and atomic implementation tasks for Zoom Dialer Companion: permissions, local storage protection, file and audio validation, path traversal defenses, logging hygiene, crash handling, and IPC trust boundaries.

## Scope

- Local-first desktop threat model (no multi-tenant server)
- Hardening of Electron, named-pipe IPC, filesystem assets, imports
- Privacy of logs and diagnostics
- Out of scope: enterprise MDM policies beyond basic documentation; cloud auth

## Dependencies

- [architecture.md](architecture.md) trust boundaries
- [storage.md](storage.md)
- [backend.md](backend.md)
- [electron.md](electron.md)
- [decisions.md](decisions.md) security ADR
- Electron security checklist; Windows ACLs on app data

## Deliverables

- Threat-informed checklist of security tasks
- Validation rules for files/audio/paths
- Completion gate for hardened beta

## Completion Criteria

* [x] Renderer sandboxing and preload allowlist tasked
* [x] Import/play path jail tasked
* [x] Audio and pack validation tasked
* [x] Logging redaction and crash handling tasked
* [x] No plaintext secrets design for v1 IPC beyond local token

---

## 1. Threat Model Tasks

* [ ] Document asset: local phrase library confidentiality (user machine)
* [ ] Document threat: malicious phrase pack zip
* [ ] Document threat: malicious audio file aiming for decoder bugs
* [ ] Document threat: renderer XSS if CSP weak
* [ ] Document threat: other local processes connecting to named pipe
* [ ] Document threat: path traversal to read arbitrary files
* [ ] Document threat: DLL planting next to sidecar executable
* [ ] Document non-goal: protecting against admin-level attacker on same machine
* [ ] Publish threat model section in this file as living checklist above

---

## 2. Electron Permissions & Hardening

* [ ] Enable `contextIsolation: true`
* [ ] Enable `sandbox: true` for renderer
* [ ] Set `nodeIntegration: false`
* [ ] Set `webSecurity: true`
* [ ] Disable `enableRemoteModule` / remove remote
* [ ] Restrict ` BroswerWindow` navigation
* [ ] Implement permission request handler denying unused media permissions in window
* [ ] Deny geolocation/notifications/midi unless explicitly needed
* [ ] Set strict Content-Security-Policy for production
* [ ] Disallow `unsafe-eval` in production CSP
* [ ] Validate `shell.openExternal` URLs against https allowlist
* [ ] Disable drag-drop navigation to file URLs
* [ ] Use `app.disableHardwareAcceleration` only if needed (document)
* [ ] Code sign Windows binaries (packaging phase)
* [ ] Enable ASLR/DEP defaults for sidecar (.NET)

---

## 3. Preload / IPC Surface Minimization

* [ ] Expose only documented `window.api` methods
* [ ] Prefer invoke channels over arbitrary `send`
* [ ] Validate sender frame URL in ipcMain handlers
* [ ] Reject IPC from unexpected origins
* [ ] Schema-validate all IPC payloads
* [ ] Apply size limits on IPC string fields
* [ ] Rate-limit play commands to prevent abuse loops (optional)
* [ ] Never pass absolute filesystem listings of entire disks to renderer
* [ ] Return only relative asset identifiers to renderer when possible

---

## 4. Named Pipe Security

* [ ] Generate cryptographically random auth token per sidecar spawn
* [ ] Pass token via secure argv or env carefully (prefer argv + ACL)
* [ ] Require token on handshake
* [ ] Use pipe name with entropy (not a fixed global predictable name alone)
* [ ] Restrict pipe security descriptor to current user SID
* [ ] Accept only one client in v1
* [ ] Close pipe on auth failure
* [ ] Log auth failures without token values
* [ ] Rotate pipe name each spawn

---

## 5. Local Storage Security

* [ ] Store DB under user AppData (per-user ACL)
* [ ] Store assets under user AppData
* [ ] Do not world-write app data directories
* [ ] Document that OS user account can read own phrases (expected)
* [ ] Optional: DPAPI protect settings secrets if any (future)
* [ ] No cloud credentials in v1
* [ ] Clear temporary import directories after use
* [ ] Use restrictive file modes when creating files

---

## 6. Path Traversal Protection

* [ ] Implement `resolveWithinRoot(root, userPath)` helper
* [ ] Reject paths containing `..` after normalization
* [ ] Reject absolute paths from renderer/import manifests
* [ ] Reject NTFS alternate data stream suspicious suffixes
* [ ] Reject reserved device names (`CON`, `NUL`, etc.)
* [ ] Canonicalize with `GetFullPathName` semantics / Node `path.resolve`
* [ ] Ensure final path starts with root prefix boundary-safe check
* [ ] Unit test zip slip `../../windows/system32` cases
* [ ] Unit test nested zip slip
* [ ] Refuse symlink escape when detecting reparse points (where feasible)

---

## 7. File Validation (Import & Add Phrase)

* [ ] Allowlist extensions: `.wav`, `.mp3` only in v1
* [ ] Check magic bytes for WAV (`RIFF`)
* [ ] Check magic bytes / container sniff for MP3
* [ ] Reject mismatched extension vs magic
* [ ] Enforce max file size (e.g., 50 MB configurable)
* [ ] Enforce max duration (e.g., 10 minutes configurable)
* [ ] Reject zero-byte files
* [ ] Compute sha256 and store
* [ ] Quarantine folder for inbound files before accept
* [ ] Move to assets only after validation success
* [ ] Delete quarantined failures

---

## 8. Audio Validation

* [ ] Decode header before accepting import
* [ ] Reject unsupported WAV formats
* [ ] Reject insane sample rates
* [ ] Reject channel counts > supported max
* [ ] Bound decoder memory usage
* [ ] Run decoder in sidecar process isolation (already separate process)
* [ ] Catch and contain decoder exceptions
* [ ] Consider optional ffmpeg sandbox later (not v1 requirement)
* [ ] Do not execute embedded metadata scripts (N/A for wav/mp3 but document)

---

## 9. Phrase Pack Zip Security

* [ ] Use zip library that exposes entry names safely
* [ ] Validate each entry path with path jail
* [ ] Enforce max entry count
* [ ] Enforce max uncompressed total size
* [ ] Enforce max compression ratio to mitigate zip bombs
* [ ] Reject encrypted zip entries in v1
* [ ] Validate manifest before extracting audio
* [ ] Extract to temp quarantine directory
* [ ] Atomic commit into library after full validation

---

## 10. TTS Input Safety

* [ ] Limit TTS text length
* [ ] Strip control characters
* [ ] Do not log full TTS text at info level if sensitive (setting)
* [ ] Reject extremely repetitive abusive payloads that could hang SAPI (timeout)

---

## 11. Logging Security

* [ ] Never log auth tokens
* [ ] Never log full raw IPC payloads with audio paths from untrusted import before validation (careful)
* [ ] Redact user home directory to `~` in shared diagnostics optional
* [ ] Do not include audio file bytes in logs
* [ ] Default log level Info in production
* [ ] Debug logging opt-in
* [ ] Protect log directory ACLs same as app data
* [ ] Diagnostics export requires explicit user action
* [ ] Provide option to exclude phrase titles from diagnostics (privacy)

---

## 12. Crash Handling

* [ ] Catch unexpected exceptions in main and log stack
* [ ] Catch unexpected exceptions in sidecar and log stack
* [ ] Avoid showing raw stacks to end users
* [ ] Show friendly error dialog with correlation ID
* [ ] Write crash marker file for next start
* [ ] Offer “safe mode” start skipping auto engine start after crash loop
* [ ] Limit crash-restart loops
* [ ] Ensure crash does not corrupt SQLite (WAL + integrity)
* [ ] On renderer crash, recreate window without losing DB

---

## 13. Update & Installer Security

* [ ] Serve updates over HTTPS
* [ ] Verify code signature before apply
* [ ] Pin publisher name checks
* [ ] Refuse downgrade attacks if supported by updater
* [ ] Document supply chain: dependency pin policy
* [ ] SBOM generation task for release (phase 12+)

---

## 14. Privacy

* [ ] No analytics by default in v1 (or opt-in only — record ADR)
* [ ] No uploading phrases
* [ ] Document microphone usage purpose in first-run copy
* [ ] Windows privacy: app must be allowed mic access for capture

---

## 15. Security Testing Tasks

* [ ] Automated path traversal tests
* [ ] Automated zip slip tests
* [ ] Automated zip bomb size reject test
* [ ] Automated CSP presence check in prod build
* [ ] Manual attempt to connect to pipe without token fails
* [ ] Manual preload leakage check

---

## 16. Security Completion Gate

* [ ] Electron hardening flags verified
* [ ] Pipe ACL + token verified
* [ ] Import path jail tests green
* [ ] Audio allowlist enforced
* [ ] Logs contain no tokens in sample review
* [ ] Crash loop safe mode verified
* [ ] Signed update path documented and tested in staging
