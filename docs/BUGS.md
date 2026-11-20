# Wayland & Desktop Tracking (`docs/BUGS.md`)

Tracks Wayland client behavior, CSD/SSD detection, and upstream `domicile` protocol alignment on the Linux VM (`debian@192.168.162.236`, running `domicile 1.2.0-1`, built 2026-11-10).

---

## Summary: What Needs Fixes Where?

| Issue | Status | Level | Notes |
| --- | --- | --- | --- |
| `pcmanfm` (GTK2) missing SSD titlebar | **Fixed & Verified in VM** | **Piloti shell** | Fixed `"gtk"` token matching `Categories=GTK;` in `src/lib/xdg-desktop-entry.ts`. |
| `gnome-connections` moving on launch & sticking on click | **Fixed & Verified** | **Piloti shell** | App emits `unset_fullscreen` (`kind=3`) at startup; stopped aliasing `3 -> 5` (`Move`) and added `heldPressRef` + `setPointerCapture(pointerId)`. |
| Dragging CSD headerbars (`gnome-connections`, `gnome-disks`, `firefox`, `chromium`) does not move window | **Solved Upstream (not in `1.2.0-1` APT yet)** | **Domicile upgrade** (`>= PR #2049`) | `1.2.0-1` drops `xdg_toplevel.move` (`WindowRequestKind` only has `0..3`). Upstream solved this on 2026-11-12 in `cprussin/domicile#2049` (`24b88fb`). Piloti already supports `Move (5)` / `Resize (6)`. **Workaround**: `Alt` / `Meta` + drag. |
| GTK3 (`gnome-connections`, `gnome-disks`, `firefox`) tight `request_mode(1)` <-> `mode(2)` loop | **Open Upstream Bug** | **Domicile compositor** (`decorations.rs`) | `domicile-compositor` always replies `Server` (`2`) to `org_kde_kwin_server_decoration.request_mode(Client=1)`, causing thousands of Wayland roundtrips per second. |
| Cursor target offset a few pixels down-right in VM + corner/popup alignment | **Partial Fix (Shell) / Upstream Engine Bug (`vmwgfx` DRM hotspot)** | **Domicile engine** + **Piloti shell** | `domicile-engine` (`chrome --ozone-platform=drm`) subtracts `(6, 4)` in `crtc-pos` but calls legacy `drmModeSetCursor` without `HOTSPOT_X/Y` (`drmModeSetCursor2`), making VMware `vmwgfx` render the host arrow tip at `(x-6, y-4)` so targets land `(+6, +4)` down-right. Shell fixes: reduced `RESIZE_HANDLES` inward overlap (`13px` -> `4px` corners, `6px` -> `3px` edges) and fixed SSD popup `titlebarHeight` (`32px` -> `46px`). |

---

## Detailed Findings & Verification

### 1. `pcmanfm` (GTK2) rendered without SSD titlebar *(Fixed & Verified in VM)*
- **Symptom**: `pcmanfm` opened with no server-side titlebar and could not be moved cleanly.
- **Root Cause**: `src/lib/xdg-desktop-entry.ts` included `"gtk"` in `CSD_HINT_TOKENS` and scanned `.desktop` `Categories`. `/usr/share/applications/pcmanfm.desktop` has `Categories=GTK;System;Core;FileTools;FileManager;`, causing `pcmanfm` to resolve `prefersCsd = true` despite GTK2 expecting SSD (`org_kde_kwin_server_decoration.request_mode(2)` -> `mode(2)`).
- **Fix**: Replaced `"gtk"` with `"gtk4"` in `CSD_HINT_TOKENS` and excluded `.desktop` `Categories` from CSD hint matching (`src/lib/xdg-desktop-entry.ts`, tested in `tests/unit/xdg-desktop.test.ts`).
- **VM Verification (`a685ccb`)**: Launched `pcmanfm` under `WAYLAND_DEBUG=1` on `wayland-1`, took `domicile screenshot`, and simulated a real pointer drag via `/dev/uinput` across its Piloti SSD titlebar. Confirmed Piloti dark SSD titlebar rendered and dragged cleanly (`vm-pcm-ok1.png` -> `vm-pcm-ok2.png`).

