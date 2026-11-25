import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveStem, compressNative, extractNative } from "@/lib/engine-native/archive";

// Runs the real scripts: the fake `processes.run` is a local spawn.
const piloti = {
  processes: {
    run: async (argv: string[]) => {
      const proc = Bun.spawnSync(argv);
      const ran = { code: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
      return { match: (m: { Ok: (r: typeof ran) => unknown }) => m.Ok(ran) };
    },
  },
} as never;

const hasBsdtar = Boolean(Bun.which("bsdtar"));
const root = mkdtempSync(join(tmpdir(), "piloti-archive-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("native archives", () => {
  it("names the extraction folder after the archive", () => {
    expect(archiveStem("a.tar.gz")).toBe("a");
    expect(archiveStem("My photos.ZIP")).toBe("My photos");
    expect(archiveStem("notes.7z")).toBe("notes");
  });

  it.skipIf(!hasBsdtar)("zips and extracts without overwriting, whatever the names", async () => {
    const names = ["a b.txt", "-dash.txt", "@at.txt", "$(touch hacked).txt"];
    for (const n of names) writeFileSync(join(root, n), n);
    mkdirSync(join(root, "dir"));
    writeFileSync(join(root, "dir", "inner.txt"), "inner");

    const all = [...names, "dir"].map((n) => join(root, n));
    const zip = await compressNative(piloti, all);
    expect(zip).toBe(join(root, "Archive.zip"));
    expect(await compressNative(piloti, all)).toBe(join(root, "Archive 2.zip"));

    const out = await extractNative(piloti, zip!);
    expect(out).toBe(join(root, "Archive"));
    for (const n of names) expect(readFileSync(join(out!, n), "utf8")).toBe(n);
    expect(readFileSync(join(out!, "dir", "inner.txt"), "utf8")).toBe("inner");
    expect(await extractNative(piloti, zip!)).toBe(join(root, "Archive 2"));
    expect(existsSync(join(root, "hacked"))).toBe(false);
  });

  it.skipIf(!hasBsdtar)("leaves nothing behind when it fails", async () => {
    writeFileSync(join(root, "broken.zip"), "not a zip");
    const before = readdirSync(root).sort();
    expect(await extractNative(piloti, join(root, "broken.zip"))).toBeNull();
    expect(await compressNative(piloti, [join(root, "missing")])).toBeNull();
    expect(readdirSync(root).sort()).toEqual(before);
  });
});
