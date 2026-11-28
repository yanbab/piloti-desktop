import type { DesktopWindowInstance } from "@/ui/context/WindowsContext";

export interface OverviewWindowLayout {
  id: string;
  targetX: number;
  targetY: number;
  scale: number;
  dx: number;
  dy: number;
  scaledWidth: number;
  scaledHeight: number;
}

export function computeOverviewColumns(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function computeOverviewWindowLayouts(
  windows: readonly DesktopWindowInstance[],
  viewportWidth: number,
  viewportHeight: number,
  bannerHeight = 114,
): Map<string, OverviewWindowLayout> {
  const result = new Map<string, OverviewWindowLayout>();
  if (windows.length === 0) return result;

  const sorted = [...windows].sort((a, b) => {
    if (a.minimized !== b.minimized) return a.minimized ? 1 : -1;
    const rowA = Math.round(a.position.y / 140);
    const rowB = Math.round(b.position.y / 140);
    if (rowA !== rowB) return rowA - rowB;
    return a.position.x - b.position.x;
  });

  const cols = computeOverviewColumns(sorted.length);
  const rows = Math.ceil(sorted.length / cols);
  const padX = 48;
  const padTop = bannerHeight + 28;
  const padBottom = 104;
  const gapX = 36;
  const gapY = 48;

  const availW = Math.max(320, viewportWidth - padX * 2);
  const availH = Math.max(240, viewportHeight - padTop - padBottom);
  const cellW = (availW - gapX * (cols - 1)) / cols;
  const cellH = (availH - gapY * (rows - 1)) / rows;

  sorted.forEach((win, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const winW = Math.max(120, win.size.width);
    const winH = Math.max(100, win.size.height);
    const scale = Math.min(cellW / winW, cellH / winH, 0.72);
    const scaledWidth = winW * scale;
    const scaledHeight = winH * scale;
    const cellX = padX + col * (cellW + gapX);
    const cellY = padTop + row * (cellH + gapY);
    const targetX = cellX + (cellW - scaledWidth) / 2;
    const targetY = cellY + (cellH - scaledHeight) / 2;
    const dx = targetX - win.position.x;
    const dy = targetY - win.position.y;

    result.set(win.id, {
      id: win.id,
      targetX,
      targetY,
      scale,
      dx,
      dy,
      scaledWidth,
      scaledHeight,
    });
  });

  return result;
}

