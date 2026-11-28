/** Where Wayland popups and subsurfaces go, relative to their toplevel. */
import type { DesktopWindowInstance, ResolvedPopupWindow } from "@/ui/context/windows/types";

export interface PopupSource {
  appId: string;
  parent?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  frame: number;
  cursor?: string;
}

/** The newest frame of each popup's ancestors, so they redraw with it. */
export function resolveSyncedParentFrames(waylandWindows: readonly PopupSource[]): Map<string, number> {
  const byId = new Map(waylandWindows.map((w) => [w.appId, w]));
  const frames = new Map<string, number>();
  for (const w of waylandWindows) {
    if (w.parent === undefined) continue;
    let cur = byId.get(w.parent);
    while (cur) {
      frames.set(cur.appId, cur.frame);
      cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined;
    }
  }
  return frames;
}

export function resolvePopupWindows(
  waylandWindows: readonly PopupSource[],
  combinedWindows: readonly DesktopWindowInstance[],
  syncedParentFrames: ReadonlyMap<string, number>,
  settings: { activeWorkspace: number; windowDecorationMode: string },
): ResolvedPopupWindow[] {
  const byId = new Map(waylandWindows.map((w) => [w.appId, w]));
  const resolved: ResolvedPopupWindow[] = [];

  for (const w of waylandWindows) {
    if (w.parent === undefined) continue;
    let offsetX = w.x ?? 0;
    let offsetY = w.y ?? 0;
    let ancestor = byId.get(w.parent);
    let rootToplevel = ancestor;

    while (ancestor && ancestor.parent !== undefined) {
      offsetX += ancestor.x ?? 0;
      offsetY += ancestor.y ?? 0;
      ancestor = byId.get(ancestor.parent);
      if (ancestor && ancestor.parent === undefined) {
        rootToplevel = ancestor;
      }
    }

    if (!rootToplevel) continue;
    const parentWin = combinedWindows.find(
      (cw) => cw.waylandAppId === rootToplevel.appId
    );
    if (
      !parentWin ||
      parentWin.minimized ||
      parentWin.workspace !== settings.activeWorkspace
    ) {
      continue;
    }

    const isCsd =
      settings.windowDecorationMode === "csd" ||
      (settings.windowDecorationMode === "auto" &&
        Boolean(parentWin.clientFrame));
    const titlebarHeight = isCsd ? 0 : 46;
    const basePos = parentWin.maximized
      ? { x: 0, y: 0 }
      : parentWin.position;

    resolved.push({
      appId: w.appId,
      parentToplevelId: parentWin.id,
      x: basePos.x + offsetX,
      y: basePos.y + titlebarHeight + offsetY,
      width: w.width ?? 220,
      height: w.height ?? 180,
      frame: syncedParentFrames.get(w.appId) ?? w.frame,
      cursor: w.cursor,
      zIndex: parentWin.zIndex + 2,
    });
  }

  return resolved;
}
