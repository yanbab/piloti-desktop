import type { XdgDesktopEntry } from "@/core/xdg/xdg-desktop-entry";

export type IconGridMode = "spatial" | "flow";

export type DesktopIconAlign = "left" | "right";

export type DesktopIconKind = "directory" | "file" | "desktop-entry";

export type AppSymbolName =
  | "settings"
  | "terminal"
  | "folder"
  | "globe"
  | "notes"
  | "activity"
  | "code"
  | "sparkles";

export interface GridCoord {
  col: number;
  row: number;
}

export interface GridMetrics {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  padding: number;
}

export interface IconGridItem {
  id: string;
  name: string;
  /** Key in saved layouts when it isn't `name` (launchers keep their file name). */
  layoutKey?: string;
  kind: DesktopIconKind;
  path: string;
  iconName: AppSymbolName;
  iconCandidates?: readonly string[];
  iconUrl?: string;
  isEmpty?: boolean;
  isHidden?: boolean;
  /** Symbolic link (shown with an arrow emblem). */
  isSymlink?: boolean;
  /** Absolute path a symbolic link points to. */
  symlinkTarget?: string;
  accessCount?: number;
  /** A file's size in bytes. */
  size?: number;
  modifiedMs?: number;
  thumbnailUrl?: string;
  desktopEntry?: XdgDesktopEntry;
}

export const DESKTOP_ICON_CELL_WIDTH = 96;
export const DESKTOP_ICON_CELL_HEIGHT = 100;
export const DESKTOP_GRID_PADDING = 12;

export function coordKey(coord: GridCoord): string {
  return `${coord.col}:${coord.row}`;
}

export function clampCoord(
  coord: GridCoord,
  cols: number,
  rows: number
): GridCoord {
  return {
    col: Math.max(0, Math.min(Math.max(1, cols) - 1, Math.round(coord.col))),
    row: Math.max(0, Math.min(Math.max(1, rows) - 1, Math.round(coord.row))),
  };
}

export function computeGridMetrics(
  containerWidth: number,
  containerHeight: number,
  cellWidth = DESKTOP_ICON_CELL_WIDTH,
  cellHeight = DESKTOP_ICON_CELL_HEIGHT,
  padding = DESKTOP_GRID_PADDING,
  /**
   * Share the leftover space between the cells, so the grid reaches both
   * edges: icons on the last column sit as far from the right edge as the
   * first ones from the left (the desktop). Cells stay equal.
   */
  stretch = false
): GridMetrics {
  const usableWidth = Math.max(cellWidth, containerWidth - padding * 2);
  const usableHeight = Math.max(cellHeight, containerHeight - padding * 2);
  const cols = Math.max(1, Math.floor(usableWidth / cellWidth));
  const rows = Math.max(1, Math.floor(usableHeight / cellHeight));
  return {
    cols,
    rows,
    cellWidth: stretch ? usableWidth / cols : cellWidth,
    cellHeight: stretch ? usableHeight / rows : cellHeight,
    padding,
  };
}

function findNearestFreeCell(
  preferred: GridCoord,
  occupied: ReadonlySet<string>,
  cols: number,
  rows: number
): GridCoord {
  const start = clampCoord(preferred, cols, rows);
  if (!occupied.has(coordKey(start))) return start;

  const maxRadius = Math.max(cols, rows) + 2;
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
        const col = start.col + dc;
        const row = start.row + dr;
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const candidate = { col, row };
        if (!occupied.has(coordKey(candidate))) return candidate;
      }
    }
  }

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows * 4; row++) {
      const candidate = { col, row };
      if (!occupied.has(coordKey(candidate))) return candidate;
    }
  }

  return start;
}

/**
 * Assigns sparse (col, row) coordinates for desktop items, preserving valid
 * saved positions and auto-placing new items column-first top-to-bottom.
 */
