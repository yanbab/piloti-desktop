import { describe, expect, test } from "bun:test";
import { HISTORY_MENU_LIMIT, historyMenuEntries } from "@/ui/shell/windows/browser-history-menu";

describe("historyMenuEntries", () => {
  test("one side, nearest first, title or address", () => {
    const h = {
      back: [
        { id: 3, url: "https://b.test/", title: "B", favicon: "data:image/png;base64,AA" },
        { id: 1, url: "https://a.test/", title: "  ", favicon: "javascript:x" },
      ],
      forward: [{ id: 5, url: "https://c.test/", title: "C", favicon: "" }],
    };
    expect(historyMenuEntries(h, "back")).toEqual([
      { id: 3, url: "https://b.test/", title: "B", favicon: "data:image/png;base64,AA" },
      { id: 1, url: "https://a.test/", title: "https://a.test/", favicon: "" },
    ]);
    expect(historyMenuEntries(h, "forward").map((e) => e.id)).toEqual([5]);
  });

  test("bad data gives nothing, and the list is capped", () => {
    expect(historyMenuEntries(null, "back")).toEqual([]);
    expect(historyMenuEntries({ back: "x" }, "back")).toEqual([]);
    expect(historyMenuEntries({ back: [{ url: "no id" }] }, "back")).toEqual([]);
    const many = { back: Array.from({ length: 40 }, (_, i) => ({ id: i, url: `u${i}`, title: "", favicon: "" })) };
    expect(historyMenuEntries(many, "back")).toHaveLength(HISTORY_MENU_LIMIT);
  });
});
