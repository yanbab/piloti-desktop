/**
 * How VFS changes travel: to subscribers in this document, to other windows of
 * the same app, and from page lifecycle events that ask for a flush.
 * The browser engine uses window events, BroadcastChannel and `storage`; tests
 * and other engines can use the in-memory implementation.
 */
export type VfsSyncMessage =
  | { type: "changed"; paths?: readonly string[] }
  | { type: "renamed"; oldPath: string; newPath: string };

export interface VfsSync {
  /** Announce to this document's subscribers only. */
  emit(msg: VfsSyncMessage): void;
  /** Announce to the other windows of the app. */
  broadcast(msg: VfsSyncMessage): void;
  /** Local and remote messages; `remote` is true when another window sent it. */
  subscribe(listener: (msg: VfsSyncMessage, remote: boolean) => void): () => void;
  /**
   * Another window wrote the backing store (a browser `storage` event). `key`
   * is `null` when everything was cleared.
   */
  onExternalWrite(listener: (key: string | null) => void): () => void;
  /** True when `broadcast` reaches other windows (so `storage` events can be ignored for VFS data). */
  readonly canBroadcast: boolean;
  /** The page is going away or hidden: write pending changes now. */
  onFlushRequested(listener: () => void): () => void;
}

export function memoryVfsSync(): VfsSync {
  const listeners = new Set<(msg: VfsSyncMessage, remote: boolean) => void>();
  return {
    emit: (msg) => {
      for (const l of [...listeners]) l(msg, false);
    },
    broadcast: () => {},
    subscribe: (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    onExternalWrite: () => () => {},
    canBroadcast: false,
    onFlushRequested: () => () => {},
  };
}
