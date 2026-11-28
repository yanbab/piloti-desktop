/**
 * Dragging file and app items (icon grids, Folders' tree): what is under the
 * pointer, and the shell events that let the Dock, other views and windows
 * highlight and take the drop. Targets are found by data attributes, so a
 * view needs no registration.
 */
import type { IconGridItem } from "@/core/files/desktop-icons";

export type DropTarget =
  | { kind: "dock"; appId: string }
  | { kind: "vfs"; destPath: string }
  | { kind: "window"; windowId: string }
  | { kind: "blocked" }
  | null;

type HitElement = Pick<Element, "hasAttribute" | "getAttribute">;

/** Items for bare paths (from an app on its own), as drop targets take them. */
export const pathItems = (paths: readonly string[]): IconGridItem[] =>
  paths.map((path) => ({
    id: path,
    path,
    name: path.slice(path.lastIndexOf("/") + 1),
    kind: "file",
    iconName: "folder",
  }));

/** The first target among `hits`, topmost first. */
export function dropTargetAmong(
  hits: Iterable<HitElement>,
  draggedPaths: readonly string[],
): DropTarget {
  for (const el of hits) {
    if (el.hasAttribute("data-drop-blocked")) return { kind: "blocked" };
    const appId = el.getAttribute("data-dock-app-id");
    if (appId) return { kind: "dock", appId };
    const destPath = el.getAttribute("data-vfs-drop-path");
    if (destPath) {
      const isSelfOrChild = draggedPaths.some(
        (src) => src === destPath || destPath.startsWith(`${src}/`),
      );
      if (!isSelfOrChild) return { kind: "vfs", destPath };
    }
    const windowId = el.getAttribute("data-drop-window-id");
    if (windowId) return { kind: "window", windowId };
    if (el.getAttribute("data-slot") === "window") return { kind: "blocked" };
  }
  return null;
}

export function resolveTopDropTarget(
  clientX: number,
  clientY: number,
  draggedPaths: readonly string[],
): DropTarget {
  if (typeof document === "undefined") return null;
  return dropTargetAmong(document.elementsFromPoint(clientX, clientY), draggedPaths);
}

/** An entry of the Applications view: no file behind it, only the Dock takes it. */
export const isVirtualAppItem = (item: Pick<IconGridItem, "id">): boolean =>
  item.id.startsWith("app:");

/** Whether every item already is a direct child of `dir`. */
export const allInFolder = (items: readonly Pick<IconGridItem, "path">[], dir: string): boolean =>
  items.every(
    (d) => d.path.startsWith(`${dir}/`) && !d.path.slice(dir.length + 1).includes("/"),
  );

/** Tells the Dock and other views where the items being dragged are. */
export function broadcastItemDrag(
  primary: IconGridItem,
  items: readonly IconGridItem[],
  clientX: number,
  clientY: number,
): void {
  window.dispatchEvent(
    new CustomEvent("residence:file-drag", {
      detail: { active: true, item: primary, items, clientX, clientY },
    }),
  );
}

export function endItemDragBroadcast(): void {
  window.dispatchEvent(new CustomEvent("residence:file-drag", { detail: { active: false } }));
}

/**
 * Sends a drop where it belongs.
 * - `external`: someone took the items.
 * - `same-dir`: they are already in the target folder.
 * - `none`: nothing under the pointer.
 * - `blocked`: the target refuses them.
 */
export function routeItemDrop(
  primary: IconGridItem,
  items: readonly IconGridItem[],
  point: { x: number; y: number; copy: boolean },
  options: {
    currentDirPath?: string;
    onDropItems?: (items: IconGridItem[], destPath: string, opts?: { copy?: boolean }) => void;
    onDropItem?: (item: IconGridItem, clientX: number, clientY: number) => void;
  },
): "external" | "same-dir" | "none" | "blocked" {
  const target = resolveTopDropTarget(point.x, point.y, items.map((d) => d.path));
  if (!target) return "none";
  if (target.kind === "blocked") return "blocked";
  if (target.kind === "dock") {
    window.dispatchEvent(
      new CustomEvent("residence:file-drop-dock", {
        detail: { appId: target.appId, item: primary, items },
      }),
    );
    return "external";
  }
  if (isVirtualAppItem(primary)) return "blocked";
  if (target.kind === "window") {
    window.dispatchEvent(
      new CustomEvent("residence:file-drop-window", {
        detail: { windowId: target.windowId, item: primary, items, copy: point.copy },
      }),
    );
    return "external";
  }
  const { destPath } = target;
  if (options.currentDirPath === destPath || allInFolder(items, destPath)) {
    return "same-dir";
  }
  if (!options.onDropItems && !options.onDropItem) return "blocked";
  window.dispatchEvent(
    new CustomEvent("residence:desktop-drop-position", {
      detail: {
        destPath,
        names: items.map((d) => d.name),
        clientX: point.x,
        clientY: point.y,
      },
    }),
  );
  if (options.onDropItems) options.onDropItems([...items], destPath, { copy: point.copy });
  else options.onDropItem?.(primary, point.x, point.y);
  window.dispatchEvent(
    new CustomEvent("piloti:folder-drop-anim", { detail: { path: destPath } }),
  );
  return "external";
}
