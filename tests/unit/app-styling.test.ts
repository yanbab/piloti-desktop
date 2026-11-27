import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import baseline from "./app-styling-baseline.json";

/**
 * Apps lay their content out; how things look belongs to `components/elements`
 * and `components/ui`. Each app file may only keep as many appearance classes
 * (colour, type, radius, shadow) as it has today; new files get none.
 *
 * After removing some, lower the baseline: `UPDATE_STYLING_BASELINE=1 bun test app-styling`
 */
const APPS = join(import.meta.dir, "../../src/apps");
const BASELINE = join(import.meta.dir, "app-styling-baseline.json");

const APPEARANCE =
  /(?<![\w-])(?:bg|rounded|shadow|font|text-ui|text-white|text-black|text-\[|border-ui|hover-fill:)(?=[-:\[\s"'`])/g;

const counts = Object.fromEntries(
  (readdirSync(APPS, { recursive: true }) as string[])
    .filter((file) => file.endsWith(".tsx"))
    .sort()
    .map((file) => {
      const path = join(APPS, file);
      return [relative(APPS, path), readFileSync(path, "utf8").match(APPEARANCE)?.length ?? 0];
    })
    .filter(([, count]) => count),
) as Record<string, number>;

if (process.env.UPDATE_STYLING_BASELINE) {
  writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
}

describe("app styling", () => {
  test("no app file gains appearance classes", () => {
    const allowed: Record<string, number> = process.env.UPDATE_STYLING_BASELINE ? counts : baseline;
    const grown = Object.entries(counts)
      .filter(([file, count]) => count > (allowed[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} (allowed ${allowed[file] ?? 0})`);
    expect(grown).toEqual([]);
  });

  test("the smallest app needs none", () => {
    expect(counts["hello/HelloWorldApp.tsx"]).toBeUndefined();
  });
});