export function assignGridPositions(
  items: readonly Pick<IconGridItem, "id">[],
  savedPositions: Readonly<Record<string, GridCoord>>,
  cols: number,
  rows: number,
  align: DesktopIconAlign = "left"
): Record<string, GridCoord> {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(1, rows);
  const occupied = new Set<string>();
  const resolved: Record<string, GridCoord> = {};

  for (const item of items) {
    const saved = savedPositions[item.id];
    if (!saved) continue;
    const cell = findNearestFreeCell(saved, occupied, safeCols, safeRows);
    resolved[item.id] = cell;
    occupied.add(coordKey(cell));
  }

  let nextCol = align === "right" ? safeCols - 1 : 0;
  let nextRow = 0;
  for (const item of items) {
    if (resolved[item.id]) continue;
    while (occupied.has(coordKey({ col: nextCol, row: nextRow }))) {
      nextRow += 1;
      if (nextRow >= safeRows) {
        nextRow = 0;
        nextCol += align === "right" ? -1 : 1;
      }
      if (nextCol < 0 || nextCol >= safeCols) {
        // Overflow beyond visible columns: place in next row slot.
        nextCol = align === "right" ? safeCols - 1 : 0;
        let overflowRow = safeRows;
        while (occupied.has(coordKey({ col: nextCol, row: overflowRow }))) {
          nextCol += align === "right" ? -1 : 1;
          if (nextCol < 0 || nextCol >= safeCols) {
            nextCol = align === "right" ? safeCols - 1 : 0;
            overflowRow += 1;
          }
        }
        nextRow = overflowRow;
        break;
      }
    }
    const cell = { col: nextCol, row: nextRow };
    resolved[item.id] = cell;
    occupied.add(coordKey(cell));
  }

  return resolved;
}

/**
 * Moves `itemId` to `targetCell`, swapping with any item already at that cell.
 */
export function moveItemToCell(
  positions: Readonly<Record<string, GridCoord>>,
  itemId: string,
  targetCell: GridCoord,
  cols: number,
  rows: number
): Record<string, GridCoord> {
  const clamped = clampCoord(targetCell, cols, rows);
  const previous = positions[itemId];
  const next: Record<string, GridCoord> = { ...positions };

  const occupantId = Object.keys(next).find((id) => {
    if (id === itemId) return false;
    const pos = next[id];
    return pos && pos.col === clamped.col && pos.row === clamped.row;
  });

  if (occupantId && previous) {
    next[occupantId] = previous;
  }
  next[itemId] = clamped;
  return next;
}

/**
 * Finds the closest unoccupied grid cell to `target` within `[cols, rows]`.
 * Falls back to `clampCoord(target, cols, rows)` if every cell is occupied.
 */
export function findClosestFreeCell(
  occupied: ReadonlySet<string>,
  target: GridCoord,
  cols: number,
  rows: number
): GridCoord {
  const clamped = clampCoord(target, cols, rows);
  if (!occupied.has(coordKey(clamped))) {
    return clamped;
  }
  let best: GridCoord | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const candidate = { col: c, row: r };
      if (occupied.has(coordKey(candidate))) continue;
      const dc = c - clamped.col;
      const dr = r - clamped.row;
      const distSq = dc * dc + dr * dr;
      if (
        distSq < bestDistSq ||
        (distSq === bestDistSq && best && (c < best.col || (c === best.col && r < best.row)))
      ) {
        bestDistSq = distSq;
        best = candidate;
      }
    }
  }
  return best ?? clamped;
}

/**
 * Moves one or more items so `primaryId` lands at `targetCell` (or swaps if single)
 * and any additional dragged items preserve their relative grid offsets around `targetCell`
 * (falling back to the closest unoccupied cell when out of bounds or occupied).
 */
export function moveItemsToCells(
  positions: Readonly<Record<string, GridCoord>>,
  itemIds: readonly string[],
  primaryId: string,
  targetCell: GridCoord,
  cols: number,
  rows: number
): Record<string, GridCoord> {
  if (itemIds.length <= 1) {
    return moveItemToCell(positions, primaryId, targetCell, cols, rows);
  }
  const clamped = clampCoord(targetCell, cols, rows);
  const next: Record<string, GridCoord> = { ...positions };
  const movingSet = new Set(itemIds);
  const occupied = new Set<string>();
  for (const [id, pos] of Object.entries(next)) {
    if (!movingSet.has(id) && pos) {
      occupied.add(coordKey(pos));
    }
  }

  const primaryOrigin = positions[primaryId] ?? clamped;
  const deltaCol = clamped.col - primaryOrigin.col;
  const deltaRow = clamped.row - primaryOrigin.row;

  const primaryCell = findClosestFreeCell(occupied, clamped, cols, rows);
  next[primaryId] = primaryCell;
  occupied.add(coordKey(primaryCell));

  for (const id of itemIds) {
    if (id === primaryId) continue;
    const orig = positions[id];
    const desired = orig
      ? clampCoord(
          { col: orig.col + deltaCol, row: orig.row + deltaRow },
          cols,
          rows
        )
      : clamped;
    const cell = findClosestFreeCell(occupied, desired, cols, rows);
    next[id] = cell;
    occupied.add(coordKey(cell));
  }
  return next;
}

