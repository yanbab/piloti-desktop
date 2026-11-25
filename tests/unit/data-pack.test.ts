import { describe, expect, it } from "bun:test";
// @ts-expect-error -- plain build script
import { packDataFiles } from "../../scripts/pack-data-files.mjs";
import { DATA_DIRS, DATA_FILES, listDataDir } from "@/lib/engine-web/data-files";

describe("data pack", () => {
  it("matches data/files (run scripts/generate-piloti-icons.mjs after changing it)", () => {
    const fresh = packDataFiles();
    expect(Object.keys(DATA_FILES)).toEqual(Object.keys(fresh.files));
    expect(DATA_FILES).toEqual(fresh.files);
    expect(DATA_DIRS).toEqual(fresh.dirs);
  });

  it("lists shipped folders", () => {
    expect(listDataDir("/")?.map((e) => e.name)).toEqual(expect.arrayContaining(["etc", "home", "usr"]));
    expect(listDataDir("/usr/share/applications")?.length).toBeGreaterThan(5);
    expect(listDataDir("/nope")).toBeNull();
  });
});
