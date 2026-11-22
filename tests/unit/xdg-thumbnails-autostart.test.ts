import { describe, expect, test } from "bun:test";
import {
  buildAutostartArgv,
  shouldLaunchAutostartEntry,
} from "@/lib/engine-desktop/autostart";
import {
  getXdgThumbnailRelativePath,
  md5Hex,
} from "@/lib/xdg/xdg-thumbnails";

describe("XDG Thumbnail Managing Standard & Autostart runtime helpers", () => {
  test("computes RFC 1321 MD5 hashes and FreeDesktop thumbnail cache paths", () => {
    expect(md5Hex("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5Hex("message digest")).toBe("f96b697d7cb7938d525a2f31aaf161d0");

    const expectedHash = md5Hex("file:///home/debian/Pictures/My%20Photo.png");
    expect(
      getXdgThumbnailRelativePath("/home/debian/Pictures/My Photo.png", "large")
    ).toBe(`.cache/thumbnails/large/${expectedHash}.png`);
  });

  test("strips FreeDesktop Exec field codes and filters conflicting system autostart daemons", () => {
    expect(buildAutostartArgv("/usr/bin/nm-applet --indicator %U")).toEqual([
      "/usr/bin/nm-applet",
      "--indicator",
    ]);

    expect(
      shouldLaunchAutostartEntry({
        id: "nm-applet.desktop",
        path: "/etc/xdg/autostart/nm-applet.desktop",
        source: "system",
        name: "Network",
        exec: "nm-applet",
        enabled: true,
        hidden: false,
        terminal: false,
      })
    ).toBe(true);

    expect(
      shouldLaunchAutostartEntry({
        id: "org.gnome.SettingsDaemon.Power.desktop",
        path: "/etc/xdg/autostart/org.gnome.SettingsDaemon.Power.desktop",
        source: "system",
        name: "GNOME Power",
        exec: "/usr/libexec/gsd-power",
        enabled: true,
        hidden: false,
        terminal: false,
      })
    ).toBe(false);

    expect(
      shouldLaunchAutostartEntry({
        id: "custom-app.desktop",
        path: "/home/user/.config/autostart/custom-app.desktop",
        source: "user",
        name: "Custom",
        exec: "custom-app",
        enabled: false,
        hidden: true,
        terminal: false,
      })
    ).toBe(false);
  });
});
