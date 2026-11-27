/**
 * What the VFS core needs from the engine to keep its data between runs.
 * The browser engine backs it with localStorage + IndexedDB; tests use memory;
 * an app module can use its own origin's storage. The VFS never touches those
 * APIs directly.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

/** Large file contents (media), kept out of the key/value store. */
export interface BlobStorage {
  get(path: string): Promise<string | undefined>;
  put(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
}

export interface VfsPersistence {
  /** `null` when nothing can be persisted (the VFS then lives in memory only). */
  kv: KeyValueStorage | null;
  blobs: BlobStorage | null;
}

export function memoryKeyValueStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

export function memoryBlobStorage(): BlobStorage {
  const map = new Map<string, string>();
  return {
    get: async (p) => map.get(p),
    put: async (p, c) => void map.set(p, c),
    delete: async (p) => void map.delete(p),
  };
}

export function memoryPersistence(): VfsPersistence {
  return { kv: memoryKeyValueStorage(), blobs: memoryBlobStorage() };
}
