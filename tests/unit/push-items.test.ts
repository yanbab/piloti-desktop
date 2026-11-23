import { describe, expect, it } from "bun:test";
import { pushItemsToCells } from "@/lib/shell/desktop-icons";

describe("pushItemsToCells", () => {
  it("moves the occupant out of the landing cell", () => {
    const next = pushItemsToCells(
      { a: { col: 0, row: 0 }, b: { col: 1, row: 0 } },
      ["a"],
      "a",
      { col: 1, row: 0 },
      4,
      4,
    );
    expect(next.a).toEqual({ col: 1, row: 0 });
    expect(next.b).toEqual({ col: 0, row: 0 });
  });

  it("keeps relative offsets and never overlaps", () => {
    const next = pushItemsToCells(
      { a: { col: 0, row: 0 }, b: { col: 0, row: 1 }, c: { col: 2, row: 0 } },
      ["a", "b"],
      "a",
      { col: 2, row: 0 },
      4,
      4,
    );
    const cells = Object.values(next).map((c) => `${c.col},${c.row}`);
    expect(new Set(cells).size).toBe(3);
    expect(next.a).toEqual({ col: 2, row: 0 });
    expect(next.b).toEqual({ col: 2, row: 1 });
  });
});
