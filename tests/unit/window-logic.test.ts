import { describe, expect, test } from "bun:test";
import { computeCenteredOrCascadedPosition } from "@/core/windows/cascade-position";
import { resolvePopupWindows, resolveSyncedParentFrames } from "@/core/windows/popups";
import { movedTabGroups, pinnedTabs, reorderedTabs } from "@/core/windows/tab-groups";
import type { DesktopWindowInstance } from "@/ui/context/windows/types";

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

describe("movedTabGroups", () => {
  test("a tab joins another window at the slot and becomes active", () => {
    const groups = { a: { tabs: ["a", "b", "c"], active: "b" }, x: { tabs: ["x", "y"], active: "x" } };
    const moved = movedTabGroups(groups, "a", "x", "b", 1);
    expect(moved?.fromEmptied).toBe(false);
    expect(moved?.groups.a).toEqual({ tabs: ["a", "c"], active: "c" });
    expect(moved?.groups.x).toEqual({ tabs: ["x", "b", "y"], active: "b" });
  });

  test("single-page windows have no record on either side", () => {
    const moved = movedTabGroups({}, "p", "q", "p", 5);
    expect(moved?.fromEmptied).toBe(true);
    expect(moved?.groups).toEqual({ q: { tabs: ["q", "p"], active: "p" } });
  });

  test("never lands before pinned tabs; drops its own pin", () => {
    const groups = {
      a: { tabs: ["a", "b"], active: "a", pinned: ["b"] },
      x: { tabs: ["x", "y"], active: "y", pinned: ["x"] },
    };
    const moved = movedTabGroups(groups, "a", "x", "b", 0);
    expect(moved?.groups.x.tabs).toEqual(["x", "b", "y"]);
    expect(moved?.groups.a).toEqual({ tabs: ["a"], active: "a" });
  });

  test("no-ops", () => {
    expect(movedTabGroups({}, "a", "a", "a", 0)).toBeNull();
    expect(movedTabGroups({}, "a", "x", "zz", 0)).toBeNull();
  });
});
