import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { shouldIncludeDataFile } from "../../scripts/build-deb.mjs";

const ROOT = path.resolve(import.meta.dir, "../..");
const SYSTEM = "usr/share/piloti/plugins";
const schema = fs.readFileSync(path.join(ROOT, "data/files/usr/share/glib-2.0/schemas/org.piloti.desktop.gschema.xml"), "utf8");

describe("bundled plugins", () => {
  // Home files are not packaged: a plugin enabled by default must be a system one.
  test("every plugin enabled by default is in the package", () => {
    const list = /name="enabled-plugins"[\s\S]*?<default>\[(.*?)\]<\/default>/.exec(schema)![1]!;
    const ids = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const manifest = `${SYSTEM}/${id}/manifest.json`;
      expect(fs.existsSync(path.join(ROOT, "data/files", manifest)), manifest).toBe(true);
      expect(shouldIncludeDataFile(manifest)).toBe(true);
    }
  });
});
