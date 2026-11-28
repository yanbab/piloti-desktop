import { describe, expect, it } from "bun:test";
// @ts-expect-error -- plain build script
import { indexDataFiles } from "../../scripts/data-files.mjs";
import {
  DATA_DIRS,
  DATA_FILES,
  listDataDir,
  loadDataFiles,
  readShippedFile,
  setDataFiles,
} from "@/platform/web/data-files";

describe("shipped files", () => {
  it("fetches the home and /etc up front, the rest when first read", async () => {
    const before = { dirs: [...DATA_DIRS], files: { ...DATA_FILES } };
    const realFetch = globalThis.fetch;
    const asked: string[] = [];
    const files = ["/home/user/a.txt", "/etc/b", "/usr/share/c"];
    globalThis.fetch = (async (url: URL) => {
      const path = url.pathname.replace("/__fs", "");
      asked.push(path);
      return path === "/index.json" ? Response.json({ dirs: [], files }) : new Response(path);
    }) as unknown as typeof fetch;
    try {
      await loadDataFiles("http://demo/");
      expect(asked).toEqual(["/index.json", "/home/user/a.txt", "/etc/b"]);
      expect(await readShippedFile("/usr/share/c")).toBe("/usr/share/c");
      await readShippedFile("/usr/share/c");
      expect(asked.filter((p) => p === "/usr/share/c")).toHaveLength(1);
      expect(await readShippedFile("/usr/share/absent")).toBeUndefined();
      expect(asked).toHaveLength(4);
    } finally {
      globalThis.fetch = realFetch;
      setDataFiles(before.dirs, before.files);
    }
  });

  it("indexes data/files", () => {
    const index = indexDataFiles();
    expect(index.dirs).toContain("/usr/share/applications");
    expect(index.files.some((f: string) => f.endsWith(".DS_Store"))).toBe(false);
  });

  it("lists shipped folders", () => {
    expect(listDataDir("/")?.map((e) => e.name)).toEqual(expect.arrayContaining(["home", "usr"]));
    expect(listDataDir("/usr/share/applications")?.length).toBeGreaterThan(5);
    expect(listDataDir("/nope")).toBeNull();
  });
});
