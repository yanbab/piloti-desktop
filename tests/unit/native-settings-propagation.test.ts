import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dir, "../../src");

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  return (
    ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
      .map((ext) => base + ext)
      .find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null
  );
}

/** Everything `entry` loads before its first line runs. */
function staticImports(entry: string): string[] {
  const seen = new Set([entry]);
  for (const file of seen) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const imports = /^(?:import|export)\s+(?!type\s)(?:[^;'"]*?\sfrom\s+)?["']([^"']+)["']/gm;
    for (const [, spec] of source.matchAll(imports)) {
      const target = resolveImport(file, spec!);
      if (target) seen.add(target);
    }
  }
  return [...seen].map((file) => path.relative(SRC, file));
}

describe("native $HOME", () => {
  // `vfs-home` reads `$HOME` once, when it loads. Loaded before the entry has
  // asked for it, the Linux shell uses `/home/user`: settings.ini saved from
  // the Text Editor then goes nowhere.
  it("the native entries load no VFS path before they know $HOME", () => {
    const loaded = staticImports(path.join(SRC, "piloti-desktop.tsx"));
    expect(loaded).toContain("lib/core/console-store.ts");
    expect(loaded).not.toContain("lib/engine/vfs-home.ts");
    expect(staticImports(path.join(SRC, "piloti-greeter.tsx"))).not.toContain("lib/engine/vfs-home.ts");
  });

  // The bundle inlines `import()`, but a module still loads when first imported.
  it("and import none before the line that sets $HOME", () => {
    for (const name of ["piloti-desktop.tsx", "piloti-greeter.tsx"]) {
      const entry = path.join(SRC, name);
      const source = fs.readFileSync(entry, "utf8");
      const setsHome = source.search(/__PILOTI_VFS_HOME__ = /);
      expect(setsHome).toBeGreaterThan(0);
      // `boot` runs top to bottom: what precedes the assignment loads before it.
      const before = source.slice(source.indexOf("async function boot"), setsHome);
      for (const [, spec] of before.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
        const target = resolveImport(entry, spec!)!;
        expect([spec, staticImports(target).includes("lib/engine/vfs-home.ts")]).toEqual([spec, false]);
      }
    }
  });
});