/**
 * Drops `itemIds` with `primaryId` on `targetCell` (others keep their relative offsets) and
 * makes room: icons that were sitting on a landing cell move to the nearest free cell, the
 * way iOS-style grids shuffle. Pure; used for the live preview and for the committed drop.
 */
export function pushItemsToCells(
  positions: Readonly<Record<string, GridCoord>>,
  itemIds: readonly string[],
  primaryId: string,
  targetCell: GridCoord,
  cols: number,
  rows: number
): Record<string, GridCoord> {
  const moving = new Set(itemIds);
  const clamped = clampCoord(targetCell, cols, rows);
  const origin = positions[primaryId] ?? clamped;
  const dCol = clamped.col - origin.col;
  const dRow = clamped.row - origin.row;

  const landing = new Map<string, GridCoord>();
  const taken = new Set<string>();
  const place = (id: string, desired: GridCoord) => {
    const cell = findClosestFreeCell(taken, desired, cols, rows);
    landing.set(id, cell);
    taken.add(coordKey(cell));
  };
  place(primaryId, clamped);
  for (const id of itemIds) {
    if (id === primaryId) continue;
    const orig = positions[id];
    place(id, orig ? { col: orig.col + dCol, row: orig.row + dRow } : clamped);
  }

  const next: Record<string, GridCoord> = { ...positions };
  for (const [id, cell] of landing) next[id] = cell;

  const displaced: string[] = [];
  const occupied = new Set<string>(taken);
  for (const [id, pos] of Object.entries(positions)) {
    if (moving.has(id) || !pos) continue;
    if (taken.has(coordKey(pos))) displaced.push(id);
    else occupied.add(coordKey(pos));
  }
  displaced.sort((a, b) => {
    const pa = positions[a]!;
    const pb = positions[b]!;
    return pa.col - pb.col || pa.row - pb.row;
  });
  for (const id of displaced) {
    const cell = findClosestFreeCell(occupied, positions[id]!, cols, rows);
    next[id] = cell;
    occupied.add(coordKey(cell));
  }
  return next;
}

export function clientPointToGridCell(
  relX: number,
  relY: number,
  metrics: GridMetrics
): GridCoord {
  const col = Math.floor((relX - metrics.padding) / metrics.cellWidth);
  const row = Math.floor((relY - metrics.padding) / metrics.cellHeight);
  return clampCoord({ col, row }, metrics.cols, metrics.rows);
}

export function sortDesktopItems<
  T extends Pick<IconGridItem, "kind" | "name">,
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = a.kind === "directory" ? 0 : 1;
    const rankB = b.kind === "directory" ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

