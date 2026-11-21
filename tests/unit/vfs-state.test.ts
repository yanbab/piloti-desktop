import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  clearAllWebVfsBackingStorage,
  getVfsEntry,
  listWebVfsBackingStorageEntries,
  writeVfsTextFile,
} from "../../src/lib/web-vfs";
import {
  getVfsCacheFilePath,
  readVfsStateJson,
  readVfsStateText,
  registerVfsHostSync,
  removeVfsStateFile,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateJson,
  writeVfsStateText,
} from "../../src/lib/vfs-state";

describe("vfs-state", () => {
  const store = new Map<string, string>();
  let prevStorage: Storage | undefined;

  beforeEach(() => {
    prevStorage = globalThis.localStorage;
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        get length() {
          return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => {
          store.clear();
        },
      },
    });
    clearAllWebVfsBackingStorage();
    registerVfsHostSync(null);
  });

  afterEach(() => {
    registerVfsHostSync(null);
    clearAllWebVfsBackingStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: prevStorage,
    });
  });

  it("stores JSON and text state in VFS files inside the single web-vfs backing key", () => {
    expect(
      writeVfsStateJson(VFS_STATE_PATHS.settings, { themeMode: "light" })
    ).toBe(true);

    const entry = getVfsEntry(VFS_STATE_PATHS.settings);
    expect(entry?.kind).toBe("file");
    expect(readVfsStateJson<{ themeMode: string }>(VFS_STATE_PATHS.settings)).toEqual({
      themeMode: "light",
    });

    // Only piloti.web.vfs.v1 should be stored in localStorage, not per-setting keys
    const rawKeys = listWebVfsBackingStorageEntries().map((e) => e.key);
    expect(rawKeys).toEqual(["piloti.web.vfs.v1"]);
  });

  it("migrates legacy localStorage keys once into VFS and deletes the legacy key", () => {
    store.set("piloti.locale.v1", "fr");
    const migrated = readVfsStateText(VFS_STATE_PATHS.locale, "piloti.locale.v1");
    expect(migrated).toBe("fr");
    expect(store.has("piloti.locale.v1")).toBe(false);
    expect(getVfsEntry(VFS_STATE_PATHS.locale)?.content).toBe("fr");
  });

  it("fires subscribeVfsPath only on real content changes to the subscribed file", () => {
    writeVfsStateText(VFS_STATE_PATHS.settingsPane, "appearance\n");

    const updates: Array<string | null> = [];
    const unsub = subscribeVfsPath(VFS_STATE_PATHS.settingsPane, (content) => {
      updates.push(content);
    });

    // Identical write should be skipped
    expect(writeVfsStateText(VFS_STATE_PATHS.settingsPane, "appearance\n")).toBe(false);
    expect(updates).toEqual([]);

    // Unrelated VFS file change should not trigger subscriber
    writeVfsTextFile("/home/user/Documents/other.txt", "hello");
    expect(updates).toEqual([]);

    // Live edit simulating Text Editor / Files update triggers subscriber
    writeVfsTextFile(VFS_STATE_PATHS.settingsPane, "dock\n");
    expect(updates).toEqual(["dock\n"]);

    removeVfsStateFile(VFS_STATE_PATHS.settingsPane);
    expect(updates).toEqual(["dock\n", null]);
    unsub();
  });

  it("forwards writes and removals to an optional host mirror and sanitizes cache paths", () => {
    const ops: string[] = [];
    registerVfsHostSync({
      writeText: (path, content) => ops.push(`write:${path}:${content.trim()}`),
      removeFile: (path) => ops.push(`rm:${path}`),
    });

    const cachePath = getVfsCacheFilePath("piloti.web-app-meta:v1");
    expect(cachePath).toBe("/home/user/.cache/piloti/piloti.web-app-meta-v1.json");

    writeVfsStateJson(cachePath, { ok: true }, false);
    removeVfsStateFile(cachePath);
    expect(ops).toEqual([
      `write:${cachePath}:{"ok":true}`,
      `rm:${cachePath}`,
    ]);
  });
});

