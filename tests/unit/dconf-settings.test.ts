import { describe, expect, it } from "bun:test";
import { createDconfSettingsBackend, routeSettingsBackend, type DconfHost } from "@/core/config/dconf-settings-backend";
import { readDesktopSettingsRaw, writeDesktopSettings } from "@/core/config/desktop-settings-store";
import { parseIniText } from "@/core/config/ini";
import { memorySettingsBackend } from "@/core/state/settings";
import type { DesktopSettings } from "@/ui/context/SettingsContext";

/** A dconf database in memory, with the command line's text formats. */
function fakeDconf(initial: Record<string, string> = {}) {
  const db = new Map(Object.entries(initial));
  const watchers = new Set<(path: string) => void>();
  const calls: string[] = [];
  const host: DconfHost = {
    async dump(dir) {
      const sections: Record<string, string[]> = {};
      for (const [path, value] of db) {
        if (!path.startsWith(dir)) continue;
        const rel = path.slice(dir.length);
        const slash = rel.lastIndexOf("/");
        const section = slash < 0 ? "/" : rel.slice(0, slash);
        (sections[section] ??= []).push(`${rel.slice(slash + 1)}=${value}`);
      }
      return Object.entries(sections).map(([s, lines]) => `[${s}]\n${lines.join("\n")}\n`).join("\n");
    },
    async load(dir, keyfile) {
      calls.push("load");
      for (const [section, entries] of Object.entries(parseIniText(keyfile))) {
        for (const [key, value] of Object.entries(entries)) {
          const path = `${dir}${section === "/" ? "" : `${section}/`}${key}`;
          db.set(path, value);
          watchers.forEach((w) => w(path));
        }
      }
      return true;
    },
    async reset(path) {
      calls.push("reset");
      db.delete(path);
      watchers.forEach((w) => w(path));
      return true;
    },
    async read(path) {
      return db.get(path) ?? null;
    },
    watch(_dir, onPath) {
      watchers.add(onPath);
      return () => watchers.delete(onPath);
    },
  };
  /** Another program (`gsettings set`) changing a key. */
  const external = (path: string, value: string | null) => {
    if (value === null) db.delete(path);
    else db.set(path, value);
    watchers.forEach((w) => w(path));
  };
  return { host, db, calls, external };
}

const kinds: Record<string, "string" | "number" | "boolean" | "string[]"> = {
  "icon-size": "number",
  "auto-hide": "boolean",
  "pinned-apps": "string[]",
  "color-scheme": "string",
};
const options = { root: "/org/piloti/desktop/", kindOf: (_s: string, key: string) => kinds[key], flushMs: 1 };
const tick = () => new Promise((r) => setTimeout(r, 10));

describe("dconf settings backend", () => {
  it("loads what is set, in the layer's text", async () => {
    const { host } = fakeDconf({
      "/org/piloti/desktop/dock/icon-size": "48.0",
      "/org/piloti/desktop/dock/pinned-apps": "['nautilus', 'terminal']",
      "/org/piloti/desktop/interface/color-scheme": "'dark'",
    });
    const b = createDconfSettingsBackend(host, options);
    expect(await b.preload()).toBe(true);
    expect(b.read("org.piloti.desktop.dock", "icon-size")).toBe("48");
    expect(b.read("org.piloti.desktop.dock", "pinned-apps")).toBe("nautilus;terminal");
    expect(b.read("org.piloti.desktop.interface", "color-scheme")).toBe("dark");
    expect(b.read("org.piloti.desktop.dock", "auto-hide")).toBeUndefined();
    b.stop();
  });

  it("writes at once to the cache and in one dconf load", async () => {
    const { host, db, calls } = fakeDconf();
    const b = createDconfSettingsBackend(host, options);
    await b.preload();
    let notified = 0;
    b.subscribe("org.piloti.desktop.dock", () => notified++);
    b.writeBatch([
      { schema: "org.piloti.desktop.dock", key: "icon-size", value: "60" },
      { schema: "org.piloti.desktop.dock", key: "auto-hide", value: "true" },
    ]);
    expect(b.read("org.piloti.desktop.dock", "icon-size")).toBe("60");
    expect(notified).toBe(1);
    await tick();
    expect(calls).toEqual(["load"]);
    expect(db.get("/org/piloti/desktop/dock/icon-size")).toBe("60.0");
    expect(db.get("/org/piloti/desktop/dock/auto-hide")).toBe("true");
    expect(notified).toBe(1); // its own write echoing back changes nothing
    b.reset("org.piloti.desktop.dock", "auto-hide");
    await tick();
    expect(db.has("/org/piloti/desktop/dock/auto-hide")).toBe(false);
    b.stop();
  });

  it("follows changes made by other programs", async () => {
    const { host, external } = fakeDconf();
    const b = createDconfSettingsBackend(host, options);
    await b.preload();
    let notified = 0;
    b.subscribeAll(() => notified++);
    external("/org/piloti/desktop/interface/color-scheme", "'light'");
    await tick();
    expect(b.read("org.piloti.desktop.interface", "color-scheme")).toBe("light");
    external("/org/piloti/desktop/interface/color-scheme", null);
    await tick();
    expect(b.read("org.piloti.desktop.interface", "color-scheme")).toBeUndefined();
    expect(notified).toBe(2);
    b.stop();
  });

  it("routes desktop schemas to dconf and the rest elsewhere", async () => {
    const { host } = fakeDconf();
    const dconf = createDconfSettingsBackend(host, options);
    await dconf.preload();
    const other = memorySettingsBackend();
    const routed = routeSettingsBackend(
      (schema) => (schema.startsWith("org.piloti.desktop") ? "primary" : "fallback"),
      dconf,
      other,
    );
    routed.writeBatch([
      { schema: "org.piloti.desktop.dock", key: "icon-size", value: "40" },
      { schema: "org.piloti.calculator", key: "scientific", value: "true" },
    ]);
    expect(dconf.read("org.piloti.desktop.dock", "icon-size")).toBe("40");
    expect(other.read("org.piloti.calculator", "scientific")).toBe("true");
    expect(dconf.read("org.piloti.calculator", "scientific")).toBeUndefined();
    dconf.stop();
  });
});

describe("desktop settings through a backend", () => {
  it("writes only what changed and reads it back as settings.ini text", () => {
    const backend = memorySettingsBackend();
    const settings = { dockSize: 48, dockAutoHide: false, gnomeBackground: {} } as unknown as DesktopSettings;
    expect(writeDesktopSettings(backend, settings)).toBeGreaterThan(0);
    expect(writeDesktopSettings(backend, settings)).toBe(0);
    expect(writeDesktopSettings(backend, { ...settings, dockSize: 50 })).toBe(1);
    const raw = readDesktopSettingsRaw(backend)!;
    expect(parseIniText(raw)["org.piloti.desktop.dock"]["icon-size"]).toBe("50");
  });
});
