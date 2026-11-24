import { describe, expect, test } from "bun:test";
import { createFileService, type VfsCacheApi } from "@/lib/core/file-service";
import type { WebVfsEntry } from "@/lib/core/vfs-paths";
import type { FileStore } from "@/lib/ports/file-store";

function fakeCache() {
  const entries = new Map<string, WebVfsEntry>();
  const entry = (path: string, kind: "file" | "directory", content?: string): WebVfsEntry => ({
    id: path,
    name: path.slice(path.lastIndexOf("/") + 1),
    kind,
    path,
    parentPath: path.slice(0, path.lastIndexOf("/")) || "/",
    content,
    updatedAt: 1,
  });
  const cache: VfsCacheApi = {
    getVfsEntry: (p) => entries.get(p),
    listVfsDir: (p) => [...entries.values()].filter((e) => e.parentPath === p),
    writeVfsTextFile: (p, c) => {
      const e = entry(p, "file", c);
      entries.set(p, e);
      return e;
    },
    createVfsFolder: (d, n = "New Folder") => {
      const e = entry(`${d}/${n}`, "directory");
      entries.set(e.path, e);
      return e;
    },
    createVfsTextFile: (d, n = "New File", c = "") => {
      const e = entry(`${d}/${n}`, "file", c);
      entries.set(e.path, e);
      return e;
    },
    renameVfsEntry: (p, n) => {
      const old = entries.get(p);
      if (!old) return null;
      entries.delete(p);
      const e = entry(`${old.parentPath}/${n}`, old.kind, old.content);
      entries.set(e.path, e);
      return e;
    },
    moveVfsEntry: (p, d) => {
      const old = entries.get(p);
      if (!old) return null;
      entries.delete(p);
      const e = entry(`${d}/${old.name}`, old.kind, old.content);
      entries.set(e.path, e);
      return e;
    },
    copyVfsEntry: () => null,
    createVfsSymlink: () => null,
    trashVfsEntry: (p) => void entries.delete(p),
    restoreVfsEntry: () => null,
    removeVfsEntry: (p) => entries.delete(p),
    emptyVfsTrash: () => undefined,
  };
  return { cache, entries };
}

function fakeStore(
  files: Record<string, string>,
): FileStore & { writes: string[]; dirs: string[]; ops: string[] } {
  const writes: string[] = [];
  const dirs: string[] = [];
  const ops: string[] = [];
  return {
    writes,
    dirs,
    ops,
    move: async (a, b, o) => (ops.push(`mv${o?.noClobber ? " -n" : ""} ${a} ${b}`), true),
    copy: async (a, b) => (ops.push(`cp ${a} ${b}`), true),
    symlink: async (a, b) => (ops.push(`ln ${a} ${b}`), true),
    trash: async (a) => (ops.push(`trash ${a}`), true),
    remove: async (a) => (ops.push(`rm ${a}`), true),
    emptyTrash: async () => void ops.push("empty"),
    list: async (p) =>
      Object.keys(files)
        .filter((f) => f.startsWith(`${p}/`) && !f.slice(p.length + 1).includes("/"))
        .map((f) => ({ name: f.slice(p.length + 1), kind: "file" as const })),
    stat: async (p) => (p in files ? { name: p, kind: "file", size: files[p]!.length, modifiedMs: 42 } : null),
    readText: async (p) => files[p] ?? null,
    writeText: async (p, c) => {
      writes.push(`${p}=${c}`);
      return true;
    },
    createDir: async (p) => {
      dirs.push(p);
      return true;
    },
  };
}

describe("FileService", () => {
  test("lists a directory from the store, with size and mtime from stat", async () => {
    const { cache } = fakeCache();
    const svc = createFileService({ store: fakeStore({ "/h/a.txt": "abc" }), cache });
    const list = await svc.listDir("/h");
    expect(list.map((e) => [e.name, e.size, e.updatedAt])).toEqual([["a.txt", 3, 42]]);
  });

  test("reading fills the cache", async () => {
    const { cache } = fakeCache();
    const svc = createFileService({ store: fakeStore({ "/h/a.txt": "abc" }), cache });
    expect(await svc.readText("/h/a.txt")).toBe("abc");
    expect(cache.getVfsEntry("/h/a.txt")?.content).toBe("abc");
  });

  test("writes hit the cache first, then the store", () => {
    const { cache } = fakeCache();
    const store = fakeStore({});
    const svc = createFileService({ store, cache });
    svc.writeText("/h/b.txt", "hi");
    svc.createFolder("/h", "d");
    expect(cache.getVfsEntry("/h/b.txt")?.content).toBe("hi");
    expect(store.writes).toEqual(["/h/b.txt=hi"]);
    expect(store.dirs).toEqual(["/h/d"]);
  });

  test("cache-only paths and a missing store never reach the store", async () => {
    const { cache } = fakeCache();
    const store = fakeStore({ "/usb/x": "1" });
    const svc = createFileService({ store, cache, cacheOnly: (p) => p.startsWith("/usb") });
    svc.writeText("/usb/y.txt", "no");
    expect(store.writes).toEqual([]);
    const demo = createFileService({ store: null, cache });
    demo.writeText("/h/c.txt", "demo");
    expect(await demo.readText("/h/c.txt")).toBe("demo");
  });

  test("rename, move and trash reach the disk even when the cache has never seen the file", async () => {
    const { cache } = fakeCache();
    const store = fakeStore({});
    const svc = createFileService({ store, cache });
    expect(svc.rename("/h/a.txt", "b.txt")).toBeNull();
    expect(svc.move("/h/a.txt", "/h/d")).toBeNull();
    svc.trash("/h/a.txt");
    expect(store.ops).toEqual(["mv /h/a.txt /h/b.txt", "mv -n /h/a.txt /h/d/a.txt", "trash /h/a.txt"]);
  });

  test("a cached rename or move moves the entry and the file", () => {
    const { cache } = fakeCache();
    const store = fakeStore({});
    const svc = createFileService({ store, cache });
    svc.writeText("/h/a.txt", "x");
    expect(svc.rename("/h/a.txt", "b.txt")?.path).toBe("/h/b.txt");
    expect(svc.move("/h/b.txt", "/h/d")?.path).toBe("/h/d/b.txt");
    expect(store.ops).toEqual(["mv /h/a.txt /h/b.txt", "mv /h/b.txt /h/d/b.txt"]);
  });

  test("copy picks a free name from the real directory and refuses a copy into itself", async () => {
    const { cache } = fakeCache();
    const store = fakeStore({ "/h/d/a.txt": "1", "/h/d/a 2.txt": "2" });
    const svc = createFileService({ store, cache });
    expect(await svc.copy("/h/a.txt", "/h/d")).toBe("/h/d/a 3.txt");
    expect(await svc.copy("/h/d", "/h/d/sub")).toBeNull();
    expect(await svc.copy("/h/a.txt", "/h/d", { symlink: true, name: "link" })).toBe("/h/d/link");
    expect(store.ops).toEqual(["cp /h/a.txt /h/d/a 3.txt", "ln /h/a.txt /h/d/link"]);
  });

  test("remove and empty trash reach the store", async () => {
    const { cache } = fakeCache();
    const store = fakeStore({});
    const svc = createFileService({ store, cache });
    await svc.remove("/h/a.txt");
    await svc.emptyTrash();
    expect(store.ops).toEqual(["rm /h/a.txt", "empty"]);
  });
});
