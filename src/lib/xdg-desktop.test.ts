import { describe, expect, test } from "bun:test";
import {
  xdgCacheHome,
  xdgConfigHome,
  xdgDataDirs,
  xdgDataHome,
} from "./xdg-basedir";
import {
  computeDesktopFileId,
  expandExecArgv,
  parseDesktopEntry,
  splitXdgList,
  unescapeXdgValue,
} from "./xdg-desktop-entry";
import {
  directoryMatchesSize,
  directorySizeDistance,
  parseIconThemeIndex,
} from "./xdg-icon-theme";

describe("xdg-desktop Desktop Entry parser", () => {
  test("unescapes XDG values and splits semicolon lists", () => {
    expect(unescapeXdgValue("Hello\\sWorld\\nLine\\t2")).toBe(
      "Hello World\nLine\t2"
    );
    expect(splitXdgList("GNOME;GTK;Utility\\;Extra;")).toEqual([
      "GNOME",
      "GTK",
      "Utility;Extra",
    ]);
  });

  test("expands Exec field codes per spec", () => {
    expect(
      expandExecArgv('env FOO=1 nautilus --new-window "%U" %i -c %c', {
        name: "Files",
        icon: "org.gnome.Nautilus",
      })
    ).toEqual(["nautilus", "--new-window", "--icon", "org.gnome.Nautilus", "-c", "Files"]);
  });

  test("computes nested Desktop File IDs", () => {
    expect(
      computeDesktopFileId(
        "/usr/share/applications/kde4/kate.desktop",
        "/usr/share/applications"
      )
    ).toBe("kde4-kate.desktop");
  });

  test("parses localized keys and desktop actions", () => {
    const entry = parseDesktopEntry(
      `[Desktop Entry]
Name=Files
Name[fr]=Fichiers
Comment=Browse files
Exec=nautilus %U
Icon=org.gnome.Nautilus
Type=Application
Categories=GNOME;GTK;FileManager;
Actions=new-window;

[Desktop Action new-window]
Name=New Window
Exec=nautilus --new-window
`,
      {
        filePath: "/usr/share/applications/org.gnome.Nautilus.desktop",
        baseDir: "/usr/share/applications",
        locale: "fr_FR",
      }
    );

    expect(entry).not.toBeNull();
    expect(entry!.desktopId).toBe("org.gnome.Nautilus.desktop");
    expect(entry!.name).toBe("Fichiers");
    expect(entry!.prefersCsd).toBe(true);
    expect(entry!.actions).toHaveLength(1);
    expect(entry!.actions[0].execArgv).toEqual(["nautilus", "--new-window"]);
  });
});

describe("xdg-desktop Icon Theme Spec", () => {
  test("parses index.theme inheritance and directory size descriptors", () => {
    const theme = parseIconThemeIndex(
      `[Icon Theme]
Name=Papirus
Inherits=Adwaita,breeze
Directories=48x48/apps,scalable/apps

[48x48/apps]
Context=Applications
Size=48
Type=Fixed

[scalable/apps]
Context=Applications
Size=64
MinSize=16
MaxSize=256
Type=Scalable
`,
      "Papirus"
    );

    expect(theme).not.toBeNull();
    expect(theme!.inherits).toEqual(["Adwaita", "breeze", "hicolor"]);

    const fixed48 = theme!.directories.find((d) => d.path === "48x48/apps")!;
    const scalable = theme!.directories.find((d) => d.path === "scalable/apps")!;

    expect(directoryMatchesSize(fixed48, 48, 1)).toBe(true);
    expect(directoryMatchesSize(fixed48, 64, 1)).toBe(false);
    expect(directoryMatchesSize(scalable, 64, 1)).toBe(true);
    expect(directorySizeDistance(scalable, 64, 1)).toBe(0);
    expect(directorySizeDistance(fixed48, 64, 1)).toBe(16);
  });
});

describe("xdg-basedir", () => {
  test("resolves XDG Base Directory defaults and overrides", () => {
    expect(xdgDataHome({ HOME: "/home/alice" })).toBe("/home/alice/.local/share");
    expect(
      xdgConfigHome({ HOME: "/home/alice", XDG_CONFIG_HOME: "/custom/cfg" })
    ).toBe("/custom/cfg");
    expect(xdgCacheHome({ HOME: "/home/alice" })).toBe("/home/alice/.cache");
    expect(xdgDataDirs({ XDG_DATA_DIRS: "/opt/share:/usr/share" })).toEqual([
      "/opt/share",
      "/usr/share",
    ]);
  });
});

