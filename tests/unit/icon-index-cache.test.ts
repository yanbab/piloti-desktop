import { describe, expect, test } from "bun:test";
import { deserializeXdgIconThemeIndex, serializeXdgIconThemeIndex } from "@/core/xdg/xdg-icon-theme";

const entries: [string, string][] = [
  ["b", "/usr/share/icons/t/48/b.svg"],
  ["a", "/usr/share/icons/t/48/a.svg"],
  ["c", "/usr/local/share/icons/t/48/c.png"],
];

const index = (list: [string, string][]) => ({
  themeOrder: ["t"],
  themes: new Map(),
  subdirFiles: new Map([["t::48", new Map(list)]]),
  fallbackFiles: new Map(list),
});

describe("icon index cache", () => {
  test("the same icons found in another order give the same text", () => {
    const text = serializeXdgIconThemeIndex("t", index(entries));
    expect(serializeXdgIconThemeIndex("t", index([...entries].reverse()))).toBe(text);
    const read = deserializeXdgIconThemeIndex("t", text)!;
    expect(Object.fromEntries(read.subdirFiles.get("t::48")!)).toEqual(Object.fromEntries(entries));
    expect(Object.fromEntries(read.fallbackFiles)).toEqual(Object.fromEntries(entries));
  });
});
