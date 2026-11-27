import { describe, expect, test } from "bun:test";
import { formatWidgetLayout, parseWidgetLayout, placeWidget } from "@/apps/system-monitor/widget-grid";

const sizes = { a: { cols: 1, rows: 1 }, b: { cols: 1, rows: 1 }, big: { cols: 2, rows: 2 } };
const layout = { a: { col: 0, row: 0 }, b: { col: 1, row: 0 }, big: { col: 0, row: 1 } };

describe("widget grid", () => {
  test("swaps two small widgets", () => {
    const next = placeWidget(layout, sizes, "a", { col: 1, row: 0 }, 2, 3);
    expect(next.a).toEqual({ col: 1, row: 0 });
    expect(next.b).toEqual({ col: 0, row: 0 });
    expect(next.big).toEqual({ col: 0, row: 1 });
  });

  test("the large one pushes both small ones out of the way", () => {
    const next = placeWidget(layout, sizes, "big", { col: 0, row: -1 }, 2, 3);
    expect(next.big).toEqual({ col: 0, row: 0 });
    expect([next.a.row, next.b.row]).toEqual([2, 2]);
    expect(next.a.col).not.toBe(next.b.col);
  });

  test("keeps the layout when the others would not fit", () => {
    expect(placeWidget(layout, sizes, "a", { col: 0, row: 1 }, 2, 3)).toBe(layout);
  });

  test("reads back what it saves and rejects an overlap", () => {
    const fallback = { ...layout };
    const saved = placeWidget(layout, sizes, "a", { col: 1, row: 0 }, 2, 3);
    expect(parseWidgetLayout(formatWidgetLayout(saved), fallback, sizes, 2, 3)).toEqual(saved);
    expect(parseWidgetLayout("a:0,0;b:0,0;big:0,1", fallback, sizes, 2, 3)).toBe(fallback);
  });
});
