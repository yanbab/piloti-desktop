# Architecture

One React tree (shell + built-in apps) runs on two engines. For where things are in the code, see the Map in [AGENT-GUIDE.md](./AGENT-GUIDE.md).

## Engines and ports

- **Native** (`src/piloti-desktop.tsx`, `src/lib/engine-native/`): the Wayland session. Mounted inside Domicile's compositor; real windows are `<app>` surfaces; Linux services come from Domicile's `@domicile-desktop/system-*` libraries, D-Bus, gsettings and `processes.run`.
- **Web** (`src/piloti-web.tsx`, `src/lib/engine-web/`): the browser demo on `createBrowserDomicile()` (fake host, in-browser VFS, simulated hardware). Builds to `docs/demo/`.
- Each entry point calls `setEngine()` (`src/lib/engine/engine.ts`) with capability flags `realFilesystem`, `systemServices`, `simulatedHardware`. Shared code asks `useCapabilities()` / `getEngine().capabilities`, not which engine it is on (older code still checks `isBrowserRuntime`; those spots are marked `FIXME : Capabilities`).
- Files: the VFS (`web-vfs.ts`) is the only copy in the demo and a memory cache of the disk on native. Every operation goes through `FileService` (`src/lib/core/file-service.ts`) over a `FileStore` port (`src/lib/ports/`); on native `engine-native/native-file-store.ts` implements it (`mv`, `cp`, `gio`).
- The native bundle never imports the web engine or the demo tree (`piloti-web.tsx` injects the seed with `setVfsSeed`).
- Built-in apps (Settings, Folders, Terminal, Text Editor, Image Viewer, Calculator, App Store, Camera, Desktop Console, spatial Desktop) run in the shell next to Wayland/XDG windows and web view windows. Heavier apps can be separate Domicile modules: see [APP-MODULES.md](./APP-MODULES.md).

Other references: [NATIVE.md](./NATIVE.md) (Wayland toolkits, portals, XDG coverage), [GNOME-REUSE.md](./GNOME-REUSE.md) (GNOME services we reuse), [PLUGINS.md](./PLUGINS.md), [ICONS.md](./ICONS.md), [WEB-APPS.md](./WEB-APPS.md) (web apps that work in the demo).

---

## Key Subsystems

### 1. Layered State & Render Isolation (`src/context/DesktopStateContext.tsx`)

`DesktopStateProvider` composes four ordered layers:

`SettingsProvider` → `SystemBackendsProvider` → `WindowsLayer` (`AppsProvider` inside)

Notice `WindowsContext` is split into **state+actions (`WindowsContext`)** and **action-only (`WindowActionsContext`)** so shell components and isolated frames calling `useWindowActions()` do not re-render on every window focus or geometry tick.

### 2. Spatial Window Management (`src/context/WindowsContext.tsx`, `src/lib/shell/spatial-window-bounds.ts`, `src/components/ui/window.tsx`, `src/components/shell/WindowManager.tsx`)

- **Spatial Persistence**: Window position, size, and workspace are persisted in `settings.savedWindowBounds` keyed by `resolveSpatialBoundsKey`:
  - `url:<origin><pathname>` for browser/web-app windows (ignoring ephemeral query strings and hashes),
  - `${appId}:${payload}` for document/folder-scoped apps (`nautilus`, `text-editor`, `image-viewer`, `terminal`),
  - `desktopId` or `appId` for standard apps, with specificity fallback via `lookupSpatialWindowBounds`.
- **Outer-Shadow Resize Targets & Dragging**: `[data-slot="window"]` uses `overflow-visible` (with clipping inside `WindowMain`) so top/bottom/left/right (`6px` outside + `6px` inside) and corner (`20×20` extending `7px` outside) resize handles sit over the window drop-shadow edge without clipping. Dragging and resizing apply `data-piloti-window-dragging` to keep pointer events smooth over iframes/webviews.
- **Workspace Persistence Without Iframe Reloads**: `WindowManager` renders all open windows in stable DOM order (`zIndex` handles stacking) and hides windows on inactive workspaces via CSS (`invisible pointer-events-none`, `aria-hidden`) instead of unmounting, preventing embedded web apps and documents from reloading on workspace switch.
- **Unified Frame & Tiling**: `WindowTitlebar` (`46px` height) supports titlebar double-click maximize/restore, right-click window menu, configurable GNOME `buttonLayout`, dock-aware `maximizeInsets`, edge snap tiling (`12px` sides, `10px` top) with pre-tile size restoration, and `WindowState.Maximized` / `TiledLeft` / `TiledRight` Wayland hints.

