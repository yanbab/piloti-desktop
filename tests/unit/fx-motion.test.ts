import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FX_DURATION, fxCssVariables, fxTransition } from "@/ui/fx/motion";

const root = join(import.meta.dir, "../..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("piloti-fx", () => {
  test("fx.css declares the same values as motion.ts", () => {
    const css = readFileSync(join(root, "src/ui/fx/fx.css"), "utf8");
    const declared = Object.fromEntries(
      [...css.matchAll(/(--fx-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
    );
    expect(declared).toEqual(fxCssVariables());
  });

  test("builds transitions", () => {
    expect(fxTransition(FX_DURATION.slide, "settle")).toBe("transform 350ms cubic-bezier(0.22, 1, 0.36, 1)");
    expect(fxTransition(200, "spring", "left", "top")).toBe(
      "left 200ms cubic-bezier(0.34, 1.45, 0.5, 1), top 200ms cubic-bezier(0.34, 1.45, 0.5, 1)",
    );
  });

  test("no curve is written out outside piloti-fx", () => {
    const offenders = sources(join(root, "src"))
      .filter((path) => !path.includes("/ui/fx/"))
      .filter((path) => /cubic-bezier\(/.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});
