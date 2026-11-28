import { describe, expect, test } from "bun:test";
import type { IconGridItem } from "@/core/files/desktop-icons";
import { buildFolderTree, renameExpanded, topmostItems } from "@/core/files/folder-tree";
import { folderEntriesToItems } from "@/core/files/folder-items";

const item = (path: string, kind: "file" | "directory" = "file"): IconGridItem => ({
  id: path,
  path,
  kind,
  name: path.slice(path.lastIndexOf("/") + 1),
  iconName: "folder",
});

describe("folder tree", () => {
  const root = [item("/h/a", "directory"), item("/h/z.txt")];
  const listed: Record<string, IconGridItem[]> = {
    "/h/a": [item("/h/a/b", "directory")],
    "/h/a/b": [item("/h/a/b/note.md")],
  };
  const childrenOf = (dir: string) => listed[dir];

  test("lists open folders' items under them", () => {
    const tree = buildFolderTree(root, { "/h/a": true, "/h/a/b": true }, childrenOf);
    expect(tree.visibleItems.map((i) => i.path)).toEqual([
      "/h/a",
      "/h/a/b",
      "/h/a/b/note.md",
      "/h/z.txt",
    ]);
    expect(tree.openDirs).toEqual(["/h/a", "/h/a/b"]);
  });

  test("a folder inside a closed one is not listed", () => {
    expect(buildFolderTree(root, { "/h/a/b": true }, childrenOf).openDirs).toEqual([]);
  });

  test("search keeps the folders leading to a match", () => {
    const tree = buildFolderTree(root, { "/h/a": true, "/h/a/b": true }, childrenOf, "note");
    expect(tree.visibleItems.map((i) => i.name)).toEqual(["a", "b", "note.md"]);
  });

  test("a folder takes its contents with it", () => {
    const picked = [item("/h/a/b/note.md"), item("/h/a", "directory"), item("/h/ab")];
    expect(topmostItems(picked).map((i) => i.path)).toEqual(["/h/a", "/h/ab"]);
  });

  test("open folders follow a rename", () => {
    expect(
      renameExpanded({ "/h/a": true, "/h/a/b": true, "/h/ab": true }, "/h/a", "/h/c"),
    ).toEqual({ "/h/c": true, "/h/c/b": true, "/h/ab": true });
  });
});

describe("folder order", () => {
  const entry = (name: string, kind: "file" | "directory", size = 0) => ({
    id: `/h/${name}`,
    name,
    kind,
    path: `/h/${name}`,
    parentPath: "/h",
    updatedAt: 1,
    size,
  });
  const entries = [entry("b", "file", 2), entry("a", "file", 9), entry("z", "directory"), entry(".x", "file")];
  const names = (sortBy: "name" | "size", sortDir: "asc" | "desc") =>
    folderEntriesToItems(entries, {
      showHidden: false,
      sortBy,
      sortDir,
      getAppIconUrl: () => undefined,
    }).map((i) => i.name);

  test("folders first, hidden files left out", () => {
    expect(names("name", "asc")).toEqual(["z", "a", "b"]);
    expect(names("size", "desc")).toEqual(["z", "a", "b"]);
    expect(names("size", "asc")).toEqual(["z", "b", "a"]);
  });
});
