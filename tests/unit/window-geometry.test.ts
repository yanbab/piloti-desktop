import { describe, expect, test } from "bun:test";
import { allowedChange, changedGeometry, createGeometryLog } from "@/core/windows/geometry";
import type { WindowPlacement } from "@/core/windows/types";

const screen = { width: 1000, height: 800 };
const move = (x: number, y: number, width = 300) => allowedChange({ position: { x, y } }, width, screen).position;

describe("moving and resizing", () => {
  test("keeps a window within reach and under the menu bar", () => {
    expect(move(100.4, 50.6)).toEqual({ x: 100, y: 51 });
    expect(move(-900, -50)).toEqual({ x: -220, y: 0 });
    expect(move(5000, 5000)).toEqual({ x: 920, y: 722 });
    expect(move(-50, 10, 40)).toEqual({ x: 0, y: 10 });
  });

  test("a resize alone leaves the position and the tile", () => {
    const window = { position: { x: 1, y: 1 }, size: { width: 2, height: 2 }, tiled: "left" } as WindowPlacement;
    const size = { width: 500, height: 400 };
    expect(changedGeometry(window, allowedChange({ size }, 500, screen))).toEqual({
      position: window.position,
      size,
      tiled: "left",
    });
    expect(changedGeometry(window, { position: { x: 5, y: 5 } }).tiled).toBeNull();
  });

  test("logs where a drag ends, once", async () => {
    const lines: string[] = [];
    const log = createGeometryLog((line) => lines.push(line), 5);
    log.add("w", "texts", { position: { x: 1, y: 1 } });
    log.add("w", "texts", { position: { x: 9, y: 9 } });
    log.add("w", "texts", { size: { width: 3.4, height: 4 } });
    log.add("w", "texts", {});
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(lines).toEqual(["[Piloti] moved texts to 9x9", "[Piloti] resized texts to 3x4"]);
  });
});
