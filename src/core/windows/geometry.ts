/** Moving and resizing by hand: what the screen allows. */
import type { WindowPlacement } from "@/core/windows/types";

export interface GeometryChange {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

/** How much of a window stays within reach at a side or the bottom. */
const REACHABLE = 80;
const MENUBAR_HEIGHT = 30;
const TITLEBAR_REACH = 48;

/**
 * The change as it will apply: a position keeps the window within reach and
 * under the menu bar. `width` is the window's, as it will be.
 */
export function allowedChange(
  change: GeometryChange,
  width: number,
  screen: { width: number; height: number },
): GeometryChange {
  if (!change.position) return { size: change.size };
  const between = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));
  return {
    size: change.size,
    position: {
      x: between(change.position.x, 0 - Math.max(0, width - REACHABLE), Math.max(0, screen.width - REACHABLE)),
      y: between(change.position.y, 0, Math.max(0, screen.height - MENUBAR_HEIGHT - TITLEBAR_REACH)),
    },
  };
}

/** The window after the change. Moving it takes it out of its half of the screen. */
export const changedGeometry = (
  current: WindowPlacement,
  { position, size }: GeometryChange,
): Partial<WindowPlacement> => ({
  position: position ?? current.position,
  size: size ?? current.size,
  tiled: position ? null : current.tiled,
});

/** Logs where windows end up, not every step of a drag. */
export function createGeometryLog(log: (line: string) => void, settleMs = 300) {
  const pending = new Map<string, GeometryChange & { timer: ReturnType<typeof setTimeout> }>();
  return {
    add(windowId: string, label: string, change: GeometryChange): void {
      if (!change.position && !change.size) return;
      const before = pending.get(windowId);
      if (before) clearTimeout(before.timer);
      const position = change.position ?? before?.position;
      const size = change.size ?? before?.size;
      const timer = setTimeout(() => {
        pending.delete(windowId);
        if (position) log(`[Piloti] moved ${label} to ${position.x}x${position.y}`);
        if (size) log(`[Piloti] resized ${label} to ${Math.round(size.width)}x${Math.round(size.height)}`);
      }, settleMs);
      pending.set(windowId, { position, size, timer });
    },
    stop(): void {
      for (const { timer } of pending.values()) clearTimeout(timer);
      pending.clear();
    },
  };
}
