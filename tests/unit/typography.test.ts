// Text sizes come from the type roles, so they follow the font settings.
import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";

const FIXED = [
  /(?<![\w-])text-(xs|sm|base|lg|\[[\d.]+px\])(?![\w-])/,
  /font-?[sS]ize:\s*"?[\d.]+px/,
];

test("no fixed text sizes in components and styles", () => {
  const found: string[] = [];
  for (const path of new Glob("src/{components,styles}/**/*.{tsx,css}").scanSync(".")) {
    readFileSync(path, "utf8").split("\n").forEach((line, i) => {
      if (FIXED.some((re) => re.test(line))) found.push(`${path}:${i + 1} ${line.trim()}`);
    });
  }
  expect(found).toEqual([]);
});
