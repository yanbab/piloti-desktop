# Upstream Issues

## 1. GTK3 `org_kde_kwin_server_decoration` tight `request_mode(1)` loop

Repository cprussin/domicile

**Title:** `domicile-compositor: Unconditional Server decoration response causes infinite request_mode(1) loop in GTK3 apps`

**Environment:** `domicile 1.2.0-1` on Debian (`wayland-1`)  
**Affected apps:** GTK3 clients (`gnome-connections`, `gnome-disks`, `firefox`), Chromium (`zxdg_decoration_manager_v1`)

**Description**  
`DomicileCompositor::request_mode` (`packages/domicile-compositor/src/decorations.rs`) unconditionally replies with `KdeMode::Server` (`mode(2)`) even when a client explicitly requests client-side decorations (`request_mode(1)`), and sends `zxdg_toplevel_decoration_v1.configure(ServerSide=2)` when Chromium calls `set_mode(1)`.

GTK3 only implements `org_kde_kwin_server_decoration_manager` (not `zxdg_decoration_manager_v1`). Because it refuses server mode on CSD windows, it responds to `mode(2)` by immediately re-sending `request_mode(1)` in a tight infinite loop, causing heavy CPU usage and input stutter:

- `gnome-connections`: **82,876** `request_mode(1)` messages in ~2.5s (`165,510` Wayland debug lines)
- `gnome-disks`: **6,642** `request_mode(1)` messages in ~2.5s (`13,424` Wayland debug lines)
- `firefox`: repeats `request_mode(1)` <-> `mode(2)` throughout startup and rendering

**Expected behavior**  
Honor `KdeMode::Client` / `XdgDecorationMode::ClientSide` when explicitly requested by a client instead of forcing `Server` mode.

---

## 2. Ozone DRM cursor missing hotspot (`HOTSPOT_X` / `HOTSPOT_Y`)

Repository cprussin/domicile

**Title:** `domicile-engine: Ozone DRM cursor misses hotspot (HOTSPOT_X/Y), shifting clicks down-right on para-virtualized GPUs (vmwgfx / virtio-gpu / qxl)`

**Environment:** `domicile 1.2.0-1` inside a VMware Linux VM (`vmwgfx` DRM driver)

**Description**  
When running `domicile-engine` (`chrome --ozone-platform=drm`), Wayland surface bounds and `wl_pointer.motion` coordinates match DOM pointer coordinates with `0.00px` error, but the visible cursor tip is offset up-left relative to where clicks and hovers actually land.

Inspecting `/sys/kernel/debug/dri/0/state` (`plane[40]`, `allocated by = DrmThread`) while moving the pointer confirms `crtc-pos` subtracts the arrow hotspot `(6, 4)` without setting DRM cursor hotspot properties:
- At DOM `(0, 0)`: `crtc-pos=64x64-6-4`
- At DOM `(220.79, 220.79)`: `crtc-pos=64x64+214+216`
- At DOM `(532.44, 305.64)`: `crtc-pos=64x64+526+301`

Because `/usr/libexec/domicile/engine/chrome` uses legacy `drmModeSetCursor` without passing `HOTSPOT_X` / `HOTSPOT_Y` (via `drmModeSetCursor2` or atomic plane properties + `DRM_CLIENT_CAP_CURSOR_PLANE_HOTSPOT`), para-virtualized DRM drivers (`vmwgfx`, `virtio-gpu`, `qxl`) leave `hot_x=0, hot_y=0` and position the host cursor tip at `(x - 6, y - 4)`. As a result, pointer events land **6px right and 4px down** from the rendered cursor tip (and resize cursors with centered hotspots shift even further).

**Expected behavior**  
Pass `HOTSPOT_X` / `HOTSPOT_Y` (`drmModeSetCursor2` or atomic cursor hotspot properties with `DRM_CLIENT_CAP_CURSOR_PLANE_HOTSPOT`) from the Ozone DRM backend so hypervisor cursor planes render at the true hotspot.

