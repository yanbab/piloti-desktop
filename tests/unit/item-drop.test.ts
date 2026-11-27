import { describe, expect, test } from "bun:test";
import { allInFolder, dropTargetAmong, isVirtualAppItem } from "@/lib/dnd/item-drop";

const el = (attrs: Record<string, string>) => ({
  hasAttribute: (name: string) => name in attrs,
  getAttribute: (name: string) => attrs[name] ?? null,
});

describe("drop targets", () => {
  test("the topmost target wins", () => {
    const hits = [el({}), el({ "data-dock-app-id": "nautilus" }), el({ "data-vfs-drop-path": "/h" })];
    expect(dropTargetAmong(hits, ["/h/a"])).toEqual({ kind: "dock", appId: "nautilus" });
  });

  test("a folder does not take itself or its parent's contents into a child", () => {
    const hits = [el({ "data-vfs-drop-path": "/h/a/b" }), el({ "data-vfs-drop-path": "/h" })];
    expect(dropTargetAmong(hits, ["/h/a"])).toEqual({ kind: "vfs", destPath: "/h" });
  });

  test("a blocked row stops the search", () => {
    const hits = [el({ "data-drop-blocked": "" }), el({ "data-vfs-drop-path": "/h" })];
    expect(dropTargetAmong(hits, ["/h/a/x"])).toEqual({ kind: "blocked" });
  });

  test("knows items already in the folder, and app entries", () => {
    expect(allInFolder([{ path: "/h/a" }], "/h")).toBe(true);
    expect(allInFolder([{ path: "/h/a/b" }], "/h")).toBe(false);
    expect(isVirtualAppItem({ id: "app:builtin:calculator" })).toBe(true);
    expect(isVirtualAppItem({ id: "/h/a.desktop" })).toBe(false);
  });
});
