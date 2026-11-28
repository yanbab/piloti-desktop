import { describe, expect, test } from "bun:test";
import type { AppDefinition } from "@/core/data/catalog";
import { createRepeatGuard, type LaunchContext, planLaunch } from "@/core/windows/launch-plan";
import { newShellWindow } from "@/core/windows/new-shell-window";
import type { DesktopWindowInstance } from "@/core/windows/types";

const texts = {
  id: "texts",
  name: "Texts",
  iconName: "file-text",
  builtinComponent: "texts",
  defaultSize: { width: 520, height: 380 },
} as AppDefinition;

const win = (over: Partial<DesktopWindowInstance>): DesktopWindowInstance => ({
  id: "shell:texts-1",
  appId: "texts",
  title: "Texts",
  iconName: "file-text",
  workspace: 1,
  position: { x: 100, y: 100 },
  size: { width: 520, height: 380 },
  minSize: { width: 300, height: 200 },
  minimized: false,
  maximized: false,
  zIndex: 1,
  ...over,
});

const context = (over: Partial<LaunchContext> = {}): LaunchContext => ({
  windows: [],
  programs: [],
  runIn: () => "shell",
  systemServices: true,
  browserUrl: "https://example.org/",
  ...over,
});

describe("launch plan", () => {
  test("goes to the window an app already has", () => {
    const ctx = context({ windows: [win({})], definition: texts });
    expect(planLaunch("texts", {}, ctx)).toEqual({ kind: "focus", windowId: "shell:texts-1" });
    expect(planLaunch("texts", { forceNew: true }, ctx)).toMatchObject({ kind: "shell" });
  });

  test("opens one window per document", () => {
    const ctx = context({ windows: [win({ payload: "/a.txt" })], definition: texts });
    expect(planLaunch("texts", { payload: "/b.txt" }, ctx)).toMatchObject({ kind: "shell" });
    expect(planLaunch("texts", { payload: "/a.txt", forceNew: true }, ctx)).toEqual({
      kind: "focus",
      windowId: "shell:texts-1",
    });
  });

  test("starts a module when the app runs on its own, unless it cannot", () => {
    const ctx = context({ definition: texts, runIn: () => "isolated" });
    expect(planLaunch("texts", {}, ctx)).toEqual({ kind: "module", builtin: "texts" });
    expect(planLaunch("texts", { inShell: true }, ctx)).toEqual({ kind: "shell", builtin: "texts", isolated: false });
    expect(planLaunch("texts", {}, { ...ctx, systemServices: false })).toEqual({
      kind: "shell",
      builtin: "texts",
      isolated: true,
    });
  });

  test("a link is a tab of the open browser, or a new window", () => {
    expect(planLaunch("browser", { payload: "x" }, context())).toEqual({ kind: "browser", url: "https://example.org/" });
    const open = context({ windows: [win({ id: "browser:1", appId: "browser", browserWindowId: "1" })] });
    expect(planLaunch("browser", { payload: "x" }, open)).toEqual({
      kind: "focus",
      windowId: "browser:1",
      openTab: "https://example.org/",
    });
  });

  test("runs programs by their entry, Flatpak by its id", () => {
    const programs = [{ appId: "org.gnome.Calculator", desktopId: "org.gnome.Calculator.desktop", execArgv: ["gnome-calculator"] }];
    expect(planLaunch("org.gnome.Calculator", {}, context({ programs }))).toEqual({
      kind: "program",
      argv: ["gnome-calculator"],
    });
    expect(planLaunch("com.example.App", {}, context())).toEqual({ kind: "program", argv: ["flatpak", "run", "com.example.App"] });
    expect(planLaunch("kitty", {}, context())).toEqual({ kind: "program", argv: ["kitty"] });
  });

  test("advanced settings are Devtools", () => {
    expect(planLaunch("settings", { payload: "advanced" }, context())).toEqual({
      kind: "instead",
      appId: "console",
      options: { payload: "advanced" },
    });
  });

  test("ignores the second of a double click", () => {
    let time = 0;
    const repeated = createRepeatGuard(500, () => time);
    expect(repeated("a")).toBe(false);
    time = 200;
    expect(repeated("a")).toBe(true);
    time = 800;
    expect(repeated("a")).toBe(false);
  });

  test("a new window is named for its document and fits the screen", () => {
    const opened = newShellWindow({
      id: "shell:texts-2",
      appId: "texts",
      builtin: "texts",
      definition: texts,
      payload: "/home/u/notes.txt",
      isolated: false,
      windows: [],
      screen: { width: 500, height: 800 },
      workspaces: { active: 5, count: 2 },
      zIndex: 3,
    });
    expect(opened.title).toBe("notes.txt");
    expect(opened.size.width).toBe(452);
    expect(opened.workspace).toBe(2);
  });
});
