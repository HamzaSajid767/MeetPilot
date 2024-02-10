# UI / UX

## Purpose

Define the complete UI/UX plan for Zoom Dialer Companion: layouts, user flows, keyboard-first operation, accessibility, themes, loading/error/toast/confirmation patterns, and acceptance checkboxes.

## Scope

- Visual and interaction design requirements for Electron React UI
- Setup, library, playback, settings, and diagnostics experiences
- Operator workflows during live Zoom Phone calls
- Out of scope: marketing website; Zoom Phone UI changes

## Dependencies

- [electron.md](electron.md) component tasks
- [architecture.md](architecture.md)
- [virtual-audio.md](virtual-audio.md) wizard content
- [features.md](features.md)

## Deliverables

- Screen inventory and layout plan
- End-to-end user flows
- Keyboard-first and a11y requirements as checkboxes
- Transient UI pattern checklist

## Completion Criteria

* [x] Every primary flow has UX acceptance checkboxes
* [x] Keyboard-first call-time workflow is explicit
* [x] Error and loading states are fully tasked
* [x] Theme and accessibility targets are tasked

---

## 1. Design Principles

* [ ] Prioritize call-time speed over editing richness
* [ ] Prefer keyboard over mouse for play actions
* [ ] Make engine/routing health always visible
* [ ] Never bury Stop Playback
* [ ] Prefer progressive disclosure for advanced audio settings
* [ ] Use plain language for device/routing errors
* [ ] Confirm before destructive data loss
* [ ] Keep critical controls reachable within one glance on default window size

---

## 2. Information Architecture

* [ ] Primary nav: Library
* [ ] Secondary nav: Categories
* [ ] Secondary nav: Devices
* [ ] Secondary nav: Settings
* [ ] Utility: Setup Wizard
* [ ] Utility: Diagnostics
* [ ] Utility: Shortcut Cheatsheet
* [ ] Global header search always available on main routes

---

## 3. Layouts

* [ ] Define default window size 1280×800
* [ ] Define minimum window size 960×640
* [ ] Layout: left sidebar 240px collapsible
* [ ] Layout: main content fluid
* [ ] Layout: bottom status bar 28–32px
* [ ] Library layout: list + optional detail split view
* [ ] Settings layout: subnav + form panel
* [ ] Wizard layout: centered stepper card
* [ ] Compact mode density option (optional)

---

## 4. Visual Hierarchy — Library

* [ ] Phrase title primary text
* [ ] Category and duration secondary
* [ ] Hotkey badge tertiary but scannable
* [ ] Playing row emphasized with accent bar
* [ ] Selected row distinct from playing row
* [ ] Multi-select checkbox column optional until selection mode

---

## 5. User Flow — First Run

* [ ] Launch → Setup Wizard if not completed
* [ ] Explain virtual mic concept in one screen
* [ ] Guide VB-CABLE install
* [ ] Detect devices
* [ ] Select mic + cable
* [ ] Instruct Zoom Phone mic = CABLE Output
* [ ] Confirm test
* [ ] Land on Library empty state with Add Phrase CTA

---

## 6. User Flow — Add & Play Phrase

* [ ] Click Add Phrase or Ctrl+N
* [ ] Drop/select WAV/MP3
* [ ] Enter title + category
* [ ] Save
* [ ] Select phrase
* [ ] Press Enter or Play or hotkey
* [ ] See Playing indicator
* [ ] Far side hears audio (manual validation)
* [ ] Press Stop or hotkey stop

---

## 7. User Flow — Call-Time Operator

* [ ] App may be minimized to tray
* [ ] Operator focuses Zoom Phone
* [ ] Operator presses global phrase hotkey
* [ ] Clip plays into call within latency SLO
* [ ] Operator continues talking
* [ ] Optional ducking reduces mic under clip
* [ ] Operator stops early if needed
* [ ] Visual feedback available when returning to app / tray tooltip

---

## 8. User Flow — Search & Categories

* [ ] Ctrl+K focus search
* [ ] Type query
* [ ] Results filter live
* [ ] Arrow to phrase
* [ ] Enter to play
* [ ] Esc clear
* [ ] Click category chip to filter
* [ ] Clear filters control visible when active

---

## 9. User Flow — Devices Problem

* [ ] Status bar turns warning when cable missing
* [ ] Banner CTA: Fix routing
* [ ] Deep link to Devices or Wizard
* [ ] Recheck devices
* [ ] Apply and retry engine
* [ ] Success returns status OK

---

## 10. Keyboard-First Workflow

