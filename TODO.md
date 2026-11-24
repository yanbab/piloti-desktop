# TODO

## Refactoring left

- **Capabilities instead of `isBrowserRuntime`** (35 files, ~300 mentions). Replace with `getEngine().capabilities` (`realFilesystem`, `systemServices`, `simulatedHardware`). Biggest first: WindowManager, AppStoreApp, DesktopIconsApp, FilesApp, SettingsContext, WindowsContext, AdvancedPane, Dock, MenuBar, AppsContext, PortalDialogs, Desktop.
  - In progress, uncommitted: `use-open-path.ts`, `text-editor-host-shell.tsx` (clean), `SystemBackendsContext.tsx` (half done; `!systemServices` sits in dependency arrays and needs a fix).
- **Remove the old terminal**: `TerminalApp.tsx` and `terminal-pipeline.ts` are unused since `XtermTerminalApp`.
- **Native file ops through `FileService`**: finish moving the remaining direct shell-outs in `fs-bridge.ts` behind `FileStore`.
- **Launcher list**: cap or virtualize rows if "Loading…" shows for long on open.
- **Window switching**: still slow in the VM; profile it (not the Launcher cause).

## Features pending

- Password prompt for secured Wi-Fi.
- Power profiles and MPRIS via D-Bus.
- Decide on an `org.piloti` GSettings schema.
- Text Editor module save test.
- Browser tabs: reorder with the Dock's dnd-kit behaviour (horizontal only) and detach a tab into its own window.
