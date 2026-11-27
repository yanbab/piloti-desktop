import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  buildAutostartArgv,
  FIND_POLKIT_AGENT_SCRIPT,
  parseAutostartCondition,
  shouldLaunchAutostartEntry,
} from "@/lib/engine-native/autostart";
import { parseAutostartDesktopFile } from "@/lib/xdg/xdg-autostart";
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

  test("honors NotShowIn=GNOME across Piloti:GNOME and parses AutostartCondition (e.g. Orca)", () => {
    const orcaDesktop = [
      "[Desktop Entry]",
      "Type=Application",
      "Name=Orca screen reader",
      "Exec=orca",
      "OnlyShowIn=GNOME;MATE;",
      "AutostartCondition=GSettings org.gnome.desktop.a11y.applications screen-reader-enabled",
    ].join("\n");

    const parsedOrca = parseAutostartDesktopFile(
      "orca-autostart.desktop",
      "/etc/xdg/autostart/orca-autostart.desktop",
      orcaDesktop,
      "system",
      ["Piloti", "GNOME"]
    );
    expect(parsedOrca?.autostartCondition).toBe(
      "GSettings org.gnome.desktop.a11y.applications screen-reader-enabled"
    );
    expect(parseAutostartCondition(parsedOrca?.autostartCondition)).toEqual({
      kind: "gsettings",
      schema: "org.gnome.desktop.a11y.applications",
      key: "screen-reader-enabled",
    });

    const geoclueDesktop = [
      "[Desktop Entry]",
      "Type=Application",
      "Name=Geoclue Demo agent",
      "Exec=/usr/libexec/geoclue-2.0/demos/agent",
      "NotShowIn=GNOME;",
    ].join("\n");
    expect(
      parseAutostartDesktopFile(
        "geoclue-demo-agent.desktop",
        "/etc/xdg/autostart/geoclue-demo-agent.desktop",
        geoclueDesktop,
        "system",
        ["Piloti", "GNOME"]
      )
    ).toBeNull();
  });
});

describe("polkit agent lookup", () => {
  const find = (entries: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "polkit-"));
    for (const [name, exec] of Object.entries(entries)) {
      writeFileSync(join(dir, name), `[Desktop Entry]\nExec=${exec}\nOnlyShowIn=LXQt;\n`);
    }
    // A stand-in `pgrep` so a real agent on this machine doesn't matter.
    writeFileSync(join(dir, "pgrep"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const run = Bun.spawnSync(["sh", "-c", FIND_POLKIT_AGENT_SCRIPT, "sh", dir], {
      env: { PATH: `${dir}:/usr/bin:/bin` },
    });
    rmSync(dir, { recursive: true });
    return run.stdout.toString().trim();
  };

  // These run a shell: slower than the default 5 s when the machine is busy.
  const SHELL_TIMEOUT = 30_000;

  test("takes the Exec line even when limited to another desktop", () => {
    expect(find({ "lxqt-policykit-agent.desktop": "sh --agent" })).toBe("sh --agent");
  }, SHELL_TIMEOUT);

  test("skips agents that are not installed and unrelated entries", () => {
    expect(
      find({
        "polkit-gone.desktop": "/nowhere/agent",
        "geoclue-demo-agent.desktop": "sh",
      }),
    ).toBe("");
  }, SHELL_TIMEOUT);
});
