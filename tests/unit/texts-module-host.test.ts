import { beforeAll, describe, expect, test } from "bun:test";
import { createDomicileEditorHost } from "@/apps/texts/host";
import { Ok } from "@cprussin/option-result";
import { createFakeDomicile } from "../helpers/fake-domicile";

beforeAll(() => {
  // The module registers a pagehide handler; there is no window in the test runner.
  (globalThis as { addEventListener?: unknown }).addEventListener ??= () => {};
});

async function start(seed: Record<string, string> = {}) {
  const { domicile } = createFakeDomicile();
  for (const [path, text] of Object.entries(seed)) {
    await domicile.processes.run(["mkdir", "-p", "--", `/home/user/${path.slice(0, path.lastIndexOf("/"))}`]);
    await domicile.files.write(path, text);
  }
  // A bus nobody speaks on.
  const dbus = { match: async () => Ok({ items: new ReadableStream() }) };
  const { host } = await createDomicileEditorHost(Object.assign(domicile, { dbus }) as never);
  return { host, files: domicile.files };
}

describe("Texts module host (piloti.vfs over Domicile)", () => {
  test("saves and reads back at the real path", async () => {
    const { host } = await start();
    await host.vfs.write("/home/user/note.txt", "line 1\nline 2\n");
    expect(await host.vfs.readText(host.normalizePath("/home/user//note.txt"))).toBe("line 1\nline 2\n");
  });

  test("a failed write rejects so the editor stays dirty", async () => {
    const { host } = await start();
    expect(host.vfs.write("/nowhere/a.txt", "x")).rejects.toThrow();
  });

  test("a new document goes to the Desktop under the real home", async () => {
    const { host } = await start();
    expect(host.defaultNewFilePath("Untitled.txt")).toBe("/home/user/Desktop/Untitled.txt");
  });

  test("an unsaved document goes to the localized Desktop folder", async () => {
    const { host } = await start({ ".config/user-dirs.dirs": 'XDG_DESKTOP_DIR="$HOME/Bureau"\n' });
    expect(host.defaultNewFilePath("Untitled.txt")).toBe("/home/user/Bureau/Untitled.txt");
  });

  test("editor preferences persist to piloti-texts/settings.ini", async () => {
    const { host, files } = await start();
    host.writeEditorPrefs({ "word-wrap": true, "font-size": 14 });
    await new Promise((r) => setTimeout(r, 10));
    const ini = (await files.readText(".config/piloti-texts/settings.ini")).unwrapOr("" as never) as string;
    expect(ini).toContain("[Editor]");
    expect(ini).toContain("word-wrap=true");
    expect(host.readEditorPrefs()).toEqual({ "word-wrap": "true", "font-size": "14" });
  });

  test("preferences from before the rename are still read", async () => {
    const { host } = await start({ ".config/piloti/notepad.ini": "[Editor]\nword-wrap=false\n" });
    expect(host.readEditorPrefs()).toEqual({ "word-wrap": "false" });
  });

  test("confirm-unsaved-on-close follows general.ini", async () => {
    const on = await start({ ".config/piloti/general.ini": "[Windows]\nconfirm-unsaved-on-close=true\n" });
    expect(on.host.confirmUnsavedOnClose()).toBe(true);
    expect((await start()).host.confirmUnsavedOnClose()).toBe(false);
  });
});
