# TODO - Code

Focus for now: stabilize, fine-tune, optimise. Features wait.

## Refactoring left

- **Capabilities instead of `isBrowserRuntime`**: about 150 uses left, each marked `// FIXME : Capabilities` (grep it). Low value; only if a third engine needs it. Replace with `useCapabilities()` / `getEngine().capabilities`.
- **Launcher list**: cap or virtualize rows if "Loading…" shows for long on open.
- **Window switching**: forced layout fixed; remaining cost is mostly native paint (blur, compositing). Re-test in the VM, then consider a setting to disable backdrop blur.

## Features pending

- Power profiles and MPRIS via D-Bus.
- Decide on an `org.piloti` GSettings schema.
- Text Editor module save test.

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
