import { describe, expect, test } from "bun:test";
import { computeCenteredOrCascadedPosition } from "@/core/windows/cascade-position";
import { resolvePopupWindows, resolveSyncedParentFrames } from "@/core/windows/popups";
import type { DesktopWindowInstance } from "@/ui/context/windows/types";

describe("window placement", () => {
  test("cascades after the last window, else goes where it was, else centres", () => {
    const size = { width: 400, height: 300 };
    expect(computeCenteredOrCascadedPosition([{ x: 10, y: 20 }], size, 1000, 800)).toEqual({ x: 34, y: 44 });
    expect(computeCenteredOrCascadedPosition([], size, 1000, 800, { x: 5, y: 6 })).toEqual({ x: 5, y: 6 });
    expect(computeCenteredOrCascadedPosition([], size, 1000, 800)).toEqual({ x: 300, y: 235 });
  });
});

describe("popups", () => {
  const surfaces = [
    { appId: "top", frame: 7 },
    { appId: "menu", parent: "top", x: 10, y: 20, width: 100, height: 50, frame: 1 },
    { appId: "sub", parent: "menu", x: 5, y: 5, frame: 2 },
  ];
  const parent = {
    id: "wayland:top",
    waylandAppId: "top",
    minimized: false,
    maximized: false,
    workspace: 1,
    position: { x: 100, y: 200 },
    clientFrame: false,
    zIndex: 30,
  } as DesktopWindowInstance;

  test("offsets nested popups from the toplevel, under its titlebar", () => {
    const frames = resolveSyncedParentFrames(surfaces);
    const [menu, sub] = resolvePopupWindows(surfaces, [parent], frames, {
      activeWorkspace: 1,
      windowDecorationMode: "auto",
    });
    expect(menu).toMatchObject({ x: 110, y: 266, frame: 1, zIndex: 32 });
    expect(sub).toMatchObject({ x: 115, y: 271, width: 220, height: 180 });
    expect(frames.get("top")).toBe(7);
  });

  test("hides them with their window", () => {
    const frames = resolveSyncedParentFrames(surfaces);
    expect(resolvePopupWindows(surfaces, [parent], frames, { activeWorkspace: 2, windowDecorationMode: "auto" })).toEqual([]);
  });
});
