import type {
  BlobStorage,
  KeyValueStorage,
  VfsPersistence,
} from "@/lib/ports/vfs-persistence";

const VFS_BLOB_DB_NAME = "piloti.web.vfs.blobs.v1";
const VFS_BLOB_STORE = "contents";

function browserKeyValueStorage(): KeyValueStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
  } catch {
    return null; // storage blocked
  }
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
    keys: () => {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key !== null) out.push(key);
      }
      return out;
    },
  };
}

function browserBlobStorage(): BlobStorage | null {
  if (typeof indexedDB === "undefined") return null;
  let dbPromise: Promise<IDBDatabase | null> | null = null;
  const open = (): Promise<IDBDatabase | null> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(VFS_BLOB_DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(VFS_BLOB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return dbPromise;
  };
  const run = async <T,>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> => {
    const db = await open();
    if (!db) return undefined;
    return new Promise((resolve) => {
      try {
        const req = fn(db.transaction(VFS_BLOB_STORE, mode).objectStore(VFS_BLOB_STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  };
  return {
    get: async (path) => {
      const v = await run("readonly", (s) => s.get(path));
      return typeof v === "string" ? v : undefined;
    },
    put: async (path, content) => {
      await run("readwrite", (s) => s.put(content, path));
    },
    delete: async (path) => {
      await run("readwrite", (s) => s.delete(path));
    },
  };
}

/**
 * Resolved lazily: localStorage/IndexedDB may appear after this module loads
 * (test shims, late storage access), so each use looks them up again.
 */
export function browserPersistence(): VfsPersistence {
  let blobs: BlobStorage | null | undefined;
  return {
    get kv() {
      return browserKeyValueStorage();
    },
    get blobs() {
      if (blobs === undefined) blobs = browserBlobStorage();
      return blobs;
    },
  };
}
