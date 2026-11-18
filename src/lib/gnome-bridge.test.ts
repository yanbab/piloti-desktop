import { describe, expect, test } from "bun:test";
import {
  parseFlatpakListOutput,
  parseFlatpakSearchOutput,
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

  test("parses flatpak list and search TSV output", () => {
    const listed = parseFlatpakListOutput(
      `Application ID\tName\tVersion\tOrigin\tInstallation
org.mozilla.firefox\tFirefox\t132.0\tflathub\tuser
org.gimp.GIMP\tGIMP\t2.10.38\tflathub\tsystem
`
    );
    expect(listed).toEqual([
      {
        appId: "org.mozilla.firefox",
        name: "Firefox",
        version: "132.0",
        origin: "flathub",
        installation: "user",
        installed: true,
      },
      {
        appId: "org.gimp.GIMP",
        name: "GIMP",
        version: "2.10.38",
        origin: "flathub",
        installation: "system",
        installed: true,
      },
    ]);

    const searched = parseFlatpakSearchOutput(
      `org.mozilla.firefox\tFirefox\tFast web browser\t132.0\tflathub
org.videolan.VLC\tVLC\tMedia player\t3.0.21\tflathub,fedora
`,
      new Set(["org.mozilla.firefox"])
    );
    expect(searched).toEqual([
      {
        appId: "org.mozilla.firefox",
        name: "Firefox",
        description: "Fast web browser",
        version: "132.0",
        origin: "flathub",
        installed: true,
      },
      {
        appId: "org.videolan.VLC",
        name: "VLC",
        description: "Media player",
        version: "3.0.21",
        origin: "flathub",
        installed: false,
      },
    ]);
  });
});

