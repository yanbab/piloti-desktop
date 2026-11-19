# Architecture & Shell API

Piloti runs the same React tree across two runtimes:

1. **Domicile Runtime (`desktop.tsx`)**: Mounted inside Domicile's Chromium Wayland compositor via `mount PilotiShell`. Renders real Wayland surfaces in `<app app-id="…" />` and talks to Linux subsystems over Domicile APIs.
2. **Browser Dev Runtime (`src/main.tsx`)**: Mounted via [`createBrowserDomicile()`](../src/lib/browser-domicile.ts), providing a `FakeDomicileHost`, virtual `.desktop` entries, Indexed VFS/Trash storage, and mock hardware/theme backends for local browser development.

Built-in web apps (**Settings**, **Files**, **Terminal**, **Text Editor**, **Image Viewer**, **Calculator**, **App Store**, **Piloti Console / DevTools**, and **Desktop Icons**) run inside the shell alongside native Wayland/XDG processes and browser `<webview>` / `<iframe>` windows.

---

## Directory Structure

```text
├── desktop.tsx                          # Domicile entry point
├── index.html                           # Browser dev entry point
└── src/
    ├── config/
    │   ├── vite.config.ts               # Browser build -> docs/demo/
    │   └── vite.shell.config.ts         # Standalone Domicile bundle -> dist/shell.js
    ├── main.tsx                         # Browser runtime + isolated app mount bootstrap
    ├── context/
    │   ├── SettingsContext.tsx          # Persisted desktop settings, themes, wallpapers, spatial bounds
    │   ├── SystemBackendsContext.tsx    # Notifications, GSettings, audio, Wi-Fi, battery, portals, lock, capture
    │   ├── AppsContext.tsx              # XDG .desktop & Icon Theme discovery + launching
    │   ├── WindowsContext.tsx           # Wayland/shell/browser window state, ready gating, spatial bounds, tiling
    │   ├── windows/                     # useGlobalAppMenu.ts, useGlobalShortcuts.ts
    │   └── DesktopStateContext.tsx      # Split provider composition (Settings -> Backends -> Windows -> Apps)
    ├── hooks/
    │   ├── use-alt-key.ts               # Global Alt key state tracking for menu bar / shell actions
    │   └── use-sidebar-keyboard-nav.ts  # Arrow/Tab keyboard navigation for Adwaita sidebars
    ├── data/
    │   ├── app.json                     # Curated web apps metadata
    │   ├── catalog.ts                   # Accent palettes, wallpapers, built-in app definitions
    │   ├── folder-icons.tsx             # Dynamic accent SVG folder/file glyphs + open-folder state hook
    │   └── web-apps.ts                  # URL canonicalization, HTML title/theme-color metadata & caching
    ├── components/
    │   ├── shell/                       # MenuBar, Dock, WindowManager, IsolatedAppFrame, Launcher,
    │   │                                # ControlPanel, Overview, OsdOverlay, AltTabSwitcher, LockScreen, Portals
    │   ├── apps/                        # SettingsApp (+ settings/*), FilesApp, FileItemContextMenu, DesktopIconsApp,
    │   │                                # TerminalApp, TextEditorApp, ImageViewerApp, CalculatorApp, AppStoreApp, ConsoleApp
    │   └── ui/                          # Adwaita-styled primitives: adw-split-view, window, icon-grid, dock, grouped-form, etc.
    ├── lib/
    │   ├── spatial-window-bounds.ts     # Spatial bounds key resolution & specificity lookup (per app/doc/URL)
    │   ├── desktop-icons.ts             # Compact spatial desktop grid math, Left/Right align, marquee & key nav
    │   ├── web-vfs.ts                   # Browser-backed POSIX VFS, Trash, generalized emblems & shared clipboard
    │   ├── fs-bridge.ts                 # Unified VFS / Domicile host filesystem operations
    │   ├── app-bridge.ts                # Typed postMessage RPC & theme sync bridge for isolated iframe apps
    │   ├── window-bounds.ts             # Viewport bounds clamping & workspace index safety
    │   ├── overview-layout.ts           # Window spread placement math for Overview
    │   ├── gnome/                       # Modular GNOME/Linux bridges (gsettings, audio, network, power, flatpak, wallpaper, gcc)
    │   ├── xdg-*.ts                     # XDG basedir, desktop entries, icon themes, app menus, session, trash
    │   ├── notifications.ts             # Pure notification policy, DND, timeout & persistence helpers
    │   ├── storage-cache.ts             # In-memory cached & debounced localStorage persistence
    │   ├── console-store.ts & csp-repl-eval.ts # Captured shell logs & CSP-safe DevTools REPL evaluator
    │   └── browser-domicile.ts          # Browser mock Domicile host
    └── styles/                          # Tailwind v4 + GNOME Adwaita design tokens (adwaita.css, globals.css)
```

---

## Key Subsystems

