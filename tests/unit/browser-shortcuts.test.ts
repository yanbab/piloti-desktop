import { describe, expect, it } from "bun:test";
import {
  browserShortcut,
  browserTabTarget,
  type ShortcutKey,
} from "@/ui/shell/windows/browser-shortcuts";
import { formatBrowserZoom, nextBrowserZoom } from "@/ui/shell/windows/browser-zoom";

const key = (k: string, mods: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});
const ctrl = (k: string, mods: Partial<ShortcutKey> = {}) => key(k, { ctrlKey: true, ...mods });

describe("browser shortcuts", () => {
  it("maps navigation keys", () => {
    expect(browserShortcut(key("ArrowLeft", { altKey: true }))).toEqual({ kind: "back" });
    expect(browserShortcut(key("ArrowRight", { altKey: true }))).toEqual({ kind: "forward" });
    expect(browserShortcut(key("F5"))).toEqual({ kind: "reload" });
    expect(browserShortcut(ctrl("r"))).toEqual({ kind: "reload" });
    expect(browserShortcut(ctrl("R", { shiftKey: true }))).toEqual({ kind: "reload" });
    expect(browserShortcut(ctrl("l"))).toEqual({ kind: "focus-address" });
  });

  it("maps tabs and windows", () => {
    expect(browserShortcut(ctrl("t"))).toEqual({ kind: "new-tab" });
    expect(browserShortcut(ctrl("T", { shiftKey: true }))).toEqual({ kind: "reopen-tab" });
    expect(browserShortcut(ctrl("w"))).toEqual({ kind: "close-tab" });
    expect(browserShortcut(ctrl("n"))).toEqual({ kind: "new-window" });
    expect(browserShortcut(ctrl("Tab"))).toEqual({ kind: "next-tab" });
    expect(browserShortcut(ctrl("Tab", { shiftKey: true }))).toEqual({ kind: "previous-tab" });
    expect(browserShortcut(ctrl("PageUp"))).toEqual({ kind: "previous-tab" });
    expect(browserShortcut(ctrl("3", { code: "Digit3" }))).toEqual({ kind: "select-tab", index: 2 });
    expect(browserShortcut(ctrl("9"))).toEqual({ kind: "select-tab", index: -1 });
  });

  it("reads tab digits by key position on AZERTY", () => {
    expect(browserShortcut(ctrl("é", { code: "Digit2" }))).toEqual({ kind: "select-tab", index: 1 });
    expect(browserShortcut(ctrl("à", { code: "Digit0" }))).toEqual({ kind: "zoom-reset" });
  });

  it("maps find and zoom", () => {
    expect(browserShortcut(ctrl("f"))).toEqual({ kind: "find" });
    expect(browserShortcut(ctrl("g"))).toEqual({ kind: "find-next" });
    expect(browserShortcut(ctrl("G", { shiftKey: true }))).toEqual({ kind: "find-previous" });
    expect(browserShortcut(ctrl("="))).toEqual({ kind: "zoom-in" });
    expect(browserShortcut(ctrl("+", { shiftKey: true }))).toEqual({ kind: "zoom-in" });
    expect(browserShortcut(ctrl("-"))).toEqual({ kind: "zoom-out" });
    expect(browserShortcut(ctrl("0"))).toEqual({ kind: "zoom-reset" });
  });

  it("leaves other keys alone", () => {
    expect(browserShortcut(key("r"))).toBeNull();
    expect(browserShortcut(ctrl("c"))).toBeNull();
    expect(browserShortcut(ctrl("l", { altKey: true }))).toBeNull();
    expect(browserShortcut(key("ArrowLeft", { altKey: true, shiftKey: true }))).toBeNull();
  });
});

describe("browser tab target", () => {
  const ids = ["a", "b", "c"];
  it("cycles and selects by position", () => {
    expect(browserTabTarget({ kind: "next-tab" }, ids, "c")).toBe("a");
    expect(browserTabTarget({ kind: "previous-tab" }, ids, "a")).toBe("c");
    expect(browserTabTarget({ kind: "select-tab", index: 1 }, ids, "a")).toBe("b");
    expect(browserTabTarget({ kind: "select-tab", index: -1 }, ids, "a")).toBe("c");
  });
  it("does nothing out of range, on the active tab or with one tab", () => {
    expect(browserTabTarget({ kind: "select-tab", index: 5 }, ids, "a")).toBeNull();
    expect(browserTabTarget({ kind: "select-tab", index: 0 }, ids, "a")).toBeNull();
    expect(browserTabTarget({ kind: "next-tab" }, ["a"], "a")).toBeNull();
  });
});

describe("browser zoom", () => {
  it("steps as Chrome does and clamps", () => {
    expect(nextBrowserZoom(1, 1)).toBe(1.1);
    expect(nextBrowserZoom(1, -1)).toBe(0.9);
    expect(nextBrowserZoom(1.05, 1)).toBe(1.1);
    expect(nextBrowserZoom(5, 1)).toBe(5);
    expect(nextBrowserZoom(0.25, -1)).toBe(0.25);
    expect(formatBrowserZoom(1.1)).toBe("110%");
  });

  it("binds Ctrl+D to the bookmark", () => {
    expect(
      browserShortcut({ key: "d", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })
    ).toEqual({ kind: "toggle-bookmark" });
  });
});
