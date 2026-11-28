import { afterEach, describe, expect, it } from "bun:test";
import { createNativeVfs, type NativeVfsHost } from "@/platform/native/vfs";
import { createWebVfs } from "@/platform/web/vfs";
import type { Vfs, VfsError } from "@/core/ports/vfs";
import { createFakeDomicile } from "../helpers/fake-domicile";

const HOME = "/home/user";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const settle = () => sleep(60);

const native = () => {
  const fake = createFakeDomicile();
  const vfs = createNativeVfs(fake.domicile as unknown as NativeVfsHost, { debounceMs: 5, pollMs: 20 });
  return { vfs, fake };
};
// The web engine runs over the browser VFS; its Domicile only serves system files.
const web = () => ({ vfs: createWebVfs({ files: createFakeDomicile().domicile.files } as never) });

let run = 0;
const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));

const code = (op: Promise<unknown>) =>
  op.then(
    () => "resolved",
    (error: VfsError) => error.code,
  );

for (const [engine, create] of [["native", native], ["web", web]] as const) {
  describe(`piloti.vfs contract (${engine})`, () => {
    const setup = async () => {
      const { vfs } = create();
      const dir = `${HOME}/vfs-${engine}-${(run += 1)}`;
      await vfs.createDir(dir);
      return { vfs, dir };
    };
    const watched = (vfs: Vfs, path: string) => {
      const seen = { count: 0 };
      stops.push(vfs.watch(path, () => (seen.count += 1)));
      return seen;
    };
    /** Whether `change` is reported by the watch. */
    const reports = async (seen: { count: number }, change: () => Promise<unknown>) => {
      await settle();
      const before = seen.count;
      await change();
      await settle();
      return seen.count > before;
    };

    it("writes, reads, stats and lists", async () => {
      const { vfs, dir } = await setup();
      await vfs.write(`${dir}/a.txt`, "héllo");
      await vfs.write(`${dir}/.dot`, "x");
      await vfs.createDir(`${dir}/sub/deeper`);
      expect(await vfs.readText(`${dir}/a.txt`)).toBe("héllo");
      expect(await vfs.read(`${dir}/a.txt`)).toEqual(new TextEncoder().encode("héllo"));
      expect(await vfs.stat(`${dir}/a.txt`)).toMatchObject({ kind: "file", name: "a.txt" });
      expect((await vfs.list(dir))!.map((e) => `${e.name}:${e.kind}`).sort()).toEqual([
        ".dot:file",
        "a.txt:file",
        "sub:directory",
      ]);
    });

    it("answers null for what is missing, and rejects a write with no folder", async () => {
      const { vfs, dir } = await setup();
      expect(await vfs.readText(`${dir}/none`)).toBeNull();
      expect(await vfs.stat(`${dir}/none`)).toBeNull();
      expect(await vfs.list(`${dir}/none`)).toBeNull();
      expect(await code(vfs.write(`${dir}/none/a`, "x"))).toBe("not-found");
    });

    it("lands writes to one path in order", async () => {
      const { vfs, dir } = await setup();
      await Promise.all(["1", "2", "3"].map((text) => vfs.write(`${dir}/a`, text)));
      expect(await vfs.readText(`${dir}/a`)).toBe("3");
    });

    it("moves and copies to the exact new path, keeping what is there", async () => {
      const { vfs, dir } = await setup();
      await vfs.write(`${dir}/a`, "A");
      await vfs.write(`${dir}/b`, "B");
      await vfs.createDir(`${dir}/sub`);
      expect(await code(vfs.move(`${dir}/a`, `${dir}/b`))).toBe("exists");
      expect(await code(vfs.copy(`${dir}/a`, `${dir}/b`))).toBe("exists");
      expect(await code(vfs.move(`${dir}/none`, `${dir}/c`))).toBe("not-found");
      await vfs.copy(`${dir}/a`, `${dir}/sub/copy`);
      await vfs.move(`${dir}/a`, `${dir}/sub/moved`);
      await vfs.move(`${dir}/b`, `${dir}/sub/moved`, { overwrite: true });
      expect(await vfs.readText(`${dir}/sub/copy`)).toBe("A");
      expect(await vfs.readText(`${dir}/sub/moved`)).toBe("B");
      expect(await vfs.stat(`${dir}/a`)).toBeNull();
    });

    it("keeps a symlink one when writing through it", async () => {
      const { vfs, dir } = await setup();
      await vfs.write(`${dir}/target`, "old");
      await vfs.symlink(`${dir}/target`, `${dir}/link`);
      await vfs.write(`${dir}/link`, "new");
      expect(await vfs.readText(`${dir}/target`)).toBe("new");
      expect(await vfs.readText(`${dir}/link`)).toBe("new");
      expect((await vfs.list(dir))!.find((e) => e.name === "link")?.isSymlink).toBe(true);
    });

    it("trashes, restores, removes and empties the Trash", async () => {
      const { vfs, dir } = await setup();
      const trash = `${HOME}/.local/share/Trash/files`;
      await vfs.write(`${dir}/gone`, "x");
      await vfs.trash(`${dir}/gone`);
      expect(await vfs.stat(`${dir}/gone`)).toBeNull();
      const name = (await vfs.list(trash))!.find((e) => e.name.startsWith("gone"))!.name;
      expect(await vfs.restore(`${trash}/${name}`)).toBe(`${dir}/gone`);
      expect(await vfs.readText(`${dir}/gone`)).toBe("x");
      await vfs.trash(`${dir}/gone`);
      await vfs.emptyTrash();
      expect(await vfs.list(trash)).toEqual([]);
      await vfs.write(`${dir}/b`, "x");
      await vfs.remove(dir);
      await vfs.remove(dir);
      expect(await vfs.stat(dir)).toBeNull();
    });

    it("refuses to restore what isn't in the Trash", async () => {
      const { vfs, dir } = await setup();
      await vfs.write(`${dir}/stay`, "x");
      await expect(vfs.restore(dir)).rejects.toThrow();
      await expect(vfs.restore(undefined as unknown as string)).rejects.toThrow();
      expect(await vfs.readText(`${dir}/stay`)).toBe("x");
    });

    it("sets and reads metadata", async () => {
      const { vfs, dir } = await setup();
      await vfs.write(`${dir}/a`, "x");
      await vfs.setMetadata(`${dir}/a`, { "metadata::piloti-cursor": 4 });
      expect(await vfs.metadata(`${dir}/a`, ["metadata::piloti-cursor", "metadata::other"])).toEqual({
        "metadata::piloti-cursor": "4",
      });
    });

    it("watches a folder, own writes included, until stopped", async () => {
      const { vfs, dir } = await setup();
      let count = 0;
      const stop = vfs.watch(dir, () => (count += 1));
      await settle();
      expect(count).toBe(1); // in place
      await vfs.write(`${dir}/a`, "x");
      await settle();
      expect(count).toBeGreaterThan(1);
      stop();
      const stopped = count;
      await vfs.write(`${dir}/a`, "y");
      await settle();
      expect(count).toBe(stopped);
    });

    it("keeps watching a file replaced again and again, or removed and made anew", async () => {
      const { vfs, dir } = await setup();
      await vfs.write(`${dir}/a`, "1");
      const seen = watched(vfs, `${dir}/a`);
      expect(await reports(seen, () => vfs.write(`${dir}/a`, "2"))).toBe(true);
      expect(await reports(seen, () => vfs.write(`${dir}/a`, "3"))).toBe(true);
      expect(await reports(seen, () => vfs.remove(`${dir}/a`))).toBe(true);
      expect(await reports(seen, () => vfs.write(`${dir}/a`, "4"))).toBe(true);
    });

    it("keeps watching a folder removed and made anew, and one not there yet", async () => {
      const { vfs, dir } = await setup();
      const seen = watched(vfs, `${dir}/x/y`);
      expect(await reports(seen, () => vfs.createDir(`${dir}/x/y`))).toBe(true);
      expect(await reports(seen, () => vfs.write(`${dir}/x/y/a`, "1"))).toBe(true);
      expect(await reports(seen, () => vfs.remove(`${dir}/x`))).toBe(true);
      expect(await reports(seen, () => vfs.createDir(`${dir}/x/y`))).toBe(true);
      expect(await reports(seen, () => vfs.write(`${dir}/x/y/b`, "2"))).toBe(true);
    });

    it("hears the target of a watched symlink", async () => {
      const { vfs, dir } = await setup();
      await vfs.createDir(`${dir}/dotfiles`);
      await vfs.write(`${dir}/dotfiles/real`, "1");
      await vfs.symlink(`${dir}/dotfiles/real`, `${dir}/link`);
      const seen = watched(vfs, `${dir}/link`);
      expect(await reports(seen, () => vfs.write(`${dir}/dotfiles/real`, "2"))).toBe(true);
    });
  });
}

