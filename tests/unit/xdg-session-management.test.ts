import { describe, expect, test } from "bun:test";
import {
  XDG_SESSION_STORAGE_KEY,
  clearXdgSession,
  loadXdgSession,
  saveXdgSession,
  serializeWindowToXdgSession,
} from "@/core/xdg/xdg-session-management";

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe("xdg-session-management-v1", () => {
  test("serializes, saves, loads, and clears session JSON", () => {
    const storage = createMemoryStorage();
    expect(loadXdgSession(storage)).toBeNull();

    const record = serializeWindowToXdgSession(
      {
        id: "shell:settings-1",
        appId: "settings",
        title: "System Settings",
        iconName: "settings",
        position: { x: 120.4, y: 64.6 },
        size: { width: 820, height: 540 },
        workspace: 2,
        maximized: true,
        fullscreen: false,
        pinned: true,
      },
      "eDP-1"
    );

    saveXdgSession([record], storage);
    const raw = storage.getItem(XDG_SESSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual([
      {
        id: "settings",
        title: "System Settings",
        icon: "settings",
        width: 820,
        height: 540,
        x: 120,
        y: 65,
        monitor: "eDP-1",
        workspace: 2,
        maximized: true,
        fullscreen: false,
        pinned: true,
      },
    ]);

    expect(loadXdgSession(storage)).toEqual([record]);
    clearXdgSession(storage);
    expect(loadXdgSession(storage)).toBeNull();
  });

  test("encodes webview URLs in session id", () => {
    const webRecord = serializeWindowToXdgSession({
      id: "browser:1",
      appId: "web:https://example.com",
      title: "Example",
      iconName: "globe",
      browserUrl: "https://example.com",
      position: { x: 100, y: 50 },
      size: { width: 900, height: 600 },
      workspace: 1,
      maximized: false,
    });
    expect(webRecord.id).toBe("web:https://example.com");
  });
});