### 1. Layered State & Render Isolation (`src/context/DesktopStateContext.tsx`)

`DesktopStateProvider` composes four ordered layers:

`SettingsProvider` → `SystemBackendsProvider` → `WindowsLayer` (`AppsProvider` inside)

Notice `WindowsContext` is split into **state+actions (`WindowsContext`)** and **action-only (`WindowActionsContext`)** so shell components and isolated frames calling `useWindowActions()` do not re-render on every window focus or geometry tick.

### 2. Spatial Window Management (`src/context/WindowsContext.tsx`, `src/lib/spatial-window-bounds.ts`, `src/components/ui/window.tsx`, `src/components/shell/WindowManager.tsx`)

- **Spatial Persistence**: Window position, size, and workspace are persisted in `settings.savedWindowBounds` keyed by `resolveSpatialBoundsKey`:
  - `url:<origin><pathname>` for browser/web-app windows (ignoring ephemeral query strings and hashes),
  - `${appId}:${payload}` for document/folder-scoped apps (`nautilus`, `text-editor`, `image-viewer`, `terminal`),
  - `desktopId` or `appId` for standard apps, with specificity fallback via `lookupSpatialWindowBounds`.
- **Outer-Shadow Resize Targets & Dragging**: `[data-slot="window"]` uses `overflow-visible` (with clipping inside `WindowMain`) so top/bottom/left/right (`6px` outside + `6px` inside) and corner (`20×20` extending `7px` outside) resize handles sit over the window drop-shadow edge without clipping. Dragging and resizing apply `data-piloti-window-dragging` to keep pointer events smooth over iframes/webviews.
- **Workspace Persistence Without Iframe Reloads**: `WindowManager` renders all open windows in stable DOM order (`zIndex` handles stacking) and hides windows on inactive workspaces via CSS (`invisible pointer-events-none`, `aria-hidden`) instead of unmounting, preventing embedded web apps and documents from reloading on workspace switch.
- **Unified Frame & Tiling**: `WindowTitlebar` (`46px` height) supports titlebar double-click maximize/restore, right-click window menu, configurable GNOME `buttonLayout`, dock-aware `maximizeInsets`, edge snap tiling (`12px` sides, `10px` top) with pre-tile size restoration, and `WindowState.Maximized` / `TiledLeft` / `TiledRight` Wayland hints.

### 3. Startup Notifications & Ready-to-Show Reveal (`WindowsContext.tsx`, `IsolatedAppFrame.tsx`, `WindowManager.tsx`, `Dock.tsx`)

- **Dock Launch Indicators**: `launchApp`, `launchXdgApp`, and `openWebUrl` call `beginStartupNotification(...)` (resolving installed web app IDs and canonical `webview:<url>` entries in `Dock`). `Dock.resolveAppDefinition` recognizes catalog apps, XDG entries, installed web apps, running windows, and pending `webview:` URLs.
- **Ready-to-Show Gating**: Newly mapped Domicile browser/webview windows and HTTP-isolated shell apps (`calculator`, `text-editor`, `image-viewer`) start with `ready: false` (`unreadyWindowIds`, guarded by a `2500ms` timeout). `<Window>` mounts immediately (`opacity-0 pointer-events-none`) so the guest can load while staying invisible; `markWindowReady(windowId)` reveals the window and transitions the Dock indicator from launching bounce to running dot once `piloti:ready`, `<iframe onLoad>`, or `<webview>` finishes loading.

### 4. Isolated Mini-App Runtime & RPC Bridge (`IsolatedAppFrame.tsx`, `src/lib/app-bridge.ts`)

`calculator`, `text-editor`, and `image-viewer` run inside `IsolatedAppFrame`:
- Over HTTP/HTTPS dev servers, an `<iframe>` loads `?piloti_app=<id>&windowId=<id>&csd=<0|1>&path=<...>` as a dedicated entry point in `src/main.tsx`.
- Over standalone `file://` Domicile bundles, it falls back cleanly to an isolated iframe DOM mounted via `createRoot`.
- `useIsolatedAppBridge` receives `piloti:theme-sync` (mode, accent, fonts), `piloti:app-action` (menus, drag-region hover, dropped paths `piloti:open-path:<path>`), and executes bidirectional `piloti:fs-read` / `piloti:fs-write` / `piloti:fs-list` RPC against the shell VFS.

### 5. Virtual Filesystem, Generalized Emblems & Z-Order Drag-and-Drop (`src/lib/web-vfs.ts`, `src/lib/desktop-icons.ts`, `src/components/ui/icon-grid.tsx`, `FilesApp.tsx`, `DesktopIconsApp.tsx`)

