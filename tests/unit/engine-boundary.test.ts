import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dir, "../../src");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return /^engine(-native|-web)?$/.test(entry.name) ? [] : sources(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("engine boundary", () => {
  it("only engine code touches piloti.files", () => {
    const offenders = sources(SRC)
      .filter((file) =>
        fs
          .readFileSync(file, "utf8")
          .split("\n")
          .some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && /\b(piloti|domicile)\??\.files\b/.test(line))
      )
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

/**
 * Views read files with `hooks/use-vfs.ts` (cached, one shared watch per path)
 * or `retainVfsWatch`; a direct `vfs.watch` would open its own inotify watch.
 */
describe("vfs watch boundary", () => {
  it("only engine code calls vfs.watch", () => {
    const offenders = sources(SRC)
      .filter((file) =>
        fs
          .readFileSync(file, "utf8")
          .split("\n")
          .some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && /\bvfs\??\.watch\(/.test(line))
      )
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

/**
 * On Linux files are reached through `piloti.vfs`; `web-vfs` is the browser
 * demo's storage. These files still use it (favorites, emblems, templates,
 * clipboard, rename events, demo-only paths): the list may only get shorter.
 */
describe("web-vfs boundary", () => {
  it("no new file outside engine-web imports web-vfs", () => {
    const all = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === "engine-web" ? [] : all(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      });
    const importers = all(SRC)
      .filter((file) => /["/]engine-web\/web-vfs["\)]/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file))
      .sort();
    const allowed: string[] = JSON.parse(
      fs.readFileSync(path.join(import.meta.dir, "web-vfs-importers.json"), "utf8"),
    );
    expect(importers).toEqual(allowed);
  });
});
