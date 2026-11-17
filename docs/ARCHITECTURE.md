# Architecture & Shell API

Piloti runs the same React tree across two runtimes:

1. **Domicile Runtime (`desktop.tsx`)**: Mounted inside Domicile's Chromium compositor via `mount(PilotiShell)`. Renders real Wayland surfaces in `<app app-id="…" />` and talks to Linux subsystems over Domicile APIs.
2. **Browser Dev Runtime (`src/main.tsx`)**: Mounted via [`createBrowserDomicile()`](../src/lib/browser-domicile.ts), providing a `FakeDomicileHost`, virtual `.desktop` entries, and mock hardware/theme backends for local browser development.

Built-in web apps (**Settings (Web)**, **Files (Web)**, **Terminal (Web)**, **Text Editor (Web)**, **App Store**, **DevTools**, and **Desktop Icons**) run inside the shell alongside native Wayland/XDG processes and browser webviews.

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
    │   ├── NotificationsContext.tsx # Notification history, read IDs, DND & banner timers
    │   ├── SystemBackendsContext.tsx # GSettings, audio, Wi-Fi, battery, portals, lock, capture
    │   ├── AppsContext.tsx        # XDG .desktop & Icon Theme discovery + launching
    │   ├── WindowsContext.tsx     # Wayland/shell/browser window state, tiling, popups, shortcuts
    │   └── DesktopStateContext.tsx# Provider composition & hook re-exports
    ├── hooks/
    │   └── use-sidebar-keyboard-nav.ts # Arrow/Tab keyboard navigation for Adwaita sidebars
    ├── data/
    │   ├── catalog.ts             # Accent palettes, wallpapers, built-in app metadata
    │   └── web-apps.ts            # Curated web apps, HTML title/theme-color metadata & caching
    ├── components/
    │   ├── shell/                 # MenuBar, Dock, WindowManager, Launcher, ControlPanel, Overview, OsdOverlay, Alt+Tab, LockScreen, Portals
    │   ├── apps/                  # SettingsApp (+ settings/*), FilesApp, TerminalApp, TextEditorApp, AppStoreApp, ConsoleApp (DevTools), DesktopIconsApp
    │   └── ui/                    # Adwaita-styled Base UI primitives (window, dock, grouped-form, inline-completion-input, etc.)
    ├── lib/
    │   ├── xdg-basedir.ts         # FreeDesktop XDG Base Directory paths
    │   ├── xdg-desktop-entry.ts   # .desktop scanner, parser, Exec field code expansion
    │   ├── xdg-icon-theme.ts      # index.theme inheritance & SVG/PNG icon resolution
    │   ├── xdg-session-management.ts # xdg-session-management-v1 JSON persistence
    │   ├── xdg-trash.ts           # FreeDesktop Trash inspection & emptying
    │   ├── gnome/                 # Modular GNOME/Linux bridges (gsettings, audio, network, power, media, gcc)
    │   ├── web-vfs.ts             # Browser-backed virtual POSIX filesystem & Trash
    │   ├── storage-cache.ts       # In-memory cached & debounced localStorage persistence
    │   ├── cursors.ts             # Unified CursorShape CSS variables (native & zero-hotspot SVG modes)
    │   ├── console-store.ts       # Captured logs & DevTools REPL state
    │   ├── csp-repl-eval.ts       # CSP-safe JS expression/statement evaluator for REPL
    │   └── browser-domicile.ts    # Browser mock Domicile host
    └── styles/                    # Tailwind v4 + GNOME Adwaita design tokens
```

---

## Key Subsystems

- **State Layer (`src/context/DesktopStateContext.tsx`)**: Composes `SettingsProvider` → `NotificationsProvider` → `SystemBackendsProvider` → `AppsProvider` → `WindowsProvider`. Components subscribe to the narrowest hook needed (`useSettings()`, `useNotifications()`, `useSystemBackends()`, `useApps()`, `useWindowManager()`).
- **Window Management (`src/components/ui/window.tsx`, `src/components/shell/WindowManager.tsx`, `src/context/WindowsContext.tsx`)**:
  - Unified `WindowTitlebar` (`46px` height) and `WindowControls` across SSD and CSD windows, respecting GNOME `buttonLayout` (default `:close`), titlebar double-click maximize/restore, and staggered cascade (`+24px, +24px`) for multi-window apps.
  - Pointer edge snapping (`12px` left/right, `10px` top) with pre-tile size preservation and restoration on untile.
  - `WaylandAppSurface` synchronizes each `<app>` element's viewport CSS pixel box to `domicile.windows.setBounds(...)` via `ResizeObserver` and layout effects (`0×0` when minimized).
  - Sends `WindowState.TiledLeft/Right/Top/Bottom` (and `Maximized`) via `domicile.windows.setStates(...)` so GTK4/Libadwaita CSD clients drop duplicate outer shadows.
  - Subscribes to `domicile.windows.requests()` (`Maximize`, `Unmaximize`, `Fullscreen`, `Unfullscreen`, `Minimize`, `Move`, `Resize`) to handle client-initiated moves, resizes, and state transitions alongside `Alt`/`Super` + drag.
- **Keyboard Navigation & Persistence**:
  - `MenuBar` supports `Ctrl+Esc` to open the Piloti menu and continuous `ArrowLeft`/`ArrowRight` navigation across menus, `Launcher`, and `ControlPanel`.
  - `useSidebarKeyboardNav` provides fast `ArrowUp`/`ArrowDown` sidebar cycling (activating on key release), `Tab`/`ArrowRight` into view content, and `ArrowLeft`/`Shift+Tab` back to the sidebar.
  - `storage-cache.ts` caches `localStorage` reads in memory and debounces writes (`150ms`) with `beforeunload` flushing.
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
