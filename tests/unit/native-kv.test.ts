import { describe, expect, test } from "bun:test";
import { createNativeKeyValueStorage } from "@/lib/engine-native/state-preload";
import type { Vfs } from "@/lib/ports/vfs";
import { memoryPersistence } from "@/lib/ports/vfs-persistence";
import { browserPersistence } from "@/lib/engine-web/vfs-persistence-browser";
import {
  loadVfsEmblemsMap,
  setVfsPersistence,
  syncVfsEmblemsFromHost,
  VFS_EMBLEMS_STORAGE_KEY,
  WEB_VFS_FAVORITES_STORAGE_KEY,
} from "@/lib/engine-web/web-vfs";

function fakeStore(initial: Record<string, string>) {
  const files = new Map(Object.entries(initial));
  const store = {
    list: async (dir: string) =>
      [...files.keys()]
        .filter((p) => p.startsWith(`${dir}/`))
        .map((p) => ({ name: p.slice(dir.length + 1), kind: "file" as const })),
    readText: async (p: string) => files.get(p) ?? null,
    write: async (p: string, c: string) => void files.set(p, c),
    createDir: async () => {},
    remove: async (p: string) => files.delete(p),
  } as unknown as Vfs;
  return { store, files };
}

const DIR = `${(globalThis as { __PILOTI_VFS_HOME__?: string }).__PILOTI_VFS_HOME__ ?? "/home/user"}/.local/state/piloti/kv`;

describe("native key/value storage", () => {
  test("loads saved keys, persists writes and removals, keeps memory-only keys off disk", async () => {
    const { store, files } = fakeStore({ [`${DIR}/emblems`]: "{}" });
    const kv = await createNativeKeyValueStorage(store, (k) => k === "cache");
    expect(kv.getItem("emblems")).toBe("{}");
    kv.setItem("emblems", '{"a":1}');
    kv.setItem("cache", "big");
    expect(kv.getItem("cache")).toBe("big");
    await new Promise((r) => setTimeout(r, 300));
    expect(files.get(`${DIR}/emblems`)).toBe('{"a":1}');
    expect(files.has(`${DIR}/cache`)).toBe(false);
    kv.removeItem("emblems");
    await new Promise((r) => setTimeout(r, 300));
    expect(files.has(`${DIR}/emblems`)).toBe(false);
  });

  // Linux: only the favorites list is saved, and emblems come back from the disk.
  test("starts from the saved favorites alone, ignoring a copy of the emblems", async () => {
    const { store, files } = fakeStore({
      [`${DIR}/${WEB_VFS_FAVORITES_STORAGE_KEY}`]: '["/home/user/a.txt"]',
      [`${DIR}/${VFS_EMBLEMS_STORAGE_KEY}`]: '{"/home/user/old.txt":["work"]}',
    });
    const kv = await createNativeKeyValueStorage(store, (k) => k === VFS_EMBLEMS_STORAGE_KEY);
    setVfsPersistence({ ...memoryPersistence(), kv, persistEntries: false });
    try {
      expect(loadVfsEmblemsMap()).toEqual({ "/home/user/a.txt": ["favorite"] });
      syncVfsEmblemsFromHost("/home/user/a.txt", ["emblem-favorite", "emblem-work"]);
      expect(loadVfsEmblemsMap()["/home/user/a.txt"]).toEqual(["favorite", "work"]);
      await new Promise((r) => setTimeout(r, 300));
      expect(files.get(`${DIR}/${VFS_EMBLEMS_STORAGE_KEY}`)).toBe('{"/home/user/old.txt":["work"]}');
      expect(files.get(`${DIR}/${WEB_VFS_FAVORITES_STORAGE_KEY}`)).toBe('["/home/user/a.txt"]');
    } finally {
      setVfsPersistence(browserPersistence());
    }
  });
});
