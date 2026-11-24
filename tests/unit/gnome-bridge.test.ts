import { describe, expect, test } from "bun:test";
import {
  parseDconfWatchEvent,
  parseFlatpakListOutput,
  parseFlatpakSearchOutput,
  parseGnomeSettingsBatchOutput,
  parseGSettingsKeyVal,
  parseGtk4HintFontMetrics,
  upsertGtkSettingsIni,
} from "@/lib/engine-native";

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

  test("parses batched GNOME GSettings output and dconf watch events", () => {
    const batch = parseGnomeSettingsBatchOutput(`
org.gnome.desktop.interface color-scheme 'prefer-dark'
org.gnome.desktop.interface accent-color 'orange'
org.gnome.desktop.background picture-options 'zoom'
org.gnome.desktop.wm.preferences button-layout 'appmenu:minimize,maximize,close'
org.gnome.desktop.notifications show-banners false
org.gnome.desktop.notifications show-in-lock-screen true
`);
    expect(batch.interface).toEqual({
      themeMode: "dark",
      accentColor: "orange",
    });
    expect(batch.background).toEqual({
      pictureOptions: "zoom",
    });
    expect(batch.wm).toEqual({
      buttonLayout: "appmenu:minimize,maximize,close",
    });
    expect(batch.notifications).toEqual({
      doNotDisturb: true,
      showInLockScreen: true,
    });

    expect(
      parseDconfWatchEvent("/org/gnome/desktop/interface/clock-format", "'24h'")
    ).toEqual({
      schema: "interface",
      patch: { clock24Hour: true },
    });
    expect(
      parseDconfWatchEvent(
        "/org/gnome/desktop/wm/preferences/button-layout",
        "'close,minimize,maximize:'"
      )
    ).toEqual({
      schema: "wm",
      patch: { buttonLayout: "close,minimize,maximize:" },
    });
    expect(
      parseDconfWatchEvent("/org/gnome/desktop/notifications/show-banners", "true")
    ).toEqual({
      schema: "notifications",
      patch: { doNotDisturb: false },
    });
  });
});

