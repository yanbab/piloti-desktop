/**
 * Floating windows: free-moving surfaces that live above normal windows, like
 * the launcher and Picture-in-Picture (panels such as the dock and menu bar
 * are another kind).
 *
 * They can go anywhere inside their bounds. Near an edge they snap to it; past
 * an edge they meet growing resistance (rubber band) and settle back inside
 * on release. Coordinates are plain rectangles in one space (viewport or
 * window stage); callers pick the bounds.
 */

export interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Gap kept between a floating window and the screen edges (main menu gap). */
export const FLOATING_EDGE_MARGIN = 6;
/** Distance under which a floating window snaps to an edge. */
export const FLOATING_SNAP_DISTANCE = 28;
/** Rubber-band stiffness: lower is stiffer. */
const RUBBER_BAND = 0.55;

/** Bounds inside an area, with the floating margin on every side. */
export function floatingBounds(
  area: FloatingRect,
  margin = FLOATING_EDGE_MARGIN
): FloatingRect {
  return {
    x: area.x + margin,
    y: area.y + margin,
    width: Math.max(0, area.width - margin * 2),
    height: Math.max(0, area.height - margin * 2),
  };
}

/** How far an overshoot of `overflow` px actually moves (iOS-style curve). */
export function rubberBand(overflow: number, dimension: number): number {
  if (overflow <= 0 || dimension <= 0) return 0;
  return (1 - 1 / ((overflow * RUBBER_BAND) / dimension + 1)) * dimension;
}

function axisRange(start: number, length: number, size: number) {
  return { min: start, max: Math.max(start, start + length - size) };
}

function snapAxis(value: number, min: number, max: number, distance: number): number {
  if (Math.abs(value - min) <= distance) return min;
  if (Math.abs(value - max) <= distance) return max;
  return value;
}

function resistAxis(value: number, min: number, max: number, size: number): number {
  if (value < min) return min - rubberBand(min - value, size);
  if (value > max) return max + rubberBand(value - max, size);
  return value;
}

/** Position while dragging: snap near edges, resist past them. */
export function floatingDragPosition(
  rect: FloatingRect,
  bounds: FloatingRect,
  snapDistance = FLOATING_SNAP_DISTANCE
): { x: number; y: number } {
  const h = axisRange(bounds.x, bounds.width, rect.width);
  const v = axisRange(bounds.y, bounds.height, rect.height);
  const x = resistAxis(snapAxis(rect.x, h.min, h.max, snapDistance), h.min, h.max, rect.width);
  const y = resistAxis(snapAxis(rect.y, v.min, v.max, snapDistance), v.min, v.max, rect.height);
  return { x: Math.round(x), y: Math.round(y) };
}

/** Position on release: back inside the bounds, snapped to close edges. */
export function settleFloatingPosition(
  rect: FloatingRect,
  bounds: FloatingRect,
  snapDistance = FLOATING_SNAP_DISTANCE
): { x: number; y: number } {
  const h = axisRange(bounds.x, bounds.width, rect.width);
  const v = axisRange(bounds.y, bounds.height, rect.height);
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  return {
    x: Math.round(snapAxis(clamp(rect.x, h.min, h.max), h.min, h.max, snapDistance)),
    y: Math.round(snapAxis(clamp(rect.y, v.min, v.max), v.min, v.max, snapDistance)),
  };
}

// ── Resizing (aspect ratio kept: the content is scaled, not reflowed) ───────

export type FloatingEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const FLOATING_EDGE_CURSORS: Record<FloatingEdge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/** The edge or corner under a point, if it is within `grip` px of the border. */
export function floatingEdgeAt(
  rect: FloatingRect,
  px: number,
  py: number,
  grip = 8
): FloatingEdge | null {
  const n = py - rect.y <= grip;
  const s = rect.y + rect.height - py <= grip;
  const w = px - rect.x <= grip;
  const e = rect.x + rect.width - px <= grip;
  const vertical = n ? "n" : s ? "s" : "";
  const horizontal = w ? "w" : e ? "e" : "";
  return ((vertical + horizontal) || null) as FloatingEdge | null;
}

/**
 * Resizes from an edge or corner by a pointer delta, keeping the aspect ratio
 * (height / width) and the opposite side in place.
 */
export function resizeFloatingRect(
  start: FloatingRect,
  edge: FloatingEdge,
  dx: number,
  dy: number,
  limits: { minWidth: number; maxWidth: number }
): FloatingRect {
  const ratio = start.width > 0 ? start.height / start.width : 1;
  const fromX = edge.includes("e") ? dx : edge.includes("w") ? -dx : 0;
  const fromY = (edge.includes("s") ? dy : edge.includes("n") ? -dy : 0) / ratio;
  // Corners follow whichever axis the pointer moved most.
  const grow = Math.abs(fromX) >= Math.abs(fromY) ? fromX : fromY;
  const width = Math.round(
    Math.min(limits.maxWidth, Math.max(limits.minWidth, start.width + grow))
  );
  const height = Math.round(width * ratio);
  const x = edge.includes("w") ? start.x + start.width - width : start.x;
  const y = edge.includes("n") ? start.y + start.height - height : start.y;
  return { x, y, width, height };
}
