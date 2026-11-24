# Piloti Desktop on Native Linux / Domicile Wayland Engine

This document captures our verified findings, architectural boundaries, toolkit-specific Wayland window-management behavior, DRM/engine quirks, XDG specification coverage, and XDG Desktop Portal roadmap when running **Piloti Shell** natively on top of **Domicile** (`domicile-compositor` + `domicile-engine` under Chromium `--ozone-platform=drm`).

---

## 1. Architecture Split: Shell vs. Compositor vs. Engine

Piloti separates responsibilities across three layers:

1. **Domicile Engine (`/usr/libexec/domicile/engine/chrome --ozone-platform=drm`)**
   - Renders the shell DOM/React bundle (`dist/shell.js`) directly onto KMS/DRM planes and reads hardware input via `libinput`.
   - Embeds Wayland client surfaces as custom `<app>` DOM elements and webviews.
2. **Domicile Compositor (`domicile-compositor`)**
   - Rust/Smithay Wayland compositor managing `wayland-1` clients, `xdg_shell`, decoration negotiation (`zxdg_decoration_manager_v1` + `org_kde_kwin_server_decoration_manager`), popup surfaces, XDG Desktop Portal D-Bus backends, PipeWire casts, and IPC (`DOMICILE_SOCK`).
3. **Piloti Shell (`dist/shell.js` in this repo)**
   - Implements the desktop UX: `MenuBar`, `Dock`, `Launcher`, `Overview`, `WindowManager`, SSD frames (`<Window>`), `PortalDialogs`, `Notifications`, `LockScreen`, and native system bridges (`domicile.files`, `domicile.processes`, `dconf`/`gsettings`).

Because DOM pointer/focus events drive window bounds while Chromium forwards input to `<app>`, **every Wayland bug spans the boundary between toolkit -> compositor -> engine -> shell DOM**.

---

## 2. Wayland Window Management Across Toolkits & Apps

Verified live in Debian VM (`domicile 1.2.0-1`, `WAYLAND_DEBUG=1`, `/dev/uinput` mouse synthesis):

### GTK2 (e.g., `pcmanfm`)
- **Decorations**: Requests Server-Side Decorations via `org_kde_kwin_server_decoration.request_mode(2)` -> expects Piloti SSD `<WindowTitlebar>`.
- **Pitfall fixed**: `src/lib/xdg-desktop-entry.ts` previously matched `"gtk"` against `.desktop` `Categories=GTK;`, misclassifying `pcmanfm` as CSD (`prefersCsd = true`). Restricting `CSD_HINT_TOKENS` to `"gtk4"` / `"libadwaita"` and excluding `Categories` restored SSD cleanly.
- **Popups (`waylandPopups`)**: Menu popups on SSD windows offset from `titlebarHeight = 46` (matching `WindowTitlebar` `h-[46px]` in `src/context/WindowsContext.tsx`).

### GTK3 (e.g., `gnome-connections`, `gnome-disks`)
- **Decoration ping-pong bug *(Upstream Compositor Bug)***: GTK3 only speaks `org_kde_kwin_server_decoration_manager` (not `zxdg_decoration_manager_v1`) and requests `Client` (`request_mode(1)`). Because `domicile-compositor` `decorations.rs` unconditionally replies `Server` (`mode(2)`), GTK3 re-requests `request_mode(1)` in a tight infinite loop (82,876 messages observed in ~2.5s on `gnome-connections`), saturating CPU and input handling. Upstream fix: honor `KdeMode::Client` when requested.
- **Startup `unset_fullscreen` float bug *(Fixed in Shell)***: GTK3 apps (`gnome-connections`) emit `xdg_toplevel.unset_fullscreen()` at startup with no mouse button held. `heldPressRef` + `targetAppId` in `src/components/shell/WindowManager.tsx` drops client requests unless a matching active pointer press is held on that `<app>`.
- **CSD headerbar move**: GTK3 only emits `xdg_toplevel.move(seat, serial)` (unlike GTK4). `domicile 1.2.0-1` ignores `.move()`, though upstream `cprussin/domicile#2049` (`24b88fb`) added `WindowRequest::Move (5)` / `Resize (6)`. On `1.2.0-1`, `Alt` / `Meta` + drag (`modifierGrabActive`) works around this.

