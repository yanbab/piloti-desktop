import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { parseDesktopEntry } from "xdg-desktop-entry";
import { runText } from "./exec";
import type {
  GnomeControlCenterPanelInfo,
  GnomeSettingsPanel,
  GnomeSystemCapabilities,
} from "./types";

const MUTTER_ONLY_PANEL_IDS = new Set(["display", "multitasking"]);

export const DEFAULT_HIDDEN_GNOME_PANELS: readonly string[] = [
  "gnome-display-panel.desktop",
  "gnome-multitasking-panel.desktop",
];

export const DEFAULT_GNOME_PANELS: readonly GnomeControlCenterPanelInfo[] = [
  { desktopId: "gnome-wifi-panel.desktop", panelId: "wifi", name: "Wi-Fi" },
  { desktopId: "gnome-network-panel.desktop", panelId: "network", name: "Network" },
  { desktopId: "gnome-bluetooth-panel.desktop", panelId: "bluetooth", name: "Bluetooth" },
  { desktopId: "gnome-sound-panel.desktop", panelId: "sound", name: "Sound" },
  { desktopId: "gnome-power-panel.desktop", panelId: "power", name: "Power" },
  { desktopId: "gnome-appearance-panel.desktop", panelId: "appearance", name: "Appearance" },
  { desktopId: "gnome-background-panel.desktop", panelId: "background", name: "Background" },
  { desktopId: "gnome-notifications-panel.desktop", panelId: "notifications", name: "Notifications" },
  { desktopId: "gnome-applications-panel.desktop", panelId: "applications", name: "Apps" },
  { desktopId: "gnome-privacy-panel.desktop", panelId: "privacy", name: "Privacy & Security" },
  { desktopId: "gnome-printers-panel.desktop", panelId: "printers", name: "Printers" },
  { desktopId: "gnome-mouse-panel.desktop", panelId: "mouse", name: "Mouse & Touchpad" },
  { desktopId: "gnome-keyboard-panel.desktop", panelId: "keyboard", name: "Keyboard" },
  { desktopId: "gnome-system-panel.desktop", panelId: "system", name: "System" },
  { desktopId: "gnome-users-panel.desktop", panelId: "users", name: "Users" },
  { desktopId: "gnome-datetime-panel.desktop", panelId: "datetime", name: "Date & Time" },
  {
    desktopId: "gnome-display-panel.desktop",
    panelId: "display",
    name: "Displays",
    comment: "Managed by Domicile & Piloti Displays (requires Mutter DisplayConfig)",
    mutterOnly: true,
  },
  {
    desktopId: "gnome-multitasking-panel.desktop",
    panelId: "multitasking",
    name: "Multitasking",
    comment: "Managed by Piloti Window Manager (requires GNOME Shell)",
    mutterOnly: true,
  },
];

const GCC_OVERRIDE_ROOT_REL = ".local/share/piloti-gcc";
const GCC_OVERRIDE_APPS_REL = ".local/share/piloti-gcc/applications";

