import type { KeyValueStorage } from "@/lib/ports/vfs-persistence";
import type { FileStore } from "@/lib/ports/file-store";
import { VFS_HOME } from "@/lib/engine/vfs-home";

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
