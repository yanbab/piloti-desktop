import * as React from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { usePiloti } from "@/lib/engine/piloti";
import { listFsDir } from "@/lib/engine/fs-bridge";
import { retainVfsWatch, vfsKeys } from "@/lib/engine/vfs-query";
import type { WebVfsEntry } from "@/lib/core/vfs-paths";
import type { IconGridItem } from "@/lib/files/desktop-icons";
import { buildFolderTree, renameExpanded, type ExpandedFolders } from "@/lib/files/folder-tree";

const NONE: ExpandedFolders = {};

/**
 * Folders' tree: which folders are open, and their entries, listed and watched
 * only while shown. Another root starts closed; open folders aren't saved.
 */
export function useFolderTree({
  rootPath,
  rootItems,
  toItems,
  query,
  enabled,
}: {
  rootPath: string;
  rootItems: readonly IconGridItem[];
  /** The same filtering and order as the top level. */
  toItems: (entries: readonly WebVfsEntry[]) => IconGridItem[];
  query: string;
  /** False for flat listings (virtual views, Trash). */
  enabled: boolean;
}) {
  const piloti = usePiloti();
  const client = useQueryClient();
  const [state, setState] = React.useState({ root: rootPath, expanded: NONE });
  const expanded = enabled && state.root === rootPath ? state.expanded : NONE;

  // Which folders are reachable depends on what is listed, which depends on
  // which are reachable: `openDirs` follows the previous render's answer.
  const [openDirs, setOpenDirs] = React.useState<string[]>([]);
  const listings = useQueries({
    queries: openDirs.map((dir) => ({
      queryKey: vfsKeys.list(dir),
      queryFn: () => listFsDir(piloti, dir, { includeHidden: true }),
    })),
    combine: React.useCallback(
      (results: { data?: WebVfsEntry[] }[]) => results.map((r) => r.data),
      [],
    ),
  });

  const tree = React.useMemo(() => {
    const byDir = new Map(openDirs.map((dir, i) => [dir, listings[i]]));
    return buildFolderTree(
      rootItems,
      expanded,
      (dir) => {
        const entries = byDir.get(dir);
        return entries && toItems(entries);
      },
      query,
    );
  }, [expanded, listings, openDirs, query, rootItems, toItems]);

  const openKey = tree.openDirs.join("\n");
  React.useEffect(() => {
    setOpenDirs(openKey ? openKey.split("\n") : []);
  }, [openKey]);

  React.useEffect(() => {
    if (!openKey) return;
    const releases = openKey.split("\n").map((dir) =>
      retainVfsWatch(piloti.vfs, dir, (initial) => {
        // "In place": the query is already loading, unless it shows old data.
        if (initial && client.getQueryState(vfsKeys.list(dir))?.status !== "success") return;
        void client.invalidateQueries({ queryKey: vfsKeys.list(dir), exact: true });
      }),
    );
    return () => releases.forEach((release) => release());
  }, [client, openKey, piloti]);

  const update = React.useCallback(
    (change: (old: ExpandedFolders) => ExpandedFolders) =>
      setState((cur) => ({
        root: rootPath,
        expanded: change(cur.root === rootPath ? cur.expanded : NONE),
      })),
    [rootPath],
  );
  const setOpen = React.useCallback(
    (path: string, open: boolean) =>
      update((old) => (Boolean(old[path]) === open ? old : { ...old, [path]: open })),
    [update],
  );
  const rename = React.useCallback(
    (oldPath: string, newPath: string) => update((old) => renameExpanded(old, oldPath, newPath)),
    [update],
  );
  const loading = React.useMemo(
    () => new Set(openDirs.filter((_dir, i) => listings[i] === undefined)),
    [listings, openDirs],
  );

  return {
    nodes: tree.nodes,
    visibleItems: tree.visibleItems,
    expanded,
    loading,
    expandable: enabled,
    setOpen,
    rename,
  };
}

export type FolderTree = ReturnType<typeof useFolderTree>;
