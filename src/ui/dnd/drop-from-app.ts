/**
 * Items an app on its own (a module, the demo's iframe) dragged out of its
 * window: the shell drops them where they were released, as if dragged from
 * one of its own views (the Desktop, a folder icon, the Dock, a window).
 */
import type { IconGridItem } from "@/core/files/desktop-icons";
import { parentPath } from "@/core/ports/vfs";
import { copyFsEntry } from "@/platform/shared/fs-bridge";
import { moveWithUndo, recordCreated } from "@/platform/shared/fs-undo";
import type { Piloti } from "@/platform/shared/piloti";
import { routeItemDrop } from "@/ui/dnd/item-drop";

export function dropFromApp(
  piloti: Piloti,
  frame: Element,
  drop: { paths: readonly string[]; x: number; y: number; copy: boolean },
): void {
  const rect = frame.getBoundingClientRect();
  const items = appDropItems(drop.paths);
  const point = { x: rect.left + drop.x, y: rect.top + drop.y, copy: drop.copy };
  routeItemDrop(items[0]!, items, point, {
    onDropItems: (list, destPath, options) =>
      void moveOrCopyFromApp(piloti, list, destPath, options?.copy === true),
  });
}

/** The items of an app's paths, as the shell's drop targets take them. */
export const appDropItems = (paths: readonly string[]): IconGridItem[] =>
  paths.map((path) => ({
    id: path,
    path,
    name: path.slice(path.lastIndexOf("/") + 1),
    kind: "file",
    iconName: "folder",
  }));

export async function moveOrCopyFromApp(piloti: Piloti, items: readonly IconGridItem[], destPath: string, copy: boolean) {
  const ctx = { piloti };
  const paths = items
    .map((i) => i.path)
    .filter((p) => p !== destPath && !destPath.startsWith(`${p}/`));
  if (!copy) {
    const moving = paths.filter((p) => parentPath(p) !== destPath);
    if (moving.length > 0) await moveWithUndo(ctx, moving, destPath);
    return;
  }
  const created: string[] = [];
  for (const path of paths) {
    const copied = await copyFsEntry(piloti, path, destPath);
    if (copied) created.push(copied);
  }
  recordCreated(ctx, created, "Copy");
}
