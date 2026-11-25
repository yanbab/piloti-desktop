import { describe, expect, it } from "bun:test";
import {
  buildXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
} from "@/lib/xdg/xdg-icon-theme";
import { DATA_FILES } from "@/lib/engine-web/data-files";
import { diskIconReader, readDataFile } from "../helpers/disk-icon-reader";

const mkOk = <T>(v: T) => ({ match: ({ Ok }: { Ok: (x: T) => unknown }) => Ok(v) });
const mkErr = () => ({ match: ({ Err }: { Err: (e: string) => unknown }) => Err("ENOENT") });
import {
  buildAutostartOverrideDesktopContent,
  mergeAutostartEntries,
  parseAutostartDesktopFile,
} from "@/lib/xdg/xdg-autostart";
import {
  parseRecentlyUsedXbel,
  serializeRecentlyUsedXbel,
  upsertRecentXbelItem,
} from "@/lib/xdg/xdg-recents";
import { parseGlobs2, sniffMimeType } from "@/lib/xdg/xdg-mimeapps";

const PILOTI_VIRTUAL_ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(DATA_FILES).filter(([p]) => p.startsWith("/usr/share/icons/Piloti/"))
);

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

  it("indexes and resolves animated/ Lottie .json icons from Piloti icon theme", async () => {
    const reader = diskIconReader;

    const index = await buildXdgIconThemeIndex(reader as never, ["Piloti", "Papirus", "Adwaita", "hicolor"]);
    const folderPath = lookupXdgIconPath(index, "folder", 64, 1);
    expect(folderPath).toBe("/usr/share/icons/Piloti/animated/places/folder.json");
    expect(lookupXdgIconPath(index, "folder-open", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/places/folder-open.json"
    );
    expect(lookupXdgIconPath(index, "application-x-zerosize", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/mimetypes/application-x-zerosize.json"
    );
    expect(lookupXdgIconPath(index, "org.gnome.Loupe", 64, 1)).toBe(
      "/usr/share/icons/Papirus/64x64/apps/org.gnome.Loupe.svg"
    );
    expect(lookupXdgIconPath(index, "piloti-devtools", 64, 1)).toBe(
      "/usr/share/icons/hicolor/scalable/apps/piloti-devtools.svg"
    );
    expect(lookupXdgIconPath(index, "preferences-desktop", 64, 1)).toBe(
      "/usr/share/icons/Papirus/64x64/apps/preferences-desktop.svg"
    );
    expect(lookupXdgIconPath(index, "user-trash", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/places/user-trash.json"
    );
    expect(lookupXdgIconPath(index, "user-trash-full", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/places/user-trash-full.json"
    );
    expect(lookupXdgIconPath(index, "view-app-grid", 64, 1)).toBe(
      "/usr/share/icons/Papirus/64x64/apps/view-app-grid.svg"
    );
    // Piloti overrides it: the Files app icon is the animated folder.
    expect(lookupXdgIconPath(index, "system-file-manager", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/apps/system-file-manager.json"
    );
    // Piloti overrides it so its download arrow follows the accent color.
    expect(lookupXdgIconPath(index, "system-software-install", 64, 1)).toBe(
      "/usr/share/icons/Piloti/scalable/apps/system-software-install.svg"
    );
    expect(lookupXdgIconPath(index, "accessories-calculator", 64, 1)).toBe(
      "/usr/share/icons/Piloti/scalable/apps/accessories-calculator.svg"
    );
    expect(lookupXdgIconPath(index, "accessories-text-editor", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/apps/accessories-text-editor.json"
    );
    // Piloti overrides it: full 56px square, light accent on the dark base.
    expect(lookupXdgIconPath(index, "utilities-terminal", 64, 1)).toBe(
      "/usr/share/icons/Piloti/scalable/apps/utilities-terminal.svg"
    );
    const dataUrl = await loadXdgIconDataUrl(reader as never, folderPath!);
    expect(dataUrl?.startsWith("data:application/json;base64,")).toBe(true);

    const pilotiOnlyReader = {
      readDir: async (dir: string) => {
        const prefix = dir.endsWith("/") ? dir : `${dir}/`;
        const seen = new Map<string, { name: string; fileType: number }>();
        for (const key of Object.keys(PILOTI_VIRTUAL_ICONS)) {
          if (!key.startsWith(prefix)) continue;
          const rest = key.slice(prefix.length);
          const slash = rest.indexOf("/");
          const name = slash >= 0 ? rest.slice(0, slash) : rest;
          const fileType = slash >= 0 ? 1 : 0;
          if (!seen.has(name)) seen.set(name, { name, fileType });
        }
        return seen.size > 0 ? mkOk(Array.from(seen.values())) : mkErr();
      },
      readText: async (filePath: string) =>
        PILOTI_VIRTUAL_ICONS[filePath] ? mkOk(PILOTI_VIRTUAL_ICONS[filePath]) : mkErr(),
    };
    const pilotiOnlyIndex = await buildXdgIconThemeIndex(pilotiOnlyReader as never, ["Piloti", "Adwaita", "hicolor"]);
    expect(lookupXdgIconPath(pilotiOnlyIndex, "folder", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/places/folder.json"
    );
    expect(lookupXdgIconPath(pilotiOnlyIndex, "application-x-zerosize", 64, 1)).toBe(
      "/usr/share/icons/Piloti/animated/mimetypes/application-x-zerosize.json"
    );

    const papirusOnlyIndex = await buildXdgIconThemeIndex(reader as never, ["Papirus", "Adwaita", "hicolor"]);
    expect(lookupXdgIconPath(papirusOnlyIndex, "org.gnome.Loupe", 64, 1)).toBe(
      "/usr/share/icons/Papirus/64x64/apps/org.gnome.Loupe.svg"
    );
    expect(lookupXdgIconPath(papirusOnlyIndex, "piloti-devtools", 64, 1)).toBe(
      "/usr/share/icons/hicolor/scalable/apps/piloti-devtools.svg"
    );
    expect(lookupXdgIconPath(papirusOnlyIndex, "preferences-desktop", 64, 1)).toBe(
      "/usr/share/icons/Papirus/64x64/apps/preferences-desktop.svg"
    );
    expect(
      readDataFile("/usr/share/icons/Papirus/64x64/mimetypes/application-x-zerosize.svg")
    ).toContain("<svg");
    expect(
      PILOTI_VIRTUAL_ICONS["/usr/share/icons/Piloti/scalable/mimetypes/application-x-zerosize.svg"]
    ).toContain("<svg");
    expect(
      readDataFile("/usr/share/icons/Papirus/64x64/devices/drive-removable-media-usb.svg")
    ).toContain("<svg");
  });
});

