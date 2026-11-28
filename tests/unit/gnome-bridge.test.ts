import { describe, expect, test } from "bun:test";
import {
  parseFlatpakListOutput,
  parseFlatpakSearchOutput,
  parseGtk4HintFontMetrics,
  upsertGtkSettingsIni,
} from "@/platform/native";

describe("gnome-bridge parsers", () => {
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
});
