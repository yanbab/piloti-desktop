import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BUNDLED_PLUGINS } from "@/core/plugins/bundled";

const SYSTEM = path.resolve(import.meta.dir, "../../data/files/usr/share/piloti/plugins");

describe("shipped script plugins", () => {
  // Linux can't import a script from disk: each one must be built into the shell.
  test("are all built into the shell", () => {
    const scripted = fs.readdirSync(SYSTEM).filter((id) => fs.existsSync(path.join(SYSTEM, id, "index.js")));
    expect(Object.keys(BUNDLED_PLUGINS).sort()).toEqual(scripted.sort());
    for (const mod of Object.values(BUNDLED_PLUGINS)) expect(typeof mod.activate).toBe("function");
  });
});
