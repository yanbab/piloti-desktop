/**
 * Window Controls Overlay for app modules, until Domicile gives it natively:
 * the module draws its own titlebar, the shell lays its window controls over
 * it. The page learns the free part of the titlebar through the standard
 * `navigator.windowControlsOverlay` and `--titlebar-area-*` CSS variables (the
 * stand-in for `env(titlebar-area-*)`), and tells the shell where it can be
 * dragged, as `app-region: drag` would.
 *
 * Plain TypeScript: the module runtime installs it, the shell reads the drag
 * regions from the module's window state.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayGeometry {
  /** The shell draws window controls over the page's titlebar. */
  visible: boolean;
  /** Room the controls take at each side, in CSS pixels. */
  insets: { left: number; right: number };
  /** The titlebar's height. */
  height: number;
}

/** The part of the titlebar the page may use: between the controls. */
export function titlebarAreaRect(viewportWidth: number, g: OverlayGeometry): Rect {
  if (!g.visible) return { x: 0, y: 0, width: 0, height: 0 };
  const width = Math.max(0, viewportWidth - g.insets.left - g.insets.right);
  return { x: g.insets.left, y: 0, width, height: g.height };
}

const area = (r: Rect) => r.width * r.height;

/** `rect` minus `hole`: up to four pieces (above, below, left, right). */
export function subtractRect(rect: Rect, hole: Rect): Rect[] {
  const left = Math.max(rect.x, hole.x);
  const top = Math.max(rect.y, hole.y);
  const right = Math.min(rect.x + rect.width, hole.x + hole.width);
  const bottom = Math.min(rect.y + rect.height, hole.y + hole.height);
  if (left >= right || top >= bottom) return [rect];
  const pieces: Rect[] = [
    { x: rect.x, y: rect.y, width: rect.width, height: top - rect.y },
    { x: rect.x, y: bottom, width: rect.width, height: rect.y + rect.height - bottom },
    { x: rect.x, y: top, width: left - rect.x, height: bottom - top },
    { x: right, y: top, width: rect.x + rect.width - right, height: bottom - top },
  ];
  return pieces.filter((p) => p.width > 0 && p.height > 0);
}

/**
 * The regions that drag the window: `drag` minus `noDrag`, rounded to whole
 * pixels, slivers dropped, at most `max` of them (the largest).
 */
export function dragRegions(drag: readonly Rect[], noDrag: readonly Rect[], max = 16): Rect[] {
  let pieces = drag.map((r) => ({ ...r }));
  for (const hole of noDrag) pieces = pieces.flatMap((p) => subtractRect(p, hole));
  return pieces
    .map((r) => {
      const x = Math.round(r.x);
      const y = Math.round(r.y);
      return { x, y, width: Math.round(r.x + r.width) - x, height: Math.round(r.y + r.height) - y };
    })
    .filter((r) => r.width >= 4 && r.height >= 4)
    .sort((a, b) => area(b) - area(a))
    .slice(0, max);
}

/** Regions as sent to the shell: external data, checked. */
export function parseDragRegions(value: unknown): Rect[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rects: Rect[] = [];
  for (const raw of value.slice(0, 16)) {
    const r = raw as Partial<Rect> | null;
    if (
      r &&
      [r.x, r.y, r.width, r.height].every((n) => typeof n === "number" && Number.isFinite(n)) &&
      r.width! > 0 &&
      r.height! > 0
    ) {
      rects.push({ x: r.x!, y: r.y!, width: r.width!, height: r.height! });
    }
  }
  return rects;
}