export function inferFileVisual(
  name: string,
  fileType: "file" | "directory",
  contentType?: string,
  options?: { isEmpty?: boolean }
): {
  iconName: AppSymbolName;
  iconCandidates: readonly string[];
} {
  if (fileType === "directory") {
    return {
      iconName: "folder",
      iconCandidates: ["folder", "inode-directory"],
    };
  }

  const isEmpty = Boolean(options?.isEmpty);
  const nameLower = name.toLowerCase();
  if (nameLower.endsWith(".desktop")) {
    return {
      iconName: "sparkles",
      iconCandidates: ["application-x-desktop"],
    };
  }
  if (/\.(deb|rpm|flatpakref|flatpak)$/.test(nameLower)) {
    return {
      iconName: "folder",
      iconCandidates: ["package-x-generic", "text-x-generic"],
    };
  }
  const emptyTextCandidates = [
    "application-x-zerosize",
    "text-x-generic-empty",
    "text-x-generic",
  ] as const;

  const normalizedMime = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalizedMime) {
    if (normalizedMime === "application/x-zerosize") {
      return {
        iconName: "notes",
        iconCandidates: [...emptyTextCandidates],
      };
    }
    if (normalizedMime === "text/plain" && isEmpty) {
      return {
        iconName: "notes",
        iconCandidates: [...emptyTextCandidates],
      };
    }
    if (normalizedMime.startsWith("audio/")) {
      return {
        iconName: "sparkles",
        iconCandidates: ["audio-x-generic", "gnome-mime-audio", "text-x-generic"],
      };
    }
    if (normalizedMime.startsWith("video/")) {
      return {
        iconName: "sparkles",
        iconCandidates: ["video-x-generic", "gnome-mime-video", "text-x-generic"],
      };
    }
    if (normalizedMime.startsWith("image/")) {
      return {
        iconName: "sparkles",
        iconCandidates: ["image-x-generic", "gnome-mime-image", "text-x-generic"],
      };
    }
    if (normalizedMime === "text/html") {
      return {
        iconName: "globe",
        iconCandidates: ["text-html", "text-x-generic"],
      };
    }
    if (normalizedMime === "application/pdf") {
      return {
        iconName: "notes",
        iconCandidates: ["application-pdf", "x-office-document", "text-x-generic"],
      };
    }
  }

  const lower = name.toLowerCase();
  if (/\.(html|htm)$/.test(lower)) {
    return {
      iconName: "globe",
      iconCandidates: ["text-html", "text-x-generic"],
    };
  }
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(lower)) {
    return {
      iconName: "sparkles",
      iconCandidates: ["image-x-generic", "gnome-mime-image", "text-x-generic"],
    };
  }
  if (/\.(mp4|webm|mkv|mov|avi|m4v)$/.test(lower)) {
    return {
      iconName: "sparkles",
      iconCandidates: ["video-x-generic", "gnome-mime-video", "text-x-generic"],
    };
  }
  if (/\.(mp3|wav|flac|m4a|ogg|aac)$/.test(lower)) {
    return {
      iconName: "sparkles",
      iconCandidates: ["audio-x-generic", "gnome-mime-audio", "text-x-generic"],
    };
  }
  if (/\.pdf$/.test(lower)) {
    return {
      iconName: "notes",
      iconCandidates: ["application-pdf", "x-office-document", "text-x-generic"],
    };
  }
  if (/\.(zip|tar|gz|tgz|bz2|xz|zst|7z|rar)$/.test(lower)) {
    return {
      iconName: "folder",
      iconCandidates: ["package-x-generic", "application-x-archive", "text-x-generic"],
    };
  }
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|sh|bash|zsh|json|toml|yaml|yml|css)$/.test(
      lower
    )
  ) {
    return {
      iconName: "code",
      iconCandidates: ["text-x-script", "application-x-executable", "text-x-generic"],
    };
  }
  if (/\.(md|txt|doc|docx|odt|rtf|log|csv|ini|conf|cfg)$/.test(lower)) {
    return {
      iconName: "notes",
      iconCandidates: isEmpty
        ? [...emptyTextCandidates]
        : ["text-x-generic", "x-office-document"],
    };
  }
  return {
    iconName: "notes",
    iconCandidates: isEmpty
      ? [...emptyTextCandidates]
      : ["text-x-generic", "application-octet-stream"],
  };
}

/**
 * Resolves 2D spatial arrow-key navigation (plus Home/End) over sparse or flow grids.
 */
export function findNextKeyboardItemId(
  items: readonly Pick<IconGridItem, "id">[],
  positions: Readonly<Record<string, GridCoord>>,
  currentId: string | null,
  key: string
): string | null {
  if (items.length === 0) return null;

  const ordered = [...items].sort((a, b) => {
    const pa = positions[a.id] ?? { col: 0, row: 0 };
    const pb = positions[b.id] ?? { col: 0, row: 0 };
    if (pa.col !== pb.col) return pa.col - pb.col;
    return pa.row - pb.row;
  });

  if (key === "Home") return ordered[0]?.id ?? null;
  if (key === "End") return ordered[ordered.length - 1]?.id ?? null;

  if (!currentId || !positions[currentId]) {
    return ordered[0]?.id ?? null;
  }

  const origin = positions[currentId];
  let bestId: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const item of items) {
    if (item.id === currentId) continue;
    const pos = positions[item.id];
    if (!pos) continue;

    const dx = pos.col - origin.col;
    const dy = pos.row - origin.row;

    let primary = 0;
    let secondary = 0;
    if (key === "ArrowRight") {
      if (dx <= 0) continue;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (key === "ArrowLeft") {
      if (dx >= 0) continue;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (key === "ArrowDown") {
      if (dy <= 0) continue;
      primary = dy;
      secondary = Math.abs(dx);
    } else if (key === "ArrowUp") {
      if (dy >= 0) continue;
      primary = -dy;
      secondary = Math.abs(dx);
    } else {
      continue;
    }

    const score = primary + secondary * 2.2;
    if (score < bestScore) {
      bestScore = score;
      bestId = item.id;
    }
  }

  return bestId ?? currentId;
}

export function findTypeAheadItemId(
  items: readonly Pick<IconGridItem, "id" | "name">[],
  currentId: string | null,
  char: string
): string | null {
  const needle = char.trim().toLowerCase();
  if (!needle) return null;
  const matches = items.filter((item) =>
    item.name.toLowerCase().startsWith(needle)
  );
  if (matches.length === 0) return null;
  if (!currentId) return matches[0].id;
  const idx = matches.findIndex((item) => item.id === currentId);
  return matches[(idx + 1) % matches.length].id;
}

export interface GridRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): GridRect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

