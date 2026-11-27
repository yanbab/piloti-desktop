import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(import.meta.dir, "../..", file), "utf8");

/** Package names of a `debian/control` field, without the `${…}` substitutions. */
const fromControl = (field: string) =>
  new RegExp(`^${field}:((?:.*\\n)(?: .*\\n)*)`, "m")
    .exec(read("debian/control"))![1]!
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && !name.startsWith("$"))
    .sort();

const fromBuildScript = (field: string) =>
  new RegExp(`"${field}: ([^"]*)"`).exec(read("scripts/build-deb.mjs"))![1]!.split(", ").sort();

// `build-deb.mjs` writes its own control file: it must say what `debian/control` says.
test.each(["Depends", "Recommends", "Suggests"])("the built .deb has the same %s as debian/control", (field) => {
  expect(fromBuildScript(field)).toEqual(fromControl(field));
});
