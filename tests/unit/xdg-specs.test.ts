import { describe, expect, it } from "bun:test";
import {
  buildAutostartOverrideDesktopContent,
  mergeAutostartEntries,
  parseAutostartDesktopFile,
} from "@/lib/xdg-autostart";
import {
  parseRecentlyUsedXbel,
  serializeRecentlyUsedXbel,
  upsertRecentXbelItem,
} from "@/lib/xdg-recents";
import { parseGlobs2, sniffMimeType } from "@/lib/xdg-mimeapps";

describe("XDG specifications (Autostart, Recents XBEL, Globs2/Magic)", () => {
  it("parses and merges XDG autostart entries with user overrides", () => {
    const sys = parseAutostartDesktopFile(
      "nm-applet.desktop",
      "/etc/xdg/autostart/nm-applet.desktop",
      "[Desktop Entry]\nName=Network Applet\nExec=nm-applet\nOnlyShowIn=GNOME;XFCE;\n",
      "system"
    );
    expect(sys).not.toBeNull();
    expect(sys!.enabled).toBe(true);

    const userOverride = parseAutostartDesktopFile(
      "nm-applet.desktop",
      "/home/user/.config/autostart/nm-applet.desktop",
      buildAutostartOverrideDesktopContent(sys!, false),
      "user"
    );
    expect(userOverride!.enabled).toBe(false);
    expect(userOverride!.hidden).toBe(true);

    const merged = mergeAutostartEntries([sys!], [userOverride!]);
    expect(merged).toHaveLength(1);
    expect(merged[0].enabled).toBe(false);
  });

  it("serializes and parses FreeDesktop recently-used.xbel bookmarks", () => {
    const updated = upsertRecentXbelItem(
      [],
      "/home/user/Documents/Notes.txt",
      "text/plain"
    );
    const xml = serializeRecentlyUsedXbel(updated);
    expect(xml).toContain('xmlns:mime="http://www.freedesktop.org/standards/shared-mime-info"');
    const parsed = parseRecentlyUsedXbel(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe("/home/user/Documents/Notes.txt");
    expect(parsed[0].mimeType).toBe("text/plain");
  });

  it("sniffs magic headers and parses shared-mime-info globs2", () => {
    const globs = parseGlobs2("50:text/markdown:*.md\n80:text/x-piloti:*.piloti\n");
    expect(sniffMimeType("notes.piloti", undefined, globs)).toBe("text/x-piloti");
    expect(
      sniffMimeType("mystery.bin", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))
    ).toBe("image/png");
    expect(
      sniffMimeType("doc.bin", new Uint8Array([0x25, 0x50, 0x44, 0x46]))
    ).toBe("application/pdf");
  });
});

