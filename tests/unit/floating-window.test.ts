import { describe, expect, it } from "bun:test";
import {
  FLOATING_EDGE_MARGIN,
  floatingBounds,
  floatingDragPosition,
  floatingEdgeAt,
  resizeFloatingRect,
  settleFloatingPosition,
} from "@/lib/windows/floating-window";

const bounds = floatingBounds({ x: 0, y: 30, width: 1000, height: 700 });
const win = { x: 300, y: 300, width: 200, height: 100 };

describe("floating windows", () => {
  it("keeps the main menu gap from the edges", () => {
    expect(FLOATING_EDGE_MARGIN).toBe(6);
    expect(bounds).toEqual({ x: 6, y: 36, width: 988, height: 688 });
  });

  it("moves freely away from the edges", () => {
    expect(floatingDragPosition(win, bounds)).toEqual({ x: 300, y: 300 });
  });

  it("snaps to an edge when close", () => {
    expect(floatingDragPosition({ ...win, x: 15 }, bounds).x).toBe(6);
    expect(floatingDragPosition({ ...win, x: 780 }, bounds).x).toBe(794);
  });

  it("resists past an edge, more the further it goes", () => {
    const a = floatingDragPosition({ ...win, x: -50 }, bounds).x;
    const b = floatingDragPosition({ ...win, x: -400 }, bounds).x;
    expect(a).toBeLessThan(6);
    expect(a).toBeGreaterThan(-50);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(6 - win.width);
  });

  it("settles back inside on release", () => {
    expect(settleFloatingPosition({ ...win, x: -80, y: 900 }, bounds)).toEqual({ x: 6, y: 624 });
  });

  it("finds the border under the pointer", () => {
    expect(floatingEdgeAt(win, 302, 350)).toBe("w");
    expect(floatingEdgeAt(win, 498, 398)).toBe("se");
    expect(floatingEdgeAt(win, 400, 350)).toBeNull();
  });

  it("resizes keeping the aspect ratio and the opposite side", () => {
    const limits = { minWidth: 100, maxWidth: 600 };
    expect(resizeFloatingRect(win, "e", 100, 0, limits)).toEqual({ x: 300, y: 300, width: 300, height: 150 });
    expect(resizeFloatingRect(win, "nw", -40, -10, limits)).toEqual({ x: 260, y: 280, width: 240, height: 120 });
    expect(resizeFloatingRect(win, "s", 0, 500, limits).width).toBe(600);
    expect(resizeFloatingRect(win, "w", 500, 0, limits)).toEqual({ x: 400, y: 300, width: 100, height: 50 });
  });
});
