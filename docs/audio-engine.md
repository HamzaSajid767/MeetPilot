# Audio Engine

## Purpose

Provide an exhaustive, implementation-ready checklist for the real-time Windows audio engine running inside the .NET 8 sidecar: WASAPI capture/render, PCM pipeline, sample-rate conversion, mixing, buffering, latency control, ducking, fades, normalization/limiting, thread synchronization, and error recovery.

## Scope

- In scope: NAudio/WASAPI shared-mode (exclusive optional), PCM float mix bus, MP3/WAV decode path into mixer, local TTS PCM injection, health metrics.
- Out of scope: UI, SQLite, installer, Zoom automation.

## Dependencies

- Windows 11 WASAPI
- NAudio (or equivalent) — see [decisions.md](decisions.md)
- VB-CABLE render endpoint — [virtual-audio.md](virtual-audio.md)
- Named-pipe command surface — [backend.md](backend.md)
- [architecture.md](architecture.md) thread model

## Deliverables

- Atomic audio engine tasks covering the full PCM path
- Explicit latency, sync, and recovery tasks
- Measurable completion gate for pass-through and mixed playback

## Completion Criteria

* [ ] Mic pass-through to VB-CABLE is stable
* [ ] Clip and TTS mix with live mic without stopping capture
* [x] Ducking, fades, volumes, limiter documented as tasks
* [x] Audio thread constraints enforced in checklist
* [x] Recovery paths for device loss and underruns are tasked

---

## 1. Engine Interfaces & State

* [ ] Create `IAudioEngine` interface with Start/Stop/Play/StopPlayback
* [ ] Create `EngineState` enum: Idle, Armed, Mixing, Playing, Recovering, Faulted
* [ ] Implement thread-safe state getter
* [ ] Emit `EngineStateChanged` on every transition
* [ ] Reject illegal transitions with error code
* [ ] Create `AudioFormat` value object (sampleRate, channels, bits, encoding)
* [ ] Create `StemGains` value object (mic, clip, master)
* [ ] Create `DuckingSettings` value object
* [ ] Create `FadeSettings` value object
* [ ] Create engine options from configuration

---

## 2. WASAPI Device Binding

* [ ] Enumerate capture endpoints via WASAPI MMDevice API
* [ ] Enumerate render endpoints via WASAPI MMDevice API
* [ ] Resolve device by durable ID string
* [ ] Resolve device by friendly name fallback
* [ ] Detect default capture device
* [ ] Detect default render device
* [ ] Open WASAPI capture client in shared mode
* [ ] Open WASAPI render client in shared mode
* [ ] Read mix format from capture client
* [ ] Read mix format from render client
* [ ] Log negotiated capture format
* [ ] Log negotiated render format
* [ ] Implement exclusive-mode experimental flag (off by default)
* [ ] Fail Start with clear error if device busy
* [ ] Fail Start if device ID not found

---

## 3. Microphone Capture Pipeline

* [ ] Create capture pump loop/task
* [ ] Read available capture packets
* [ ] Convert captured bytes to float32 interleaved PCM
* [ ] Handle silence when capture returns no data
* [ ] Timestamp capture buffers relative to engine clock
* [ ] Push capture PCM into capture ring buffer
* [ ] Measure capture callback/loop duration
* [ ] Count capture glitches/discontinuities
* [ ] Stop capture cleanly on cancellation
* [ ] Dispose capture client safely

---

## 4. Render Pipeline (Virtual Microphone)

* [ ] Create render pump driven by WASAPI event or timer
* [ ] Query render padding / available frames
* [ ] Pull mixed frames for exact needed count
* [ ] Convert float32 mix to device format (int16/float32)
* [ ] Write frames to WASAPI render client
* [ ] Detect render underrun condition
* [ ] Insert silence on underrun rather than crashing
* [ ] Count underruns
* [ ] Count overruns if applicable
* [ ] Stop render cleanly on cancellation
* [ ] Dispose render client safely

---

## 5. PCM Pipeline Core

* [ ] Define internal mix format: 48000 Hz target
* [ ] Define internal mix format: float32
* [ ] Define channel policy: mono mix to stereo duplicate OR stereo (document choice in ADR)
* [ ] Implement channel upmix mono→stereo
* [ ] Implement channel downmix stereo→mono
* [ ] Implement interleaved ↔ planar helpers if needed
* [ ] Implement byte↔float conversion utilities
* [ ] Clamp sample values defensively before convert-out
* [ ] Add unit tests for conversion bit-exact ranges

---

## 6. Sample Rate Conversion (SRC)

