# TODO - Code

Focus for now: stabilize, fine-tune, optimise. Features wait.

## Refactoring left

- **Capabilities instead of `isBrowserRuntime`**: about 150 uses left, each marked `// FIXME : Capabilities` (grep it). Low value; only if a third engine needs it. Replace with `useCapabilities()` / `getEngine().capabilities`.
- **Window switching**: forced layout fixed; remaining cost is mostly native paint (blur, compositing). Re-test in the VM, then consider a setting to disable backdrop blur.

## Features pending

- Verify in the VM: power profile and MPRIS over D-Bus (`dbus-services.ts`). The profile *set* sends a D-Bus variant; if the daemon refuses it the code falls back to `powerprofilesctl`.
- On hold: `org.piloti` GSettings schema decision.


## Ideas (small improvements)

Checked against the code on 2026-11-24. Priority picks are marked (*).

- Browser: duplicate tab (not there). Reopen closed tab and pin tab are done.
- Notifications: (*) schedule for Do Not Disturb. The toggle exists in the Control Panel (`doNotDisturb`); no schedule, no per-app mute, no "clear all" check yet.
- Windows: (*) Alt+` to cycle the windows of one app (not there). Corner snapping exists (`quad` in `window.tsx`); a keyboard shortcut for it was not checked.
- Quick settings: airplane mode (not there); night-light schedule (the toggle exists, `nightLight`); rotation lock; battery time remaining.
- Terminal: tabs, Ctrl +/- font size, copy on select (not checked in `XtermTerminalApp`).
- Folders: batch rename (only `renameSelected` for one item exists), properties dialog with permissions (not found), drag out to other windows.
- Dock: notification count badges (not there), "Quit all windows" in the Dock menu (not there), thumbnails on hover.
- Launcher: unit and currency conversion, clipboard history (neither there); calculator history.
- Settings: reset a pane to defaults, search across panes.

## Done
- Old terminal (`TerminalApp.tsx`, `terminal-pipeline.ts` and its test) removed; the app is now "Terminal" with `piloti-terminal` as desktop file, command and bin script (`piloti-shell` still resolves as an alias).
- Launcher opens at once and fills its list next frame; no app/icon refresh on open.
- Wi-Fi password: secured networks without a saved profile ask for the password in the Control Panel; wrong password shows an error (untested on hardware: no Wi-Fi in the VM).
- Window switching: every Window measured its frame after each render (forced layout on each focus); now only when maximize flips. Focus latency in a production web build went from about 55 ms to 38 ms.
- Browser tabs: reorder with the Dock's dnd-kit feel, horizontal only; pull a tab 48 px away from the bar to detach it into its own window (checked in the web demo; also fixed tab title/icon changes not showing on inactive tabs).
- Capabilities: `useCapabilities()` hook added (`src/hooks/use-capabilities.ts`); Launcher, DisplaysPane and icon-grid migrated. About 290 uses remain.
- Capabilities (cont.): migrated Camera, Login screen, portal dialogs, Security/Advanced/Wallpaper/Fonts/Displays settings, SettingsApp, Desktop, keyboard switcher, Alt+Tab, Console, file context menu. Still using `isBrowserRuntime`: DesktopIconsApp, FilesApp, WindowManager, AppStoreApp, SettingsContext, WindowsContext, Dock, MenuBar, AppsContext, ControlPanel, useGlobalShortcuts, AboutComputerDialog, DesktopStateContext. `DockFolderStack.tsx` is converted and committed with the rest.
- Capabilities: Folders and Desktop migrated. Remaining `isBrowserRuntime` uses are marked `// FIXME : Capabilities` (grep for it); several sit in files with another session's uncommitted edits (WindowManager, AppStoreApp, Dock, MenuBar, ControlPanel, SettingsContext, DockFolderStack) and get committed with them. Decision: leave the rest unless a third engine needs it.
- File metadata (`metadata::*` read/write) goes through `FileService`/`FileStore` (`gio info`/`gio set` now live in `native-file-store.ts`); `fs-bridge.ts` no longer runs any process itself.
- Text Editor module save test: `tests/unit/text-editor-module-host.test.ts` (writes real path, failed write, read back, preload, localized Desktop, prefs, confirm-on-close).
- Power profiles and MPRIS now use D-Bus (`src/lib/engine-native/dbus-services.ts`): live signals instead of polling, multi-player pick (playing first), tests in `dbus-services.test.ts`.
- Browser tabs: Reopen Closed Tab (File menu, Ctrl+Shift+T, last 20 pages) and Pin Tab (tab context menu with Unpin and Move to New Window; pinned tabs sit first as icons). Checked in the web demo.
