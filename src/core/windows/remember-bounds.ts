/** Where each app and document last was (`window-bounds.json`). */
import { resolveSpatialBoundsKey, type SavedWindowBounds } from "@/core/windows/spatial-window-bounds";
import type { DesktopWindowInstance } from "@/core/windows/types";

/** The saved places with this window's, `changes` applied. */
export function rememberBounds(
  saved: Record<string, SavedWindowBounds>,
  window: DesktopWindowInstance,
  monitor: string | undefined,
  changes: Partial<SavedWindowBounds> = {},
): Record<string, SavedWindowBounds> {
  const key = resolveSpatialBoundsKey({
    appId: window.appId,
    payload: window.payload,
    browserUrl: window.browserUrl,
    desktopId: window.waylandDesktopId,
  });
  return {
    ...saved,
    [key]: {
      position: window.position,
      size: window.size,
      workspace: window.workspace,
      maximized: window.maximized,
      monitor,
      ...changes,
    },
  };
}