### 2. GTK3 CSD apps (`gnome-connections`, `gnome-disks`) & browsers (`firefox`, `chromium`) fail to move *(Shell fixes applied; Compositor needs post-`1.2.0-1` upgrade)*
- **Symptoms**:
  - `gnome-connections` moved on its own after launch and stuck on click; buttons & outer resize edges worked.
  - `gnome-connections`, `gnome-disks`, `firefox`, and `chromium` render CSD cleanly, buttons/resize work, but dragging their CSD headerbars/tabstrips does not move the window.
- **Root Causes (Verified via `WAYLAND_DEBUG=1` + `/dev/uinput` mouse simulation + VM package inspection)**:
  1. **Startup float (`Unfullscreen` aliasing — Shell bug, Fixed)**: `gnome-connections` sends `xdg_toplevel.unset_fullscreen()` on launch. Previously `WindowManager.tsx` aliased `WindowRequestKind.Unfullscreen (3)` to `Move (5)` without checking whether a pointer button was pressed, putting the window into drag mode until the next click.
  2. **Missing `heldPress` & `setPointerCapture` (`WindowManager.tsx` / `window.tsx` — Shell bug, Fixed)**: Updated `WindowHandle.startMove` / `startResize` to take `pointerId` -> `node.setPointerCapture(pointerId)`, and added capture-phase `heldPressRef` so stale `Move`/`Resize` requests after release are dropped per `cprussin/domicile/docs/WRITING-A-SHELL.md`.
  3. **`domicile 1.2.0-1` predates upstream `cprussin/domicile#2049` (`24b88fb`)**:
     - Under `WAYLAND_DEBUG=1` + `/dev/uinput` mouse drag, **all tested CSD apps already emit valid `xdg_toplevel.move(seat, serial)` requests**:
       - `gnome-connections`: `wl_pointer.button(3488, ..., 272, 1)` -> `xdg_toplevel#37.move(wl_seat#21, 3488)` -> `wl_pointer.button(3522, ..., 272, 0)` (press never handed off).
       - `firefox`: `wl_pointer.button(3724, ..., 272, 1)` -> `xdg_toplevel#53.move(wl_seat#21, 3724)` -> `wl_pointer.button(3756, ..., 272, 0)`.
       - `chromium`: `wl_pointer.button(4004, ..., 272, 1)` -> `xdg_toplevel#45.move(wl_seat#13, 4004)` -> `wl_pointer.button(4039, ..., 272, 0)`.
     - Inspected VM `/usr/libexec/domicile/workspace/packages/chrome-sdk/dist/window-state.js` and `/usr/bin/domicile-compositor` (`1.2.0-1`, built `2026-11-10`): `WindowRequestKind` only defines `Maximize (0)`, `Unmaximize (1)`, `Fullscreen (2)`, `Unfullscreen (3)`. Upstream PR `#2049` (`24b88fb`, merged `2026-11-12`) added `hand_the_press_to_the_shell` and `WindowRequest::Move (5)` / `Resize (6)`, so `1.2.0-1` drops `xdg_toplevel.move` completely (and `apt-cache policy domicile` currently stops at `1.2.0-1`, while CI packages on GitHub Releases include `2026-11-19` builds).
- **Workaround on `domicile 1.2.0-1`**: Hold `Alt` or `Meta` (`Super`) and drag anywhere on a CSD window (`modifierGrabActive` in `WindowManager.tsx`). Outer Piloti resize edges work normally.

### 3. GTK3 `org_kde_kwin_server_decoration` ping-pong loop *(Needs upstream `domicile-compositor` fix)*
- **Symptom**: High CPU usage and input sluggishness/stutter on GTK3 apps (`gnome-connections`, `gnome-disks`, `firefox`).
- **Root Cause**:
  - GTK3 only supports `org_kde_kwin_server_decoration_manager` (not `zxdg_decoration_manager_v1`), and requests `Client` decorations (`request_mode(1)`).
  - Upstream `domicile-compositor/src/decorations.rs` (`DomicileCompositor::request_mode`) unconditionally sends `decoration.mode(KdeMode::Server)` (`mode(2)`), and similarly `zxdg_toplevel_decoration_v1.configure(ServerSide = 2)` (observed with Chromium `set_mode(1)` -> `configure(2)`).
  - GTK3 sees the server reply `mode(2)` and immediately re-requests `request_mode(1)` in a tight infinite loop:
    - `gnome-connections`: **82,876** `request_mode(1)` messages in ~2.5s (`165,510` total Wayland log lines).
    - `gnome-disks`: **6,642** `request_mode(1)` messages in ~2.5s (`13,424` total log lines).
    - `firefox`: repeats `request_mode(1)` <-> `mode(2)` throughout startup/renders.
