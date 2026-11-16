# Architecture & Shell API

Piloti runs the same React tree across two runtimes:

1. **Domicile Runtime (`desktop.tsx`)**: Mounted inside Domicile's Chromium compositor via `mount(PilotiShell)`. Renders real Wayland surfaces in `<app app-id="…" />` and talks to Linux subsystems over Domicile APIs.
2. **Browser Dev Runtime (`src/main.tsx`)**: Mounted via [`createBrowserDomicile()`](../src/lib/browser-domicile.ts), providing a `FakeDomicileHost`, virtual `.desktop` entries, and mock hardware/theme backends for local browser development.

Only **System Settings** and **Piloti Console** are built into the shell; all other apps run as Wayland/XDG processes or browser webviews.

---

## Directory Structure

```text
├── desktop.tsx                    # Domicile entry point
├── index.html                     # Browser dev entry point
├── vite.config.ts                 # Browser build -> docs/demo/
├── vite.shell.config.ts           # Standalone Domicile bundle -> dist/shell.js
└── src/
    ├── main.tsx                   # Browser runtime bootstrap
    ├── context/
    │   ├── SettingsContext.tsx    # Persisted settings, themes, wallpapers, bounds
    │   ├── SystemBackendsContext.tsx # GSettings, audio, Wi-Fi, battery, portals, lock, capture
    │   ├── AppsContext.tsx        # XDG .desktop & Icon Theme discovery + launching
    │   ├── WindowsContext.tsx     # Wayland/shell/browser window state, popups, shortcuts
    │   └── DesktopStateContext.tsx# Provider composition & hook re-exports
    ├── data/catalog.ts            # Accent palettes, wallpapers, built-in app metadata
    ├── components/
    │   ├── shell/                 # Menubar, Dock, WindowManager, CommandPalette, ControlCenter, Alt+Tab, LockScreen, Portals
    │   ├── apps/                  # SettingsApp (+ settings/* panes) and ConsoleApp
    │   │   └── ui/                    # Adwaita-styled Base UI primitives
    ├── lib/
    │   ├── xdg-basedir.ts         # FreeDesktop XDG Base Directory paths
    │   ├── xdg-desktop-entry.ts   # .desktop scanner, parser, Exec field code expansion
    │   ├── xdg-icon-theme.ts      # index.theme inheritance & SVG/PNG icon resolution
    │   ├── xdg-session-management.ts # xdg-session-management-v1 JSON persistence
    │   ├── xdg-trash.ts           # FreeDesktop Trash inspection & emptying
    │   ├── gnome-bridge.ts        # gsettings/dconf, wpctl/pactl, nmcli, UPower, powerprofilesctl
    │   ├── cursors.ts             # Unified CursorShape CSS variables (native & zero-hotspot SVG modes)
    │   ├── console-store.ts       # Captured logs & Piloti Console state
    │   ├── csp-repl-eval.ts       # CSP-safe JS expression/statement evaluator for REPL
    │   └── browser-domicile.ts    # Browser mock Domicile host
    └── styles/                    # Tailwind v4 + GNOME Adwaita design tokens
```

---

## Key Subsystems

- **State Layer (`src/context/DesktopStateContext.tsx`)**: Composes `SettingsProvider` → `SystemBackendsProvider` → `AppsProvider` → `WindowsProvider`. Components subscribe to the narrowest hook needed (`useSettings()`, `useSystemBackends()`, `useApps()`, `useWindowManager()`).
- **Window Management (`src/components/shell/WindowManager.tsx`)**:
  - `WaylandAppSurface` synchronizes each `<app>` element's viewport CSS pixel box to `domicile.windows.setBounds(...)` via `ResizeObserver` and layout effects (`0×0` when minimized).
  - Sends `WindowState.TiledLeft/Right/Top/Bottom` (and `Maximized`) via `domicile.windows.setStates(...)` so GTK4/Libadwaita CSD clients drop duplicate outer shadows.
  - Subscribes to `domicile.windows.requests()` (`Maximize`, `Unmaximize`, `Fullscreen`, `Unfullscreen`, `Minimize`, `Move`, `Resize`) to handle client-initiated moves, resizes, and state transitions alongside `Alt`/`Super` + drag.
- **Cursor Management (`src/lib/cursors.ts`)**: Single source of truth covering all 35 `@domicile-desktop/sdk/cursor-shape` values. `installCursorVars()` injects `--cursor-*` CSS variables onto `:root` using `"native"` CSS keywords in browser mode and `(0, 0)`-anchored 24×24 SVGs (`"zero-hotspot"`) under Domicile DRM.

