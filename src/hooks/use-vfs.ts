import * as React from "react";
import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePiloti } from "@/lib/engine/piloti";
import { listFsDir } from "@/lib/engine/fs-bridge";
import { retainVfsWatch, vfsKeys } from "@/lib/engine/vfs-query";
import type { WebVfsEntry } from "@/lib/core/vfs-paths";
import type { VfsStat } from "@/lib/ports/vfs";

/**
 * VFS reads as live data: cached and shared by every view of a path, refreshed
 * when the path changes (on disk or in the shell). Components read files with
 * these hooks and don't call `vfs.watch` themselves. Writes go through
 * `fs-undo` / `piloti.vfs`; the watch brings their result here.
 */
export function useVfsQuery<T>(key: QueryKey, watchPath: string | null, load: () => Promise<T>) {
  const piloti = usePiloti();
  const client = useQueryClient();
  const query = useQuery({ queryKey: key, queryFn: load, enabled: watchPath !== null });

  const keyHash = JSON.stringify(key);
  React.useEffect(() => {
    if (watchPath === null) return;
    return retainVfsWatch(piloti.vfs, watchPath, (initial) => {
      // The first call means "in place": the query is already loading, unless
      // it shows cached data, which may be old (another view's watch on the
      // same path only refreshes that view's key).
      const state = client.getQueryState(key);
      // A load under way may already show partial data: don't restart it.
      if (initial && (state?.status !== "success" || state.fetchStatus === "fetching")) return;
      void client.invalidateQueries({ queryKey: key, exact: true });
    });
    // `key` is described by `keyHash`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, keyHash, piloti, watchPath]);

  return query;
}

/**
 * A folder's entries (Folders' naming and metadata), `undefined` while loading.
 * Hidden ones included, as on disk: callers filter (`hiddenNamesOf`, dot files).
 */
export function useVfsList(dir: string | null) {
  const piloti = usePiloti();
  const client = useQueryClient();
  const key = vfsKeys.list(dir ?? "");
  return useVfsQuery<WebVfsEntry[]>(key, dir, () =>
    listFsDir(piloti, dir!, {
      includeHidden: true,
      // A first load shows names at once; a refresh keeps what it has.
      onNames: (entries) => {
        if (client.getQueryData(key) === undefined) client.setQueryData(key, entries);
      },
    }),
  );
}

/** Refreshes `key` (a `vfsKeys` entry) now, e.g. after the shell's own change. */
export function useVfsRefresh() {
  const client = useQueryClient();
  return React.useCallback(
    (key: QueryKey) => void client.invalidateQueries({ queryKey: key, exact: true }),
    [client],
  );
}

/**
 * Calls `onChange` when `path` changes, sharing the watch with every other view
 * of it. For data that isn't cached (images, an open document); the first call
 * the watch makes once in place is passed on too.
 */
export function useVfsWatch(path: string | null, onChange: () => void) {
  const piloti = usePiloti();
  const ref = React.useRef(onChange);
  ref.current = onChange;
  React.useEffect(() => {
    if (path === null) return;
    return retainVfsWatch(piloti.vfs, path, () => ref.current());
  }, [path, piloti]);
}

/** A small text file's content; `null` when it doesn't exist. */
export function useVfsText(path: string | null) {
  const piloti = usePiloti();
  return useVfsQuery<string | null>(vfsKeys.text(path ?? ""), path, () =>
    piloti.vfs.readText(path!),
  );
}

/** A path's kind, size and dates; `null` when it doesn't exist. */
export function useVfsStat(path: string | null) {
  const piloti = usePiloti();
  return useVfsQuery<VfsStat | null>(vfsKeys.stat(path ?? ""), path, () =>
    piloti.vfs.stat(path!),
  );
}
