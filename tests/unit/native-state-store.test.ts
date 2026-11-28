import { afterEach, describe, expect, it } from "bun:test";
import { createNativeStateStore, type NativeStateStore } from "@/lib/engine-native/state-store";
import { createNativeVfs, type NativeVfsHost } from "@/lib/engine-native/vfs";
import { createFakeDomicile } from "../helpers/fake-domicile";

const HOME = "/home/user";
const CONFIG = `${HOME}/.config/piloti`;
const settle = () => new Promise((r) => setTimeout(r, 60));

const stores: NativeStateStore[] = [];
afterEach(() => stores.splice(0).forEach((s) => s.dispose()));

async function start(seed: Record<string, string> = {}) {
  const fake = createFakeDomicile();
  const vfs = createNativeVfs(fake.domicile as unknown as NativeVfsHost, { debounceMs: 5 });
  for (const [path, text] of Object.entries(seed)) {
    await vfs.createDir(path.slice(0, path.lastIndexOf("/")));
    await vfs.write(path, text);
  }
  const store = await createNativeStateStore(vfs, HOME);
  stores.push(store);
  await settle();
  /** What another program does: write the disk, not through the store. */
  const edit = async (path: string, text: string) => {
    await vfs.createDir(path.slice(0, path.lastIndexOf("/")));
    await vfs.write(path, text);
    await settle();
  };
  return { vfs, store, edit, fake };
}

const heard = (store: NativeStateStore, path: string) => {
  const values: (string | null)[] = [];
  store.subscribe(path, () => values.push(store.read(path)));
  return values;
};

describe("native state store", () => {
  it("reads the large app cache on its own, and says when it is there", async () => {
    const cache = `${HOME}/.cache/piloti/xdg-apps.json`;
    const { store } = await start({ [cache]: '{"v":4}' });
    await store.ready!(cache);
    expect(store.read(cache)).toBe('{"v":4}');
  });

  it("has the saved files before anything reads them, but not logs", async () => {
    const { store } = await start({
      [`${CONFIG}/settings.ini`]: "a=1",
      [`${CONFIG}/apps/files.ini`]: "b=2",
      [`${HOME}/.local/state/piloti/session.json`]: "[]",
      [`${HOME}/.local/state/piloti/piloti.log`]: "noise",
      [`${HOME}/.config/mimeapps.list`]: "[Default Applications]",
    });
    expect(store.read(`${CONFIG}/settings.ini`)).toBe("a=1");
    expect(store.read(`${CONFIG}/apps/files.ini`)).toBe("b=2");
    expect(store.read(`${HOME}/.local/state/piloti/session.json`)).toBe("[]");
    expect(store.read(`${HOME}/.config/mimeapps.list`)).toBe("[Default Applications]");
    expect(store.read(`${HOME}/.local/state/piloti/piloti.log`)).toBeNull();
  });

  it("saves to disk, making folders, with the last write winning", async () => {
    const { store, vfs } = await start();
    const path = `${CONFIG}/apps/new.ini`;
    store.write(path, "1");
    store.write(path, "2");
    expect(store.read(path)).toBe("2");
    await store.settled();
    expect(await vfs.readText(path)).toBe("2");
    store.remove(path);
    await store.settled();
    expect(await vfs.stat(path)).toBeNull();
  });

  it("follows edits and removals of a config file, with or without a subscriber", async () => {
    const path = `${CONFIG}/settings.ini`;
    const { store, edit, vfs } = await start({ [path]: "dark" });
    await edit(path, "light");
    expect(store.read(path)).toBe("light");
    const values = heard(store, path);
    await edit(path, "default");
    await vfs.remove(path);
    await settle();
    await edit(path, "dark");
    expect(values).toEqual(["default", null, "dark"]);
  });

  it("picks up config files and folders made later", async () => {
    const { store, edit } = await start();
    let changes = 0;
    store.subscribeDir(`${CONFIG}/apps`, () => (changes += 1));
    await edit(`${CONFIG}/apps/editor.ini`, "x=1");
    await settle();
    expect(store.read(`${CONFIG}/apps/editor.ini`)).toBe("x=1");
    expect(changes).toBe(1);
  });

  it("follows a state file only while someone subscribes", async () => {
    const path = `${HOME}/.local/state/piloti/window-bounds.json`;
    const { store, edit } = await start({ [path]: "{}" });
    await edit(path, "[1]");
    expect(store.read(path)).toBe("{}");
    const values = heard(store, path);
    await settle(); // the watch reads once when in place
    await edit(path, "[2]");
    expect(values).toEqual(["[1]", "[2]"]);
  });

  it("does not report its own write twice, or bring back an older one", async () => {
    const path = `${CONFIG}/settings.ini`;
    const { store } = await start({ [path]: "0" });
    const values = heard(store, path);
    for (const text of ["1", "2", "3"]) store.write(path, text);
    await store.settled();
    await settle();
    expect(values).toEqual(["1", "2", "3"]);
    expect(store.read(path)).toBe("3");
  });

  it("keeps the value of a file an editor has only truncated", async () => {
    const path = `${CONFIG}/settings.ini`;
    const { store, edit } = await start({ [path]: "kept" });
    await edit(path, "");
    expect(store.read(path)).toBe("kept");
  });

  it("holds a few folder watches, not one per file", async () => {
    const seed = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`${CONFIG}/apps/app${i}.ini`, "x"]),
    );
    const { fake } = await start(seed);
    await settle();
    expect(fake.watchCount()).toBeLessThanOrEqual(3);
  });
});
