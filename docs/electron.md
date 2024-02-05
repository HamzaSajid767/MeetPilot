# Electron / UI Shell

## Purpose

Define atomic implementation tasks for the Electron application shell and React TypeScript UI: windows, routing, components, keyboard shortcuts, search, phrase management, settings, theme, and renderer state management.

## Scope

- Electron BrowserWindow / tray / preload
- React renderer application
- UI state management
- In-app and global shortcut UX surfaces
- Out of scope: SQLite schema details ([storage.md](storage.md)), audio DSP ([audio-engine.md](audio-engine.md)), visual UX copy polish beyond tasking ([ui-ux.md](ui-ux.md) owns UX acceptance)

## Dependencies

- [architecture.md](architecture.md)
- [backend.md](backend.md) — ipcMain channels
- [ui-ux.md](ui-ux.md)
- Electron, React, TypeScript, Vite (or Electron Forge/Vite template)

## Deliverables

- Exhaustive checkbox task list for Electron UI implementation
- Window and route inventory
- Component and store checklist

## Completion Criteria

* [x] Every UI surface required for MVP→GA has atomic tasks
* [x] Preload bridge is fully enumerated
* [x] Shortcut UX and phrase management flows are covered
* [x] Tasks remain UI-scoped without embedding audio DSP work

---

## 1. Electron Tooling Scaffold

* [ ] Initialize Electron + Vite + React + TypeScript app under `apps/desktop`
* [ ] Configure main/preload/renderer build entry points
* [ ] Configure path aliases for `@main`, `@renderer`, `@shared`
* [ ] Enable strict TypeScript settings for renderer and main
* [ ] Add ESLint config for React hooks rules
* [ ] Add Prettier config (documentation note; file created in scaffold phase)
* [ ] Add script `dev` to run Electron with hot reload
* [ ] Add script `build` to package renderer + main
* [ ] Add script `typecheck`
* [ ] Ensure `sandbox`, `contextIsolation`, `nodeIntegration:false` defaults

---

## 2. BrowserWindow Tasks

* [ ] Create main BrowserWindow factory
* [ ] Set minimum window width
* [ ] Set minimum window height
* [ ] Restore window bounds from settings
* [ ] Persist window bounds on move/resize debounce
* [ ] Center window on first launch
* [ ] Load renderer URL in development
* [ ] Load packaged `index.html` in production
* [ ] Implement close-to-tray behavior setting
* [ ] Implement quit from tray menu
* [ ] Implement Bring to Front on second instance
* [ ] Set window title “Zoom Dialer Companion”
* [ ] Set application user model ID on Windows
* [ ] Attach CSP for production renderer
* [ ] Block navigation to external origins in window
* [ ] Open external links via `shell.openExternal` allowlist

---

## 3. Tray & Menu

* [ ] Add tray icon asset reference in docs/assets plan
* [ ] Create tray context menu: Show, Start Engine, Stop Engine, Quit
* [ ] Update tray tooltip with engine state
* [ ] Add application menu with File/Edit/View/Help stubs
* [ ] Wire Help → Open Logs
* [ ] Wire Help → Diagnostics
* [ ] Wire Help → Check for Updates

---

## 4. Preload Bridge

* [ ] Create preload script with `contextBridge`
* [ ] Expose `api.phrases.list`
* [ ] Expose `api.phrases.get`
* [ ] Expose `api.phrases.create`
* [ ] Expose `api.phrases.update`
* [ ] Expose `api.phrases.delete`
* [ ] Expose `api.phrases.search`
* [ ] Expose `api.phrases.play`
* [ ] Expose `api.phrases.stop`
* [ ] Expose `api.categories.list`
* [ ] Expose `api.categories.create`
* [ ] Expose `api.categories.update`
* [ ] Expose `api.categories.delete`
* [ ] Expose `api.categories.reorder`
* [ ] Expose `api.devices.list`
* [ ] Expose `api.devices.select`
* [ ] Expose `api.devices.refresh`
* [ ] Expose `api.settings.getAll`
* [ ] Expose `api.settings.set`
* [ ] Expose `api.shortcuts.list`
* [ ] Expose `api.shortcuts.set`
* [ ] Expose `api.importExport.importPack`
* [ ] Expose `api.importExport.exportPack`
* [ ] Expose `api.app.getVersion`
* [ ] Expose `api.app.openLogs`
* [ ] Expose `api.app.exportDiagnostics`
* [ ] Expose `api.updates.check`
* [ ] Expose `api.on(event, listener)` subscription helper
* [ ] Expose `api.off(event, listener)`
* [ ] Type `window.api` in a shared `.d.ts` (created during scaffold phase)
* [ ] Ensure no Node builtins leak through preload

