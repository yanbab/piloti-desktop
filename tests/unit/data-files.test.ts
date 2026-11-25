import { describe, expect, it } from "bun:test";
// @ts-expect-error -- plain build script
import { indexDataFiles } from "../../scripts/data-files.mjs";
import { listDataDir } from "@/lib/engine-web/data-files";

describe("shipped files", () => {
  it("indexes data/files", () => {
    const index = indexDataFiles();
    expect(index.files).toContain("/etc/issue");
    expect(index.dirs).toContain("/usr/share/applications");
    expect(index.files.some((f: string) => f.endsWith(".DS_Store"))).toBe(false);
  });

  it("lists shipped folders", () => {
    expect(listDataDir("/")?.map((e) => e.name)).toEqual(expect.arrayContaining(["etc", "home", "usr"]));
    expect(listDataDir("/usr/share/applications")?.length).toBeGreaterThan(5);
    expect(listDataDir("/nope")).toBeNull();
  });
});