export async function discoverGnomeControlCenterPanels(
  domicile: Domicile
): Promise<GnomeControlCenterPanelInfo[]> {
  try {
    const dirRes = await domicile.files.readDir("/usr/share/applications");
    const entries = dirRes.match({
      Ok: (list) => list,
      Err: () => [],
    });
    const panelFiles = entries.filter(
      (e) => /^gnome-.+-panel\.desktop$/i.test(e.name) && e.fileType !== 1
    );
    if (panelFiles.length === 0) {
      return [...DEFAULT_GNOME_PANELS];
    }

    const parsed = await Promise.all(
      panelFiles.map(
        async (item): Promise<GnomeControlCenterPanelInfo | null> => {
          const textRes = await domicile.files.readText(
            `/usr/share/applications/${item.name}`
          );
          const text = textRes.match({
            Ok: (t) => t,
            Err: () => undefined,
          });
          const panelId = item.name
            .replace(/^gnome-/i, "")
            .replace(/-panel\.desktop$/i, "");
          if (!text) {
            return { desktopId: item.name, panelId, name: panelId };
          }
          const entry = parseDesktopEntry(text, {
            filePath: `/usr/share/applications/${item.name}`,
            baseDir: "/usr/share/applications",
          });
          return {
            desktopId: item.name,
            panelId,
            name: entry?.name ?? panelId,
            comment: entry?.comment,
            mutterOnly: MUTTER_ONLY_PANEL_IDS.has(panelId),
          };
        }
      )
    );

    return parsed
      .filter((p): p is GnomeControlCenterPanelInfo => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [...DEFAULT_GNOME_PANELS];
  }
}

export async function syncGnomePanelOverrides(
  domicile: Domicile,
  hiddenDesktopIds: readonly string[]
): Promise<void> {
  try {
    await domicile.files.createDir(".local");
    await domicile.files.createDir(".local/share");
    await domicile.files.createDir(GCC_OVERRIDE_ROOT_REL);
    await domicile.files.createDir(GCC_OVERRIDE_APPS_REL);

    const hiddenSet = new Set(hiddenDesktopIds);

    const existingRes = await domicile.files.readDir(GCC_OVERRIDE_APPS_REL);
    const existingFiles = existingRes.match({
      Ok: (list) => list,
      Err: () => [],
    });
    const toRemove = existingFiles
      .filter((f) => f.name.endsWith(".desktop") && !hiddenSet.has(f.name))
      .map((f) => f.name);

    if (toRemove.length > 0) {
      await runText(domicile, [
        "sh",
        "-c",
        'dir="$HOME/.local/share/piloti-gcc/applications"; for f in "$@"; do rm -f "$dir/$f"; done',
        "sh",
        ...toRemove,
      ]);
    }

    await Promise.all(
      Array.from(hiddenSet).map((desktopId) => {
        if (!/^gnome-[A-Za-z0-9_.-]+\.desktop$/.test(desktopId)) {
          return Promise.resolve();
        }
        return domicile.files.write(
          `${GCC_OVERRIDE_APPS_REL}/${desktopId}`,
          `[Desktop Entry]\nType=Application\nName=Hidden Panel\nHidden=true\n`
        );
      })
    );
  } catch {
    // ignore if locked or unavailable
  }
}

export async function openGnomeControlCenter(
  domicile: Domicile,
  panel?: GnomeSettingsPanel | (string & {}),
  hiddenDesktopIds?: readonly string[]
): Promise<void> {
  if (hiddenDesktopIds) {
    await syncGnomePanelOverrides(domicile, hiddenDesktopIds);
  }

  const launchScript =
    'exec env XDG_CURRENT_DESKTOP=GNOME XDG_SESSION_DESKTOP=gnome XDG_DATA_DIRS="$HOME/.local/share/piloti-gcc:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}" gnome-control-center "$@"';
  const argv = panel
    ? ["sh", "-c", launchScript, "sh", panel]
    : ["sh", "-c", launchScript, "sh"];

  domicile.processes.launch(argv);
}

/**
 * Probes which underlying GNOME / Freedesktop daemons and CLIs are available
 * on the Linux host in a single batched shell invocation.
 */
export async function probeGnomeCapabilities(
  domicile: Domicile
): Promise<GnomeSystemCapabilities> {
  const out = await runText(domicile, [
    "sh",
    "-c",
    'for b in gsettings gnome-control-center wpctl pactl nmcli powerprofilesctl upower; do command -v "$b" >/dev/null 2>&1 && printf "%s\\n" "$b"; done; true',
  ]);
  const found = new Set(
    (out ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  );

  return {
    gsettings: found.has("gsettings"),
    gnomeControlCenter: found.has("gnome-control-center"),
    pipewire: found.has("wpctl") || found.has("pactl"),
    networkManager: found.has("nmcli"),
    powerProfiles: found.has("powerprofilesctl"),
    upower: found.has("upower"),
  };
}