export function rectsIntersect(a: GridRect, b: GridRect): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

/**
 * Returns IDs of all spatial grid items whose cell bounds intersect `selectionRect`.
 */
export function findItemsInRect(
  items: readonly Pick<IconGridItem, "id">[],
  positions: Readonly<Record<string, GridCoord>>,
  selectionRect: GridRect,
  metrics: GridMetrics
): string[] {
  const inset = 6;
  const matched: string[] = [];
  for (const item of items) {
    const coord = positions[item.id];
    if (!coord) continue;
    const left = metrics.padding + coord.col * metrics.cellWidth + inset;
    const top = metrics.padding + coord.row * metrics.cellHeight + inset;
    const itemRect: GridRect = {
      left,
      top,
      right: left + Math.max(1, metrics.cellWidth - inset * 2),
      bottom: top + Math.max(1, metrics.cellHeight - inset * 2),
    };
    if (rectsIntersect(selectionRect, itemRect)) {
      matched.push(item.id);
    }
  }
  return matched;
}


/**
 * Positions after dropping `itemIds` (led by `primaryId`) on `cell` in a
 * spatial grid: the current layout (saved positions, others auto-placed) with
 * the moved items in place and neighbours pushed aside. Shared by the desktop
 * and Folders' "Sort Manually" view.
 */
export function moveItemsInSpatialGrid(
  items: readonly Pick<IconGridItem, "id">[],
  savedPositions: Readonly<Record<string, GridCoord>>,
  itemIds: readonly string[],
  primaryId: string,
  cell: GridCoord,
  metrics: Pick<GridMetrics, "cols" | "rows">,
  align: DesktopIconAlign = "left"
): Record<string, GridCoord> {
  const current = assignGridPositions(items, savedPositions, metrics.cols, metrics.rows, align);
  return pushItemsToCells(current, itemIds, primaryId, cell, metrics.cols, metrics.rows);
}

/** Saved layout of a folder, keyed by entry name (as `desktopIconPositions`). */
export type NamedPositions = Record<string, GridCoord>;

type NamedItem = Pick<IconGridItem, "id" | "name" | "layoutKey">;
const layoutKeyOf = (item: NamedItem) => item.layoutKey ?? item.name;

/** A name-keyed layout as the id-keyed one the grid works with. */
export function positionsById(
  items: readonly NamedItem[],
  saved: Readonly<NamedPositions>
): Record<string, GridCoord> {
  const byId: Record<string, GridCoord> = {};
  for (const item of items) {
    const cell = saved[layoutKeyOf(item)];
    if (cell) byId[item.id] = cell;
  }
  return byId;
}

/**
 * The layout to save after a drop in a spatial grid. With `partial`, only the
 * icons the drop actually moved are written: a view smaller than the desktop
 * must not squeeze every other icon into its own bounds.
 */
export function moveInNamedLayout(
  items: readonly NamedItem[],
  saved: Readonly<NamedPositions>,
  itemIds: readonly string[],
  primaryId: string,
  cell: GridCoord,
  metrics: Pick<GridMetrics, "cols" | "rows">,
  { align = "left", partial = false }: { align?: DesktopIconAlign; partial?: boolean } = {}
): NamedPositions {
  const byId = positionsById(items, saved);
  const current = assignGridPositions(items, byId, metrics.cols, metrics.rows, align);
  const moved = moveItemsInSpatialGrid(items, byId, itemIds, primaryId, cell, metrics, align);
  const next: NamedPositions = partial ? { ...saved } : {};
  for (const item of items) {
    const pos = moved[item.id];
    if (!pos) continue;
    const before = current[item.id];
    const changed =
      itemIds.includes(item.id) || before?.col !== pos.col || before?.row !== pos.row;
    if (!partial || changed) next[layoutKeyOf(item)] = pos;
  }
  return next;
}

/** Gives files about to appear (dropped from elsewhere) free cells near `target`. */
export function placeNamesNear(
  items: readonly NamedItem[],
  saved: Readonly<NamedPositions>,
  names: readonly string[],
  target: GridCoord,
  metrics: Pick<GridMetrics, "cols" | "rows">,
  align: DesktopIconAlign = "left"
): NamedPositions {
  const current = assignGridPositions(
    items,
    positionsById(items, saved),
    metrics.cols,
    metrics.rows,
    align
  );
  const occupied = new Set(Object.values(current).map(coordKey));
  const next: NamedPositions = { ...saved };
  for (const name of names) {
    const cell = findClosestFreeCell(occupied, target, metrics.cols, metrics.rows);
    next[name] = cell;
    occupied.add(coordKey(cell));
  }
  return next;
}
