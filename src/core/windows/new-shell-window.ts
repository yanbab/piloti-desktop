/** The window an app of the shell opens in: where, how big, on which workspace. */
import type { AppDefinition, BuiltinAppId } from "@/core/data/catalog";
import { computeCenteredOrCascadedPosition } from "@/core/windows/cascade-position";
import type { SavedWindowBounds } from "@/core/windows/spatial-window-bounds";
import type { DesktopWindowInstance } from "@/core/windows/types";
import { clampWindowBounds, clampWorkspace } from "@/core/windows/window-bounds";

export interface NewShellWindow {
  id: string;
  appId: string;
  builtin: BuiltinAppId;
  definition: AppDefinition;
  payload?: string;
  isolated: boolean;
  forceCsd?: boolean;
  /** Where this app and document last was. */
  remembered?: SavedWindowBounds;
  /** The windows there are, to cascade from those of the same app. */
  windows: readonly DesktopWindowInstance[];
  screen: { width: number; height: number };
  workspaces: { active: number; count: number };
  zIndex: number;
}

export function newShellWindow(w: NewShellWindow): DesktopWindowInstance {
  const { definition, remembered, screen, builtin, payload } = w;
  const minSize = definition.minSize ?? {
    width: Math.min(360, definition.defaultSize.width),
    height: Math.min(260, definition.defaultSize.height),
  };
  const size = {
    width: remembered?.size.width ?? Math.min(definition.defaultSize.width, screen.width - 48),
    height: remembered?.size.height ?? Math.min(definition.defaultSize.height, screen.height - 120),
  };
  const sameApp = w.windows
    .filter((other) => other.appId === w.appId && !other.minimized)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((other) => other.position);
  const bounds = clampWindowBounds(
    computeCenteredOrCascadedPosition(sameApp, size, screen.width, screen.height, remembered?.position),
    size,
    screen.width,
    screen.height,
    { minWidth: minSize.width, minHeight: minSize.height },
  );
  const holdsDocument = builtin === "texts" || builtin === "image-viewer";
  return {
    id: w.id,
    appId: w.appId,
    title: (holdsDocument && payload ? payload.split("/").pop() : "") || definition.name,
    iconName: definition.iconName,
    builtinComponent: builtin,
    isolated: w.isolated,
    clientFrame: w.forceCsd ?? builtin !== "terminal",
    workspace: clampWorkspace(remembered?.workspace ?? w.workspaces.active, w.workspaces.count),
    position: bounds.position,
    size: bounds.size,
    minSize,
    minimized: false,
    maximized: remembered?.maximized ?? false,
    zIndex: w.zIndex,
    payload,
  };
}