### GTK4 / Libadwaita (e.g., `nautilus`, GNOME apps)
- **CSD move quirk (`domicile 1.2.0-1` compatibility)**: GTK4 (`gdk_wayland_toplevel_begin_move`) calls both `xdg_toplevel.unset_fullscreen()` (`kind=3`) and `xdg_toplevel.move()` on headerbar drag. Accepting `WindowRequestKind.Unfullscreen` (`kind=3`) when `!targetWin.fullscreen` and `heldPressRef.current` matches `req.appId` restores headerbar dragging on `1.2.0-1`.
- **`setPointerCapture` pitfall *(Fixed in Shell)***: When `pointerdown` originated inside an `<app>` Wayland surface, calling `node.setPointerCapture(pointerId)` asynchronously from the IPC `subscribeClientWindowRequest` callback causes Chromium to fire `lostpointercapture` immediately, aborting the drag before any `pointermove`. Omitting `pointerId` on `handle.startMove` / `handle.startResize` routes client-initiated drags through `attachGlobalInteractionListeners()` (`window` capture listeners + `[data-piloti-window-dragging] app { pointer-events: none !important; }`).
- **Resize edge vs. header buttons**: Tightened `RESIZE_HANDLES` inward overlap in `src/components/ui/window.tsx` (`4px` corners, `3px` edges) so resize strips do not steal hits from CSD close/`+`/menu buttons.

### Browsers & Cross-Platform Toolkits (`firefox`, `chromium`, Qt, Electron)
- `firefox` & `chromium` emit valid `xdg_toplevel.move(seat, serial)` on tabstrip drag (`WAYLAND_DEBUG=1` verified), requiring `domicile >= PR #2049` (`kind=5`/`6`).
- `chromium` (`set_mode(1)`) hits the same `zxdg_toplevel_decoration_v1` `ServerSide` rejection loop if client mode is forced back to `ServerSide`.
- **GTK4/GTK3 App Styling**: Piloti Themes/Plugins can ship `gtk4.css` / `gtk3.css`, synced into `~/.config/gtk-4.0/gtk.css` and `~/.config/gtk-3.0/gtk.css` by `PluginsContext` via `syncManagedGtkCssFile`.

---

## 3. DRM / Ozone Engine Rendering & Cursor Findings

- **Cursor Hitbox Offset in VMware `vmwgfx` (`+6px, +4px`) *(Upstream Engine Bug)***:
  - Wayland `<app>` surface placement and `wl_pointer.motion` coordinates match DOM coordinates to `0.00px`.
  - Inspecting `/sys/kernel/debug/dri/0/state` (`plane[40]`) shows `domicile-engine` calls legacy `drmModeSetCursor` without passing `HOTSPOT_X` / `HOTSPOT_Y` (`drmModeSetCursor2`), while subtracting `(6, 4)` from `crtc-pos` (`-6-4` at `(0,0)`). On `vmwgfx` (and similar para-virtualized drivers), the host renders the arrow tip at `crtc-pos`, making actual clicks land **6px right and 4px down**.
  - **Upstream fix**: Enable `DRM_CLIENT_CAP_CURSOR_PLANE_HOTSPOT` / `drmModeSetCursor2` in `domicile-engine`'s Ozone DRM cursor plane backend.

---

## 4. What Implementing XDG Desktop Portals Means for Piloti

### Why Portals Exist and Who Does What
Under Wayland and sandboxed runtimes (Flatpak, Snap, restricted containers), applications **cannot** inspect the desktop tree, capture raw KMS buffers, open arbitrary files on the host, or bind global hotkeys directly. Instead, apps talk over session D-Bus to `org.freedesktop.portal.Desktop` (`xdg-desktop-portal`), which delegates interactive prompts and compositor actions to the backend:

