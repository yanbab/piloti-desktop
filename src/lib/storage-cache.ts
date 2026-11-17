/**
 * Creates a memory-backed `localStorage` key/value map cache that lazily loads
 * once on first read/write and persists updates back to `localStorage`.
 */
export function createLocalStorageCache<V>(
  storageKey: string,
  isValid: (val: unknown) => val is V
) {
  const memory = new Map<string, V>();
  let loaded = false;

  function ensureLoaded() {
    if (loaded || typeof localStorage === "undefined") return;
    loaded = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
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
      if (typeof localStorage === "undefined") return;
      try {
        const obj: Record<string, V> = {};
        for (const [k, v] of memory.entries()) {
          obj[k] = v;
        }
        localStorage.setItem(storageKey, JSON.stringify(obj));
      } catch {
        // ignore storage errors
      }
    },
  };
}