- **Required Fix (Upstream `domicile-compositor`)**: In `packages/domicile-compositor/src/decorations.rs`, honor `KdeMode::Client` (and `XdgDecorationMode::ClientSide`) when requested (or avoid forcing `KdeMode::Server` in response to `request_mode(Client)`), instead of unconditionally rejecting client mode and fighting GTK3's decoration negotiation.

### 4. Cursor target offset down-right (`+6px, +4px` in VMware VM) & button/popup hitboxes
- **Symptoms**: Visual arrow cursor lands above-left of the actual click/hover target, making small buttons and window borders feel ~5px down-right.
- **Root Causes Verified in Live VM**:
  1. **Wayland surface geometry & pointer routing are exact (`0.00px` error)**:
     - Pixel scan of `domicile screenshot` matches `setBounds` and `<app>.getBoundingClientRect()` to `0.00px` (`gnome-connections`: `23, 59, 738x341`; `pcmanfm`: `125, 315, 640x334`).
     - DOM `pointerdown` relative to `<app>` matches `WAYLAND_DEBUG=1` `wl_pointer.motion` to `0.00px` before and after resize (`pcmanfm` at `(449.28, 411.70)` -> `(449.28 - 125, 411.70 - 315) = (324.28, 96.70)` = exact `wl_pointer.motion(324.28, 96.70)`; `gnome-connections` with `set_window_geometry(20, 20)` at `(216.51, 194.90)` -> `(213.51, 155.90)` = exact `wl_pointer.motion`).
  2. **VMware `vmwgfx` DRM cursor hotspot missing in `domicile-engine` *(Upstream Engine Bug)***:
     - Inspected `/sys/kernel/debug/dri/0/state` (`plane[40]`, `allocated by = DrmThread`) while moving the pointer via `/dev/uinput`:
       - At DOM `(0, 0)`: `crtc-pos=64x64-6-4` (no `HOTSPOT_X` / `HOTSPOT_Y`).
       - At DOM `(220.79, 220.79)`: `crtc-pos=64x64+214+216` (`-6, -4`).
       - At DOM `(532.44, 305.64)`: `crtc-pos=64x64+526+301` (`-6, -4`).
     - `/usr/libexec/domicile/engine/chrome` uses `drmModeSetCursor` (never `drmModeSetCursor2` or atomic `HOTSPOT_X`/`HOTSPOT_Y`). Chromium Ozone DRM subtracts the pointer asset's hotspot `(6, 4)` from `crtc-pos` while leaving DRM `hot_x=0, hot_y=0`. On para-virtualized drivers (`vmwgfx`, `virtio-gpu`, `qxl`), the hypervisor places the host cursor tip at `crtc-pos` (`(x-6, y-4)`), causing every click/hover to land **`6px` right and `4px` down** of the displayed arrow tip (and centered resize cursors shift even further when active).
     - **Upstream fix needed**: In `domicile-engine`'s Ozone DRM backend (`crtc_controller` / `hardware_display_plane_manager`), call `drmModeSetCursor2` / pass `HOTSPOT_X` & `HOTSPOT_Y` with `DRM_CLIENT_CAP_CURSOR_PLANE_HOTSPOT`.
  3. **Shell hitbox/popup fixes *(Fixed in Piloti)***:
     - `RESIZE_HANDLES` in `src/components/ui/window.tsx` overlapped `13px` inward at corners (`-top-[7px] -right-[7px] size-5`) and `6px` along edges, stealing pointer hits from CSD close/`+`/menu buttons near window corners; moved handles mostly outward (`4px` inward at corners, `3px` along edges, `8-9px` outward).
     - `waylandPopups` in `src/context/WindowsContext.tsx` hardcoded `titlebarHeight = 32` for SSD windows while `WindowTitlebar` is `h-[46px]`, placing SSD Wayland menus `14px` too high; updated to `46`.

### 5. Upstream `domicile-builder` notes (`cprussin/domicile`)
- Passing source `desktop.tsx` triggers `domicile-builder` (`bun add` fails on `@/` tsconfig path aliases).
- Always build `dist/shell.js` with `npm run build:shell` (`inlineDynamicImports: true`) and point `~/.config/domicile/domicile.json` to `dist/shell.js`.