```
Sandboxed/Wayland App
   │  D-Bus (org.freedesktop.portal.*)
   ▼
xdg-desktop-portal + domicile-compositor backend
   │  - enforces sandbox permissions & FDs
   │  - grants PipeWire streams / file handles / inhibit locks
   │  - pushes UI prompt requests over Domicile IPC
   ▼
Piloti Shell (`usePortalRequests()` -> `PortalDialogs.tsx`)
   │  - renders the Adwaita/Piloti dialog over the requesting `<app>` (`parentAppId`)
   │  - returns `domicile.portals.answer(id, PortalAnswer.*)`
   ▼
Domicile Compositor -> returns D-Bus response / handles to the app
```

**Division of work**:
- **Domicile** handles D-Bus interfaces, document/PipeWire/FD handoff, permission store, and screenshot/screencast frame capture.
- **Piloti** handles every user-facing chooser, confirmation dialog, preview, and session feedback UI via `@domicile-desktop/sdk/portal`.

### Portal Coverage in Piloti (`@domicile-desktop/sdk/portal`)

| Portal (`PortalKind`) | Compositor / SDK Support | Piloti Shell Status | Work Remaining / Polish |
| --- | --- | --- | --- |
| `Screenshot` | Captures frozen desktop + window list (`PortalAnswer.Screenshot` / `ScreenshotWindow`) | **Implemented** (`ScreenshotPortalOverlay`, Esc cancel, sound cue) | Optional annotation tools |
| `ScreenCast` | Enumerates monitors, windows & desktop frame preview (`CastSource`) | **Implemented** (`ScreenCastPortalDialog` with frame preview & monitor resolution badges) | Live per-window video thumbnails |
| `PickColor` | Samples desktop pixel at `(x, y)` | **Implemented** (`PickColorPortalOverlay` with live coordinate HUD & Esc cancel) | Magnified RGB hex loupe |
| `Access` / `Account` / `Wallpaper` / `InputCapture` / `Usb` | Rich typed request bodies (`AccessBody`, `AccountBody`, `WallpaperBody`, `UsbBody`, `InputCaptureBody`) | **Implemented** (`PermissionPortalDialog` with destructive styling, wallpaper preview, USB R/W badges, input device pills) | Per-app permission history in Settings |
| `Inhibit` | Compositor tracks active logout/suspend/switch inhibitors | **Implemented** (surfaced in `PowerActionDialog` & `ControlPanel`) | Optional per-inhibitor app focus jump |
| `FileChooser` | Sends `FileChooserMode` (`Open`, `Save`, `SaveFiles`), `filters`, `choices`, `multiple`, `directory` | **Implemented** (`FileChooserPortalDialog` with Places sidebar, hidden files toggle, `SaveFiles` summary, filters, custom `FileChoice` controls) | Thumbnail previews & inline search |
| `AppChooser` | Sends `choices`, `lastChoice`, `contentType`, `uri`, `filename` | **Implemented** (`AppChooserPortalDialog` backed by `xdg-desktop-entry.ts` + optional default persistence to `mimeapps.list`) | Category filter for all installed apps |
| `GlobalShortcuts` | Sends proposed shortcuts & `taken` chords | **Implemented** (`GlobalShortcutsPortalDialog` with interactive key-chord capture, clear button & `taken` conflict badges) | Persistent shortcut overview in Settings |
| `DynamicLauncher` | App installation prompt (`LauncherBody`) | **Implemented** (`DynamicLauncherPortalDialog` with icon/target preview & editable name) | Auto-pin option |
| `RemoteDesktop` | Device + clipboard control grant (`RemoteDesktopBody`) | **Implemented** (`RemoteDesktopPortalDialog` with keyboard/pointer/touchscreen/clipboard toggles) | Active remote session indicator |
| `Print` | Printer/options & Save-to-PDF request | **Implemented** (`PrintPortalDialog` with printer list, copies & PDF path) | Page range / duplex / orientation controls |