* [ ] Detect capture rate ≠ mix rate
* [ ] Detect clip rate ≠ mix rate
* [ ] Detect TTS rate ≠ mix rate
* [ ] Detect render rate ≠ mix rate
* [ ] Implement high-quality SRC for offline clip preroll
* [ ] Implement low-latency SRC for live capture path
* [ ] Choose SRC algorithm quality vs CPU setting
* [ ] Validate no DC offset introduced by SRC
* [ ] Validate pitch correctness after SRC
* [ ] Benchmark SRC CPU cost at 48k stereo
* [ ] Fallback error if SRC initialization fails

---

## 7. Buffer Management

* [ ] Implement lock-free SPSC float ring buffer
* [ ] Size capture ring for N milliseconds (configurable)
* [ ] Size clip ring for N milliseconds (configurable)
* [ ] Size TTS ring for N milliseconds (configurable)
* [ ] Size output staging buffer
* [ ] Expose buffer fullness metrics
* [ ] Implement buffer clear on stop
* [ ] Implement buffer clear on device restart
* [ ] Prevent writer overrun by dropping oldest or blocking non-audio thread
* [ ] Prevent reader underrun by returning zeros
* [ ] Add configuration for target latency ms
* [ ] Compute buffer frames from ms and sample rate helper

---

## 8. Mixing

* [ ] Create `Mixer` that sums mic + clip + tts stems
* [ ] Apply mic gain linearly from dB setting
* [ ] Apply clip gain linearly from dB setting
* [ ] Apply TTS gain linearly from dB setting
* [ ] Apply master gain after sum
* [ ] Support mute flags per stem
* [ ] Ensure muted clip does not duck mic incorrectly
* [ ] Mix in float32 to avoid intermediate clipping
* [ ] Process exact frame counts requested by render
* [ ] Keep mixer allocation-free on audio thread
* [ ] Add wet/dry meter peak calculation (optional UI feed)

---

## 9. Soft Limiter / Volume Normalization

* [ ] Implement peak meter per stem
* [ ] Implement peak meter on master bus
* [ ] Implement soft clip / tanh-style limiter on master
* [ ] Configure limiter threshold
* [ ] Configure limiter makeup gain (optional)
* [ ] Implement optional RMS normalization for imported clips at ingest (offline)
* [ ] Store per-phrase normalization gain metadata
* [ ] Bypass limiter setting for debugging
* [ ] Log limiter gain-reduction peaks periodically

---

## 10. Ducking

* [ ] Implement sidechain detector on clip/TTS stem amplitude
* [ ] Apply gain reduction to mic stem when clip active
* [ ] Configure ducking threshold dB
* [ ] Configure ducking ratio
* [ ] Configure attack ms
* [ ] Configure release ms
* [ ] Configure maximum attenuation dB
* [ ] Smooth ducking envelope to avoid zipper noise
* [ ] Allow ducking disable toggle
* [ ] Allow invert policy option: duck clip under mic (optional advanced)
* [ ] Unit-test envelope attack/release timing
* [ ] Ensure ducking state resets when playback ends

---

## 11. Fade In / Fade Out

* [ ] Implement fade-in envelope on clip start
* [ ] Implement fade-out envelope on clip stop
* [ ] Implement fade-out on natural end near EOF
* [ ] Configurable fade-in ms default
* [ ] Configurable fade-out ms default
* [ ] Per-play fade override via PlayClip command
* [ ] Equal-power or linear fade curve selection
* [ ] Apply fades before stem gain
* [ ] Cancel fade cleanly if stop requested mid-fade
* [ ] Unit-test fade reaches 0/1 endpoints

---

## 12. Playback Engine (WAV)

* [ ] Create WAV file reader abstraction
* [ ] Validate WAV header before decode
* [ ] Support PCM16 WAV
* [ ] Support float WAV
* [ ] Support common WAV channel layouts mono/stereo
* [ ] Reject unsupported WAV compressions with clear error
* [ ] Stream decode into clip ring on worker thread
* [ ] Support seek to start for replay
* [ ] Compute duration from header
* [ ] Emit PlaybackStarted with duration
* [ ] Emit PlaybackProgress at interval
* [ ] Emit PlaybackEnded
* [ ] Handle file locked/in-use errors

---

## 13. Playback Engine (MP3)

* [ ] Integrate MP3 decoder (MediaFoundation or NAudio provider)
* [ ] Validate MP3 container before decode
* [ ] Decode MP3 to PCM on worker thread
* [ ] Handle VBR duration estimation
* [ ] Handle corrupt frame errors gracefully
* [ ] Convert decoded PCM to mix format via SRC
* [ ] Prebuffer minimum ms before starting audible play
* [ ] Cancel decode on StopPlayback
* [ ] Dispose decoder resources
* [ ] Benchmark decode latency for typical clip sizes

---

## 14. Local TTS Injection

