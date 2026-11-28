/**
 * Placing widgets of several sizes on a fixed grid, the way the desktop places
 * icons: the dragged one takes the cells it is dropped on and those in the way
 * move to the nearest free place. Pure.
 */

import type { GridCoord } from "@/core/files/desktop-icons";

export interface WidgetSize {
  cols: number;
  rows: number;
}

export type WidgetLayout<Id extends string> = Record<Id, GridCoord>;

function overlaps(a: GridCoord, as: WidgetSize, b: GridCoord, bs: WidgetSize): boolean {
  return (
    a.col < b.col + bs.cols &&
    b.col < a.col + as.cols &&
    a.row < b.row + bs.rows &&
    b.row < a.row + as.rows
  );
}

/**
 * `layout` with `id` on `target` (kept inside the grid), or `layout` itself
 * when the others would not all fit.
 */
export function placeWidget<Id extends string>(
  layout: WidgetLayout<Id>,
  sizes: Record<Id, WidgetSize>,
  id: Id,
  target: GridCoord,
  cols: number,
  rows: number,
): WidgetLayout<Id> {
  const cell = {
    col: Math.max(0, Math.min(cols - sizes[id].cols, target.col)),
    row: Math.max(0, Math.min(rows - sizes[id].rows, target.row)),
  };
  const placed: [Id, GridCoord][] = [[id, cell]];
  const free = (other: Id, at: GridCoord) =>
    placed.every(([p, pos]) => !overlaps(at, sizes[other], pos, sizes[p]));

  const displaced: Id[] = [];
  for (const other of Object.keys(layout) as Id[]) {
    if (other === id) continue;
    if (free(other, layout[other])) placed.push([other, layout[other]]);
    else displaced.push(other);
  }
  // The largest first: they have the fewest places to go.
  const area = (w: Id) => sizes[w].cols * sizes[w].rows;
  displaced.sort((a, b) => area(b) - area(a));
  for (const other of displaced) {
    const from = layout[other];
    let best: GridCoord | null = null;
    let bestDistance = Infinity;
    for (let row = 0; row <= rows - sizes[other].rows; row++) {
      for (let col = 0; col <= cols - sizes[other].cols; col++) {
        const distance = Math.abs(col - from.col) + Math.abs(row - from.row);
        if (distance < bestDistance && free(other, { col, row })) {
          best = { col, row };
          bestDistance = distance;
        }
      }
    }
    if (!best) return layout;
    placed.push([other, best]);
  }
  return Object.fromEntries(placed) as WidgetLayout<Id>;
}

/** `id:col,row;…`, for a settings file. */
export function formatWidgetLayout(layout: WidgetLayout<string>): string {
  return Object.entries(layout)
    .map(([id, { col, row }]) => `${id}:${col},${row}`)
    .join(";");
}

/** The saved layout, or `fallback` when it is incomplete or no longer fits. */
export function parseWidgetLayout<Id extends string>(
  raw: string | undefined,
  fallback: WidgetLayout<Id>,
  sizes: Record<Id, WidgetSize>,
  cols: number,
  rows: number,
): WidgetLayout<Id> {
  const saved = new Map<string, GridCoord>();
  for (const part of (raw ?? "").split(";")) {
    const match = /^\s*([\w-]+):(\d+),(\d+)\s*$/.exec(part);
    if (match) saved.set(match[1]!, { col: Number(match[2]), row: Number(match[3]) });
  }
  const ids = Object.keys(fallback) as Id[];
  const valid = ids.every((id, i) => {
    const at = saved.get(id);
    return (
      at &&
      at.col + sizes[id].cols <= cols &&
      at.row + sizes[id].rows <= rows &&
      ids.slice(0, i).every((o) => !overlaps(at, sizes[id], saved.get(o)!, sizes[o]))
    );
  });
  return valid
    ? (Object.fromEntries(ids.map((id) => [id, saved.get(id)!])) as WidgetLayout<Id>)
    : fallback;
}
