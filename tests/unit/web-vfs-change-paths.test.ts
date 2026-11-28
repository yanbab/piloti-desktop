import { describe, expect, it } from "bun:test";
import {
  createVfsFolder,
  getWebVfsPerfStats,
  renameVfsEntry,
  subscribeWebVfs,
  vfsChangeAffects,
  writeVfsTextFile,
} from "@/platform/web/web-vfs";
import { writeVfsStateJson } from "@/core/state/vfs-state";

describe("vfsChangeAffects", () => {
  it("matches exact paths and ancestors", () => {
    expect(vfsChangeAffects(["/home/user/a.txt"], { path: "/home/user/a.txt" })).toBe(true);
    expect(vfsChangeAffects(["/home/user"], { path: "/home/user/a.txt" })).toBe(true);
    expect(vfsChangeAffects(["/home/user/b.txt"], { path: "/home/user/a.txt" })).toBe(false);
  });

  it("children mode ignores grandchildren", () => {
    const watch = { path: "/home/user", mode: "children" as const };
    expect(vfsChangeAffects(["/home/user/Desktop"], watch)).toBe(true);
    expect(vfsChangeAffects(["/home/user/.local/state/piloti/editor-state.json"], watch)).toBe(false);
  });

  it("subtree mode matches descendants; unknown changes always match", () => {
    expect(vfsChangeAffects(["/a/b/c/d"], { path: "/a/b", mode: "subtree" })).toBe(true);
    expect(vfsChangeAffects(undefined, { path: "/x" })).toBe(true);
  });
});

describe("subscribeWebVfs path filtering", () => {
  it("state writes do not wake folder listeners", () => {
    let desktopCalls = 0;
    let allCalls = 0;
    const seen: (readonly string[] | undefined)[] = [];
    const unsubDesktop = subscribeWebVfs(() => {
      desktopCalls += 1;
    }, { path: "/home/user/Desktop", mode: "children" });
    const unsubAll = subscribeWebVfs((detail) => {
      allCalls += 1;
      seen.push(detail.paths);
    });
    const before = getWebVfsPerfStats();

    // Texts cursor/scroll state: must not reload Desktop icons.
    writeVfsStateJson("/home/user/.local/state/piloti/editor-state.json", { a: Date.now() });
    writeVfsStateJson("/home/user/.local/state/piloti/editor-state.json", { a: Date.now() + 1 });
    expect(desktopCalls).toBe(0);
    expect(allCalls).toBeGreaterThan(0);
    expect(seen.at(-1)).toEqual(["/home/user/.local/state/piloti/editor-state.json"]);

    writeVfsTextFile("/home/user/Desktop/Note.txt", "hello");
    expect(desktopCalls).toBe(1);

    const folder = createVfsFolder("/home/user/Desktop", "Change Paths Test");
    expect(desktopCalls).toBe(2);
    renameVfsEntry(folder.path, "Change Paths Renamed");
    expect(desktopCalls).toBe(3);

    const after = getWebVfsPerfStats();
    expect(after.listenerSkips).toBeGreaterThan(before.listenerSkips);
    unsubDesktop();
    unsubAll();
  });
});
