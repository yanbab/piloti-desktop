import { describe, expect, it } from "bun:test";
import { APP_CATALOG } from "@/data/catalog";
import {
  buildXdgIconThemeIndex,
  lookupXdgIconPath,
  type XdgIconThemeIndex,
} from "@/lib/xdg/xdg-icon-theme";
import { DEFAULT_USER_DIR_SPECS } from "@/lib/xdg/xdg-user-dirs";
import {
  APP_GRID_ICON_CANDIDATES,
  SHELL_XDG_ICON_GROUPS,
} from "@/lib/shell/shell-icon-names";
import {
  hasAccentMarkers,
  iconAccentConfigFromIndex,
  markInheritedAccentIcon,
  tintIconDataUrl,
} from "@/lib/shell/icon-accent-tint";
import { diskIconReader, listDataFiles, readDataFile } from "../helpers/disk-icon-reader";

// Every icon the shell asks for, by what asks for it.
function requestedIcons(): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {};
  for (const app of APP_CATALOG) out[`app:${app.id}`] = app.xdgIcons ?? [app.id];
  for (const [key, names] of Object.entries(SHELL_XDG_ICON_GROUPS)) out[`shell:${key}`] = names;
  for (const dir of DEFAULT_USER_DIR_SPECS) out[`dir:${dir.key}`] = dir.iconCandidates;
  out["shell:__app_grid__"] = APP_GRID_ICON_CANDIDATES;
  return out;
}

function missingIcons(index: XdgIconThemeIndex): string[] {
  return Object.entries(requestedIcons())
    .filter(([, names]) => !lookupXdgIconPath(index, names, 64, 1))
    .map(([key]) => key);
}

const svgUrl = (text: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
const decode = (url: string) => decodeURIComponent(url.slice(url.indexOf(",") + 1));

describe("bundled icon themes (web demo)", () => {
  it("Piloti inherits Papirus, then Adwaita, then hicolor", async () => {
    const index = await buildXdgIconThemeIndex(diskIconReader as never, ["Piloti", "Adwaita", "hicolor"]);
    expect(index.themeOrder).toEqual(["Piloti", "Papirus", "Adwaita", "hicolor"]);
  });

  it("resolves every shell and app icon with the Piloti theme", async () => {
    const index = await buildXdgIconThemeIndex(diskIconReader as never, ["Piloti", "Adwaita", "hicolor"]);
    expect(missingIcons(index)).toEqual([]);
  });

  it("resolves every shell and app icon with the Adwaita theme", async () => {
    const index = await buildXdgIconThemeIndex(diskIconReader as never, ["Adwaita", "hicolor"]);
    // Not bundled for the web demo (a GNOME system has the drive icons; there
    // is no login-screen app icon): the shell falls back to its own glyphs.
    expect(missingIcons(index)).toEqual([
      "app:login-screen",
      "shell:__usb_drive__",
      "shell:__harddisk__",
      "shell:__optical_drive__",
      "shell:__sd_card__",
    ]);
  });

  it("uses the GNOME app icons under Adwaita", async () => {
    const index = await buildXdgIconThemeIndex(diskIconReader as never, ["Adwaita", "hicolor"]);
    const files = APP_CATALOG.find((a) => a.id === "nautilus")!;
    expect(lookupXdgIconPath(index, files.xdgIcons!, 64, 1)).toBe(
      "/usr/share/icons/hicolor/scalable/apps/org.gnome.Nautilus.svg"
    );
  });
});

describe("accent-colored icons", () => {
  it("reads the accent configuration from the Piloti theme", async () => {
    const index = await buildXdgIconThemeIndex(diskIconReader as never, ["Piloti", "Adwaita", "hicolor"]);
    const config = iconAccentConfigFromIndex(index);
    expect(config.accent).toBe("#5294e2");
    expect(config.inheritedIcons).toContain("folder-*");
  });

  it("marks every accent placeholder in Piloti-owned icons", () => {
    const owned = [
      ...listDataFiles("/usr/share/icons/Piloti"),
      ...listDataFiles("/usr/share/icons/hicolor").filter((p) => p.includes("/piloti-")),
    ];
    const unmarked: string[] = [];
    for (const path of owned) {
      const text = readDataFile(path)!;
      if (path.endsWith(".svg")) {
        for (const tag of text.match(/<[a-z]+\b[^>]*>/g) ?? []) {
          if (/#(5294e2|4877b1|8bbcf6)/i.test(tag) && !/class="[^"]*accent/.test(tag)) {
            unmarked.push(`${path}: ${tag.slice(0, 60)}`);
          }
        }
      } else if (path.endsWith(".json")) {
        const placeholders = text.match(/"c":\{"a":0,"k":\[(0\.3216,0\.5804,0\.8863|0\.2824,0\.4667,0\.6941|0\.5451,0\.7373,0\.9647),1\]\}/g) ?? [];
        const markers = text.match(/"cl":"accent[a-z-]*"/g) ?? [];
        if (placeholders.length !== markers.length) unmarked.push(path);
      }
    }
    expect(unmarked).toEqual([]);
  });

  it("recolors marked SVG shapes with a stylesheet", () => {
    const url = svgUrl('<svg xmlns="http://www.w3.org/2000/svg"><rect class="accent" style="fill:#5294e2"/></svg>');
    expect(hasAccentMarkers(url)).toBe(true);
    const tinted = decode(tintIconDataUrl(url, "#ff0000")!);
    expect(tinted).toContain(".accent{fill:#ff0000!important}");
    expect(tinted).toContain(".accent-darker{fill:#c70000!important}");
  });

  it("recolors marked Lottie fills", () => {
    const lottie = JSON.stringify({ layers: [{ shapes: [{ ty: "fl", cl: "accent", c: { a: 0, k: [0.3216, 0.5804, 0.8863, 1] } }] }] });
    const url = `data:application/json;charset=utf-8,${encodeURIComponent(lottie)}`;
    const tinted = JSON.parse(decode(tintIconDataUrl(url, "#00ff00")!));
    expect(tinted.layers[0].shapes[0].c.k).toEqual([0, 1, 0, 1]);
  });

  it("leaves icons without markers untouched", () => {
    const url = svgUrl('<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:#5294e2"/></svg>');
    expect(tintIconDataUrl(url, "#ff0000")).toBe(url);
  });

  it("marks only the inherited icons the theme lists", async () => {
    const index = await buildXdgIconThemeIndex(diskIconReader as never, ["Piloti", "Adwaita", "hicolor"]);
    const config = iconAccentConfigFromIndex(index);
    const folderPath = "/usr/share/icons/Papirus/64x64/places/folder-documents.svg";
    const drivePath = "/usr/share/icons/Papirus/64x64/devices/drive-removable-media.svg";
    const folder = markInheritedAccentIcon(svgUrl(readDataFile(folderPath)!), folderPath, config);
    const drive = markInheritedAccentIcon(svgUrl(readDataFile(drivePath)!), drivePath, config);
    expect(hasAccentMarkers(folder)).toBe(true);
    expect(decode(folder!)).toContain('class="accent-darker"');
    expect(hasAccentMarkers(drive)).toBe(false);
  });
});
