import { describe, expect, it } from "bun:test";
import { parseHtmlManifestHref, parseWebAppManifest } from "@/core/data/web-apps";
import { clampWindowBounds } from "@/core/windows/window-bounds";
import { resolveSpatialBoundsKey } from "@/core/windows/spatial-window-bounds";

describe("M5 & M6: Web app manifest parsing & spatial window lifecycle", () => {
  it("extracts manifest href from HTML and resolves relative URLs", () => {
    const html = `<!doctype html><html><head><link rel="manifest" href="/app.webmanifest"></head></html>`;
    expect(parseHtmlManifestHref(html, "https://notes.example.com/sub/page")).toBe(
      "https://notes.example.com/app.webmanifest"
    );
  });

  it("extracts short_name, start_url, and largest icon from PWA manifest", () => {
    const parsed = parseWebAppManifest(
      {
        name: "Piloti Notes Progressive Web App",
        short_name: "Piloti Notes",
        start_url: "/inbox?source=pwa",
        icons: [
          { src: "/icons/icon-64.png", sizes: "64x64" },
          { src: "/icons/icon-512.png", sizes: "192x192 512x512" },
        ],
      },
      "https://notes.example.com/manifest.json"
    );
    expect(parsed.title).toBe("Piloti Notes");
    expect(parsed.startUrl).toBe("https://notes.example.com/inbox?source=pwa");
    expect(parsed.iconUrl).toBe("https://notes.example.com/icons/icon-512.png");
  });

  it("resolves spatial window keys and clamps oversized bounds cleanly", () => {
    expect(
      resolveSpatialBoundsKey({
        appId: "browser",
        browserUrl: "https://example.com/a?x=1",
      })
    ).toContain("example.com");
    expect(
      resolveSpatialBoundsKey({
        appId: "texts",
        payload: "/home/user/notes.md",
      })
    ).toContain("notes.md");
    const clamped = clampWindowBounds(
      { x: -120, y: 1200 },
      { width: 2400, height: 1800 },
      1280,
      800
    );
    expect(clamped.position.x).toBeGreaterThanOrEqual(0);
    expect(clamped.size.width).toBeLessThanOrEqual(1280);
    expect(clamped.size.height).toBeLessThanOrEqual(800);
  });
});

