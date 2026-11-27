import type { KeyValueStorage } from "@/lib/ports/vfs-persistence";
import type { Vfs } from "@/lib/ports/vfs";
import { VFS_HOME } from "@/lib/engine/vfs-home";

const KV_DIR = `${VFS_HOME}/.local/state/piloti/kv`;

/**
 * The VFS keeps a few small keyed values besides its entry cache (emblems,
 * favorites). Those that must outlive the session live as files in
 * `~/.local/state/piloti/kv/` — except the keys named by `memoryOnly`, which
 * mirror the disk (the entry cache, each file's emblems) and are rebuilt from it.
 */
export async function createNativeKeyValueStorage(
  vfs: Pick<Vfs, "list" | "readText" | "write" | "remove" | "createDir">,
  memoryOnly: (key: string) => boolean,
): Promise<KeyValueStorage> {
  const map = new Map<string, string>();
  const listed = await vfs.list(KV_DIR).catch(() => null);
  await Promise.all(
    (listed ?? [])
      .filter((e) => e.kind === "file" && !memoryOnly(e.name))
      .map(async (e) => {
        const text = await vfs.readText(`${KV_DIR}/${e.name}`).catch(() => null);
        if (text !== null) map.set(e.name, text);
      }),
  );
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
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
            await vfs.remove(`${KV_DIR}/${key}`);
            return;
          }
          await vfs.createDir(KV_DIR);
          await vfs.write(`${KV_DIR}/${key}`, value);
        })().catch((error) => console.warn("[piloti] cannot save", key, error));
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
