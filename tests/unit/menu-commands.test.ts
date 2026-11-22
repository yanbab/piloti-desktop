import { describe, expect, it } from "bun:test";
import {
  collectRemoteMenuCommands,
  type MenuCommand,
  searchMenuCommands,
} from "@/lib/shell/menu-commands";
import type { RemoteMenuEntry } from "@/lib/xdg/xdg-app-menu";

const cmd = (path: string[], label: string, shortcut?: string): MenuCommand => ({
  id: `${path.join("/")}:${label}`,
  label,
  path,
  shortcut,
  run: () => {},
});

describe("menu-commands", () => {
  const commands = [
    cmd(["File"], "Save", "Ctrl+S"),
    cmd(["File"], "Save As…", "Ctrl+Shift+S"),
    cmd(["View"], "Line Numbers"),
    cmd(["Edit"], "Paste", "Ctrl+V"),
    cmd(["Window"], "Tile Left", "Alt+["),
  ];

  it("ranks prefix matches first", () => {
    expect(searchMenuCommands(commands, "sav").map((c) => c.label)).toEqual(["Save", "Save As…"]);
  });

  it("matches words, menu paths and subsequences", () => {
    expect(searchMenuCommands(commands, "numbers")[0]?.label).toBe("Line Numbers");
    expect(searchMenuCommands(commands, "window tile")[0]?.label).toBe("Tile Left");
    expect(searchMenuCommands(commands, "lnn")[0]?.label).toBe("Line Numbers");
    expect(searchMenuCommands(commands, "")).toEqual([]);
  });

  it("flattens remote menus with submenu paths and cleans mnemonics", () => {
    const entries: RemoteMenuEntry[] = [
      { kind: "item", id: "1", label: "_Open", enabled: true, shortcut: "<Control>o", activate: () => {} },
      { kind: "separator", id: "s" },
      {
        kind: "item",
        id: "2",
        label: "_Zoom",
        enabled: true,
        submenu: [{ kind: "item", id: "3", label: "Zoom _In", enabled: false, activate: () => {} }],
      },
    ];
    const out = collectRemoteMenuCommands(entries, ["File"]);
    expect(out.map((c) => [c.path.join("/"), c.label, c.disabled])).toEqual([
      ["File", "Open", false],
      ["File/Zoom", "Zoom In", true],
    ]);
  });
});
