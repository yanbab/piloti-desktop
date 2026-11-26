import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { refreshFromHostFile } from "@/lib/engine-native/host-state-refresh";

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
  it("the native entry loads no VFS path before it knows $HOME", () => {
    const loaded = staticImports(path.join(SRC, "piloti-desktop.tsx"));
    expect(loaded).toContain("lib/core/console-store.ts");
    expect(loaded).not.toContain("lib/engine/vfs-home.ts");
  });
});

describe("refreshFromHostFile", () => {
  const file = (disk: string | null, cache = "color-scheme=light") => {
    const state = { cache, writing: false };
    return {
      state,
      host: {
        isWriting: () => state.writing,
        readCache: () => state.cache,
        readHost: async () => disk,
        writeCache: (text: string) => void (state.cache = text),
      },
    };
  };

  it("takes an edit made on disk", async () => {
    const { state, host } = file("color-scheme=dark");
    await refreshFromHostFile(host);
    expect(state.cache).toBe("color-scheme=dark");
  });

  it("keeps the cache for a missing or half-written file", async () => {
    for (const disk of [null, "", "\n"]) {
      const { state, host } = file(disk);
      await refreshFromHostFile(host);
      expect(state.cache).toBe("color-scheme=light");
    }
  });

  it("lets the shell's own write win, started before or during the read", async () => {
    const before = file("old");
    before.state.writing = true;
    await refreshFromHostFile(before.host);
    expect(before.state.cache).toBe("color-scheme=light");

    const during = file("old");
    await refreshFromHostFile({
      ...during.host,
      readHost: async () => {
        during.state.cache = "color-scheme=default";
        return "old";
      },
    });
    expect(during.state.cache).toBe("color-scheme=default");
  });
});
