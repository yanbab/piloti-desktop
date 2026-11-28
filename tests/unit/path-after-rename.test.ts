import { describe, expect, test } from "bun:test";
import { pathAfterRename } from "@/core/ports/vfs";

describe("pathAfterRename", () => {
  test("the renamed file and anything inside a renamed folder", () => {
    expect(pathAfterRename("/h/a.txt", "/h/a.txt", "/h/b.txt")).toBe("/h/b.txt");
    expect(pathAfterRename("/h/docs/x/a.txt", "/h/docs", "/h/old")).toBe("/h/old/x/a.txt");
  });
  test("other paths, including a shared prefix, stay", () => {
    expect(pathAfterRename("/h/docs2/a.txt", "/h/docs", "/h/old")).toBeNull();
    expect(pathAfterRename("/h/a.txt", "/h/b.txt", "/h/c.txt")).toBeNull();
  });
});
