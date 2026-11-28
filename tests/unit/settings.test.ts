import { afterEach, describe, expect, it } from "bun:test";
import {
  defineSettings,
  keyfileSettingsBackend,
  memorySettingsBackend,
  setSettingsBackend,
} from "@/platform/shared/settings";
import {
  SHELL_SETTINGS_PATH,
  findSettings,
  listSettingsSchemas,
  settingsFor,
  settingsPathForSchema,
} from "@/platform/shared/settings";
import { desktopSchemaDefaults } from "@/core/config/piloti-settings-ini";
import type { DesktopSettings } from "@/ui/context/SettingsContext";
import { mergeIniText } from "@/core/config/ini";
import { setStateSource } from "@/platform/shared/vfs-state";
import {
  appSettingsPath,
  getAppSetting,
  setAppSetting,
  subscribeAppSettings,
} from "@/core/config/app-settings";
import type { StateSource } from "@/core/ports/state-source";

function memoryStateSource(): StateSource & { data: Map<string, string> } {
  const data = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  return {
    data,
    files: () => [],
    read: (path) => data.get(path) ?? null,
    write(path, content) {
      data.set(path, content);
      listeners.get(path)?.forEach((l) => l());
    },
    remove(path) {
      data.delete(path);
      listeners.get(path)?.forEach((l) => l());
    },
    subscribe(path, listener) {
      if (!listeners.has(path)) listeners.set(path, new Set());
      listeners.get(path)!.add(listener);
      return () => listeners.get(path)?.delete(listener);
    },
    subscribeDir: () => () => {},
  };
}

afterEach(() => {
  setSettingsBackend(null);
  setStateSource(null);
});

describe("settings", () => {
  const defaults = { scientific: false, precision: 10, label: "Calc", history: [] as string[] };

  it("reads defaults, then what was set, then defaults again after reset", () => {
    setSettingsBackend(memorySettingsBackend());
    const s = defineSettings("org.piloti.test", defaults);
    expect(s.get("scientific")).toBe(false);
    s.set("scientific", true);
    s.set("precision", 4);
    s.set("history", ["1+1", "2*3"]);
    expect(s.get("scientific")).toBe(true);
    expect(s.get("precision")).toBe(4);
    expect(s.get("history")).toEqual(["1+1", "2*3"]);
    s.reset("precision");
    expect(s.get("precision")).toBe(10);
  });

  it("returns the same array until it changes", () => {
    setSettingsBackend(memorySettingsBackend());
    const s = defineSettings("org.piloti.test", defaults);
    s.set("history", ["a"]);
    expect(s.get("history")).toBe(s.get("history"));
  });

  it("notifies a key's listener only when that key changes", () => {
    setSettingsBackend(memorySettingsBackend());
    const s = defineSettings("org.piloti.test", defaults);
    let calls = 0;
    const stop = s.subscribe("scientific", () => calls++);
    s.set("precision", 3);
    s.set("scientific", true);
    s.set("scientific", true);
    stop();
    s.set("scientific", false);
    expect(calls).toBe(1);
  });

  it("stores a built-in app's schema in its app file and follows edits to it", () => {
    const state = memoryStateSource();
    setStateSource(state);
    setSettingsBackend(keyfileSettingsBackend());
    const path = appSettingsPath("test");
    const s = defineSettings("org.piloti.test", defaults);

    s.set("scientific", true);
    s.set("history", ["a", "b"]);
    expect(state.data.get(path)).toBe("[org.piloti.test]\nscientific=true\nhistory=a;b\n");

    let calls = 0;
    s.subscribe("precision", () => calls++);
    state.write(path, "[org.piloti.test]\nprecision=2\n");
    expect(calls).toBe(1);
    expect(s.get("precision")).toBe(2);
    expect(s.get("scientific")).toBe(false);
  });

  it("reads a bad value as the default", () => {
    setSettingsBackend(memorySettingsBackend());
    const s = defineSettings("org.piloti.test", defaults);
    s.set("precision", "x" as unknown as number);
    expect(s.get("precision")).toBe(10);
  });

  it("keeps other sections of a keyfile and drops an emptied one", () => {
    const state = memoryStateSource();
    setStateSource(state);
    setSettingsBackend(
      keyfileSettingsBackend({ path: () => "/s/app.ini", section: () => "General", dirs: ["/s"] }),
    );
    state.write("/s/app.ini", "[Desktop Entry]\nName=App\n");
    const s = defineSettings("app", { dark: false });
    s.set("dark", true);
    expect(state.data.get("/s/app.ini")).toBe("[Desktop Entry]\nName=App\n\n[General]\ndark=true\n");
    s.reset("dark");
    expect(state.data.get("/s/app.ini")).toBe("[Desktop Entry]\nName=App\n");
  });
});