### 3. Startup Notifications & Ready-to-Show Reveal (`WindowsContext.tsx`, `IsolatedAppFrame.tsx`, `WindowManager.tsx`, `Dock.tsx`)

- **Dock Launch Indicators**: `launchApp`, `launchXdgApp`, and `openWebUrl` call `beginStartupNotification(...)` (resolving installed web app IDs and canonical `webview:<url>` entries in `Dock`). `Dock.resolveAppDefinition` recognizes catalog apps, XDG entries, installed web apps, running windows, and pending `webview:` URLs.
- **Ready-to-Show Gating**: Newly mapped Domicile browser/webview windows and an isolated `text-editor` start with `ready: false` (`unreadyWindowIds`, guarded by a `2500ms` timeout). `<Window>` mounts immediately (`opacity-0 pointer-events-none`) so the guest can load while staying invisible; `markWindowReady(windowId)` reveals the window and transitions the Dock indicator from launching bounce to running dot once `piloti:ready`, `<iframe onLoad>`, or `<webview>` finishes loading.

### 4. Isolated Mini-App Runtime & RPC Bridge (`IsolatedAppFrame.tsx`, `src/lib/engine/app-bridge.ts`)

`text-editor`, when set to open windows separately, runs inside `IsolatedAppFrame`:
- Over HTTP/HTTPS dev servers, an `<iframe>` loads `?piloti_app=<id>&windowId=<id>&csd=<0|1>&path=<...>` as a dedicated entry point in `src/piloti-web.tsx`.
- Over standalone `file://` Domicile bundles, it falls back cleanly to an isolated iframe DOM mounted via `createRoot`.
- `useIsolatedAppBridge` receives `piloti:theme-sync` (mode, accent, fonts), `piloti:app-action` (menus, drag-region hover, dropped paths `piloti:open-path:<path>`), and executes bidirectional `piloti:fs-read` / `piloti:fs-write` / `piloti:fs-list` RPC against the shell VFS.

### 5. Virtual Filesystem, Generalized Emblems & Z-Order Drag-and-Drop (`src/lib/engine-web/web-vfs.ts`, `src/lib/shell/desktop-icons.ts`, `src/components/ui/icon-grid.tsx`, `FilesApp.tsx`, `DesktopIconsApp.tsx`)

- **VFS & Shared Clipboard**: `web-vfs.ts` provides `/home/user` POSIX paths, XDG folders, Trash/Restore, `copyVfsEntry`, `duplicateVfsEntry`, external file drop import, and module-shared cross-window clipboard (`getVfsClipboard` / `setVfsClipboard` / `subscribeVfsClipboard`) syncing cut/copy/paste across Desktop and multiple Files windows.
- **Generalized Emblems**: `VfsEmblemId` (`"favorite" | "important" | "work" | "personal"`) stores badges per normalized VFS path with prefix migration across rename, move, trash, restore, and permanent deletion, keeping legacy Favorites APIs (`loadVfsFavorites`, `toggleVfsFavorite`, `piloti://favorites`) 100% compatible.
- **Compact Desktop Grid & Bi-Directional DnD**: `desktop-icons.ts` uses compact `92×90` grid cells (`12px` padding) and supports Left and Right column-first placement (`settings.desktopIconAlign`). `IconGrid` supports multi-item drag with a stacked count ghost badge and walks `document.elementsFromPoint(...)` top-to-bottom (`resolveTopDropTarget`), respecting `[data-slot="window"]` z-order boundaries so drags cleanly route across Dock apps, Trash, sidebar places, folder rows/icons, Desktop, or `Text Editor` / `Image Viewer` drop targets without punching through unrelated windows.

### 6. Consistent Adwaita Split-View UI (`src/components/ui/adw-split-view.tsx`)

`AdwSplitView` encapsulates the collapsible `<aside>` navigation pattern shared by `SettingsApp`, `FilesApp`, and `AppStoreApp`:
- Automatic compact icon-rail collapse via `ResizeObserver` + compact hover tooltips,
- `<aside>` container preserving translucent `adwaita.css` CSD sidebar titlebar styling and scroll-triggered divider borders,
- Keyboard navigation integration (`useSidebarKeyboardNav`), configurable right headerbar, optional auxiliary `rightPane` (Files Info Inspector), and scoped bottom action/footer bar.
