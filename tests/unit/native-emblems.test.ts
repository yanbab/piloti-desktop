import { afterAll, describe, expect, test } from "bun:test";
import { createNativeEmblemStorage } from "@/lib/engine-native/emblem-storage";
import { loadEmblemsMap, setEmblemStorage, syncEmblemsFromHost, toggleEmblem } from "@/lib/engine/emblems";
import { readVfsStateJson, removeVfsStateFile, setStateSource, VFS_STATE_PATHS } from "@/lib/engine/vfs-state";
import { webEmblemStorage } from "@/lib/engine-web/web-vfs";

const files = new Map<string, string>();
const source = {
  files: () => [],
  read: (path: string) => files.get(path) ?? null,
  write: (path: string, content: string) => void files.set(path, content),
  remove: (path: string) => void files.delete(path),
  subscribe: () => () => undefined,
  subscribeDir: () => () => undefined,
};
const noOldFile = { readText: async () => { throw new Error("NotFound"); } };

describe("native emblem storage", () => {
  afterAll(() => {
    setStateSource(null);
    setEmblemStorage(webEmblemStorage);
  });

  test("saves only the favorites, and takes the rest from the disk", async () => {
    setStateSource(source);
    removeVfsStateFile(VFS_STATE_PATHS.favorites);
    setEmblemStorage(await createNativeEmblemStorage(noOldFile));
    toggleEmblem("/home/user/a.txt", "favorite");
    toggleEmblem("/home/user/b.txt", "work");
    expect(readVfsStateJson<string[]>(VFS_STATE_PATHS.favorites)).toEqual(["/home/user/a.txt"]);

    setEmblemStorage(await createNativeEmblemStorage(noOldFile));
    expect(loadEmblemsMap()).toEqual({ "/home/user/a.txt": ["favorite"] });
    syncEmblemsFromHost("/home/user/c.txt", ["emblem-work"]);
    expect(loadEmblemsMap()["/home/user/c.txt"]).toEqual(["work"]);
  });

  test("takes over the favorites saved by earlier releases", async () => {
    setStateSource(source);
    files.clear();
    setEmblemStorage(await createNativeEmblemStorage({ readText: async () => '["/home/user/old.txt"]' }));
    expect(loadEmblemsMap()).toEqual({ "/home/user/old.txt": ["favorite"] });
    expect(readVfsStateJson<string[]>(VFS_STATE_PATHS.favorites)).toEqual(["/home/user/old.txt"]);
  });
});
