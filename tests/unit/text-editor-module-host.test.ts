import { beforeAll, describe, expect, test } from "bun:test";
import { createDomicileEditorHost } from "@/apps/text-editor/host";

type Res<T> = { isOk: () => boolean; unwrapOr: (d: T) => T };
const ok = <T,>(v: T): Res<T> => ({ isOk: () => true, unwrapOr: () => v });
const err = <T,>(): Res<T> => ({ isOk: () => false, unwrapOr: (d) => d });

/** A fake `domicile.files` over an in-memory map of path -> text. */
function fakeFiles(initial: Record<string, string>, failWrites = false) {
  const disk = new Map(Object.entries(initial));
  const writes: Array<[string, string]> = [];
  const files = {
    readText: async (p: string) => (disk.has(p) ? ok(disk.get(p)!) : err<string>()),
    write: async (p: string, data: string) => {
      if (failWrites) return err<unknown>();
      disk.set(p, data);
      writes.push([p, data]);
      return ok(undefined);
    },
    createDir: async () => ok(undefined),
    watch: async () => err<unknown>(),
  };
  return { files: files as never, disk, writes };
}

beforeAll(() => {
  // The module registers a pagehide handler; there is no window in the test runner.
  (globalThis as { addEventListener?: unknown }).addEventListener ??= () => {};
});

describe("Text Editor module host (Domicile files)", () => {
  test("saving writes the text to the real path and reports success", async () => {
    const { files, disk } = fakeFiles({});
    const { host } = await createDomicileEditorHost(files, null);
    const saved = await host.bridge!.fs!.writeText("/home/u//Documents/note.txt", "hello");
    expect(saved).toBe(true);
    expect(disk.get("/home/u/Documents/note.txt")).toBe("hello");
  });

  test("a failed write reports failure so the editor stays dirty", async () => {
    const { files, disk } = fakeFiles({}, true);
    const { host } = await createDomicileEditorHost(files, null);
    expect(await host.bridge!.fs!.writeText("/tmp/a.txt", "x")).toBe(false);
    expect(disk.size).toBe(0);
  });

  test("a saved file reads back unchanged", async () => {
    const { files } = fakeFiles({});
    const { host } = await createDomicileEditorHost(files, null);
    await host.bridge!.fs!.writeText("/tmp/b.txt", "line 1\nline 2\n");
    expect(await host.bridge!.fs!.readText("/tmp/b.txt")).toBe("line 1\nline 2\n");
  });

  test("the file opened at start is preloaded for the editor", async () => {
    const { files } = fakeFiles({ "/tmp/open.txt": "opened" });
    const { host } = await createDomicileEditorHost(files, "/tmp/open.txt");
    expect(host.peekFile("/tmp/open.txt")).toEqual({ kind: "file", content: "opened" });
    expect(host.peekFile("/tmp/other.txt")).toBeUndefined();
  });

  test("an unsaved document goes to the localized Desktop folder", async () => {
    const { files } = fakeFiles({
      ".config/user-dirs.dirs": 'XDG_DESKTOP_DIR="$HOME/Bureau"\n',
    });
    const { host } = await createDomicileEditorHost(files, null);
    expect(host.defaultNewFilePath("Untitled.txt")).toBe("Bureau/Untitled.txt");
    const none = await createDomicileEditorHost(fakeFiles({}).files, null);
    expect(none.host.defaultNewFilePath("Untitled.txt")).toBe("Desktop/Untitled.txt");
  });

  test("editor preferences persist to notepad.ini", async () => {
    const { files, disk } = fakeFiles({});
    const { host } = await createDomicileEditorHost(files, null);
    host.writeEditorPrefs({ "word-wrap": true, "font-size": 14 });
    await Promise.resolve();
    const ini = disk.get(".config/piloti/notepad.ini") ?? "";
    expect(ini).toContain("[Editor]");
    expect(ini).toContain("word-wrap=true");
    expect(host.readEditorPrefs()).toEqual({ "word-wrap": "true", "font-size": "14" });
  });

  test("confirm-unsaved-on-close follows general.ini", async () => {
    const on = await createDomicileEditorHost(
      fakeFiles({ ".config/piloti/general.ini": "[Windows]\nconfirm-unsaved-on-close=true\n" }).files,
      null,
    );
    expect(on.host.confirmUnsavedOnClose()).toBe(true);
    const off = await createDomicileEditorHost(fakeFiles({}).files, null);
    expect(off.host.confirmUnsavedOnClose()).toBe(false);
  });
});