describe("app settings", () => {
  it("stores strings per app under [General], empty means unset", () => {
    const state = memoryStateSource();
    setStateSource(state);
    let calls = 0;
    const stop = subscribeAppSettings(() => calls++);
    setAppSetting("org.example.App", "color-scheme", "dark");
    expect(getAppSetting("org.example.App", "color-scheme")).toBe("dark");
    expect(state.data.get(appSettingsPath("org.example.App"))).toBe("[General]\ncolor-scheme=dark\n");
    setAppSetting("org.example.App", "color-scheme", "");
    expect(getAppSetting("org.example.App", "color-scheme")).toBeUndefined();
    expect(calls).toBe(2);
    stop();
  });
});

describe("settings files", () => {
  it("picks one file per owner from the schema id", () => {
    expect(settingsPathForSchema("org.piloti.desktop")).toBe(SHELL_SETTINGS_PATH);
    expect(settingsPathForSchema("org.piloti.desktop.dock")).toBe(SHELL_SETTINGS_PATH);
    expect(settingsPathForSchema("org.piloti.calculator")).toBe(appSettingsPath("calculator"));
    expect(settingsPathForSchema("org.piloti.calculator.history")).toBe(appSettingsPath("calculator"));
    expect(settingsPathForSchema("org.gnome.TextEditor")).toBe(appSettingsPath("org.gnome.TextEditor"));
  });

  it("an app's schema and the shell's keys for it share the file", () => {
    const state = memoryStateSource();
    setStateSource(state);
    setSettingsBackend(keyfileSettingsBackend());
    setAppSetting("calculator", "color-scheme", "dark");
    defineSettings("org.piloti.calculator", { scientific: false }).set("scientific", true);
    expect(state.data.get(appSettingsPath("calculator"))).toBe(
      "[General]\ncolor-scheme=dark\n\n[org.piloti.calculator]\nscientific=true\n",
    );
    expect(getAppSetting("calculator", "color-scheme")).toBe("dark");
  });

  it("mergeIniText keeps what the generated text doesn't hold", () => {
    expect(mergeIniText("[a]\nx=1\nkeep=1\n\n[b]\ny=2\n", "[a]\nx=9\n")).toBe(
      "[a]\nx=9\nkeep=1\n\n[b]\ny=2\n",
    );
    expect(mergeIniText(null, "[a]\nx=1\n")).toBe("[a]\nx=1\n");
  });
});

describe("schema registry", () => {
  it("finds defined schemas and gives untyped access to others", () => {
    setSettingsBackend(memorySettingsBackend());
    const s = defineSettings("org.piloti.registry-test", { size: 3 });
    expect(findSettings("org.piloti.registry-test")).toBe(s as never);
    expect(listSettingsSchemas()).toContain("org.piloti.registry-test");

    const other = settingsFor("org.example.Unknown");
    expect(other.get("anything")).toBeUndefined();
    other.set("anything", "42");
    expect(other.get("anything")).toBe("42");
    expect(listSettingsSchemas()).not.toContain("org.example.Unknown");
  });

  it("turns settings.ini's table into desktop schemas", () => {
    const schemas = desktopSchemaDefaults({
      dockSize: 48,
      pinnedAppIds: ["a", "b"],
      gnomeBackground: { pictureOptions: "zoom" },
    } as unknown as DesktopSettings);
    expect(schemas["org.piloti.desktop.dock"]?.["icon-size"]).toBe(48);
    expect(schemas["org.piloti.desktop.dock"]?.["pinned-apps"]).toEqual(["a", "b"]);
    expect(schemas["org.piloti.desktop.background"]?.["picture-options"]).toBe("zoom");
    expect(schemas["org.piloti.desktop.dock"]).not.toHaveProperty("position");
  });
});
