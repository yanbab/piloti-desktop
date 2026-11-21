import { describe, expect, test } from "bun:test";
import {
  clampWindowBounds,
  clampWorkspace,
  resolveWaylandOuterConstraints,
  SSD_TITLEBAR_HEIGHT,
} from "@/lib/window-bounds";

describe("window-bounds", () => {
  test("clamps offscreen negative and bottom-right positions inside viewport", () => {
    expect(
      clampWindowBounds(
        { x: -120, y: -40 },
        { width: 800, height: 500 },
        1440,
        900
      )
    ).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 800, height: 500 },
    });

    expect(
      clampWindowBounds(
        { x: 1600, y: 820 },
        { width: 800, height: 500 },
        1440,
        900
      )
    ).toEqual({
      position: { x: 640, y: 370 },
      size: { width: 800, height: 500 },
    });
  });

  test("shrinks oversized windows to fit smaller screens even below nominal minSize", () => {
    expect(
      clampWindowBounds(
        { x: 300, y: 200 },
        { width: 1200, height: 900 },
        1024,
        600,
        { minWidth: 620, minHeight: 400 }
      )
    ).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 1024, height: 570 },
    });

    expect(
      clampWindowBounds(
        { x: 50, y: 50 },
        { width: 800, height: 600 },
        500,
        360,
        { minWidth: 620, minHeight: 400 }
      )
    ).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 500, height: 330 },
    });
  });

  test("handles non-finite coordinates cleanly", () => {
    expect(
      clampWindowBounds(
        { x: Number.NaN, y: Number.POSITIVE_INFINITY },
        { width: Number.NaN, height: Number.NaN },
        1280,
        720,
        { minWidth: 400, minHeight: 300 }
      )
    ).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
    });
  });

  test("clamps window size against requested maxWidth and maxHeight", () => {
    expect(
      clampWindowBounds(
        { x: 100, y: 100 },
        { width: 900, height: 700 },
        1440,
        900,
        { minWidth: 200, minHeight: 150, maxWidth: 480, maxHeight: 360 }
      )
    ).toEqual({
      position: { x: 100, y: 100 },
      size: { width: 480, height: 360 },
    });
  });

  test("clamps workspace index safely", () => {
    expect(clampWorkspace(undefined, 3)).toBe(1);
    expect(clampWorkspace(0, 3)).toBe(1);
    expect(clampWorkspace(5, 3)).toBe(3);
    expect(clampWorkspace(2, 3)).toBe(2);
    expect(clampWorkspace(2, 0)).toBe(1);
  });

  test("adds SSD titlebar height to Wayland client constraints for SSD dialogs", () => {
    // qterminal About dialog requests fixed 383x232 client size
    const ssdAbout = resolveWaylandOuterConstraints(
      {
        width: 383,
        height: 232,
        minWidth: 383,
        minHeight: 232,
        maxWidth: 383,
        maxHeight: 232,
      },
      false
    );
    expect(ssdAbout.defaultSize).toEqual({
      width: 383,
      height: 232 + SSD_TITLEBAR_HEIGHT,
    });
    expect(ssdAbout.minSize).toEqual({
      width: 383,
      height: 232 + SSD_TITLEBAR_HEIGHT,
    });
    expect(ssdAbout.maxHeight).toBe(232 + SSD_TITLEBAR_HEIGHT);

    // Small dialog with maxSize < generic default minimum (265x114) shouldn't be stretched
    const smallSsdDialog = resolveWaylandOuterConstraints(
      { width: 285, height: 134, maxWidth: 265, maxHeight: 114 },
      false
    );
    expect(smallSsdDialog.minSize).toEqual({
      width: 265,
      height: 114 + SSD_TITLEBAR_HEIGHT,
    });

    // CSD dialogs keep 1:1 client dimensions without extra titlebar padding
    const csdDialog = resolveWaylandOuterConstraints(
      { width: 444, height: 395, minWidth: 444, minHeight: 395, maxWidth: 444, maxHeight: 395 },
      true
    );
    expect(csdDialog.defaultSize).toEqual({ width: 444, height: 395 });
    expect(csdDialog.maxHeight).toBe(395);
  });
});