---

## Shell & Runtime API Reference

### 1. React Context Hooks (Inside Shell Components)

Import from `@/context/DesktopStateContext`:

- **Apps (`useApps()`)**:
  - `installedXdgApps`: `XdgDesktopEntry[]` — discovered `.desktop` apps (`appId`, `desktopId`, `name`, `execArgv`, `iconUrl`, `actions`).
  - `getAppIconUrl(id)`: resolves SVG/PNG icon data URL for a desktop/catalog app ID.
  - `launchXdgEntry(entry, actionId?)` / `refreshXdgApps()`.
- **Windows (`useWindowManager()`)**:
  - `windows` (`combinedWindows`) / `workspaceWindows` / `mruWindows`: unified `DesktopWindowInstance[]` across Wayland clients, built-in shell apps, and Domicile browser windows.
  - `focusedWindow` / `focusedWindowId` / `waylandPopups`: active window and child Wayland popups.
  - Actions: `launchApp(appId, options?)`, `launchXdgApp(entry, actionId?)`, `openWebUrl(url)`, `focusWindow(windowId)`, `closeWindow(windowId)`, `minimizeWindow(windowId)`, `toggleMinimizeWindow(windowId)`, `toggleMaximizeWindow(windowId)`, `tileWindow(windowId, "left" | "right" | "full")`, `forceQuitApp(appId)`, `updateWindowGeometry(windowId, { position, size })`.
- **Settings (`useSettings()`)**:
  - `settings`: `DesktopSettings` (`themeMode`, `accentColor`, `wallpaperId`, `dockSize`, `dockMagnification`, `volume`, `muted`, `brightness`, `nightLight`, `activeWorkspace`, `pinnedAppIds`, etc.).
  - `updateSettings(patch)` / `isBrowserRuntime`.
- **System Backends (`useSystemBackends()`)**:
  - Hardware & daemon state: `batteryInfo`, `wifiNetworks`, `audioSinks`, `availableGnomePanels`, `gnomeCapabilities`, `notifications`, `capturing`, `locked`.
  - Actions: `pushNotification(...)`, `dismissNotification(id)`, `takeScreenshot()`, `startScreenRecording()`, `stopCapture()`, `lockSession()`, `unlockSession(passphrase)`, `requestPowerAction(...)`.

### 2. Domicile SDK (`useDomicile()`)

Direct low-level compositor access from `@domicile-desktop/react/domicile-provider`:

| Domain | Common Calls / Properties |
| :--- | :--- |
| Windows | `domicile.windows.list`, `focused`, `focus(appId)`, `close(appId)`, `setBounds(appId, box)`, `setStates(appId, states)`, `requests()`, `on("change" \| "focuschange" \| "focusrequest", cb)` |
| Processes & Files | `domicile.processes.launch(argv, env?)`, `domicile.processes.run(argv)`, `domicile.files.readDir(path)`, `readText(path)`, `writeText(path, text)` |
| Displays & Theme | `domicile.displays.list`, `setBrightness(pct)`, `setColorTemperature(kelvin)`, `domicile.theme.set(mode)` |
| Session & Portals | `domicile.session.lock()`, `unlock(passphrase)`, `domicile.portals.requests()`, `domicile.capture.preview(target)` |

### 3. Piloti Console REPL

Open **Piloti Console** (`Alt + Space` → `Piloti Console`) to inspect state or script the desktop live. Exposed REPL bindings:

- **State**: `windows`, `focusedWindow`, `waylandPopups`, `apps` (XDG `.desktop` list), `displays`, `browserWindows`, `settings`, `notifications`, `gnomeCapabilities`, `domicile`.
- **Actions**: `launchApp(id)`, `focusWindow(id)`, `closeWindow(id)`, `openWebUrl(url)`, `openGnomeSettings(panel?)`, `updateSettings(patch)`, `pushNotification(...)`, `await run(shellCmd)`, `$_` (last result), `help()`, `clear()`.

```js
// List open Wayland & shell windows
windows.map(w => ({ id: w.id, appId: w.appId, title: w.title }))

// Find installed XDG apps
apps.filter(a => a.name.toLowerCase().includes("files")).map(a => a.desktopId)

// Focus, launch, or update settings
launchApp("nautilus")
updateSettings({ themeMode: "dark", accentColor: "teal" })
await run("uname -a")
```
