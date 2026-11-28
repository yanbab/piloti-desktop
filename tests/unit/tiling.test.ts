import { describe, expect, test } from "bun:test";
import { canResize, createUntiledSizes, tileBounds, tiled, toggledMaximize } from "@/core/windows/tiling";
import type { WindowPlacement } from "@/core/windows/types";

const desktop = { screen: { width: 1000, height: 800 }, dock: { size: 52, autoHide: false } };

describe("tiling", () => {
  test("halves what the menu bar and Dock leave free", () => {
    expect(tileBounds("left", desktop)).toEqual({ position: { x: 8, y: 6 }, size: { width: 488, height: 682 } });
    expect(tileBounds("right", desktop).position.x).toBe(504);
  });

  test("gives a side Dock its room, none to a hidden one", () => {
    const side = { ...desktop, dock: { position: "left" as const, size: 52, autoHide: false } };
    expect(tileBounds("left", side).position.x).toBe(84);
    expect(tileBounds("left", { ...desktop, dock: { size: 52, autoHide: true } }).size.height).toBe(750);
  });

  test("tiling and maximizing show the window", () => {
    expect(tiled("left", desktop)).toMatchObject({ tiled: "left", maximized: false, minimized: false });
    expect(toggledMaximize({ maximized: true } as WindowPlacement)).toEqual({ maximized: false, minimized: false });
    expect(canResize("calculator")).toBe(false);
    expect(canResize("texts")).toBe(true);
  });

  test("moving a tiled window gives back its first size, once", () => {
    const sizes = createUntiledSizes();
    sizes.keep("w", { size: { width: 300, height: 200 } });
    sizes.keep("w", { size: { width: 488, height: 682 }, tiled: "left" });
    const move = { position: { x: 1, y: 1 } };
    expect(sizes.takeOnMove("w", { tiled: "left" }, { ...move, size: {} })).toBeUndefined();
    expect(sizes.takeOnMove("w", { tiled: null }, move)).toBeUndefined();
    expect(sizes.takeOnMove("w", { tiled: "left" }, move)).toEqual({ width: 300, height: 200 });
    expect(sizes.takeOnMove("w", { tiled: "left" }, move)).toBeUndefined();
  });
});
