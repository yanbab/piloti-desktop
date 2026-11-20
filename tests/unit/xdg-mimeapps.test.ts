import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MIMEAPPS_INI,
  inferMimeType,
  parseMimeAppsList,
  resolveAppsForMime,
} from "@/lib/xdg-mimeapps";

describe("xdg-mimeapps", () => {
  test("infers specific and generic MIME types", () => {
    expect(inferMimeType("Docs", "directory")).toBe("inode/directory");
    expect(inferMimeType("notes.md", "file")).toBe("text/markdown");
    expect(inferMimeType("config.json", "file")).toBe("application/json");
    expect(inferMimeType("photo.png", "file")).toBe("image/png");
    expect(inferMimeType("readme.txt", "file")).toBe("text/plain");
  });

  test("parses mimeapps.list and resolves exact + generic MIME associations", () => {
    const config = parseMimeAppsList(DEFAULT_MIMEAPPS_INI);
    const jsonApps = resolveAppsForMime("application/json", config);
    expect(jsonApps.map((a) => a.appId)).toEqual(["text-editor", "console"]);

    const customTextApps = resolveAppsForMime("text/x-python", config);
    expect(customTextApps.map((a) => a.appId)).toEqual([
      "text-editor",
      "terminal",
    ]);
  });
});