---

## 5. Renderer App Shell

* [ ] Create React root mount
* [ ] Create App providers wrapper (theme, query/store)
* [ ] Create main layout with sidebar + content + status bar
* [ ] Create status bar showing engine state
* [ ] Create status bar showing selected devices short names
* [ ] Create status bar showing playback indicator
* [ ] Create sidebar nav items: Library, Categories, Devices, Settings, Setup
* [ ] Create header with global search input
* [ ] Create header play/stop buttons
* [ ] Create header volume popover trigger
* [ ] Handle offline/sidecar-down banner component mount point

---

## 6. Routing

* [ ] Add client-side router
* [ ] Route `/library` Phrase Library
* [ ] Route `/phrases/:id` Phrase Detail
* [ ] Route `/categories` Category Manager
* [ ] Route `/devices` Device Settings
* [ ] Route `/settings` General Settings
* [ ] Route `/settings/audio` Audio Settings
* [ ] Route `/settings/shortcuts` Shortcut Settings
* [ ] Route `/settings/updates` Updates
* [ ] Route `/setup` Setup Wizard
* [ ] Route `/diagnostics` Diagnostics view
* [ ] Redirect `/` to `/library`
* [ ] Guard `/library` with setup-required redirect when needed
* [ ] Remember last route in session (optional setting)

---

## 7. Phrase Library Components

* [ ] Create `PhraseList` virtualized list component
* [ ] Create `PhraseListItem` with title, category, duration, hotkey badge
* [ ] Create `PhraseEmptyState` component
* [ ] Create `PhraseToolbar` with Add / Import / Export actions
* [ ] Create multi-select checkboxes on phrase rows
* [ ] Create bulk delete action bar
* [ ] Create bulk export action
* [ ] Create sort dropdown: name, recent, frequently used
* [ ] Create filter chip by category
* [ ] Create filter chip by has-hotkey
* [ ] Highlight currently playing phrase row
* [ ] Double-click row to play
* [ ] Context menu: Play, Edit, Duplicate, Delete, Assign Hotkey
* [ ] Keyboard focus movement across list items
* [ ] Enter to play focused phrase
* [ ] Delete key opens confirm delete

---

## 8. Phrase Detail / Editor

* [ ] Create phrase editor form
* [ ] Field: title
* [ ] Field: category select
* [ ] Field: tags input
* [ ] Field: notes textarea
* [ ] Field: default gain slider
* [ ] Field: hotkey recorder control
* [ ] Field: audio file picker
* [ ] Show duration after file selected
* [ ] Show waveform placeholder or duration bar (optional MVP+)
* [ ] Save button with dirty-state disable logic
* [ ] Cancel/navigate away dirty confirmation
* [ ] Play preview button
* [ ] Replace audio file action
* [ ] Validation messages under fields

---

## 9. Create Phrase Flow

* [ ] Add Phrase modal/page
* [ ] Drag-and-drop audio file dropzone
* [ ] Validate dropped file type in UI before invoke
* [ ] Show upload/import progress indeterminate state
* [ ] On success navigate to detail or select in list
* [ ] On failure show error toast with code

---

## 10. Categories UI

* [ ] Category list panel
* [ ] Create category dialog
* [ ] Rename category inline
* [ ] Delete category with reassignment dialog
* [ ] Drag-reorder categories
* [ ] Show phrase counts per category
* [ ] Click category filters library

---

## 11. Search UI

* [ ] Debounced search input (150–250 ms)
* [ ] Show spinner while searching
* [ ] Show result count
* [ ] Clear search button
* [ ] Recent searches dropdown (optional)
* [ ] Empty search results state
* [ ] Focus search with Ctrl+K / Ctrl+F
* [ ] Escape clears search or blurs

---

## 12. Playback Controls UI

* [ ] Play button invokes `phrases.play`
* [ ] Stop button invokes `phrases.stop`
* [ ] Disable play when no selection
* [ ] Show progress for active playback from events
* [ ] Show elapsed/remaining time
* [ ] Master volume slider
* [ ] Mic volume slider
* [ ] Clip volume slider
* [ ] Ducking toggle
* [ ] Ducking advanced disclosure panel
* [ ] Visual “On Air” indicator when Mixing
* [ ] Visual “Playing” indicator when Playing

