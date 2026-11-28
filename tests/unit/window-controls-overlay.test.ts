import { describe, expect, test } from "bun:test";
import {
  dragRegions,
  parseDragRegions,
  subtractRect,
  titlebarAreaRect,
} from "@/core/apps/window-controls-overlay";

describe("titlebarAreaRect", () => {
  test("between the controls, or nothing when hidden", () => {
    const g = { visible: true, insets: { left: 46, right: 78 }, height: 36 };
    expect(titlebarAreaRect(800, g)).toEqual({ x: 46, y: 0, width: 676, height: 36 });
    expect(titlebarAreaRect(800, { ...g, visible: false })).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(titlebarAreaRect(100, g).width).toBe(0);
  });
});

describe("drag regions", () => {
  const bar = { x: 0, y: 0, width: 400, height: 36 };
  test("a button in the middle leaves two strips", () => {
    const pieces = subtractRect(bar, { x: 100, y: 4, width: 50, height: 28 });
    expect(pieces).toContainEqual({ x: 0, y: 4, width: 100, height: 28 });
    expect(pieces).toContainEqual({ x: 150, y: 4, width: 250, height: 28 });
    expect(pieces).toContainEqual({ x: 0, y: 0, width: 400, height: 4 });
  });
  test("start and end groups cut out, slivers dropped, biggest first", () => {
    const regions = dragRegions([bar], [
      { x: 0, y: 0, width: 120, height: 36 },
      { x: 300, y: 0, width: 100, height: 36 },
      { x: 150, y: 0, width: 2, height: 36 },
    ]);
    expect(regions).toEqual([
      { x: 152, y: 0, width: 148, height: 36 },
      { x: 120, y: 0, width: 30, height: 36 },
    ]);
  });
  test("what the shell accepts", () => {
    expect(parseDragRegions("x")).toBeUndefined();
    expect(parseDragRegions([{ x: 1, y: 2, width: 3, height: 4 }, { x: "a" }, { x: 0, y: 0, width: 0, height: 5 }])).toEqual([
      { x: 1, y: 2, width: 3, height: 4 },
    ]);
  });
});
