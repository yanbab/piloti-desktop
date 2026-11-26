import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Glob } from "bun";

// The theme contract: components use --shell-* tokens, adwaita.css is the
// base that sets them, and other themes only override.
const read = (path: string) => readFileSync(path, "utf8");
const defined = (css: string) =>
  new Set([...css.matchAll(/(?:^|[;{])\s*(--shell-[\w-]+)\s*:/gm)].map((m) => m[1]!));
const base = defined(read("src/styles/adwaita.css"));
const sources = [...new Glob("src/**/*.{ts,tsx,css}").scanSync(".")];

describe("theme tokens", () => {
  test("every token used without a fallback is set by the base theme", () => {
    const missing = sources.flatMap((path) =>
      [...read(path).matchAll(/var\((--shell-[\w-]*\w)\s*\)/g)]
        .filter((m) => !base.has(m[1]!))
        .map((m) => `${path}: ${m[1]}`),
    );
    expect(missing).toEqual([]);
  });

  test("no source uses the old adw names", () => {
    // loader.ts translates the old names for installed plugins.
    const old = sources.filter(
      (path) => !path.endsWith("plugins/loader.ts") && /--adw-|[a-z]-adw-/.test(read(path)),
    );
    expect(old).toEqual([]);
  });

  test("component stylesheets use no Tailwind", () => {
    for (const path of new Glob("src/styles/components/*.css").scanSync(".")) {
      expect(read(path)).not.toMatch(/@apply|@utility|--spacing\(|theme\(/);
    }
  });
});
