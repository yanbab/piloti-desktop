import { describe, expect, test } from "bun:test";
import {
  addGtkBookmark,
  parseGtkBookmarks,
  removeGtkBookmark,
  serializeGtkBookmarks,
} from "@/lib/xdg/xdg-bookmarks";

describe("GTK bookmarks", () => {
  test("parses paths, labels, escapes, and skips non-file URIs", () => {
    const list = parseGtkBookmarks(
      "file:///home/u/Projets Projects\nfile:///home/u/Vid%C3%A9os\nsftp://host/x\n\nfile:///tmp/\n",
    );
    expect(list).toEqual([
      { path: "/home/u/Projets", label: "Projects" },
      { path: "/home/u/Vidéos" },
      { path: "/tmp" },
    ]);
  });

  test("round-trips through serialize", () => {
    const list = [{ path: "/home/u/My Docs", label: "Docs" }, { path: "/home/u/Vidéos" }];
    expect(parseGtkBookmarks(serializeGtkBookmarks(list))).toEqual(list);
    expect(serializeGtkBookmarks([])).toBe("");
  });

  test("add is idempotent, remove drops the path", () => {
    const one = addGtkBookmark([], "/a");
    expect(addGtkBookmark(one, "/a")).toEqual(one);
    expect(removeGtkBookmark(addGtkBookmark(one, "/b"), "/a")).toEqual([{ path: "/b" }]);
  });
});
