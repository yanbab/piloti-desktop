import { describe, expect, test } from "bun:test";
import {
  assignGridPositions,
  clientPointToGridCell,
  computeGridMetrics,
  findItemsInRect,
  findNextKeyboardItemId,
  findTypeAheadItemId,
  inferFileVisual,
  moveItemsToCells,
  moveItemToCell,
  normalizeRect,
  sortDesktopItems,
} from "@/lib/files/desktop-icons";

describe("desktop-icons spatial grid helpers", () => {
  test("computes grid metrics with sensible minimums", () => {
    const metrics = computeGridMetrics(1200, 700, 96, 104, 16);
    expect(metrics.cols).toBe(12);
    expect(metrics.rows).toBe(6);

    const tiny = computeGridMetrics(40, 40, 96, 104, 16);
    expect(tiny.cols).toBe(1);
    expect(tiny.rows).toBe(1);
  });

  test("assigns saved coordinates without collision and auto-places new items column-first", () => {
    const items = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ];
    const positions = assignGridPositions(
      items,
      { c: { col: 2, row: 1 }, d: { col: 2, row: 1 } },
      4,
      2
    );

    expect(positions.c).toEqual({ col: 2, row: 1 });
    expect(positions.d).not.toEqual(positions.c);
    expect(positions.a).toEqual({ col: 0, row: 0 });
    expect(positions.b).toEqual({ col: 0, row: 1 });
  });

  test("moves item to empty cell and swaps when dropping on an occupied cell", () => {
    const initial = {
      a: { col: 0, row: 0 },
      b: { col: 0, row: 1 },
    };
    const moved = moveItemToCell(initial, "a", { col: 2, row: 1 }, 4, 3);
    expect(moved.a).toEqual({ col: 2, row: 1 });
    expect(moved.b).toEqual({ col: 0, row: 1 });

    const swapped = moveItemToCell(moved, "a", { col: 0, row: 1 }, 4, 3);
    expect(swapped.a).toEqual({ col: 0, row: 1 });
    expect(swapped.b).toEqual({ col: 2, row: 1 });

    const multi = moveItemsToCells(
      {
        a: { col: 0, row: 0 },
        b: { col: 1, row: 2 },
        c: { col: 3, row: 0 },
      },
      ["a", "b"],
      "a",
      { col: 2, row: 1 },
      5,
      4
    );
    expect(multi.a).toEqual({ col: 2, row: 1 });
    expect(multi.b).toEqual({ col: 3, row: 3 });
    expect(multi.c).toEqual({ col: 3, row: 0 });
  });

  test("converts pointer coordinates to clamped grid cells", () => {
    const metrics = computeGridMetrics(500, 400, 100, 100, 10);
    expect(clientPointToGridCell(15, 15, metrics)).toEqual({ col: 0, row: 0 });
    expect(clientPointToGridCell(240, 130, metrics)).toEqual({ col: 2, row: 1 });
    expect(clientPointToGridCell(9999, 9999, metrics)).toEqual({
      col: metrics.cols - 1,
      row: metrics.rows - 1,
    });
  });

  test("navigates spatially with arrow keys, Home/End, and type-ahead", () => {
    const items = [
      { id: "projects", name: "Projects" },
      { id: "notes", name: "Notes.md" },
      { id: "pictures", name: "Pictures" },
      { id: "readme", name: "README.txt" },
    ];
    const positions = {
      projects: { col: 0, row: 0 },
      notes: { col: 0, row: 1 },
      pictures: { col: 2, row: 0 },
      readme: { col: 2, row: 1 },
    };

    expect(findNextKeyboardItemId(items, positions, "projects", "ArrowRight")).toBe(
      "pictures"
    );
    expect(findNextKeyboardItemId(items, positions, "pictures", "ArrowDown")).toBe(
      "readme"
    );
    expect(findNextKeyboardItemId(items, positions, "readme", "ArrowLeft")).toBe(
      "notes"
    );
    expect(findNextKeyboardItemId(items, positions, "notes", "ArrowUp")).toBe(
      "projects"
    );
    expect(findNextKeyboardItemId(items, positions, "notes", "Home")).toBe(
      "projects"
    );
    expect(findNextKeyboardItemId(items, positions, "projects", "End")).toBe(
      "readme"
    );
    expect(findTypeAheadItemId(items, "projects", "p")).toBe("pictures");
    expect(findTypeAheadItemId(items, "pictures", "p")).toBe("projects");
  });

  test("sorts directories before files and infers file visuals", () => {
    const sorted = sortDesktopItems([
      { kind: "file", name: "zeta.txt" },
      { kind: "directory", name: "Work" },
      { kind: "desktop-entry", name: "App.desktop" },
      { kind: "directory", name: "Alpha" },
    ]);
    expect(sorted.map((i) => i.name)).toEqual([
      "Alpha",
      "Work",
      "App.desktop",
      "zeta.txt",
    ]);

    expect(inferFileVisual("Docs", "directory").iconName).toBe("folder");
    expect(inferFileVisual("script.ts", "file").iconName).toBe("code");
    expect(inferFileVisual("photo.png", "file").iconName).toBe("sparkles");
    expect(inferFileVisual("Welcome.md", "file").iconName).toBe("notes");
  });

  test("finds items intersecting a rubber-band selection rectangle", () => {
    const metrics = computeGridMetrics(600, 500, 96, 104, 16);
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const positions = {
      a: { col: 0, row: 0 },
      b: { col: 0, row: 1 },
      c: { col: 2, row: 0 },
    };
    const rect = normalizeRect(100, 140, 20, 20);
    expect(findItemsInRect(items, positions, rect, metrics)).toEqual([
      "a",
      "b",
    ]);
  });

  test("auto-places unassigned items right-to-left when align is right", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const positions = assignGridPositions(items, {}, 4, 2, "right");
    expect(positions.a).toEqual({ col: 3, row: 0 });
    expect(positions.b).toEqual({ col: 3, row: 1 });
    expect(positions.c).toEqual({ col: 2, row: 0 });
  });

  test("distinguishes empty text files from populated text files", () => {
    const emptyTxt = inferFileVisual("draft.txt", "file", "text/plain", { isEmpty: true });
    expect(emptyTxt.iconCandidates[0]).toBe("application-x-zerosize");
    expect(emptyTxt.iconCandidates).toContain("text-x-generic");

    const nonEmptyTxt = inferFileVisual("notes.txt", "file", "text/plain", { isEmpty: false });
    expect(nonEmptyTxt.iconCandidates[0]).toBe("text-x-generic");

    const zeroMime = inferFileVisual("README", "file", "application/x-zerosize");
    expect(zeroMime.iconCandidates[0]).toBe("application-x-zerosize");
  });
});

