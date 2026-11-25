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
