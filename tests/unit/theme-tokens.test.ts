import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Glob } from "bun";

// The theme contract: components use --ui-* tokens, adwaita.css is the
// base that sets them, and other themes only override.
const read = (path: string) => readFileSync(path, "utf8");
const defined = (css: string) =>
  new Set([...css.matchAll(/(?:^|[;{])\s*(--ui-[\w-]+)\s*:/gm)].map((m) => m[1]!));
const base = defined(read("src/styles/adwaita.css"));
const sources = [...new Glob("src/**/*.{ts,tsx,css}").scanSync(".")];

describe("theme tokens", () => {
  test("every token used without a fallback is set by the base theme", () => {
    const missing = sources.flatMap((path) =>
      [...read(path).matchAll(/var\((--ui-[\w-]*\w)\s*\)/g)]
        .filter((m) => !base.has(m[1]!))
        .map((m) => `${path}: ${m[1]}`),
    );
    expect(missing).toEqual([]);
  });

  test("the Cupertino theme is scoped to itself", () => {
    const rules = read("src/styles/cupertino.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...rules.matchAll(/([^{}]+)\{/g)].flatMap((m) =>
      m[1]!.trim().split(/,\n/),
    );
    for (const selector of selectors) {
      expect(selector.trim()).toStartWith(':root[data-interface-theme="cupertino"]');
    }
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
