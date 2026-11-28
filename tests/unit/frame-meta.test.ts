import { describe, expect, test } from "bun:test";
import { placementOf, scopedMeta, scopedSetter, syncShellMeta, type FrameMeta } from "@/ui/context/windows/frame-meta";
import type { DesktopWindowInstance } from "@/ui/context/windows/types";

const at = (x: number) => ({
  position: { x, y: 0 },
  size: { width: 400, height: 300 },
  minimized: false,
  maximized: false,
  tiled: null,
  zIndex: x,
  workspace: 1,
});

describe("frame records", () => {
  test("one kind is seen and written by raw id, the others untouched", () => {
    let all: FrameMeta = { "browser:a": at(1), "wayland:w": at(2) };
    const set = (action: FrameMeta | ((prev: FrameMeta) => FrameMeta)) => {
      all = typeof action === "function" ? action(all) : action;
    };
    expect(scopedMeta(all, "browser:")).toEqual({ a: at(1) });
    const before = all;
    scopedSetter(set, "browser:")((prev) => prev);
    expect(all).toBe(before);
    scopedSetter(set, "browser:")((prev) => ({ ...prev, b: at(3) }));
    expect(Object.keys(all).sort()).toEqual(["browser:a", "browser:b", "wayland:w"]);
  });

  test("shell windows get a record where they opened, lose it when closed unless their frame stays", () => {
    const win = { id: "shell:texts-1", ...at(5) } as DesktopWindowInstance;
    const seeded = syncShellMeta({}, [win], () => false);
    expect(seeded["shell:texts-1"]).toEqual(placementOf(win));
    expect(syncShellMeta(seeded, [win], () => false)).toBe(seeded);
    expect(syncShellMeta(seeded, [], () => false)).toEqual({});
    expect(syncShellMeta(seeded, [], () => true)).toBe(seeded);
  });
});
