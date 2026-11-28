/** Where a dragged view or window would land. */
import { fitsIn, minSize } from "./geometry";
import { insertSurface } from "./tree";
import type { DropZone, LayoutMetrics, LayoutNode, MinSizeOf, Rect, Side, SurfaceId } from "./types";

/** Share of a view, from each edge, that splits instead of adding a tab. */
export const DROP_EDGE_BAND = 0.25;
/** Distance from a screen edge that sends a window into the mosaic. */
export const SCREEN_EDGE_THRESHOLD = 24;

const inside = (r: Rect, p: { x: number; y: number }) =>
  p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;

/** The zone of `rect` under `point`: its nearest edge within the band, else the center. */
export function dropZoneAt(rect: Rect, point: { x: number; y: number }, band = DROP_EDGE_BAND): DropZone | null {
  if (!inside(rect, point) || rect.width <= 0 || rect.height <= 0) return null;
  const fx = (point.x - rect.x) / rect.width;
  const fy = (point.y - rect.y) / rect.height;
  const edges: Array<[Side, number]> = [
    ["left", fx],
    ["right", 1 - fx],
    ["top", fy],
    ["bottom", 1 - fy],
  ];
  const [side, distance] = edges.reduce((a, b) => (b[1] < a[1] ? b : a));
  return distance < band ? side : "center";
}

/** The rectangle a drop would take, for the preview. */
export function dropPreviewRect(rect: Rect, zone: DropZone): Rect {
  const halfW = Math.round(rect.width / 2);
  const halfH = Math.round(rect.height / 2);
  switch (zone) {
    case "center":
      return rect;
    case "left":
      return { ...rect, width: halfW };
    case "right":
      return { ...rect, x: rect.x + rect.width - halfW, width: halfW };
    case "top":
      return { ...rect, height: halfH };
    case "bottom":
      return { ...rect, y: rect.y + rect.height - halfH, height: halfH };
  }
}

/** The screen edge under `point` that sends a window into the mosaic (not the bottom: the Dock). */
export function screenEdgeAt(
  area: Rect,
  point: { x: number; y: number },
  threshold = SCREEN_EDGE_THRESHOLD,
): Exclude<Side, "bottom"> | null {
  if (point.x <= area.x + threshold) return "left";
  if (point.x >= area.x + area.width - threshold) return "right";
  if (point.y <= area.y + threshold) return "top";
  return null;
}

/**
 * The tree after the drop, if every view still gets its smallest size in
 * `frame`; `null` when the drop makes no sense or would not fit (the zone
 * then stays off).
 */
export function fittingDrop(
  root: LayoutNode,
  frame: Pick<Rect, "width" | "height">,
  target: SurfaceId,
  surface: SurfaceId,
  zone: DropZone,
  minOf: MinSizeOf,
  metrics: LayoutMetrics,
  index?: number,
): LayoutNode | null {
  const next = insertSurface(root, target, surface, zone, index);
  if (!next) return null;
  return fitsIn(minSize(next, minOf, metrics), frame) ? next : null;
}
