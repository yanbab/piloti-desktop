import { describe, expect, it } from "bun:test";
import { classifyAddressInput, expandPath, looksLikePath, tildePath } from "@/core/address/input";
import {
  canNavigate,
  currentNavEntry,
  navGo,
  navMenuEntries,
  navPush,
  startNavHistory,
} from "@/core/address/nav-history";
import { pathSuggestions, splitTypedPath } from "@/core/address/path-suggestions";
import type { VfsListedEntry } from "@/core/ports/vfs";

const HOME = "/home/ana";

describe("address input", () => {
  it("tells paths, addresses and text apart", () => {
    expect(classifyAddressInput("  ", HOME)).toEqual({ kind: "empty" });
    expect(classifyAddressInput("~/Documents/", HOME)).toEqual({ kind: "path", path: "/home/ana/Documents" });
    expect(classifyAddressInput("/usr/../etc//x", HOME)).toEqual({ kind: "path", path: "/etc/x" });
    expect(classifyAddressInput("file:///home/ana/My%20Files", HOME)).toEqual({
      kind: "path",
      path: "/home/ana/My Files",
    });
    expect(classifyAddressInput("example.com", HOME)).toEqual({ kind: "url", url: "https://example.com" });
    expect(classifyAddressInput("localhost:5173", HOME)).toEqual({ kind: "url", url: "http://localhost:5173" });
    expect(classifyAddressInput("example.com:8080/x", HOME)).toEqual({ kind: "url", url: "https://example.com:8080/x" });
    expect(classifyAddressInput("about:blank", HOME)).toEqual({ kind: "url", url: "about:blank" });
    expect(classifyAddressInput("linux desktop", HOME)).toEqual({ kind: "text", text: "linux desktop" });
    expect(classifyAddressInput("~ana", HOME)).toEqual({ kind: "text", text: "~ana" });
  });

  it("expands and shortens home", () => {
    expect(looksLikePath("~")).toBe(true);
    expect(looksLikePath("Documents")).toBe(false);
    expect(expandPath("~", HOME)).toBe(HOME);
    expect(expandPath("/", HOME)).toBe("/");
    expect(tildePath("/home/ana/Music", HOME)).toBe("~/Music");
    expect(tildePath("/home/anabel", HOME)).toBe("/home/anabel");
  });
});

describe("nav history", () => {
  const a = { location: "/a", title: "A" };
  const b = { location: "/b", title: "B" };
  const c = { location: "/c", title: "C" };

  it("goes back and forward, and a new location drops Forward", () => {
    let h = navPush(navPush(startNavHistory(a), b), c);
    expect(canNavigate(h, 1)).toBe(false);
    h = navGo(h, -2);
    expect(currentNavEntry(h)).toEqual(a);
    expect(navMenuEntries(h, "forward").map((e) => [e.entry.location, e.delta])).toEqual([
      ["/b", 1],
      ["/c", 2],
    ]);
    h = navPush(h, c);
    expect(h.entries.map((e) => e.location)).toEqual(["/a", "/c"]);
    expect(navGo(h, 5)).toBe(h);
  });

  it("renames the current entry instead of repeating it, and keeps the newest", () => {
    const h = navPush(startNavHistory(a), { location: "/a", title: "Renamed" });
    expect(h.entries).toEqual([{ location: "/a", title: "Renamed" }]);
    let long = startNavHistory(a);
    for (let i = 0; i < 5; i++) long = navPush(long, { location: `/${i}`, title: "" }, 3);
    expect(long.entries.map((e) => e.location)).toEqual(["/2", "/3", "/4"]);
    expect(long.index).toBe(2);
  });
});

describe("path suggestions", () => {
  const tree: Record<string, string[]> = {
    "/home/ana": ["Documents/", "Downloads/", "Desktop/", ".config/", "notes.txt", "Music/"],
    "/": ["home/", "usr/"],
  };
  const host = {
    list: async (dir: string): Promise<VfsListedEntry[] | null> =>
      tree[dir]?.map((n) => ({
        name: n.replace(/\/$/, ""),
        path: `${dir}/${n}`,
        kind: n.endsWith("/") ? ("directory" as const) : ("file" as const),
      })) ?? null,
  };

  it("splits what is typed", () => {
    expect(splitTypedPath("~/Do", HOME)).toEqual({ dir: HOME, prefix: "Do", typedDir: "~/" });
    expect(splitTypedPath("~", HOME)).toEqual({ dir: HOME, prefix: "", typedDir: "~/" });
    expect(splitTypedPath("/u", HOME)).toEqual({ dir: "/", prefix: "u", typedDir: "/" });
    expect(splitTypedPath("Docs", HOME)).toBeNull();
  });

  it("lists matching subfolders, hidden ones once a dot is typed", async () => {
    const docs = await pathSuggestions("~/do", host, HOME);
    expect(docs.map((s) => s.completion)).toEqual(["~/Documents/", "~/Downloads/"]);
    expect(docs[0]).toMatchObject({ detail: "~/Documents", target: { kind: "path", path: "/home/ana/Documents" } });
    expect((await pathSuggestions("~/", host, HOME)).map((s) => s.title)).toEqual([
      "Desktop",
      "Documents",
      "Downloads",
      "Music",
    ]);
    expect((await pathSuggestions("~/.c", host, HOME)).map((s) => s.title)).toEqual([".config"]);
    expect((await pathSuggestions("/", host, HOME)).map((s) => s.target)).toEqual([
      { kind: "path", path: "/home" },
      { kind: "path", path: "/usr" },
    ]);
    expect(await pathSuggestions("/nowhere/x", host, HOME)).toEqual([]);
  });
});
