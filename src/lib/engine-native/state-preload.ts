import type { KeyValueStorage } from "@/lib/ports/vfs-persistence";
import type { FileStore } from "@/lib/ports/file-store";
import { VFS_HOME } from "@/lib/engine/vfs-home";

/** Where Piloti keeps its own state under `$HOME`. */
const STATE_ROOTS = [
  `${VFS_HOME}/.config/piloti`,
  `${VFS_HOME}/.local/state/piloti`,
  `${VFS_HOME}/.cache/piloti`,
] as const;
const STATE_FILES = [`${VFS_HOME}/.piloti_history`] as const;
const MAX_DEPTH = 3;

export interface StateSink {
  ensureDir(path: string): void;
  writeText(path: string, content: string): void;
}

/**
 * The native VFS is a memory cache of the disk, but the shell reads its state
 * (settings, session, caches) synchronously. Load those few files before the
 * desktop starts so the first read already sees what the last session wrote.
 */
export async function preloadNativeState(store: FileStore, sink: StateSink): Promise<number> {
  let loaded = 0;
  const walk = async (dir: string, depth: number): Promise<void> => {
    const entries = await store.list(dir).catch(() => null);
    if (!entries) return;
    sink.ensureDir(dir);
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.kind === "directory") {
          if (depth < MAX_DEPTH) await walk(path, depth + 1);
          return;
        }
        const text = await store.readText(path).catch(() => null);
        if (text === null) return;
        sink.writeText(path, text);
        loaded += 1;
      }),
    );
  };
  await Promise.all([
    ...STATE_ROOTS.map((root) => walk(root, 0)),
    ...STATE_FILES.map(async (path) => {
      const text = await store.readText(path).catch(() => null);
      if (text === null) return;
      sink.ensureDir(path.slice(0, path.lastIndexOf("/")));
      sink.writeText(path, text);
      loaded += 1;
    }),
  ]);
  return loaded;
}

const KV_DIR = `${VFS_HOME}/.local/state/piloti/kv`;

/**
 * The VFS keeps a few small keyed values besides its entry cache (emblems,
 * favorites). On native they must outlive the session, so they live as files in
 * `~/.local/state/piloti/kv/` — except the keys named by `memoryOnly`, such as
 * the entry cache itself, which mirrors the disk and is rebuilt from it.
 */
export async function createNativeKeyValueStorage(
  store: FileStore,
  memoryOnly: (key: string) => boolean,
): Promise<KeyValueStorage> {
  const map = new Map<string, string>();
  const listed = await store.list(KV_DIR).catch(() => null);
  await Promise.all(
    (listed ?? [])
      .filter((e) => e.kind === "file")
      .map(async (e) => {
        const text = await store.readText(`${KV_DIR}/${e.name}`).catch(() => null);
        if (text !== null) map.set(e.name, text);
      }),
  );
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  let dirReady = false;
  const persist = (key: string, value: string | null) => {
    if (memoryOnly(key)) return;
    const previous = pending.get(key);
    if (previous) clearTimeout(previous);
    pending.set(
      key,
      setTimeout(() => {
        pending.delete(key);
        void (async () => {
          if (value === null) {
            await store.remove(`${KV_DIR}/${key}`);
            return;
          }
          if (!dirReady) dirReady = await store.createDir(KV_DIR);
          await store.writeText(`${KV_DIR}/${key}`, value);
        })();
      }, 200),
    );
  };
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem(k, v) {
      map.set(k, v);
      persist(k, v);
    },
    removeItem(k) {
      map.delete(k);
      persist(k, null);
    },
    keys: () => [...map.keys()],
  };
}
