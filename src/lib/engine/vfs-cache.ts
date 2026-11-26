import type { QueryClient } from "@tanstack/react-query";
import { normalizeVfsPath, type WebVfsEntry } from "@/lib/core/vfs-paths";
import { queryClient } from "@/lib/engine/query-client";
import { vfsKeys } from "@/lib/engine/vfs-query";
import { parentPath } from "@/lib/ports/vfs";

/**
 * The shell's own file operations (`fs-bridge.ts`) show in open views at once:
 * cached folder listings are patched as soon as an operation is done, then
 * marked stale so the next load (or the watch, a moment later) brings the full
 * entry (size, thumbnail…). Listings nobody shows are only marked stale.
 */
export function createVfsCacheUpdater(client: QueryClient) {
  const patchList = (dir: string, patch: (list: WebVfsEntry[]) => WebVfsEntry[]) => {
    const key = vfsKeys.list(dir);
    if (client.getQueryData<WebVfsEntry[]>(key)) {
      client.setQueryData<WebVfsEntry[]>(key, (list) => (list ? patch(list) : list));
    }
    void client.invalidateQueries({ queryKey: key, exact: true });
  };

  const removed = (rawPath: string) => {
    const path = normalizeVfsPath(rawPath);
    patchList(parentPath(path), (list) => list.filter((e) => e.path !== path));
    void client.invalidateQueries({ queryKey: vfsKeys.stat(path), exact: true });
    void client.invalidateQueries({ queryKey: vfsKeys.text(path), exact: true });
  };

  const added = (entry: WebVfsEntry) => {
    const path = normalizeVfsPath(entry.path);
    patchList(parentPath(path), (list) => [...list.filter((e) => e.path !== path), entry]);
  };

  return {
    removed,
    added,
    moved(from: string, entry: WebVfsEntry) {
      removed(from);
      added(entry);
    },
    /** Something changed in `dir` that we can't describe yet: reload it. */
    changedIn(dir: string) {
      patchList(normalizeVfsPath(dir), (list) => list);
    },
  };
}

export const vfsCache = createVfsCacheUpdater(queryClient);
