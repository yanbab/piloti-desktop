/**
 * Items dropped on the window of an app that runs on its own (a module, the
 * demo's iframe): the shell passes them on as a menu action, as it passes a
 * file to open (`piloti:open-path:<path>`).
 */
const PREFIX = "piloti:drop-paths:";

/** `dest`: the folder they go to; the window's own folder when unset. */
export function droppedPathsAction(paths: readonly string[], copy: boolean, dest?: string): string {
  return `${PREFIX}${JSON.stringify({ paths, copy, ...(dest ? { dest } : null) })}`;
}

export function parseDroppedPaths(
  actionId: string,
): { paths: string[]; copy: boolean; dest?: string } | null {
  if (!actionId.startsWith(PREFIX)) return null;
  try {
    const value = JSON.parse(actionId.slice(PREFIX.length)) as { paths?: unknown; copy?: unknown; dest?: unknown };
    const paths = Array.isArray(value.paths)
      ? value.paths.filter((p): p is string => typeof p === "string" && p.startsWith("/"))
      : [];
    const dest = typeof value.dest === "string" && value.dest.startsWith("/") ? value.dest : undefined;
    return paths.length > 0 ? { paths, copy: value.copy === true, ...(dest ? { dest } : null) } : null;
  } catch {
    return null;
  }
}

/** What the shell says when items are dropped on a window (`residence:file-drop-window`). */
export interface FileDropWindowDetail {
  windowId: string;
  item?: { path?: string };
  items?: readonly { path?: string }[];
  copy?: boolean;
}

/** The actions an app on its own gets for a drop: the items, then the first to open. */
export function droppedActions(detail: FileDropWindowDetail): string[] {
  const paths = (detail.items ?? [detail.item]).flatMap((i) => (i?.path ? [i.path] : []));
  if (paths.length === 0) return [];
  return [droppedPathsAction(paths, detail.copy === true), `piloti:open-path:${paths[0]}`];
}
