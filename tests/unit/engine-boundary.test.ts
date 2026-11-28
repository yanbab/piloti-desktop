import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dir, "../../src");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return full === path.join(SRC, "platform") ? [] : sources(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** A source file without its comment lines. */
const code = (file: string) =>
  fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

describe("engine boundary", () => {
  it("only engine code touches piloti.files", () => {
    const offenders = sources(SRC)
      .filter((file) =>
        fs
          .readFileSync(file, "utf8")
          .split("\n")
          .some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && /\b(piloti|domicile)\??\.files\b/.test(line))
      )
      .map((file) => path.relative(SRC, file))
      // The accessor itself.
      .filter((file) => file !== path.join("core", "files", "host-files.ts"));
    expect(offenders).toEqual([]);
  });
});

/**
 * Command lines live in the engines: UI code calls a named function
 * (`engine/system-commands.ts`) and never runs a program itself. The plain
 * backends (`core/apps/`) take their host as an argument and may.
 */
describe("process boundary", () => {
  it("only engine code runs programs", () => {
    const offenders = sources(SRC)
      .filter((file) => !file.startsWith(path.join(SRC, "core/apps/")))
      .filter((file) => /\bprocesses\??\s*\.(run|spawn|launch)\(/.test(code(file)))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

/**
 * UI code asks `engine/`, not the Linux engine. Only entry points import it:
 * the list of other files is empty, and stays so.
 */
describe("engine-native boundary", () => {
  it("no new file outside the engines imports engine-native", () => {
    const entry = /^(piloti-desktop|piloti-greeter)\.tsx$/;
    const importers = sources(SRC)
      // Type-only imports are erased: they don't tie a file to Linux code.
      .filter((file) =>
        /["/]platform\/native["/)]/.test(code(file).replace(/import type [^;]*;/g, "")),
      )
      .map((file) => path.relative(SRC, file))
      .filter((file) => !entry.test(file))
      .sort();
    const allowed: string[] = JSON.parse(
      fs.readFileSync(path.join(import.meta.dir, "engine-native-importers.json"), "utf8"),
    );
    expect(importers).toEqual(allowed);
  });
});

/**
 * Components ask for the settings they read (`useDesktopSettings`…), so they
 * don't re-render on every settings change; `useSettings()` is for contexts.
 */
describe("settings boundary", () => {
  it("only contexts call useSettings()", () => {
    const offenders = sources(SRC)
      .filter((file) => !file.includes(`${path.sep}context${path.sep}`))
      .filter((file) =>
        fs
          .readFileSync(file, "utf8")
          .split("\n")
          .some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && /\buseSettings\(\)/.test(line))
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
 * demo's storage. Only the demo's entry point still imports it from outside
 * `engine-web`: the list may only get shorter.
 */
describe("web-vfs boundary", () => {
  it("no new file outside engine-web imports web-vfs", () => {
    const all = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return full === path.join(SRC, "platform/web") ? [] : all(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      });
    const importers = all(SRC)
      .filter((file) => /["/]platform\/web\/web-vfs["\)]/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file))
      .sort();
    const allowed: string[] = JSON.parse(
      fs.readFileSync(path.join(import.meta.dir, "web-vfs-importers.json"), "utf8"),
    );
    expect(importers).toEqual(allowed);
  });
});

/** The Linux bundle carries neither the demo's storage nor its fakes. */
describe("engine-web boundary", () => {
  it("only the demo's entry point imports engine-web", () => {
    const importers = sources(SRC)
      .filter((file) => /(from |import\()"[^"]*platform\/web[/"]/.test(code(file).replace(/import type [^;]*;/g, "")))
      .map((file) => path.relative(SRC, file));
    expect(importers).toEqual(["piloti-web.tsx"]);
  });
});

/** Code asks for a capability, never which engine it runs on. */
describe("engine kind", () => {
  it("nothing asks which engine this is", () => {
    const offenders = sources(SRC)
      .filter((file) => /\bisWebEngine\b|getEngine\(\)\.kind\b/.test(code(file)))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

/** A backend an app module can run: no React, no state, nothing of the shell. */
describe("plain backend boundary", () => {
  it("core/apps imports no React, UI or platform", () => {
    const offenders = sources(path.join(SRC, "core/apps"))
      .filter((file) => /from "(react|@\/(ui|platform)\/)/.test(code(file)))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

/**
 * `core/` is plain TypeScript, `platform/` its adapters, `ui/` the React shell
 * and apps. Imports go down only.
 */
describe("layers", () => {
  /** Files of `layer` that import from `forbidden`, types included or not. */
  const importers = (layer: string, forbidden: string, { types = true } = {}) => {
    const all = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return all(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      });
    const target = new RegExp(`(from |import\\()"@/(${forbidden})[/"]`);
    return all(path.join(SRC, layer))
      .filter((file) => {
        const text = types ? code(file) : code(file).replace(/import type [^;]*;/g, "");
        return target.test(text);
      })
      .map((file) => path.relative(SRC, file))
      .sort();
  };

  it("core imports neither platform nor UI", () => {
    expect(importers("core", "platform|ui")).toEqual([]);
  });

  it("platform imports no UI", () => {
    expect(importers("platform", "ui")).toEqual([]);
  });

  it("UI imports the shared part of the platform, not an engine", () => {
    expect(importers("ui", "platform/(native|web)", { types: false })).toEqual([]);
  });
});