* [ ] Define `ITtsEngine` interface
* [ ] Implement Windows SAPI TTS adapter
* [ ] Enumerate installed voices
* [ ] Select voice by ID
* [ ] Synthesize text to WAV/PCM file or memory stream
* [ ] Stream synthesized PCM into TTS ring
* [ ] Apply same fade/duck/gain path as clips
* [ ] Enforce max text length
* [ ] Reject empty text
* [ ] Cancel synthesis on stop
* [ ] Cache last synthesis optional setting
* [ ] Emit TTS-specific playback events or reuse Playback* events

---

## 15. Volume Controls

* [ ] Map UI 0–100 slider to internal dB or linear scale (document mapping)
* [ ] Apply SetStemGains without audio glitch (atomic snapshot)
* [ ] Support relative hotkey volume nudges (optional)
* [ ] Persist last gains via main settings (coordination)
* [ ] Clamp gains to safe min/max
* [ ] Provide unity gain default

---

## 16. Latency Control

* [ ] Define default target buffer ms (e.g., 20–40)
* [ ] Provide low-latency preset
* [ ] Provide stable-latency preset
* [ ] Measure hotkey-to-audible latency harness hook
* [ ] Measure round-trip mic-to-cable latency harness hook
* [ ] Expose latency estimate in HealthSnapshot
* [ ] Adjust WASAPI buffer duration where API allows
* [ ] Document interaction with Zoom software processing delay (external)

---

## 17. Thread Synchronization

* [ ] Ensure capture thread never calls UI/IPC directly
* [ ] Ensure render/audio thread never allocates large arrays
* [ ] Ensure render/audio thread never takes mutex that IPC also holds (priority inversion)
* [ ] Use concurrent queue for control commands
* [ ] Drain control commands at buffer boundaries
* [ ] Use Interlocked for state flags
* [ ] Affinity/priority: set audio thread priority carefully on Windows
* [ ] Avoid GC thrash: reuse buffers / ArrayPool
* [ ] Stress-test under concurrent play/stop spam
* [ ] Detect and log potential deadlock timeouts on stop

---

## 18. Clock & Scheduling

* [ ] Treat render device as master clock
* [ ] Align clip sample consumption to render frames
* [ ] Avoid drift between capture and render with adaptive buffering
* [ ] Implement simple adaptive capture read sizing
* [ ] Reset clocks on device restart
* [ ] Document known drift limits

---

## 19. Error Recovery

* [ ] Detect capture device lost HRESULT/condition
* [ ] Detect render device lost HRESULT/condition
* [ ] Transition to Recovering state
* [ ] Attempt automatic re-open of devices N times
* [ ] Backoff between recovery attempts
* [ ] Emit DeviceLost event with which side failed
* [ ] Fall back to silence mic stem if capture lost but render OK (policy flag)
* [ ] Stop playback if render lost
* [ ] Transition to Faulted after recovery exhaustion
* [ ] Allow user Reset command to return Idle
* [ ] Recover from decoder exceptions without killing engine
* [ ] Recover from TTS failures without killing engine
* [ ] Clear rings after recovery before restart
* [ ] Verify pass-through resumes after recovery

---

## 20. Health & Telemetry (Engine)

* [ ] Track underrun count
* [ ] Track overrun count
* [ ] Track dropped capture frames
* [ ] Track peak CPU time in render callback
* [ ] Track current buffer fill %
* [ ] Track current ducking gain reduction
* [ ] Emit HealthSnapshot on interval
* [ ] Emit Underrun event when threshold exceeded
* [ ] Reset counters command for diagnostics

---

## 21. Engine Lifecycle Commands

* [ ] Implement StartEngine: open devices → start pumps → Mixing
* [ ] Implement StopEngine: stop playback → stop pumps → close devices → Idle
* [ ] Implement PlayClip while Mixing → Playing
* [ ] Implement PlayClip while already Playing (stop-previous or queue policy — document)
* [ ] Implement StopPlayback → return Mixing
* [ ] Implement SetDevices only when Idle or Stopped (or seamless restart sequence)
* [ ] Implement seamless SetDevices: stop → set → start helper
* [ ] Implement Quit: StopEngine + break IPC loop

---

## 22. Test Doubles & Harnesses

* [ ] Create fake capture source generating sine
* [ ] Create fake render sink writing to WAV file
* [ ] Create offline mix unit test summing known buffers
* [ ] Create ducking envelope unit test
* [ ] Create fade envelope unit test
* [ ] Create SRC correctness test with tone
* [ ] Create underrun simulation test
* [ ] Create device-lost simulation test

---

## 23. Audio Engine Completion Gate

* [ ] Pass-through mic audible via VB-CABLE in Zoom Phone
* [ ] WAV clip mixes with live speech
* [ ] MP3 clip mixes with live speech
* [ ] TTS mixes with live speech
* [ ] Ducking audibly reduces mic under clip
* [ ] Fade in/out has no clicks
* [ ] Stop mid-clip is clean
* [ ] Device unplug enters Recovering and notifies
* [ ] No audio-thread deadlocks under stress
* [ ] Latency SLO sample recorded for default preset
