import { describe, expect, test } from "bun:test";
import {
  xdgCacheHome,
  xdgConfigHome,
  xdgDataDirs,
  xdgDataHome,
} from "@/lib/xdg/xdg-basedir";
import {
  computeDesktopFileId,
  expandExecArgv,
  parseDesktopEntry,
  splitXdgList,
  unescapeXdgValue,
} from "@/lib/xdg/xdg-desktop-entry";
import {
  buildXdgIconThemeIndex,
  directoryMatchesSize,
  directorySizeDistance,
  lookupXdgIconPath,
  parseIconThemeIndex,
} from "@/lib/xdg/xdg-icon-theme";
import {
  buildOpenXdgFolderArgv,
  buildXdgUserDirList,
  discoverXdgUserDirs,
  parseXdgUserDirs,
} from "@/lib/xdg/xdg-user-dirs";

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

  test("resolves CSD auto-detection via clientFrame, .desktop metadata, StartupWMClass/Exec, and GTK hints", () => {
    const {
      matchXdgEntryForWaylandWindow,
      resolveWaylandClientFrame,
    } = require("@/lib/xdg/xdg-desktop-entry");

    const settingsEntry = parseDesktopEntry(
      `[Desktop Entry]
Name=Settings
Exec=gnome-control-center
Type=Application
Categories=GNOME;GTK;Settings;
`,
      { filePath: "/usr/share/applications/org.gnome.Settings.desktop", baseDir: "/usr/share/applications" }
    )!;
    const kittyEntry = parseDesktopEntry(
      `[Desktop Entry]
Name=kitty
Exec=kitty
Type=Application
Categories=System;TerminalEmulator;
`,
      { filePath: "/usr/share/applications/kitty.desktop", baseDir: "/usr/share/applications" }
    )!;

    const matchedSettings = matchXdgEntryForWaylandWindow(
      [settingsEntry, kittyEntry],
      "gnome-control-center"
    );
    expect(matchedSettings?.desktopId).toBe("org.gnome.Settings.desktop");
    expect(
      resolveWaylandClientFrame(
        { clientFrame: false, desktopId: "gnome-control-center" },
        matchedSettings
      )
    ).toBe(true);
    expect(
      resolveWaylandClientFrame({ clientFrame: false, desktopId: "org.gnome.TextEditor" })
    ).toBe(true);

    const matchedKitty = matchXdgEntryForWaylandWindow([settingsEntry, kittyEntry], "kitty");
    expect(
      resolveWaylandClientFrame(
        { clientFrame: false, desktopId: "kitty" },
        matchedKitty
      )
    ).toBe(false);
    expect(
      resolveWaylandClientFrame(
        { clientFrame: true, desktopId: "kitty" },
        matchedKitty
      )
    ).toBe(true);

    const pcmanfmEntry = parseDesktopEntry(
      `[Desktop Entry]
Name=PCMan File Manager
Exec=pcmanfm %U
Type=Application
Categories=GTK;System;Core;FileTools;FileManager;
`,
      { filePath: "/usr/share/applications/pcmanfm.desktop", baseDir: "/usr/share/applications" }
    )!;
    expect(pcmanfmEntry.prefersCsd).toBe(false);
    expect(
      resolveWaylandClientFrame({ clientFrame: false, desktopId: "pcmanfm" }, pcmanfmEntry)
    ).toBe(false);
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

  test("skips tiny subdirs while indexing apps, places, mimetypes and status", async () => {
    const readDirs: string[] = [];
    const fakeFiles = {
      readDir: async (dir: string) => {
        readDirs.push(dir);
        if (dir === "/usr/share/icons") {
          return {
            match: ({ Ok }: { Ok: (v: unknown) => unknown }) =>
              Ok([{ name: "Adwaita", fileType: 1 }]),
          };
        }
        if (dir === "/usr/share/icons/Adwaita/scalable/places") {
          return {
            match: ({ Ok }: { Ok: (v: unknown) => unknown }) =>
              Ok([{ name: "user-trash.svg", fileType: 0 }]),
          };
        }
        return {
          match: ({ Err }: { Err: () => unknown }) => Err(),
        };
      },
      readText: async (file: string) => {
        if (file === "/usr/share/icons/Adwaita/index.theme") {
          return {
            match: ({ Ok }: { Ok: (v: unknown) => unknown }) =>
              Ok(`[Icon Theme]
Name=Adwaita
Inherits=hicolor
Directories=16x16/apps,16x16/mimetypes,48x48/status,scalable/mimetypes,scalable/places

[16x16/apps]
Context=Applications
Size=16
Type=Fixed

[16x16/mimetypes]
Context=MimeTypes
Size=16
Type=Fixed

[48x48/status]
Context=Status
Size=48
Type=Fixed

[scalable/mimetypes]
Context=MimeTypes
Size=128
MinSize=8
MaxSize=512
Type=Scalable

[scalable/places]
Context=Places
Size=128
MinSize=8
MaxSize=512
Type=Scalable
`),
          };
        }
        return {
          match: ({ Err }: { Err: () => unknown }) => Err(),
        };
      },
    } as never;

    const index = await buildXdgIconThemeIndex(fakeFiles, ["Adwaita"]);
    expect(lookupXdgIconPath(index, "user-trash", 64, 1)).toBe(
      "/usr/share/icons/Adwaita/scalable/places/user-trash.svg"
    );
    expect(readDirs).not.toContain("/usr/share/icons/Adwaita/16x16/apps");
    expect(readDirs).not.toContain("/usr/share/icons/Adwaita/16x16/mimetypes");
    // File-type and full-trash icons live in mimetypes/ and status/.
    expect(readDirs).toContain("/usr/share/icons/Adwaita/48x48/status");
    expect(readDirs).toContain("/usr/share/icons/Adwaita/scalable/mimetypes");
  });

  test("prefers active theme aliases (nautilus / system-file-manager) over hicolor org.gnome.Nautilus", async () => {
    const fakeFiles = {
      readDir: async (dir: string) => {
        if (dir === "/usr/share/icons") {
          return {
            match: ({ Ok }: { Ok: (v: unknown) => unknown }) =>
              Ok([
                { name: "Papirus", fileType: 1 },
                { name: "Adwaita", fileType: 1 },
                { name: "hicolor", fileType: 1 },
              ]),
          };
        }
        if (dir === "/usr/share/icons/Papirus/64x64/apps") {
          return {
            match: ({ Ok }: { Ok: (v: unknown) => unknown }) =>
              Ok([{ name: "system-file-manager.svg", fileType: 0 }]),
          };
        }
        if (dir === "/usr/share/icons/hicolor/scalable/apps") {
          return {
            match: ({ Ok }: { Ok: (v: unknown) => unknown }) =>
              Ok([{ name: "org.gnome.Nautilus.svg", fileType: 0 }]),
          };
        }
        return { match: ({ Err }: { Err: () => unknown }) => Err() };
      },
      readText: async (file: string) => {
        if (file === "/usr/share/icons/Papirus/index.theme") {
          return {
            match: ({ Ok }: { Ok: (v: unknown) => unknown }) =>
              Ok(`[Icon Theme]
Name=Papirus
Inherits=Adwaita,hicolor
Directories=64x64/apps

[64x64/apps]
Context=Applications
Size=64
Type=Fixed
`),
          };
        }
        return { match: ({ Err }: { Err: () => unknown }) => Err() };
      },
    } as never;

    const index = await buildXdgIconThemeIndex(fakeFiles, [
      "Papirus",
      "Adwaita",
      "hicolor",
    ]);
    expect(index.themeOrder).toEqual(["Papirus", "Adwaita", "hicolor"]);
    expect(lookupXdgIconPath(index, "org.gnome.Nautilus", 64, 1)).toBe(
      "/usr/share/icons/Papirus/64x64/apps/system-file-manager.svg"
    );
    expect(
      lookupXdgIconPath(
        index,
        ["org.gnome.Nautilus", "system-file-manager", "folder"],
        64,
        1
      )
    ).toBe("/usr/share/icons/Papirus/64x64/apps/system-file-manager.svg");
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

describe("xdg-user-dirs", () => {
  test("parses ~/.config/user-dirs.dirs assignments and resolves folder defaults", () => {
    const parsed = parseXdgUserDirs(`# comment
XDG_DESKTOP_DIR="$HOME/Desktop"
XDG_DOWNLOAD_DIR="$HOME/Téléchargements"
XDG_MUSIC_DIR="/mnt/media/Music/"
`);

    expect(parsed).toEqual({
      DESKTOP: "$HOME/Desktop",
      DOWNLOAD: "$HOME/Téléchargements",
      MUSIC: "/mnt/media/Music",
    });

    const dirs = buildXdgUserDirList(parsed);
    expect(dirs[0].key).toBe("HOME");
    expect(dirs[0].displayPath).toBe("~");

    const downloads = dirs.find((d) => d.key === "DOWNLOAD")!;
    expect(downloads.name).toBe("Téléchargements");
    expect(downloads.displayPath).toBe("~/Téléchargements");
    expect(downloads.keywords).toContain("downloads");
    expect(buildOpenXdgFolderArgv(downloads, false)).toEqual([
      "sh",
      "-c",
      'exec nautilus --new-window "$HOME/$1"',
      "sh",
      "Téléchargements",
    ]);

    const music = dirs.find((d) => d.key === "MUSIC")!;
    expect(music.absolutePath).toBe("/mnt/media/Music");
    expect(buildOpenXdgFolderArgv(music, false)).toEqual([
      "nautilus",
      "--new-window",
      "/mnt/media/Music",
    ]);
  });

  test("falls back cleanly to default XDG folders when user-dirs.dirs is absent", async () => {
    const dirs = await discoverXdgUserDirs({
      readText: async () => ({
        match: ({ Err }: { Ok: (v: string) => unknown; Err: () => unknown }) => Err(),
      }) as never,
    });
    expect(dirs.map((d) => d.name)).toEqual([
      "Home",
      "Desktop",
      "Documents",
      "Downloads",
      "Music",
      "Pictures",
      "Videos",
      "Public",
      "Templates",
    ]);
  });
});

