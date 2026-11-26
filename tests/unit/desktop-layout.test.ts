import { describe, expect, test } from "bun:test";
import { moveInNamedLayout, placeNamesNear, positionsById } from "@/lib/shell/desktop-icons";

const items = [
  { id: "/d/a", name: "a" },
  { id: "/d/b", name: "b" },
  // A launcher shows the app's name and is saved under its file name.
  { id: "/d/c.desktop", name: "Camera", layoutKey: "c.desktop" },
];
const grid = { cols: 4, rows: 4 };

describe("name-keyed folder layouts", () => {
  test("saved cells are found by file name", () => {
    expect(positionsById(items, { "c.desktop": { col: 2, row: 1 } })).toEqual({
      "/d/c.desktop": { col: 2, row: 1 },
    });
  });

  test("a drop on the desktop pins every icon", () => {
    const next = moveInNamedLayout(items, {}, ["/d/a"], "/d/a", { col: 3, row: 3 }, grid);
    expect(next).toEqual({
      a: { col: 3, row: 3 },
      b: { col: 0, row: 1 },
      "c.desktop": { col: 0, row: 2 },
    });
  });

  test("a partial drop leaves untouched icons where they were saved", () => {
    const saved = { b: { col: 9, row: 9 } };
    const next = moveInNamedLayout(items, saved, ["/d/a"], "/d/a", { col: 1, row: 1 }, grid, {
      partial: true,
    });
    expect(next).toEqual({ a: { col: 1, row: 1 }, b: { col: 9, row: 9 } });
  });

  test("incoming files get free cells near the drop point", () => {
    const next = placeNamesNear(items, {}, ["new"], { col: 0, row: 0 }, grid);
    expect(next.new).not.toEqual({ col: 0, row: 0 });
  });
});
