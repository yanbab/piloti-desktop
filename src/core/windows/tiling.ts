/** Maximizing and tiling to half the screen. */
import type { WindowPlacement } from "@/core/windows/types";

/** The calculator's size follows its keypad: it is not maximized or tiled. */
export const canResize = (appId: string | undefined): boolean => appId !== "calculator";

type Side = "left" | "right";

export interface TilingDesktop {
  screen: { width: number; height: number };
  dock: { position?: "bottom" | "left" | "right"; size: number; autoHide: boolean };
}

const MENUBAR_HEIGHT = 30;
const TOP_INSET = 6;
const GAP = 8;

/** Half of what the menu bar and the Dock leave free. */
export function tileBounds(side: Side, { screen, dock }: TilingDesktop) {
  const position = dock.position ?? "bottom";
  const clearance = dock.autoHide ? 8 : dock.size + 24;
  const bottom = position === "bottom" ? clearance + 6 : GAP;
  const left = position === "left" ? clearance + 8 : GAP;
  const right = position === "right" ? clearance + 8 : GAP;
  const height = Math.max(300, screen.height - MENUBAR_HEIGHT - TOP_INSET - bottom);
  const width = Math.floor((Math.max(400, screen.width - left - right) - GAP) / 2);
  return {
    position: { x: side === "left" ? left : left + width + GAP, y: TOP_INSET },
    size: { width, height },
  };
}

export const tiled = (side: Side, desktop: TilingDesktop): Partial<WindowPlacement> => ({
  ...tileBounds(side, desktop),
  tiled: side,
  maximized: false,
  minimized: false,
});

export const toggledMaximize = (window: WindowPlacement): Partial<WindowPlacement> => ({
  maximized: !window.maximized,
  minimized: false,
});

/** The sizes windows had before they were tiled, to give back when dragged out. */
export function createUntiledSizes() {
  const sizes = new Map<string, WindowPlacement["size"]>();
  return {
    /** Before tiling: tiling again keeps the first size. */
    keep(windowId: string, window: Pick<WindowPlacement, "size" | "tiled">): void {
      if (!window.tiled) sizes.set(windowId, window.size);
    },
    /** The size to give back, once, when a tiled window is moved. */
    takeOnMove(
      windowId: string,
      window: Pick<WindowPlacement, "tiled"> | undefined,
      change: { position?: unknown; size?: unknown },
    ): WindowPlacement["size"] | undefined {
      if (!change.position || change.size || !window?.tiled) return undefined;
      const size = sizes.get(windowId);
      sizes.delete(windowId);
      return size;
    },
  };
}
