import {
  getVfsCacheFilePath,
  readVfsStateJson,
  writeVfsStateJson,
} from "@/core/state/vfs-state";

/**
 * Creates a memory-backed VFS cache (`/home/user/.cache/piloti/<key>.json`)
 * that lazily loads once on first read/write and persists updates through VFS.
 */
export function createLocalStorageCache<V>(
  storageKey: string,
  isValid: (val: unknown) => val is V
) {
  const memory = new Map<string, V>();
  const vfsPath = getVfsCacheFilePath(storageKey);
  let loaded = false;

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    try {
      const parsed = readVfsStateJson<Record<string, unknown>>(vfsPath, storageKey);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (isValid(v)) {
            memory.set(k, v);
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  return {
    get(key: string): V | undefined {
      ensureLoaded();
      return memory.get(key);
    },
    set(key: string, value: V): void {
      ensureLoaded();
      memory.set(key, value);
      try {
        const obj: Record<string, V> = {};
        for (const [k, v] of memory.entries()) {
          obj[k] = v;
        }
        writeVfsStateJson(vfsPath, obj, false);
      } catch {
        // ignore storage errors
      }
    },
  };
}

