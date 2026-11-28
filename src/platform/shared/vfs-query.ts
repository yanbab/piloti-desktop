import { normalizeVfsPath } from "@/core/files/vfs-paths";
import type { Vfs } from "@/core/ports/vfs";

/**
 * Query keys for VFS reads (`hooks/use-vfs.ts`), so a change can refresh every
 * view of a path. See `_docs/PLAN-REACTIVE.md`.
 */
export const vfsKeys = {
  all: ["vfs"] as const,
  list: (dir: string) => ["vfs", "list", normalizeVfsPath(dir)] as const,
  text: (path: string) => ["vfs", "text", normalizeVfsPath(path)] as const,
  stat: (path: string) => ["vfs", "stat", normalizeVfsPath(path)] as const,
  /** "New document" templates (`~/Templates`). */
  templates: (dir: string) => ["vfs", "templates", normalizeVfsPath(dir)] as const,
  /** Whether the Trash is empty (the dock's icon). */
  trashEmpty: (dir: string) => ["vfs", "trash-empty", normalizeVfsPath(dir)] as const,
};

/**
 * `onChange(initial, wasWatched)`: every subscriber gets one `initial` call when
 * the watch is in place, then `initial = false` on each change. A subscriber
 * joining a watch already in place gets its `initial` call right away, with
 * `wasWatched` true: what was loaded under that watch is current.
 */
export type VfsWatchListener = (initial: boolean, wasWatched: boolean) => void;

interface SharedWatch {
  listeners: Set<VfsWatchListener>;
  /** Listeners still waiting for their `initial` call. */
  pending: Set<VfsWatchListener>;
  placed: boolean;
  stop: () => void;
}

type Watchable = Pick<Vfs, "watch">;

const pools = new WeakMap<Watchable, Map<string, SharedWatch>>();

/**
 * One `vfs.watch` per path however many views use it, stopped with the last
 * one (inotify instances are scarce). Returns release.
 */
export function retainVfsWatch(vfs: Watchable, path: string, onChange: VfsWatchListener): () => void {
  const norm = normalizeVfsPath(path);
  let pool = pools.get(vfs);
  if (!pool) pools.set(vfs, (pool = new Map()));

  let shared = pool.get(norm);
  if (shared) {
    shared.listeners.add(onChange);
    if (shared.placed) onChange(true, true);
    else shared.pending.add(onChange);
  } else {
    const entry: SharedWatch = {
      listeners: new Set([onChange]),
      pending: new Set([onChange]),
      placed: false,
      stop: () => undefined,
    };
    shared = entry;
    pool.set(norm, entry);
    entry.stop = vfs.watch(norm, () => {
      entry.placed = true;
      for (const listener of [...entry.listeners]) {
        const initial = entry.pending.delete(listener);
        listener(initial, false);
      }
    });
  }

  const own = shared;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    own.listeners.delete(onChange);
    own.pending.delete(onChange);
    if (own.listeners.size === 0) {
      own.stop();
      if (pool.get(norm) === own) pool.delete(norm);
    }
  };
}

/** Paths watched right now, for tests and the Console. */
export function watchedVfsPaths(vfs: Watchable): string[] {
  return [...(pools.get(vfs)?.keys() ?? [])];
}
