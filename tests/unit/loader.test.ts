import { describe, expect, test } from "bun:test";
import type { Files } from "@domicile-desktop/sdk/desktop/files";
import { discoverPlugins } from "@/lib/plugins/loader";

function createMockFiles(tree: Record<string, string | "dir">): Files {
  const ok = <T,>(val: T) => ({
    ok: true as const,
    match: <R,>(handlers: { Ok: (v: T) => R; Err: (e: unknown) => R }) =>
      handlers.Ok(val),
  });
  const err = (e: unknown) => ({
    ok: false as const,
    match: <R,>(handlers: { Ok: (v: never) => R; Err: (errVal: unknown) => R }) =>
      handlers.Err(e),
  });

  return {
    readDir: async (dir: string) => {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      const seen = new Set<string>();
      const entries: Array<{ name: string; fileType: number }> = [];
      for (const key of Object.keys(tree)) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const firstSeg = rest.split("/")[0];
        if (!firstSeg || seen.has(firstSeg)) continue;
        seen.add(firstSeg);
        const isDir = rest.includes("/") || tree[key] === "dir";
        entries.push({ name: firstSeg, fileType: isDir ? 1 : 0 });
      }
      return ok(entries) as never;
    },
    readText: async (path: string) => {
      const val = tree[path];
      if (typeof val === "string" && val !== "dir") return ok(val) as never;
      return err(new Error("ENOENT")) as never;
    },
    stat: async (path: string) => {
      const val = tree[path];
      if (val === undefined) return err(new Error("ENOENT")) as never;
      return ok({ fileType: val === "dir" ? 1 : 0 }) as never;
    },
  } as unknown as Files;
}

describe("discoverPlugins", () => {
  test("discovers standalone .css and .js files without manifest.json", async () => {
    const files = createMockFiles({
      ".config/piloti/plugins/nord.css": ":root { --adw-accent: #88c0d0; }",
      ".config/piloti/plugins/hello.js": "export function activate() {}",
    });

    const list = await discoverPlugins(files, ["nord"]);
    expect(list.length).toBe(2);

    const hello = list.find((p) => p.id === "hello");
    expect(hello).toBeDefined();
    expect(hello?.sourceType).toBe("js");
    expect(hello?.hasManifest).toBe(false);
    expect(hello?.scriptPath).toBe(".config/piloti/plugins/hello.js");
    expect(hello?.enabled).toBe(false);

    const nord = list.find((p) => p.id === "nord");
    expect(nord).toBeDefined();
    expect(nord?.sourceType).toBe("css");
    expect(nord?.hasManifest).toBe(false);
    expect(nord?.stylePath).toBe(".config/piloti/plugins/nord.css");
    expect(nord?.enabled).toBe(true);
  });

  test("discovers folder plugins with or without manifest.json", async () => {
    const files = createMockFiles({
      ".config/piloti/plugins/plain-folder/style.css": "body {}",
      ".config/piloti/plugins/plain-folder/index.js": "console.log(1);",
      ".config/piloti/plugins/custom-pack/manifest.json": JSON.stringify({
        id: "custom-pack",
        name: "Custom Pack",
        version: "1.2.0",
        description: "Test pack",
        style: "theme.css",
        commands: [{ id: "open-site", title: "Open Site", url: "https://example.com" }],
      }),
      ".config/piloti/plugins/custom-pack/theme.css": "body {}",
    });

    const list = await discoverPlugins(files, ["custom-pack"]);
    expect(list.length).toBe(2);

    const plain = list.find((p) => p.id === "plain-folder");
    expect(plain?.hasManifest).toBe(false);
    expect(plain?.stylePath).toBe(".config/piloti/plugins/plain-folder/style.css");
    expect(plain?.scriptPath).toBe(".config/piloti/plugins/plain-folder/index.js");

    const custom = list.find((p) => p.id === "custom-pack");
    expect(custom?.hasManifest).toBe(true);
    expect(custom?.name).toBe("Custom Pack");
    expect(custom?.version).toBe("1.2.0");
    expect(custom?.stylePath).toBe(".config/piloti/plugins/custom-pack/theme.css");
    expect(custom?.commands.length).toBe(1);
    expect(custom?.enabled).toBe(true);
  });

  test("discovers declarative animated wallpapers in plugin manifests", async () => {
    const files = createMockFiles({
      ".config/piloti/plugins/aurora/manifest.json": JSON.stringify({
        id: "aurora",
        name: "Aurora",
        wallpapers: [
          {
            id: "aurora-wp",
            name: "Aurora",
            type: "css",
            style: "wallpaper.css",
            darkStyle: "wallpaper-dark.css",
          },
        ],
      }),
      ".config/piloti/plugins/aurora/wallpaper.css": ".piloti-wp-anim {}",
      ".config/piloti/plugins/aurora/wallpaper-dark.css": ".piloti-wp-anim {}",
    });

    const list = await discoverPlugins(files, ["aurora"]);
    expect(list).toHaveLength(1);
    expect(list[0]?.wallpapers).toEqual([
      {
        id: "aurora-wp",
        name: "Aurora",
        type: "css",
        style: ".config/piloti/plugins/aurora/wallpaper.css",
        darkStyle: ".config/piloti/plugins/aurora/wallpaper-dark.css",
      },
    ]);
  });
});

