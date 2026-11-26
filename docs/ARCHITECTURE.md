# Architecture

One React tree (shell and built-in apps) runs on two engines. For where things are in the code, see the Map in [AGENT-GUIDE.md](./AGENT-GUIDE.md).

Also: [PILOTI-API.md](./PILOTI-API.md), [APP-MODULES.md](./APP-MODULES.md), [GNOME-REUSE.md](./GNOME-REUSE.md), [PLUGINS.md](./PLUGINS.md), [ICONS.md](./ICONS.md), [WEB-APPS.md](./WEB-APPS.md).

## Engines

| | Native | Web |
|---|---|---|
| Entry | `src/piloti-desktop.tsx` | `src/piloti-web.tsx` |
| Code | `src/lib/engine-native/` | `src/lib/engine-web/` |
| Host | Domicile compositor | `createBrowserDomicile()`, builds to `docs/demo/` |
| Files (`piloti.vfs`) | the disk: `domicile.files`, coreutils, `gio`; shared folder watches | `web-vfs.ts` (localStorage, IndexedDB) |
| System | `@domicile-desktop/system-*`, D-Bus, gsettings, `processes.run` | simulated |

- Each entry calls `setEngine()` (`lib/engine/engine.ts`) with `realFilesystem`, `systemServices` and `simulatedHardware`. Shared code checks capabilities, not the engine. Older `isBrowserRuntime` checks are marked `FIXME : Capabilities`.
- Config and state files are read synchronously (`engine/vfs-state.ts`); natively from a store that follows the disk.
- The native bundle never imports the web engine or the demo seed (`setVfsSeed`).
- Built-in apps run in the shell. Heavier apps can be separate Domicile modules.

## Native layers

1. **Domicile engine** (Chromium on DRM): renders `dist/shell.js`, reads input, embeds Wayland clients as `<app>` elements.
2. **Domicile compositor** (Rust/Smithay): Wayland, `xdg_shell`, decorations, portal backends, IPC.
3. **Piloti shell**: the desktop UI and system bridges.

The DOM drives window bounds while the engine forwards input to `<app>`, so a Wayland bug can sit in the toolkit, compositor, engine or shell.

## Shell

**State.** `DesktopStateProvider` nests settings, system backends, then windows and apps. Window actions have their own context (`useWindowActions()`), so focus and geometry changes don't re-render their users.

**Windows**
- Bounds and workspace are saved in `settings.savedWindowBounds`, keyed by URL (without query or hash), app + document, or app (`spatial-window-bounds.ts`).
- Windows keep a stable DOM order; other workspaces are hidden with CSS, so iframes don't reload.
- `data-piloti-window-dragging` keeps drags smooth over iframes and `<app>`.
- New webview and isolated windows stay invisible until ready (2.5 s limit); the Dock shows them launching.

**Isolated apps.** Text Editor in a separate window runs in `IsolatedAppFrame`: an iframe over HTTP, a `createRoot` in an iframe under `file://`. `engine/app-bridge.ts` carries theme, menu actions and file calls.

**Web VFS.** Provides `/home/user`, XDG folders, Trash, a clipboard shared across windows, and per-path emblems that follow renames and moves.

**UI.** `adw-split-view.tsx` is the sidebar layout of Settings, Folders and App Store. `icon-grid.tsx` handles icon drags; drop targets respect window stacking.

## Wayland toolkit notes

Observed in a Debian VM with `domicile 1.2.0-1`; recheck on newer releases.

| Client | Behaviour | Status |
|---|---|---|
| GTK2 | Wants server-side decorations. `GTK` in `Categories` must not imply CSD. | Fixed |
| GTK3 | Asks for client decorations, compositor always answers server: endless loop, high CPU. | Compositor bug |
| GTK3 | Sends `unset_fullscreen` at startup. Requests are ignored unless a pointer press is held on that app. | Fixed |
| GTK3, Firefox, Chromium | Move only with `xdg_toplevel.move`, which 1.2.0-1 ignores. Needs `cprussin/domicile#2049`. | Alt/Super + drag |
| GTK4 | Headerbar drag also sends `unset_fullscreen`, accepted as a move. | Worked around |
| Any `<app>` | `setPointerCapture` is lost at once for client-started drags; use window listeners. | Fixed |
| Any CSD | Wide resize strips steal headerbar button clicks; keep inward overlap small. | Fixed |

**Cursor offset (VMware `vmwgfx`).** Clicks land 6 px right and 4 px down: the engine sets the DRM cursor without its hotspot. Engine bug; the fix is `drmModeSetCursor2`.

**GTK styling.** Plugins can ship `gtk3.css` and `gtk4.css`, synced to `~/.config/gtk-*/gtk.css`.

## Portals

Apps call `org.freedesktop.portal.*`. Domicile handles D-Bus, permissions, streams and capture. Piloti draws the dialog (`PortalDialogs.tsx`) and replies with `portals.answer(id, answer)`.

Implemented: Screenshot, ScreenCast, PickColor, Access, Account, Wallpaper, InputCapture, USB, Inhibit, FileChooser, AppChooser, GlobalShortcuts, DynamicLauncher, RemoteDesktop, Print.

## XDG coverage

In `src/lib/xdg/`: base directories, desktop entries and actions, icon themes, `mimeapps.list` and shared MIME info, user directories, trash, recent files, thumbnails (read), autostart, session restore, web app entries and global menus (GTK and dbusmenu).

Elsewhere: sound cues (`lib/shell/sound-effects.ts`) and a `greetd` greeter (`src/piloti-greeter.tsx`).

## Open items

- Unlock the keyring at login (Secret Service).
- Generate missing thumbnails.
- Documents, OpenURI, Contacts and Location portals; per-app permission settings.
- Notification portal actions and replies.
- Play the system sound theme.
- Portal polish: window thumbnails in ScreenCast, colour loupe, FileChooser search, print page range and duplex.
