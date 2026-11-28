import { describe, expect, test } from "bun:test";
import { droppedActions, droppedPathsAction, parseDroppedPaths } from "@/core/files/dropped-paths";

describe("items dropped on an app on its own", () => {
  test("reads back what the shell sends", () => {
    expect(parseDroppedPaths(droppedPathsAction(["/home/u/a b.txt", "/home/u/c"], true))).toEqual({
      paths: ["/home/u/a b.txt", "/home/u/c"],
      copy: true,
    });
    expect(parseDroppedPaths(droppedPathsAction(["/a"], false, "/home/u/Music"))).toEqual({
      paths: ["/a"],
      copy: false,
      dest: "/home/u/Music",
    });
    expect(parseDroppedPaths(droppedPathsAction(["/a"], false, "Music"))).toEqual({ paths: ["/a"], copy: false });
    expect(parseDroppedPaths("piloti:drop-paths:{oops")).toBeNull();
    expect(parseDroppedPaths(droppedPathsAction(["relative"], false))).toBeNull();
    expect(parseDroppedPaths("files:copy")).toBeNull();
  });

  test("gives the items, then the first to open", () => {
    expect(droppedActions({ windowId: "w", items: [{ path: "/a" }, { path: "/b" }] })).toEqual([
      droppedPathsAction(["/a", "/b"], false),
      "piloti:open-path:/a",
    ]);
    expect(droppedActions({ windowId: "w", item: { path: "/a" }, copy: true })[0]).toBe(
      droppedPathsAction(["/a"], true),
    );
    expect(droppedActions({ windowId: "w", items: [] })).toEqual([]);
  });
});