- **VFS & Shared Clipboard**: `web-vfs.ts` provides `/home/user` POSIX paths, XDG folders, Trash/Restore, `copyVfsEntry`, `duplicateVfsEntry`, external file drop import, and module-shared cross-window clipboard (`getVfsClipboard` / `setVfsClipboard` / `subscribeVfsClipboard`) syncing cut/copy/paste across Desktop and multiple Files windows.
- **Generalized Emblems**: `VfsEmblemId` (`"favorite" | "important" | "work" | "personal"`) stores badges per normalized VFS path with prefix migration across rename, move, trash, restore, and permanent deletion, keeping legacy Favorites APIs (`loadVfsFavorites`, `toggleVfsFavorite`, `piloti://favorites`) 100% compatible.
- **Compact Desktop Grid & Bi-Directional DnD**: `desktop-icons.ts` uses compact `92×90` grid cells (`12px` padding) and supports Left and Right column-first placement (`settings.desktopIconAlign`). `IconGrid` supports multi-item drag with a stacked count ghost badge and walks `document.elementsFromPoint(...)` top-to-bottom (`resolveTopDropTarget`), respecting `[data-slot="window"]` z-order boundaries so drags cleanly route across Dock apps, Trash, sidebar places, folder rows/icons, Desktop, or `Text Editor` / `Image Viewer` drop targets without punching through unrelated windows.

### 6. Consistent Adwaita Split-View UI (`src/components/ui/adw-split-view.tsx`)

`AdwSplitView` encapsulates the collapsible `<aside>` navigation pattern shared by `SettingsApp`, `FilesApp`, and `AppStoreApp`:
- Automatic compact icon-rail collapse via `ResizeObserver` + compact hover tooltips,
- `<aside>` container preserving translucent `adwaita.css` CSD sidebar titlebar styling and scroll-triggered divider borders,
- Keyboard navigation integration (`useSidebarKeyboardNav`), configurable right headerbar, optional auxiliary `rightPane` (Files Info Inspector), and scoped bottom action/footer bar.

---

## Shell & Runtime API Reference

### 1. React Context Hooks (Inside Shell Components)

Import from `@/context/DesktopStateContext`:

- **Apps (`useApps()`)**: `installedXdgApps`, `getAppIconUrl(id)`, `launchXdgEntry(entry, actionId?)`, `refreshXdgApps()`.
- **Window Actions (`useWindowActions()`)**: `launchApp`, `launchXdgApp`, `openWebUrl`, `openGnomeSettings`, `focusWindow`, `closeWindow`, `forceQuitApp`, `minimizeWindow`, `toggleMinimizeWindow`, `toggleMaximizeWindow`, `tileWindow`, `updateWindowGeometry`, `moveWindowToWorkspace`, `markWindowReady`.
- **Windows (`useWindowManager()`)**: all of `useWindowActions()` plus `windows`, `workspaceWindows`, `mruWindows`, `waylandPopups`, `focusedWindow`, `focusedWindowId`, `launchingApps`, overview/launcher/alt-tab controls.
- **Settings (`useSettings()`)**: `settings: DesktopSettings` (`themeMode`, `accentColor`, `wallpaperId`, `desktopIconsEnabled`, `desktopIconAlign`, `savedWindowBounds`, etc.), `updateSettings(patch)`, `isBrowserRuntime`.
- **System Backends (`useSystemBackends()`)**: `batteryInfo`, `wifiNetworks`, `audioSinks`, `availableGnomePanels`, `gnomeCapabilities`, `notifications`, `capturing`, `locked`, plus `pushNotification`, `dismissNotification`, capture/lock/power actions.

### 2. Domicile SDK (`useDomicile()`)

| Domain | Common Calls / Properties |
| :--- | :--- |
| Windows | `domicile.windows.list`, `focused`, `focus(appId)`, `close(appId)`, `setBounds(appId, box)`, `setStates(appId, states)`, `requests()`, `on("change" \| "focuschange" \| "focusrequest", cb)` |
| Processes & Files | `domicile.processes.launch(argv, env?)`, `domicile.processes.run(argv)`, `domicile.files.readDir(path)`, `readText(path)`, `writeText(path, text)` |
| Displays & Theme | `domicile.displays.list`, `setBrightness(pct)`, `setColorTemperature(kelvin)`, `domicile.theme.set(mode)` |
| Session & Portals | `domicile.session.lock()`, `unlock(passphrase)`, `domicile.portals.requests()`, `domicile.capture.preview(target)` |

### 3. Piloti Console REPL

Open **DevTools / Piloti Console** (`Alt + Space` → `DevTools` or Menu Bar → `DevTools`) to inspect state or script the desktop live:
- **State**: `windows`, `focusedWindow`, `waylandPopups`, `apps`, `displays`, `browserWindows`, `settings`, `notifications`, `gnomeCapabilities`, `domicile`.
- **Actions**: `launchApp(id)`, `focusWindow(id)`, `closeWindow(id)`, `openWebUrl(url)`, `openGnomeSettings(panel?)`, `updateSettings(patch)`, `pushNotification(...)`, `await run(shellCmd)`, `$_`, `help()`, `clear()`.
