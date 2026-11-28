import { describe, expect, test } from "bun:test";
import { rememberBounds } from "@/core/windows/remember-bounds";
import type { DesktopWindowInstance } from "@/core/windows/types";
import { moveToWorkspace, removeWorkspace } from "@/core/windows/workspaces";

describe("workspaces", () => {
  test("moving a window past the last adds workspaces", () => {
    expect(moveToWorkspace(4, 2)).toEqual({ workspace: 4, count: 4 });
    expect(moveToWorkspace(1, 3)).toEqual({ workspace: 1, count: 3 });
    expect(moveToWorkspace(0, 2)).toEqual({ workspace: 1, count: 2 });
  });

  test("removing one sends its windows to the first and closes the gap", () => {
    const removal = removeWorkspace(2, { count: 3, active: 3 })!;
    expect([1, 2, 3].map(removal.remap)).toEqual([1, 1, 2]);
    expect(removal).toMatchObject({ count: 2, active: 2 });
    expect(removeWorkspace(2, { count: 3, active: 2 })!.active).toBe(1);
    expect(removeWorkspace(3, { count: 3, active: 1 })!.active).toBe(1);
    expect(removeWorkspace(1, { count: 1, active: 1 })).toBeNull();
  });

  test("a window's place is remembered by its app and document", () => {
    const window = {
      appId: "texts",
      payload: "/a.txt",
      position: { x: 1, y: 2 },
      size: { width: 3, height: 4 },
      workspace: 1,
      maximized: false,
    } as DesktopWindowInstance;
    const saved = rememberBounds({}, window, "screen", { workspace: 2 });
    expect(Object.values(saved)).toEqual([
      { position: { x: 1, y: 2 }, size: { width: 3, height: 4 }, workspace: 2, maximized: false, monitor: "screen" },
    ]);
    expect(Object.keys(saved)[0]).toContain("/a.txt");
  });
});
