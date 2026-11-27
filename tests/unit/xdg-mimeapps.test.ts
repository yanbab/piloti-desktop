import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MIMEAPPS_INI,
  inferMimeType,
  parseMimeAppsList,
  resolveAppsForMime,
} from "@/lib/xdg/xdg-mimeapps";

describe("xdg-mimeapps", () => {
  test("infers specific and generic MIME types", () => {
    expect(inferMimeType("Docs", "directory")).toBe("inode/directory");
    expect(inferMimeType("notes.md", "file")).toBe("text/markdown");
    expect(inferMimeType("config.json", "file")).toBe("application/json");
    expect(inferMimeType("photo.png", "file")).toBe("image/png");
    expect(inferMimeType("readme.txt", "file")).toBe("text/plain");
    expect(inferMimeType("paper.pdf", "file")).toBe("application/pdf");
    expect(inferMimeType("song.mp3", "file")).toBe("audio/mpeg");
    expect(inferMimeType("clip.mkv", "file")).toBe("video/x-matroska");
    expect(inferMimeType("pkg_1.0_amd64.deb", "file")).toBe("application/vnd.debian.binary-package");
    expect(inferMimeType("site.url", "file")).toBe("application/x-mswinurl");
    expect(inferMimeType("Makefile", "file")).toBe("text/plain");
    expect(inferMimeType("archive.bin", "file")).toBe("application/octet-stream");
  });

  test("falls back to built-in defaults and installed apps", () => {
    const config = parseMimeAppsList("");
    expect(resolveAppsForMime("application/pdf", config)[0]?.appId).toBe("browser");
    expect(resolveAppsForMime("application/vnd.debian.binary-package", config)[0]?.builtinAppId).toBe(
      "app-store",
    );
    const installed = [
      { desktopId: "org.example.Player.desktop", appId: "org.example.Player", name: "Player", mimeTypes: ["video/*"], hidden: false, noDisplay: false },
      { desktopId: "org.example.Hidden.desktop", appId: "org.example.Hidden", name: "Hidden", mimeTypes: ["video/mp4"], hidden: false, noDisplay: true },
    ] as never[];
    const video = resolveAppsForMime("video/mp4", config, installed);
    // Installed apps that declare the type rank above the built-in browser fallback.
    expect(video.map((a) => a.label)).toEqual(["Player", "Web Browser"]);
    expect(video[0]?.entry?.desktopId).toBe("org.example.Player.desktop");
  });

  test("parses mimeapps.list and resolves exact + generic MIME associations", () => {
    const config = parseMimeAppsList(DEFAULT_MIMEAPPS_INI);
    const jsonApps = resolveAppsForMime("application/json", config);
    // JSON is a sub-class of text/plain, so it also inherits the text associations.
    expect(jsonApps.map((a) => a.appId)).toEqual(["texts", "console", "terminal"]);

    const customTextApps = resolveAppsForMime("text/x-python", config);
    expect(customTextApps.map((a) => a.appId)).toEqual([
      "texts",
      "terminal",
    ]);
  });
});

