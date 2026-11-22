import { describe, expect, it } from "bun:test";
import {
  lookupSpatialWindowBounds,
  resolveSpatialBoundsKey,
  type SavedWindowBounds,
} from "@/lib/shell/spatial-window-bounds";

describe("spatial-window-bounds", () => {
  it("resolves per-URL keys for browser windows and per-payload keys for document apps", () => {
    expect(
      resolveSpatialBoundsKey({
        appId: "webview:1",
        browserUrl: "https://Excalidraw.com/?foo=bar#hash",
      }),
    ).toBe("url:https://excalidraw.com");

    expect(
      resolveSpatialBoundsKey({
        appId: "nautilus",
        payload: "/home/user/Documents",
      }),
    ).toBe("nautilus:/home/user/Documents");

    expect(
      resolveSpatialBoundsKey({
        appId: "text-editor",
        payload: "/home/user/Desktop/notes.md",
      }),
    ).toBe("text-editor:/home/user/Desktop/notes.md");

    expect(
      resolveSpatialBoundsKey({
        appId: "image-viewer",
        payload: "/home/user/Pictures/photo.png",
      }),
    ).toBe("image-viewer:/home/user/Pictures/photo.png");

    expect(
      resolveSpatialBoundsKey({
        appId: "calculator",
      }),
    ).toBe("calculator");
  });

  it("looks up most specific bounds first and falls back cleanly", () => {
    const saved: Record<string, SavedWindowBounds> = {
      "url:https://excalidraw.com": {
        position: { x: 100, y: 80 },
        size: { width: 900, height: 640 },
        workspace: 2,
      },
      "nautilus:/home/user/Downloads": {
        position: { x: 220, y: 110 },
        size: { width: 720, height: 500 },
      },
      nautilus: {
        position: { x: 60, y: 60 },
        size: { width: 680, height: 460 },
      },
      "org.gnome.TextEditor": {
        position: { x: 40, y: 40 },
        size: { width: 640, height: 480 },
      },
      webview: {
        position: { x: 20, y: 30 },
        size: { width: 800, height: 600 },
      },
    };

    expect(
      lookupSpatialWindowBounds(saved, {
        appId: "webview:excalidraw",
        browserUrl: "https://excalidraw.com/#room=123",
      }),
    ).toEqual(saved["url:https://excalidraw.com"]);

    expect(
      lookupSpatialWindowBounds(saved, {
        appId: "webview:other",
        browserUrl: "https://example.org",
      }),
    ).toEqual(saved.webview);

    expect(
      lookupSpatialWindowBounds(saved, {
        appId: "nautilus",
        payload: "/home/user/Downloads",
      }),
    ).toEqual(saved["nautilus:/home/user/Downloads"]);

    expect(
      lookupSpatialWindowBounds(saved, {
        appId: "nautilus",
        payload: "/home/user/Music",
      }),
    ).toEqual(saved.nautilus);

    expect(
      lookupSpatialWindowBounds(saved, {
        appId: "gnome-text-editor",
        desktopId: "org.gnome.TextEditor.desktop",
        shortId: "org.gnome.TextEditor",
      }),
    ).toEqual(saved["org.gnome.TextEditor"]);
  });
});

