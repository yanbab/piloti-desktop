import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { linkSettingsBackend, parseGSettingsLinks } from "@/core/config/gsettings-links";
import { toGVariant } from "@/core/config/gvariant";
import { desktopSchemaKeys } from "@/core/config/piloti-settings-ini";
import { memorySettingsBackend } from "@/platform/shared/settings";

const links = parseGSettingsLinks(readFileSync("data/files/usr/share/piloti/gsettings-links.ini", "utf8"));
const IFACE = "org.piloti.desktop.interface";
const GNOME = "org.gnome.desktop.interface";
const toggle = { schema: "org.piloti.desktop.system", key: "sync-gnome-settings" };

function setup() {
  const base = memorySettingsBackend();
  const gnome = memorySettingsBackend();
  return { base, gnome, linked: linkSettingsBackend({ base, gnome, links, toggle }) };
}

describe("gsettings links", () => {
  it("lists only Piloti keys that exist, with matching types", () => {
    const kinds = new Map(desktopSchemaKeys().map((k) => [`${k.schema}/${k.key}`, k.kind]));
    expect(links.length).toBeGreaterThan(15);
    for (const link of links) {
      const kind = kinds.get(`${link.schema}/${link.key}`);
      expect(kind).toBeDefined();
      if (!link.values) expect(link.target.kind === "int" ? "number" : link.target.kind).toBe(kind!);
    }
  });

  it("keeps Piloti's value until GNOME has one, then reads GNOME's", () => {
    const { base, gnome, linked } = setup();
    base.write(IFACE, "accent-color", "blue");
    expect(linked.read(IFACE, "accent-color")).toBe("blue");
    gnome.write(GNOME, "accent-color", "slate");
    expect(linked.read(IFACE, "accent-color")).toBe("graphite");
    gnome.write(GNOME, "accent-color", "unknown");
    expect(linked.read(IFACE, "accent-color")).toBe("blue");
  });

  it("writes both sides in GNOME's spelling and keeps 'system'", () => {
    const { base, gnome, linked } = setup();
    linked.write(IFACE, "color-scheme", "system");
    expect(gnome.read(GNOME, "color-scheme")).toBe("default");
    expect(linked.read(IFACE, "color-scheme")).toBe("system");
    linked.write("org.piloti.desktop.notifications", "do-not-disturb", "true");
    expect(gnome.read("org.gnome.desktop.notifications", "show-banners")).toBe("false");
    expect(base.read("org.piloti.desktop.notifications", "do-not-disturb")).toBe("true");
    linked.write("org.piloti.desktop.background", "picture-opacity", "75.4");
    expect(gnome.read("org.gnome.desktop.background", "picture-opacity")).toBe("75");
    expect(toGVariant("75", "int")).toBe("75");
  });

  it("never reads a write-only key back", () => {
    const { gnome, linked } = setup();
    gnome.write(GNOME, "icon-theme", "Adwaita");
    expect(linked.read(IFACE, "icon-theme")).toBeUndefined();
    expect(linked.linkedValue!(IFACE, "icon-theme")).toBe("Adwaita");
  });

  it("stops linking when sync is off, and seeds Piloti only", () => {
    const { gnome, linked } = setup();
    linked.seed!([{ schema: IFACE, key: "color-scheme", value: "dark" }]);
    expect(gnome.read(GNOME, "color-scheme")).toBeUndefined();
    gnome.write(GNOME, "color-scheme", "default");
    linked.write(toggle.schema, toggle.key, "false");
    expect(linked.read(IFACE, "color-scheme")).toBe("dark");
    linked.write(IFACE, "color-scheme", "light");
    linked.write(IFACE, "color-scheme", "dark");
    expect(gnome.read(GNOME, "color-scheme")).toBe("default");
  });

  it("tells listeners once both sides are written", () => {
    const { linked } = setup();
    const seen: Array<string | undefined> = [];
    linked.subscribeAll(() => seen.push(linked.read(IFACE, "color-scheme")));
    linked.write(IFACE, "color-scheme", "dark");
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set(["dark"]));
  });
});