---

## 13. Devices UI

* [ ] Device list refresh button
* [ ] Capture device dropdown
* [ ] Render device dropdown
* [ ] Mark recommended VB-CABLE render device
* [ ] Show device state badges: OK, Missing, Default
* [ ] Apply devices button
* [ ] Test tone / loopback guidance text (no Zoom dependency)
* [ ] Warning when render device not virtual cable
* [ ] Link to Setup Wizard

---

## 14. Settings UI

* [ ] General settings page layout
* [ ] Toggle start with Windows (if supported)
* [ ] Toggle start minimized
* [ ] Toggle close to tray
* [ ] Toggle auto-start engine on launch
* [ ] Toggle auto-start engine on first play
* [ ] Theme select: system / light / dark
* [ ] Log level select
* [ ] Open logs folder button
* [ ] Export diagnostics button
* [ ] Reset settings to defaults with confirm
* [ ] Audio settings: buffer target, fade defaults
* [ ] Audio settings: ducking params editors
* [ ] Audio settings: soft limiter toggle
* [ ] Shortcut settings page listing all accelerators
* [ ] Updates page with channel + check now + last result

---

## 15. Setup Wizard UI

* [ ] Step 1: Welcome / what this app does
* [ ] Step 2: Install VB-CABLE instructions with external link
* [ ] Step 3: Detect cable device presence
* [ ] Step 4: Select capture and render devices
* [ ] Step 5: Configure Zoom Phone mic to CABLE Output instructions
* [ ] Step 6: Run pass-through test checklist (manual confirm)
* [ ] Step 7: Finish and go to library
* [ ] Persist wizardCompleted flag
* [ ] Allow re-open wizard from Help/Devices

---

## 16. Keyboard Shortcuts (UI + Wiring)

* [ ] Global shortcut settings editor UI
* [ ] Capture key combination input component
* [ ] Clear shortcut button
* [ ] Show conflict warning badge
* [ ] In-app shortcut: focus search
* [ ] In-app shortcut: new phrase
* [ ] In-app shortcut: play selection
* [ ] In-app shortcut: stop
* [ ] In-app shortcut: next/previous phrase
* [ ] Display shortcut cheatsheet modal
* [ ] Disable conflicting in-app shortcuts when typing in inputs

---

## 17. Theme

* [ ] Define design tokens for light theme
* [ ] Define design tokens for dark theme
* [ ] Apply system theme preference detection
* [ ] Persist user theme override
* [ ] Ensure focus rings visible in both themes
* [ ] Ensure status colors meet contrast targets

---

## 18. Renderer State Management

* [ ] Choose and document store library in ADR reference
* [ ] Create `engineSlice` / store module for sidecar state
* [ ] Create `phrasesSlice` for list cache
* [ ] Create `selectionSlice` for selected phrase IDs
* [ ] Create `playbackSlice` for active playback UI
* [ ] Create `devicesSlice`
* [ ] Create `settingsSlice`
* [ ] Create `uiSlice` for modals/toasts
* [ ] Subscribe to main events and dispatch store updates
* [ ] Invalidate phrase list on phraseChanged events
* [ ] Reconcile optimistic play state on PlaybackError
* [ ] Persist UI density preference (optional)

---

## 19. Toasts, Dialogs, Loading

* [ ] Toast viewport component
* [ ] Success toast helper
* [ ] Error toast helper
* [ ] Info toast helper
* [ ] Confirm dialog component
* [ ] Destructive confirm for delete phrase
* [ ] Destructive confirm for delete category
* [ ] Modal focus trap
* [ ] Route-level loading skeleton for library
* [ ] Button pending spinner state
* [ ] Full-screen sidecar reconnect overlay

---

## 20. Accessibility Wiring

* [ ] All icon buttons have aria-labels
* [ ] Dialogs have aria-modal and labelledby
* [ ] Live region for playback status announcements
* [ ] Ensure tab order matches visual order
* [ ] Skip-to-content link
* [ ] Honor Windows high-contrast where feasible

---

## 21. Error Boundaries

* [ ] React error boundary around app shell
* [ ] Fallback UI with reload action
* [ ] Report boundary errors to log via main invoke

---

## 22. Electron UI Completion Gate

* [ ] User can complete setup wizard
* [ ] User can add, search, play, stop a phrase from UI
* [ ] User can assign and use a hotkey
* [ ] User can change devices and volumes
* [ ] UI reflects engine state transitions live
* [ ] Theme and settings persist across restart
