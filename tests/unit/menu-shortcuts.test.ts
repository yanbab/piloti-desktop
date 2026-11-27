import { describe, expect, it } from "bun:test";
import { buildAppHelpLinks, slugifyAppName } from "@/shell/menubar/app-help-links";
import { collectMenuShortcuts, formatMenuShortcut } from "@/lib/core/menu-shortcuts";

describe("menu shortcut collection", () => {
  it("reads shortcuts from built-in menus, remote menus and extra groups", () => {
    const groups = collectMenuShortcuts({
      menus: [
        {
          title: "View",
          items: [
            { label: "Zoom In", shortcut: "Ctrl++", actionId: "a" },
            { label: "No shortcut", actionId: "b" },
          ],
        },
        { title: "Empty", items: [{ label: "X", actionId: "c" }] },
      ],
      remoteSections: [
        {
          title: "_File",
          items: [
            { kind: "item", id: "1", label: "_Open", enabled: true, shortcut: "Ctrl+O" },
            { kind: "separator", id: "2" },
            {
              kind: "item",
              id: "3",
              label: "Export",
              enabled: true,
              submenu: [
                { kind: "item", id: "4", label: "As _PDF", enabled: true, shortcut: "Ctrl+E" },
              ],
            },
          ],
        },
      ],
      extraGroups: [{ title: "Window", entries: [{ label: "Minimize", shortcut: "Alt+M" }] }],
    });
    expect(groups.map((g) => g.title)).toEqual(["View", "File", "Window"]);
    expect(groups[0].entries).toEqual([{ label: "Zoom In", shortcut: "Ctrl++" }]);
    expect(groups[1].entries.map((e) => e.label)).toEqual(["Open", "As PDF"]);
  });

  it("de-duplicates identical entries", () => {
    const entry = { label: "Save", shortcut: "Ctrl+S" };
    const groups = collectMenuShortcuts({
      extraGroups: [{ title: "File", entries: [entry, entry] }],
    });
    expect(groups[0].entries).toHaveLength(1);
  });

  it("formats shortcuts for PC and Mac layouts", () => {
    expect(formatMenuShortcut("⌘1", "pc")).toBe("Super + 1");
    expect(formatMenuShortcut("Ctrl+S", "mac")).toBe("⌘S");
  });
});

describe("per-app help links", () => {
  it("slugifies app names", () => {
    expect(slugifyAppName("Text Editor")).toBe("text-editor");
    expect(slugifyAppName("  Desktop  Settings! ")).toBe("desktop-settings");
  });

  it("builds website and issue URLs", () => {
    expect(buildAppHelpLinks("Text Editor")).toEqual({
      websiteUrl: "https://yanbab.github.io/piloti-desktop/#text-editor",
      issueUrl: "https://github.com/yanbab/piloti-desktop/issues/new?title=Text%20Editor%20issue",
    });
  });

  it("falls back to Piloti Desktop for empty names", () => {
    expect(buildAppHelpLinks("  ").websiteUrl).toBe(
      "https://yanbab.github.io/piloti-desktop/#piloti-desktop",
    );
  });
});
