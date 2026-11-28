import type { WebVfsEntry } from "@/core/files/vfs-paths";

/** Persistence counters of the browser VFS. */
export interface WebVfsPerfStats {
  /** In-memory VFS mutations (each `saveVfs`). */
  writes: number;
  /** Coalesced localStorage serializations. */
  flushes: number;
  lastFlushMs: number;
  totalFlushMs: number;
  /** Size of the last serialized VFS JSON (characters). */
  lastJsonChars: number;
  /** Listener invocations (delivered) vs. skipped by path filters. */
  listenerCalls: number;
  listenerSkips: number;
  /** Full re-parses of localStorage after another window changed it. */
  reloads: number;
  startedAt: number;
}

export interface WebVfsBackingStorageEntry {
  key: string;
  bytes: number;
  value: string;
}

/**
 * What the Console shows of the browser VFS. Only the demo has one: on Linux
 * the files are the disk's, and this is `null`.
 */
export interface VfsInspector {
  /** The `window` event sent when files change. */
  changedEvent: string;
  entries(): WebVfsEntry[];
  backingStorage(): WebVfsBackingStorageEntry[];
  stats(): WebVfsPerfStats;
  resetStats(): void;
}

let current: VfsInspector | null = null;

export function setVfsInspector(next: VfsInspector | null): void {
  current = next;
}

export const vfsInspector = (): VfsInspector | null => current;
