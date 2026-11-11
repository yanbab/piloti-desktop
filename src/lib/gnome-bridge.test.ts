import { describe, expect, test } from "bun:test";
import {
  parseGSettingsKeyVal,
  parseNmcliWifiOutput,
  parseWpctlVolumeOutput,
} from "./gnome-bridge";

describe("gnome-bridge parsers", () => {
  test("parses GSettings interface keys", () => {
    expect(parseGSettingsKeyVal("color-scheme", "'prefer-dark'")).toEqual({
      themeMode: "dark",
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

