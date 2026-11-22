import { describe, expect, it } from "bun:test";
import { buildLinkFile, isLinkFile, linkTargetToPath, parseLinkFile, pathToFileUrl } from "@/lib/shell/link-files";
import { resolveOpenAction } from "@/lib/shell/open-file";
import { parseMimeAppsList } from "@/lib/xdg/xdg-mimeapps";

describe("link files", () => {
  it("parses .url, .webloc and Type=Link .desktop files", () => {
    expect(parseLinkFile("a.url", "[InternetShortcut]\nURL=https://example.org\n")?.url).toBe("https://example.org");
    expect(parseLinkFile("a.webloc", "<plist><dict><key>URL</key><string>https://x.test/</string></dict></plist>")?.url).toBe("https://x.test/");
    const link = parseLinkFile("l.desktop", "[Desktop Entry]\nType=Link\nName=Docs\nURL=file:///home/user/Documents\n");
    expect(link).toMatchObject({ url: "file:///home/user/Documents", name: "Docs", format: "desktop" });
    expect(isLinkFile("app.desktop", "[Desktop Entry]\nType=Application\nExec=x\n")).toBe(false);
    expect(parseLinkFile("bad.url", "[InternetShortcut]\nURL=javascript:alert(1)")).toBeNull();
  });

  it("round-trips built link files and file URLs", () => {
    const built = buildLinkFile({ name: "My Doc", url: pathToFileUrl("/home/user/My Doc.txt") });
    const parsed = parseLinkFile("Link to My Doc.desktop", built);
    expect(parsed?.url).toBe("file:///home/user/My%20Doc.txt");
    expect(linkTargetToPath(parsed!.url)).toBe("/home/user/My Doc.txt");
    expect(linkTargetToPath("~/x")).toBe("/home/user/x");
    expect(linkTargetToPath("https://a.b")).toBeNull();
  });
});

describe("resolveOpenAction", () => {
  const config = parseMimeAppsList("");
  const base = { config, kind: "file" as const };

  it("opens link files, launchers, packages and archives specially", () => {
    expect(resolveOpenAction({ ...base, path: "/h/s.url", name: "s.url", content: "[InternetShortcut]\nURL=https://example.org" })).toEqual({ type: "url", url: "https://example.org" });
    expect(resolveOpenAction({ ...base, path: "/h/l.desktop", name: "l.desktop", content: "[Desktop Entry]\nType=Link\nURL=file:///h/Pictures" })).toEqual({ type: "path", path: "file:///h/Pictures" });
    expect(resolveOpenAction({ ...base, path: "/h/a.desktop", name: "a.desktop", content: "[Desktop Entry]\nType=Application\nName=A\nExec=piloti-calculator\n" }).type).toBe("launch-entry");
    expect(resolveOpenAction({ ...base, path: "/h/p.deb", name: "p.deb" })).toEqual({ type: "install-package", path: "/h/p.deb", format: "deb" });
    expect(resolveOpenAction({ ...base, path: "/h/z.zip", name: "z.zip" }).type).toBe("extract");
  });

  it("uses the mime default app and falls back sensibly", () => {
    expect(resolveOpenAction({ ...base, path: "/h/a.png", name: "a.png" })).toEqual({ type: "app", appId: "image-viewer", path: "/h/a.png" });
    expect(resolveOpenAction({ ...base, path: "/h/n.md", name: "n.md" })).toEqual({ type: "app", appId: "text-editor", path: "/h/n.md" });
    expect(resolveOpenAction({ ...base, path: "/h/d", name: "d", kind: "directory" })).toEqual({ type: "folder", path: "/h/d" });
    // A plain .desktop (no launcher content) is text.
    expect(resolveOpenAction({ ...base, path: "/h/x.desktop", name: "x.desktop", content: "junk" }).type).toBe("app");
  });
});