describe("native watching", () => {
  it("shares one watch per folder and releases it", async () => {
    const { vfs, fake } = native();
    await vfs.createDir(`${HOME}/s`);
    await vfs.write(`${HOME}/s/a`, "");
    await vfs.write(`${HOME}/s/b`, "");
    const all = [`${HOME}/s`, `${HOME}/s/a`, `${HOME}/s/b`].map((p) => vfs.watch(p, () => {}));
    await settle();
    expect(fake.watchCount()).toBe(1);
    all.forEach((stop) => stop());
    expect(fake.watchCount()).toBe(0);
  });

  it("polls folders past the cap, and when the system has no watch left", async () => {
    for (const limits of [{ maxWatches: 1, watchLimit: 128 }, { maxWatches: 30, watchLimit: 1 }]) {
      const fake = createFakeDomicile({ watchLimit: limits.watchLimit });
      const vfs = createNativeVfs(fake.domicile as unknown as NativeVfsHost, {
        maxWatches: limits.maxWatches,
        pollMs: 10,
        debounceMs: 2,
      });
      await vfs.createDir(`${HOME}/one`);
      await vfs.createDir(`${HOME}/two`);
      const counts = [0, 0];
      const all = ["one", "two"].map((name, i) => vfs.watch(`${HOME}/${name}`, () => (counts[i]! += 1)));
      await sleep(80);
      expect(fake.watchCount()).toBe(1);
      expect(counts[1]).toBeGreaterThan(2); // nothing changed: it is being polled
      all.forEach((stop) => stop());
    }
  });
});

describe("native symlinks", () => {
  it("writes through a dangling one, keeping it", async () => {
    const { vfs } = native();
    await vfs.createDir(`${HOME}/dangling`);
    await vfs.symlink(`${HOME}/dangling/not-yet`, `${HOME}/dangling/link`);
    await vfs.write(`${HOME}/dangling/link`, "made");
    expect(await vfs.readText(`${HOME}/dangling/not-yet`)).toBe("made");
    expect((await vfs.list(`${HOME}/dangling`))!.find((e) => e.name === "link")?.isSymlink).toBe(true);
  });
});
