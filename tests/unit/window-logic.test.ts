import { describe, expect, test } from "bun:test";
import { computeCenteredOrCascadedPosition } from "@/lib/windows/cascade-position";
import { resolvePopupWindows, resolveSyncedParentFrames } from "@/lib/windows/popups";
import { pinnedTabs, reorderedTabs } from "@/lib/windows/tab-groups";
import type { DesktopWindowInstance } from "@/context/windows/types";

describe("browser tab groups", () => {
  const group = { tabs: ["a", "b", "c"], active: "a" };

  test("reorders only with the same tabs, keeping pinned ones first", () => {
    expect(reorderedTabs(group, ["c", "a", "b"])?.tabs).toEqual(["c", "a", "b"]);
    expect(reorderedTabs(group, ["a", "b", "c"])).toBeNull();
    expect(reorderedTabs(group, ["a", "b"])).toBeNull();
    expect(reorderedTabs({ ...group, pinned: ["a"] }, ["c", "b", "a"])?.tabs).toEqual(["a", "c", "b"]);
  });

  test("pins after the pinned ones, and unpins right after them", () => {
    const once = pinnedTabs(group, "b", true)!;
    expect(once).toEqual({ tabs: ["b", "a", "c"], active: "a", pinned: ["b"] });
    const twice = pinnedTabs(once, "c", true)!;
    expect(twice.tabs).toEqual(["b", "c", "a"]);
    expect(pinnedTabs(twice, "b", false)).toEqual({ tabs: ["c", "b", "a"], active: "a", pinned: ["c"] });
    expect(pinnedTabs(group, "b", false)).toBeNull();
  });
});

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
