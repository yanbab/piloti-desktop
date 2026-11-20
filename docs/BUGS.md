# Wayland & Desktop Tracking (`docs/BUGS.md`)

Tracks Wayland client behavior, CSD/SSD detection, and upstream `domicile` protocol alignment on Linux (`domicile 1.2.0-1`).

---

## Active & Recently Fixed Issues

### 1. `pcmanfm` (GTK2) rendered without SSD titlebar
- **Symptom**: `pcmanfm` opened with no server-side titlebar and could not be moved cleanly.
- **Root Cause**: `src/lib/xdg-desktop-entry.ts` included `"gtk"` in `CSD_HINT_TOKENS` and scanned `Categories` (`Categories=GTK;System;Core;FileTools;FileManager;`), causing GTK2 apps to falsely resolve `prefersCsd = true` even when Domicile's `xdg-decoration` reported `clientFrame = false`.
- **Fix** (*fixed*): Replaced `"gtk"` with `"gtk4"` in `CSD_HINT_TOKENS` and stopped matching `.desktop` `Categories` against CSD hints, so `clientFrame = false` + GTK2 apps reliably receive Piloti's SSD titlebar.

### 2. GTK3 CSD apps (`gnome-connections`, `gnome-disks`) & browsers (`firefox`, `chromium`) fail to move or stick on click
- **Symptoms**:
  - `gnome-connections` / `gnome-disks`: resizing via window edges and clicking headerbar buttons works, but dragging the headerbar fails to move or leaves the window stuck following the pointer after mouse release until the next click.
  - `firefox` / `chromium`: dragging the CSD tab/titlebar does not move the window.
- **Root Causes**:
  1. **Missing `heldPress` guard**: When a Wayland client sends `xdg_toplevel.move` (`WindowRequestKind.Move = 5`) asynchronously after a quick click, the shell started `startMove()` even if `pointerup` had already fired — causing the window to stay stuck in drag mode until the next click (`WRITING-A-SHELL.md`: *"A request that comes after the release has nothing to drag; drop it"*).
  2. **Missing `pointerId` & `setPointerCapture`**: `WindowHandle.startMove` / `startResize` in `src/components/ui/window.tsx` omitted `pointerId`, so `beginDrag` / `beginResize` fell back to global listeners without calling `node.setPointerCapture(pointerId)` to take pointer ownership away from `<app>`.
  3. **SDK version mismatch**: Published `@domicile-desktop/sdk@next` (`0.0.0-alpha-b8fdaae89ce9`) omitted `WindowRequestKind.Move` (`5`), `Resize` (`6`), and `ResizeEdge`, which exist in `domicile 1.2.0-1` (added upstream in `cprussin/domicile#2049`, commit `24b88fb`).
- **Fixes Applied** (*testing in VM*):
  - Track active `heldPressRef` (`pointerId`, `button`, `clientX`, `clientY`) in capture phase in `WindowManager.tsx` and drop `Move`/`Resize` requests when `!heldPressRef.current`.
  - Pass `held.pointerId` into `WindowHandle.startMove` / `startResize` -> `node.setPointerCapture(pointerId)` in `src/components/ui/window.tsx`.
  - Use `rawReq.kind === 5` for `Move` (stop aliasing `Unfullscreen` kind `3` to `Move`, which caused false drags).
- **Remaining Check**: Verify in VM with live `firefox` / `chromium` / `gnome-connections` / `gnome-disks` whether `firefox`/`chromium` emit `Move` (`kind: 5`) cleanly or if `domicile-compositor`'s `hand_the_press_to_the_shell` drops subsurfaces/press serials under any client.

### 3. Upstream `domicile-builder` notes (`cprussin/domicile`)
- Passing source `desktop.tsx` triggers `domicile-builder` (`bun add` fails on `@/` tsconfig path aliases).
- Always build `dist/shell.js` with `npm run build:shell` (`inlineDynamicImports: true`) and point `~/.config/domicile/domicile.json` to `dist/shell.js`.