* [ ] Document default shortcuts cheat sheet
* [ ] `Ctrl+K` / `Ctrl+F` search
* [ ] `Ctrl+N` new phrase
* [ ] `Space` / `Enter` play selection (choose one primary; document)
* [ ] `Esc` stop playback when not in modal input
* [ ] `Delete` delete with confirm
* [ ] `Ctrl+,` open settings
* [ ] `Ctrl+/` cheatsheet
* [ ] `Alt+1..9` optional category jumps (optional)
* [ ] Global configurable play/stop hotkeys
* [ ] Per-phrase configurable hotkeys
* [ ] Ensure shortcuts work when renderer focused
* [ ] Ensure global shortcuts work when app unfocused
* [ ] Show shortcut hints in button tooltips
* [ ] Show shortcut hints in context menus

---

## 11. Accessibility

* [ ] WCAG AA contrast for text on surfaces
* [ ] Visible focus ring on all interactive elements
* [ ] Hit target min 32×32 where practical
* [ ] aria-live polite region for “Playing {title}”
* [ ] aria-live assertive for critical routing failures
* [ ] Form labels associated with inputs
* [ ] Errors linked via aria-describedby
* [ ] Do not rely on color alone for Playing vs Selected
* [ ] Support keyboard operability for all tasks
* [ ] Test with Windows Magnifier spot check
* [ ] Respect `prefers-reduced-motion` for animations

---

## 12. Color Themes

* [ ] Light theme tokens: background, surface, text, accent, danger, warning, success
* [ ] Dark theme tokens matching same roles
* [ ] System theme follows OS
* [ ] Status colors: Mixing green, Playing blue, Recovering amber, Faulted red
* [ ] Ensure accent distinct in both themes
* [ ] Provide theme preview in settings

---

## 13. Loading States

* [ ] Library initial load skeleton rows
* [ ] Search in-progress spinner in input
* [ ] Phrase save button pending state
* [ ] Device refresh spinner
* [ ] Engine starting spinner in status bar
* [ ] Import progress determinate if possible else indeterminate
* [ ] Update download progress bar
* [ ] Avoid layout shift when skeletons resolve

---

## 14. Empty States

* [ ] Empty library with Add/Import CTAs
* [ ] Empty search results with clear query CTA
* [ ] Empty category with assign hint
* [ ] No devices found with troubleshooting CTA

---

## 15. Toasts

* [ ] Toast for play failure
* [ ] Toast for import success with count
* [ ] Toast for export success with path
* [ ] Toast for settings saved (optional quiet)
* [ ] Toast for update available
* [ ] Toast for sidecar restarted
* [ ] Stack max 3 toasts
* [ ] Auto-dismiss non-error toasts
* [ ] Sticky error toasts until dismissed
* [ ] Actionable toast button (e.g., Open Devices)

---

## 16. Error Dialogs

* [ ] Modal for fatal Faulted engine with Retry/Open Logs
* [ ] Modal for failed migration
* [ ] Modal for failed restore
* [ ] Include correlation ID copy button
* [ ] Do not block entire app for non-fatal play errors (toast instead)

---

## 17. Confirmation Dialogs

* [ ] Confirm delete phrase
* [ ] Confirm bulk delete
* [ ] Confirm delete category
* [ ] Confirm reset settings
* [ ] Confirm restore backup
* [ ] Confirm discard unsaved phrase edits
* [ ] Destructive button styled danger
* [ ] Default focus on cancel for destructive dialogs

---

## 18. Status Bar & Tray UX

* [ ] Status bar: Engine state chip
* [ ] Status bar: Capture short name
* [ ] Status bar: Render short name
* [ ] Status bar: Latency estimate optional
* [ ] Tray tooltip mirrors engine state + playing title
* [ ] Tray menu Stop Playback when playing

---

## 19. Copywriting Tasks

* [ ] Write wizard Zoom configuration copy
* [ ] Write cable missing error copy
* [ ] Write feedback-loop blocked copy
* [ ] Write first-run mic privacy explanation
* [ ] Write empty library copy
* [ ] Avoid jargon without tooltip definitions (WASAPI hidden)

---

## 20. Motion & Feedback

* [ ] Subtle playing progress animation
* [ ] No distracting motion during calls
* [ ] Button press feedback immediate (<100 ms UI)
* [ ] Optimistic playing state with rollback on error

---

## 21. UX Acceptance Checkboxes

* [ ] New user can complete setup without external help docs
* [ ] Returning user can play a phrase in ≤3 keystrokes from cold library focus
* [ ] Global hotkey play works while Zoom focused
* [ ] Routing failure is obvious within 1 second of detection
* [ ] Destructive actions always confirm
* [ ] Dark and light themes both usable in bright/dim rooms
* [ ] Keyboard-only user can add, search, play, stop
* [ ] Errors offer next step, not only failure text

---

## 22. UI/UX Completion Gate

* [ ] All primary flows have mockable component coverage in electron tasks
* [ ] Cheatsheet matches actual shortcuts
* [ ] Status semantics match engine state machine names
* [ ] Wizard covers VB-CABLE + Zoom mic steps
* [ ] Accessibility checklist spot-checked on reference build
