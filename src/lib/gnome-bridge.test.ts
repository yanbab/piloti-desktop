import { describe, expect, test } from "bun:test";
import {
  parseGSettingsKeyVal,
  parseGtk4HintFontMetrics,
  parseNmcliWifiOutput,
  parseWpctlVolumeOutput,
  upsertGtkSettingsIni,
} from "./gnome-bridge";

describe("gnome-bridge parsers", () => {
  test("parses GSettings interface keys", () => {
    expect(parseGSettingsKeyVal("color-scheme", "'prefer-dark'")).toEqual({
      themeMode: "dark",
    });
    expect(parseGSettingsKeyVal("color-scheme", "'default'")).toEqual({
      themeMode: "light",
    });
    expect(parseGSettingsKeyVal("accent-color", "'slate'")).toEqual({
      accentColor: "graphite",
    });
    expect(parseGSettingsKeyVal("clock-format", "'24h'")).toEqual({
      clock24Hour: true,
    });
    expect(parseGSettingsKeyVal("clock-show-seconds", "true")).toEqual({
      clockShowSeconds: true,
    });
    expect(parseGSettingsKeyVal("font-name", "'Adwaita Sans 11'")).toEqual({
      fontName: "Adwaita Sans 11",
    });
    expect(parseGSettingsKeyVal("font-antialiasing", "'rgba'")).toEqual({
      fontAntialiasing: "rgba",
    });
    expect(parseGSettingsKeyVal("font-hinting", "'slight'")).toEqual({
      fontHinting: "slight",
    });
    expect(parseGSettingsKeyVal("text-scaling-factor", "1.15")).toEqual({
      textScalingFactor: 1.15,
    });
  });

  test("parses and updates GTK 4 settings.ini gtk-hint-font-metrics", () => {
    const initial = `[Settings]\ngtk-application-prefer-dark-theme=1\n`;
    const enabled = upsertGtkSettingsIni(initial, "gtk-hint-font-metrics", "true");
    expect(enabled).toContain("gtk-hint-font-metrics=true");
    expect(parseGtk4HintFontMetrics(enabled)).toBe(true);

    const disabled = upsertGtkSettingsIni(enabled, "gtk-hint-font-metrics", "false");
    expect(disabled).toContain("gtk-hint-font-metrics=false");
    expect(disabled.match(/gtk-hint-font-metrics=/g)).toHaveLength(1);
    expect(parseGtk4HintFontMetrics(disabled)).toBe(false);
  });

  test("parses wpctl audio volume and mute flag", () => {
    expect(parseWpctlVolumeOutput("Volume: 0.78")).toEqual({
      volume: 78,
      muted: false,
    });
    expect(parseWpctlVolumeOutput("Volume: 0.42 [MUTED]")).toEqual({
      volume: 42,
      muted: true,
    });
    expect(parseWpctlVolumeOutput("invalid")).toBeNull();
  });

  test("parses nmcli terse wifi output including escaped colons", () => {
    const parsed = parseNmcliWifiOutput(
      `yes:Studio\\:Mesh:88:WPA2
no:GuestWifi:45:--
no:GuestWifi:62:WPA2
`
    );
    expect(parsed.connectedSsid).toBe("Studio:Mesh");
    expect(parsed.networks).toHaveLength(2);
    expect(parsed.networks[0].ssid).toBe("Studio:Mesh");
    expect(parsed.networks[1]).toMatchObject({
      ssid: "GuestWifi",
      signal: 62,
      secured: true,
    });
  });
});

