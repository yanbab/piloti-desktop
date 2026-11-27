import { beforeEach, describe, expect, test } from "bun:test";
import { resolveInitialSettings } from "@/context/SettingsContext";
import {
  lookupSpatialWindowBounds,
  resolveSpatialBoundsKey,
} from "@/lib/windows/spatial-window-bounds";
import {
  clearXdgSession,
  loadXdgSession,
  saveXdgSession,
  serializeWindowToXdgSession,
} from "@/lib/xdg/xdg-session-management";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, String(val));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

describe("Functional: open 3 apps, move/resize, reload desktop & restore state", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    clearXdgSession();
  });

  test("restores 3 open apps with moved positions, resized bounds, and payloads after desktop reload", () => {
    // 1. Initial boot & open 3 apps: Files, Notepad (with file payload), Desktop Shell
    const initialSettings = resolveInitialSettings(null, true);
    let savedBounds = initialSettings.savedWindowBounds;

    const openWindows = [
      {
        id: "nautilus-1",
        appId: "nautilus",
        title: "Files",
        workspace: 1,
        position: { x: 80, y: 70 },
        size: { width: 780, height: 500 },
        minimized: false,
        maximized: false,
        payload: "/home/user/Documents",
      },
      {
        id: "text-editor-1",
        appId: "text-editor",
        title: "Notes.txt",
        workspace: 1,
        position: { x: 240, y: 140 },
        size: { width: 520, height: 380 },
        minimized: false,
        maximized: false,
        payload: "/home/user/Documents/Notes.txt",
      },
      {
        id: "terminal-1",
        appId: "terminal",
        title: "Desktop Shell",
        workspace: 2,
        position: { x: 320, y: 180 },
        size: { width: 720, height: 460 },
        minimized: false,
        maximized: false,
      },
    ];

    // 2. Move & resize all 3 windows (simulating user drag/resize interactions)
    const movedWindows = [
      {
        ...openWindows[0],
        position: { x: 120, y: 95 },
        size: { width: 860, height: 540 },
      },
      {
        ...openWindows[1],
        position: { x: 460, y: 160 },
        size: { width: 640, height: 440 },
      },
      {
        ...openWindows[2],
        position: { x: 200, y: 110 },
        size: { width: 780, height: 510 },
        maximized: true,
      },
    ];

    for (const win of movedWindows) {
      const key = resolveSpatialBoundsKey({
        appId: win.appId,
        payload: win.payload,
      });
      savedBounds = {
        ...savedBounds,
        [key]: {
          position: win.position,
          size: win.size,
          workspace: win.workspace,
          maximized: win.maximized,
        },
      };
    }

    // Persist session + settings before reload
    saveXdgSession(
      movedWindows.map((w) => serializeWindowToXdgSession(w, "Display-1"))
    );
    const persistedSettingsJson = JSON.stringify({
      ...initialSettings,
      savedWindowBounds: savedBounds,
    });

    // 3. Simulate full desktop reload from persisted storage
    const reloadedSettings = resolveInitialSettings(persistedSettingsJson, true);
    const restoredSession = loadXdgSession();

    // 4. Verify all 3 apps reopen with exact moved/resized bounds & payloads
    expect(restoredSession).not.toBeNull();
    expect(restoredSession).toHaveLength(3);

    const filesRec = restoredSession!.find((r) => r.id === "nautilus");
    expect(filesRec).toMatchObject({
      id: "nautilus",
      x: 120,
      y: 95,
      width: 860,
      height: 540,
      workspace: 1,
      payload: "/home/user/Documents",
    });

    const notepadRec = restoredSession!.find((r) => r.id === "text-editor");
    expect(notepadRec).toMatchObject({
      id: "text-editor",
      x: 460,
      y: 160,
      width: 640,
      height: 440,
      payload: "/home/user/Documents/Notes.txt",
    });

    const termRec = restoredSession!.find((r) => r.id === "terminal");
    expect(termRec).toMatchObject({
      id: "terminal",
      x: 200,
      y: 110,
      width: 780,
      height: 510,
      workspace: 2,
      maximized: true,
    });

    // Also verify spatial bounds lookup restores exact size/pos when reopening later
    expect(
      lookupSpatialWindowBounds(reloadedSettings.savedWindowBounds, {
        appId: "text-editor",
        payload: "/home/user/Documents/Notes.txt",
      })
    ).toMatchObject({
      position: { x: 460, y: 160 },
      size: { width: 640, height: 440 },
    });
  });
});
