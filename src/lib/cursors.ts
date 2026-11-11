import type { CursorShape } from "@domicile-desktop/sdk/cursor-shape";

/**
 * Encodes an SVG string (with explicit 24x24 pixel dimensions and active tip
 * anchored at `(0, 0)`) into a CSS `cursor: url("data:image/svg+xml,...") 0 0, fallback`
 * declaration.
 *
 * Why `(0, 0)` hotspot-anchored cursors are required on Linux (`ozone/drm` + `vmwgfx`):
 * Chromium's `CrtcController::SetCursor` (`ui/ozone/platform/drm/gpu/crtc_controller.cc`)
 * calls the legacy `drmModeSetCursor(fd, crtc, handle, width, height)` ioctl instead of
 * `drmModeSetCursor2(..., hot_x, hot_y)`. On VMware (`vmwgfx`) and QEMU (`virtio-gpu`)
 * with host mouse integration (`vmmouse`), the hypervisor intercepts `drmModeSetCursor`
 * and creates a host OS cursor with hotspot `(0, 0)` (the top-left corner of the bitmap),
 * ignoring the guest's `drmModeMoveCursor` hotspot subtraction.
 *
 * Because Chromium's built-in 24x24 Lottie cursor (`ui_lottie_resources.grd`) and XCursor
 * themes pad the arrow tip inside the 24x24 canvas around `(6, 4)`–`(7, 7)` (and `(10, 4)`
 * for `pointer` or `(12, 12)` for `*-resize`), the visible cursor tip appears shifted
 * down-right while clicks register at `(0, 0)` of the cursor bitmap.
 *
 * By anchoring the visual tip of each SVG cursor right at `(0, 0)` AND declaring CSS
 * hotspot `0 0`, both `DrmCursor` (`location_ - (0, 0)`) and `vmwgfx` (`hot_x = 0, hot_y = 0`)
 * place `(0, 0)` of the bitmap at the exact pointer coordinate `(clientX, clientY)`.
 */