### Additional Portal / D-Bus Specs Outside `PortalKind`
- **Secret / Password (`org.freedesktop.portal.Secret` + `org.freedesktop.secrets`)**: Prompt/unlock keyring cleanly on login (`LockScreen`) so apps (`chromium`, `git`, `gnome-connections`, `nm-applet`) do not block on uninitialized secret collections.
- **Notification (`org.freedesktop.portal.Notification`)**: Route action button callbacks (`invokeNotificationAction`), inline replies, and priority hints between sandboxed apps and Piloti `NotificationToasts` / Control Panel.
- **Documents (`org.freedesktop.portal.Documents`) & OpenURI (`OpenURI`)**: Compositor/portal-managed FUSE exports (`/run/user/1000/doc/...`) for Flatpak file access and delegating `OpenURI` via `xdg-mimeapps.ts` / `AppChooser`.
- **Contacts & Location**: Permission dialogs + privacy toggles in Settings (`Privacy` / Control Panel).
- **Power / Session Lifecycle**: `Inhibit` integration + `org.freedesktop.login1` suspend/hibernate/shutdown feedback alongside the fast fade-to-black exit overlay (`sessionExiting`).

---

## 5. XDG Specifications & Display Manager Coverage

### Currently Implemented in Piloti (`src/lib/xdg/` & `src/lib/engine-desktop/`)
- **XDG Base Directory Specification** (`src/lib/xdg/xdg-basedir.ts`)
- **XDG Desktop Entry Specification** + Desktop Actions (`src/lib/xdg/xdg-desktop-entry.ts`)
- **XDG Icon Theme Specification** + `Piloti` (Lottie `animated/` + `scalable/`), `Papirus`, `Adwaita`, `hicolor` (`src/lib/xdg/xdg-icon-theme.ts`)
- **XDG MIME Applications (`mimeapps.list`) & Shared MIME-info (`globs2` / magic sniffing)** (`src/lib/xdg/xdg-mimeapps.ts`)
- **XDG User Directories (`user-dirs.dirs`)** (`src/lib/xdg/xdg-user-dirs.ts`)
- **XDG Trash Specification (`.trashinfo`)** (`src/lib/xdg/xdg-trash.ts`)
- **Global Menus (`org.gtk.Actions`, `org.gtk.Menus`, and `com.canonical.dbusmenu`)** (`src/lib/xdg/xdg-app-menu.ts`)
- **XDG Session Window Restore** (`src/lib/xdg/xdg-session-management.ts`)
- **Custom Web App `.desktop` Entries** (`src/lib/xdg/xdg-web-apps.ts`)
- **XDG Autostart (`/etc/xdg/autostart` + `~/.config/autostart`)** (`src/lib/xdg/xdg-autostart.ts`, launched once per Wayland session via `src/lib/engine-desktop/autostart.ts`, managed in Settings -> Advanced)
- **XDG Recent Files (`~/.local/share/recently-used.xbel`)** (`src/lib/xdg/xdg-recents.ts`, wired into `fs-bridge.ts` & `FilesApp`)
- **XDG Thumbnail Managing Standard (`~/.cache/thumbnails/{large,normal}/<md5>.png`)** (`src/lib/xdg/xdg-thumbnails.ts`, wired into `fs-bridge.ts` for Linux files)
- **XDG Sound Theme Cues** (`src/lib/sound-effects.ts`, wired into screenshot & trash-empty actions)
- **Display Manager / `greetd` Greeter Replacement** (`src/piloti-greeter.tsx` -> `dist/greeter.js`, `src/lib/engine-desktop/greeter.ts`, `/usr/bin/piloti-greeter`, `/usr/libexec/piloti-desktop/piloti-greetd-client`, `/usr/share/piloti-desktop/greetd.toml`)

### Remaining Useful Specs & Polish
1. **Secret Service (`org.freedesktop.secrets`) & Keyring Auto-Unlock**: Ensure PAM/`greetd` session startup unlocks `gnome-keyring-daemon` automatically so apps (`chromium`, `git`, `nm-applet`) never stall on locked keyrings.
2. **Thumbnail Generation Worker**: Generate and write missing `~/.cache/thumbnails/normal/<md5>.png` entries on demand in addition to reading existing system thumbnails.
3. **Full `org.freedesktop.portal.Documents` / Contacts / Location privacy controls**: Expose per-app portal permission toggles in Desktop Settings.
4. **System Sound Theme OGG/OGA playback**: Load system sound theme files from `/usr/share/sounds/freedesktop/stereo/` when available, falling back to synthesized Web Audio cues.