function svgCursor(svgBody: string, fallback: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">${svgBody}</svg>`;
  const encoded = svg
    .replace(/%/g, "%25")
    .replace(/#/g, "%23")
    .replace(/"/g, "'")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/\s+/g, " ")
    .trim();
  return `url("data:image/svg+xml,${encoded}") 0 0, ${fallback}`;
}

/**
 * Standard arrow cursor (`default` / `auto`) with tip at `(0.5, 0.5)`.
 */
export const CURSOR_DEFAULT = svgCursor(
  `<path d="M0.6 0.6L0.6 17.2L4.8 13.1L7.8 19.8L10.3 18.6L7.3 12.0L13.2 12.0L0.6 0.6Z" fill="#111318" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round"/>`,
  "default"
);

/**
 * Interactive link / button cursor (`pointer`) with index fingertip at `(0.8, 0.8)`
 * so clicking buttons, switches, and links registers at the exact tip.
 */
export const CURSOR_POINTER = svgCursor(
  `<path d="M1 1L1 14.5L4.5 11.2L7.4 17.6L9.9 16.4L7.0 10.1L12.2 10.1L1 1Z" fill="#111318" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round"/><circle cx="15.5" cy="5.5" r="2.6" fill="#3584E4" stroke="#FFFFFF" stroke-width="1.1"/>`,
  "pointer"
);

/**
 * Text I-beam cursor (`text`) with top crossbar center anchored at `(1, 1)`.
 */
export const CURSOR_TEXT = svgCursor(
  `<path d="M0.5 1H6.5M3.5 1V16M0.5 16H6.5" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/><path d="M0.5 1H6.5M3.5 1V16M0.5 16H6.5" stroke="#111318" stroke-width="1.3" stroke-linecap="round"/>`,
  "text"
);

/**
 * Window drag / grab cursor (`grab` / `move`) with tip at `(0.6, 0.6)`.
 */
export const CURSOR_GRAB = svgCursor(
  `<path d="M0.6 0.6L0.6 15.8L4.4 12.1L7.2 18.2L9.5 17.1L6.7 11.1L12.1 11.1L0.6 0.6Z" fill="#111318" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round"/><path d="M16 12V19M12.5 15.5H19.5M16 12L14 14M16 12L18 14M16 19L14 17M16 19L18 17" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12V19M12.5 15.5H19.5M16 12L14 14M16 12L18 14M16 19L14 17M16 19L18 17" stroke="#111318" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`,
  "grab"
);

/**
 * Active window dragging cursor (`grabbing`) with tip at `(0.6, 0.6)`.
 */
export const CURSOR_GRABBING = svgCursor(
  `<path d="M0.6 0.6L0.6 15.8L4.4 12.1L7.2 18.2L9.5 17.1L6.7 11.1L12.1 11.1L0.6 0.6Z" fill="#3584E4" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round"/>`,
  "grabbing"
);

/**
 * Horizontal resize cursor (`ew-resize` / `col-resize` / `e-resize` / `w-resize`)
 * with active pointer tip at `(0.8, 0.8)` so 5px window resize borders hit-test accurately.
 */
export const CURSOR_EW_RESIZE = svgCursor(
  `<path d="M0.8 0.8L5.5 0.8L0.8 5.5Z" fill="#3584E4"/><path d="M2 7H17M2 7L5.8 3.5M2 7L5.8 10.5M17 7L13.2 3.5M17 7L13.2 10.5" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 7H17M2 7L5.8 3.5M2 7L5.8 10.5M17 7L13.2 3.5M17 7L13.2 10.5" stroke="#111318" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  "ew-resize"
);

/**
 * Vertical resize cursor (`ns-resize` / `row-resize` / `n-resize` / `s-resize`)
 * with active pointer tip at `(0.8, 0.8)` so 5px window resize borders hit-test accurately.
 */
export const CURSOR_NS_RESIZE = svgCursor(
  `<path d="M0.8 0.8L5.5 0.8L0.8 5.5Z" fill="#3584E4"/><path d="M7 2V17M7 2L3.5 5.8M7 2L10.5 5.8M7 17L3.5 13.2M7 17L10.5 13.2" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 2V17M7 2L3.5 5.8M7 2L10.5 5.8M7 17L3.5 13.2M7 17L10.5 13.2" stroke="#111318" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  "ns-resize"
);

/**
 * Diagonal NW-SE resize cursor (`nwse-resize` / `nw-resize` / `se-resize`)
 * with top-left arrow tip at `(1, 1)`.
 */
export const CURSOR_NWSE_RESIZE = svgCursor(
  `<path d="M1.2 1.2L15.5 15.5M1.2 1.2H7.2M1.2 1.2V7.2M15.5 15.5H9.5M15.5 15.5V9.5" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.2 1.2L15.5 15.5M1.2 1.2H7.2M1.2 1.2V7.2M15.5 15.5H9.5M15.5 15.5V9.5" stroke="#111318" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  "nwse-resize"
);

/**
 * Diagonal NE-SW resize cursor (`nesw-resize` / `ne-resize` / `sw-resize`)
 * with active tip indicator at `(0.8, 0.8)`.
 */
export const CURSOR_NESW_RESIZE = svgCursor(
  `<path d="M0.8 0.8L5.5 0.8L0.8 5.5Z" fill="#3584E4"/><path d="M15.5 2.5L2.5 15.5M15.5 2.5H9.5M15.5 2.5V8.5M2.5 15.5H8.5M2.5 15.5V9.5" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 2.5L2.5 15.5M15.5 2.5H9.5M15.5 2.5V8.5M2.5 15.5H8.5M2.5 15.5V9.5" stroke="#111318" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  "nesw-resize"
);

/**
 * Not-allowed / disabled cursor (`not-allowed` / `no-drop`) with tip at `(0.6, 0.6)`.
 */
export const CURSOR_NOT_ALLOWED = svgCursor(
  `<path d="M0.6 0.6L0.6 15.8L4.4 12.1L7.2 18.2L9.5 17.1L6.7 11.1L12.1 11.1L0.6 0.6Z" fill="#111318" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round"/><circle cx="16.5" cy="16.5" r="5" fill="#E01B24" stroke="#FFFFFF" stroke-width="1.2"/><path d="M13.5 13.5L19.5 19.5" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>`,
  "not-allowed"
);

/**
 * Crosshair cursor (`crosshair`) anchored at `(1, 1)`.
 */
export const CURSOR_CROSSHAIR = svgCursor(
  `<path d="M1 1V11M1 1H11" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/><path d="M1 1V11M1 1H11" stroke="#111318" stroke-width="1.3" stroke-linecap="round"/>`,
  "crosshair"
);

const CURSOR_MAP: Record<string, string> = {
  none: "none",
  default: CURSOR_DEFAULT,
  auto: CURSOR_DEFAULT,
  "context-menu": CURSOR_DEFAULT,
  help: CURSOR_DEFAULT,
  progress: CURSOR_DEFAULT,
  wait: CURSOR_DEFAULT,
  pointer: CURSOR_POINTER,
  alias: CURSOR_POINTER,
  copy: CURSOR_POINTER,
  text: CURSOR_TEXT,
  "vertical-text": CURSOR_TEXT,
  grab: CURSOR_GRAB,
  move: CURSOR_GRAB,
  "all-scroll": CURSOR_GRAB,
  grabbing: CURSOR_GRABBING,
  "ew-resize": CURSOR_EW_RESIZE,
  "e-resize": CURSOR_EW_RESIZE,
  "w-resize": CURSOR_EW_RESIZE,
  "col-resize": CURSOR_EW_RESIZE,
  "ns-resize": CURSOR_NS_RESIZE,
  "n-resize": CURSOR_NS_RESIZE,
  "s-resize": CURSOR_NS_RESIZE,
  "row-resize": CURSOR_NS_RESIZE,
  "nwse-resize": CURSOR_NWSE_RESIZE,
  "nw-resize": CURSOR_NWSE_RESIZE,
  "se-resize": CURSOR_NWSE_RESIZE,
  "nesw-resize": CURSOR_NESW_RESIZE,
  "ne-resize": CURSOR_NESW_RESIZE,
  "sw-resize": CURSOR_NESW_RESIZE,
  "not-allowed": CURSOR_NOT_ALLOWED,
  "no-drop": CURSOR_NOT_ALLOWED,
  crosshair: CURSOR_CROSSHAIR,
  cell: CURSOR_CROSSHAIR,
};

/**
 * Maps a Domicile Wayland cursor shape (`DomicileCursorShape`) or CSS cursor
 * keyword to a `(0, 0)` hotspot-aligned SVG `url(...) 0 0` cursor declaration.
 */
export function resolveCursorStyle(
  shape: CursorShape | string | undefined
): string {
  if (!shape) return CURSOR_DEFAULT;
  return CURSOR_MAP[shape] ?? CURSOR_DEFAULT;
}
