import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { AccentColorId, WifiNetwork } from "@/data/catalog";
import { parseDesktopEntry } from "xdg-desktop";

/**
 * Environment variables injected when launching GNOME / GTK / XDG applications
 * under Domicile so tools like `gnome-control-center` activate all panels and
 * portal/dconf integrations work cleanly.
 */
export const GNOME_SESSION_ENV: Record<string, string> = {
  XDG_CURRENT_DESKTOP: "GNOME",
  XDG_SESSION_DESKTOP: "gnome",
};

export const GNOME_ENV_PREFIX: readonly string[] = [
  "env",
  "XDG_CURRENT_DESKTOP=GNOME",
  "XDG_SESSION_DESKTOP=gnome",
];

export type GnomeSettingsPanel =
  | "wifi"
  | "network"
  | "bluetooth"
  | "display"
  | "sound"
  | "power"
  | "appearance"
  | "background"
  | "notifications"
  | "applications"
  | "privacy"
  | "keyboard"
  | "mouse"
  | "printers"
  | "system"
  | "users"
  | "datetime";

export interface GnomeInterfaceSnapshot {
  themeMode?: "dark" | "light" | "system";
  accentColor?: AccentColorId;
  iconTheme?: string;
  clock24Hour?: boolean;
  clockShowSeconds?: boolean;
}

export interface GnomeSystemCapabilities {
  gsettings: boolean;
  gnomeControlCenter: boolean;
  pipewire: boolean;
  networkManager: boolean;
  powerProfiles: boolean;
  upower: boolean;
}

export interface AudioSinkInfo {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface BatteryInfo {
  present: boolean;
  percentage: number;
  charging: boolean;
}

const GNOME_ACCENT_TO_PILOTI: Record<string, AccentColorId> = {
  blue: "blue",
  teal: "teal",
  green: "green",
  yellow: "yellow",
  orange: "orange",
  red: "red",
  pink: "pink",
  purple: "purple",
  slate: "graphite",
};

const PILOTI_ACCENT_TO_GNOME: Record<AccentColorId, string> = {
  blue: "blue",
  teal: "teal",
  green: "green",
  yellow: "yellow",
  orange: "orange",
  red: "red",
  pink: "pink",
  purple: "purple",
  graphite: "slate",
  mint: "teal",
  cyan: "teal",
  indigo: "blue",
  brown: "orange",
};

function stripGVariantQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseGSettingsKeyVal(
  key: string,
  rawVal: string
): Partial<GnomeInterfaceSnapshot> {
  const val = stripGVariantQuotes(rawVal);
  switch (key) {
    case "color-scheme": {
      if (val === "prefer-dark") return { themeMode: "dark" };
      if (val === "prefer-light") return { themeMode: "light" };
      if (val === "default") return { themeMode: "system" };
      return {};
    }
    case "accent-color": {
      const mapped = GNOME_ACCENT_TO_PILOTI[val];
      return mapped ? { accentColor: mapped } : {};
    }
    case "icon-theme": {
      return val ? { iconTheme: val } : {};
    }
    case "clock-format": {
      if (val === "24h") return { clock24Hour: true };
      if (val === "12h") return { clock24Hour: false };
      return {};
    }
    case "clock-show-seconds": {
      if (val === "true") return { clockShowSeconds: true };
      if (val === "false") return { clockShowSeconds: false };
      return {};
    }
    default:
      return {};
  }
}

async function runText(
  domicile: Domicile,
  argv: readonly string[]
): Promise<string | null> {
  try {
    const res = await domicile.processes.run(argv);
    return res.match({
      Ok: (ran) => (ran.code === 0 ? ran.stdout : null),
      Err: () => null,
    });
  } catch {
    return null;
  }
}

async function commandExists(
  domicile: Domicile,
  bin: string
): Promise<boolean> {
  const out = await runText(domicile, [
    "sh",
    "-c",
    'command -v "$1"',
    "sh",
    bin,
  ]);
  return Boolean(out && out.trim().length > 0);
}

/**
 * Launches a Linux / XDG command with `XDG_CURRENT_DESKTOP=GNOME` so GNOME apps
 * (especially `gnome-control-center`) enable full GNOME integration.
 */
export function launchWithGnomeEnv(
  domicile: Domicile,
  argv: readonly string[],
  options?: { cwd?: string; extraEnv?: Record<string, string> }
): void {
  if (argv.length === 0) return;

  if (options?.cwd || options?.extraEnv) {
    domicile.processes
      .spawn(argv, {
        cwd: options.cwd,
        env: { ...GNOME_SESSION_ENV, ...options.extraEnv },
      })
      .catch(() => {
        domicile.processes.launch([...GNOME_ENV_PREFIX, ...argv]);
      });
    return;
  }

  domicile.processes.launch([...GNOME_ENV_PREFIX, ...argv]);
}

export interface GnomeControlCenterPanelInfo {
  /** Desktop filename, e.g. `gnome-wifi-panel.desktop`. */
  desktopId: string;
  /** Panel CLI identifier, e.g. `wifi`. */
  panelId: string;
  /** Localized display name, e.g. `Wi-Fi`. */
  name: string;
  /** Optional subtitle / description. */
  comment?: string;
  /** Whether the panel relies on GNOME Mutter private D-Bus APIs. */
  mutterOnly?: boolean;
}

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

/**
 * Discovers installed `gnome-*-panel.desktop` entries under `/usr/share/applications/`
 * so the user can choose which panels appear in `gnome-control-center`.
 */
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
      panelFiles.map(async (item): Promise<GnomeControlCenterPanelInfo | null> => {
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
      })
    );

    return parsed
      .filter((p): p is GnomeControlCenterPanelInfo => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [...DEFAULT_GNOME_PANELS];
  }
}

/**
 * Writes isolated XDG override stubs (`Hidden=true`) into
 * `~/.local/share/piloti-gcc/applications/` so disabled panels are hidden only
 * when launched from Piloti without modifying `/usr/share/applications/` or GNOME Shell.
 */
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

    // Clean up overrides for panels that are now enabled
    const existingRes = await domicile.files.readDir(GCC_OVERRIDE_APPS_REL);
    const existingFiles = existingRes.match({
      Ok: (list) => list,
      Err: () => [],
    });
    const toRemove = existingFiles
      .filter(
        (f) =>
          f.name.endsWith(".desktop") && !hiddenSet.has(f.name)
      )
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

    // Write Hidden=true override stubs for disabled panels
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

/**
 * Opens native GNOME Settings (`gnome-control-center`) with Piloti's isolated
 * panel overrides applied via `XDG_DATA_DIRS`, optionally jumping directly to a panel.
 */
export async function openGnomeControlCenter(
  domicile: Domicile,
  panel?: GnomeSettingsPanel,
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
 * on the Linux host.
 */
export async function probeGnomeCapabilities(
  domicile: Domicile
): Promise<GnomeSystemCapabilities> {
  const [gsettings, gcc, wpctl, pactl, nmcli, ppctl, upower] =
    await Promise.all([
      commandExists(domicile, "gsettings"),
      commandExists(domicile, "gnome-control-center"),
      commandExists(domicile, "wpctl"),
      commandExists(domicile, "pactl"),
      commandExists(domicile, "nmcli"),
      commandExists(domicile, "powerprofilesctl"),
      commandExists(domicile, "upower"),
    ]);

  return {
    gsettings,
    gnomeControlCenter: gcc,
    pipewire: wpctl || pactl,
    networkManager: nmcli,
    powerProfiles: ppctl,
    upower,
  };
}

/**
 * Reads current `org.gnome.desktop.interface` keys via `gsettings list-recursively`.
 */
export async function readGnomeInterfaceSettings(
  domicile: Domicile
): Promise<GnomeInterfaceSnapshot> {
  const stdout = await runText(domicile, [
    "gsettings",
    "list-recursively",
    "org.gnome.desktop.interface",
  ]);
  if (!stdout) return {};

  const snapshot: GnomeInterfaceSnapshot = {};
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Format: "org.gnome.desktop.interface color-scheme 'prefer-dark'"
    const match = trimmed.match(/^org\.gnome\.desktop\.interface\s+(\S+)\s+(.+)$/);
    if (!match) continue;
    Object.assign(snapshot, parseGSettingsKeyVal(match[1], match[2]));
  }
  return snapshot;
}

/**
 * Subscribes to live changes in `org.gnome.desktop.interface` using
 * `gsettings monitor org.gnome.desktop.interface`. Returns a stop callback.
 */
export function monitorGnomeInterfaceSettings(
  domicile: Domicile,
  onChange: (patch: GnomeInterfaceSnapshot) => void
): () => void {
  let stopped = false;
  let killFn: (() => void) | undefined;

  (async () => {
    try {
      const res = await domicile.processes.spawn([
        "gsettings",
        "monitor",
        "org.gnome.desktop.interface",
      ]);
      const proc = res.match({
        Ok: (p) => p,
        Err: () => undefined,
      });
      if (!proc || stopped) {
        proc?.kill();
        return;
      }
      killFn = () => proc.kill();

      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done || stopped) break;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          // Format: "color-scheme: 'prefer-dark'"
          const sepIdx = line.indexOf(":");
          if (sepIdx <= 0) continue;
          const key = line.slice(0, sepIdx).trim();
          const rawVal = line.slice(sepIdx + 1).trim();
          const patch = parseGSettingsKeyVal(key, rawVal);
          if (Object.keys(patch).length > 0) {
            onChange(patch);
          }
        }
      }
    } catch {
      // ignore if gsettings monitor is unavailable
    }
  })();

  return () => {
    stopped = true;
    killFn?.();
  };
}

/**
 * Writes a Piloti setting back to GNOME's `dconf` / `gsettings` store so
 * GTK4/Libadwaita apps and `gnome-control-center` stay in sync.
 */
export async function syncGnomeInterfaceKey(
  domicile: Domicile,
  patch: {
    themeMode?: "dark" | "light" | "system";
    accentColor?: AccentColorId;
    clock24Hour?: boolean;
    clockShowSeconds?: boolean;
  }
): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (patch.themeMode !== undefined) {
    const scheme =
      patch.themeMode === "dark"
        ? "prefer-dark"
        : patch.themeMode === "light"
          ? "prefer-light"
          : "default";
    tasks.push(
      runText(domicile, [
        "gsettings",
        "set",
        "org.gnome.desktop.interface",
        "color-scheme",
        scheme,
      ])
    );
  }

  if (patch.accentColor !== undefined) {
    const gnomeAccent = PILOTI_ACCENT_TO_GNOME[patch.accentColor];
    if (gnomeAccent) {
      tasks.push(
        runText(domicile, [
          "gsettings",
          "set",
          "org.gnome.desktop.interface",
          "accent-color",
          gnomeAccent,
        ])
      );
    }
  }

  if (patch.clock24Hour !== undefined) {
    tasks.push(
      runText(domicile, [
        "gsettings",
        "set",
        "org.gnome.desktop.interface",
        "clock-format",
        patch.clock24Hour ? "24h" : "12h",
      ])
    );
  }

  if (patch.clockShowSeconds !== undefined) {
    tasks.push(
      runText(domicile, [
        "gsettings",
        "set",
        "org.gnome.desktop.interface",
        "clock-show-seconds",
        patch.clockShowSeconds ? "true" : "false",
      ])
    );
  }

  await Promise.allSettled(tasks);
}

export function parseWpctlVolumeOutput(
  wpOut: string
): { volume: number; muted: boolean } | null {
  const m = wpOut.match(/Volume:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return null;
  const vol = Math.max(0, Math.min(100, Math.round(Number(m[1]) * 100)));
  const muted = /\[MUTED\]/i.test(wpOut);
  return { volume: vol, muted };
}

/**
 * Reads default audio sink volume (0..100) and mute state via PipeWire (`wpctl`)
 * or PulseAudio (`pactl`).
 */
export async function readSystemAudio(
  domicile: Domicile
): Promise<{ volume: number; muted: boolean } | null> {
  const wpOut = await runText(domicile, [
    "wpctl",
    "get-volume",
    "@DEFAULT_AUDIO_SINK@",
  ]);
  if (wpOut) {
    const parsed = parseWpctlVolumeOutput(wpOut);
    if (parsed) return parsed;
  }

  const [paVolOut, paMuteOut] = await Promise.all([
    runText(domicile, ["pactl", "get-sink-volume", "@DEFAULT_SINK@"]),
    runText(domicile, ["pactl", "get-sink-mute", "@DEFAULT_SINK@"]),
  ]);
  if (paVolOut) {
    const m = paVolOut.match(/(\d+)%/);
    if (m) {
      const vol = Math.max(0, Math.min(100, Number(m[1])));
      const muted = paMuteOut ? /yes/i.test(paMuteOut) : false;
      return { volume: vol, muted };
    }
  }

  return null;
}

/**
 * Sets system audio volume and mute state via PipeWire (`wpctl`) or PulseAudio (`pactl`).
 */
export async function setSystemAudio(
  domicile: Domicile,
  volume: number,
  muted: boolean
): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  const wpRes = await runText(domicile, [
    "wpctl",
    "set-volume",
    "@DEFAULT_AUDIO_SINK@",
    (clamped / 100).toFixed(2),
  ]);
  if (wpRes !== null) {
    await runText(domicile, [
      "wpctl",
      "set-mute",
      "@DEFAULT_AUDIO_SINK@",
      muted ? "1" : "0",
    ]);
    return;
  }

  await Promise.allSettled([
    runText(domicile, [
      "pactl",
      "set-sink-volume",
      "@DEFAULT_SINK@",
      `${clamped}%`,
    ]),
    runText(domicile, [
      "pactl",
      "set-sink-mute",
      "@DEFAULT_SINK@",
      muted ? "1" : "0",
    ]),
  ]);
}

/**
 * Lists PipeWire / PulseAudio output sinks using `pactl list short sinks`.
 */
export async function listSystemAudioSinks(
  domicile: Domicile
): Promise<AudioSinkInfo[]> {
  const [defaultSinkOut, shortOut] = await Promise.all([
    runText(domicile, ["pactl", "get-default-sink"]),
    runText(domicile, ["pactl", "list", "short", "sinks"]),
  ]);
  if (!shortOut) return [];

  const defaultName = defaultSinkOut?.trim() ?? "";
  const sinks: AudioSinkInfo[] = [];

  for (const line of shortOut.split(/\r?\n/)) {
    const cols = line.split(/\t+/);
    if (cols.length < 2) continue;
    const id = cols[0].trim();
    const name = cols[1].trim();
    if (!name) continue;
    const friendly = name
      .replace(/^alsa_output\./, "")
      .replace(/^bluez_output\./, "Bluetooth · ")
      .replace(/\.analog-stereo$/, " (Analog Stereo)")
      .replace(/\.hdmi-stereo.*$/, " (HDMI / DisplayPort)")
      .replace(/_/g, " ");
    sinks.push({
      id,
      name,
      description: friendly,
      active: name === defaultName,
    });
  }

  return sinks;
}

/**
 * Sets the default audio output sink via `pactl set-default-sink`.
 */
export async function setDefaultAudioSink(
  domicile: Domicile,
  sinkName: string
): Promise<void> {
  await runText(domicile, ["pactl", "set-default-sink", sinkName]);
}

export function parseNmcliWifiOutput(listOut: string): {
  connectedSsid: string | null;
  networks: WifiNetwork[];
} {
  let connectedSsid: string | null = null;
  const dedup = new Map<string, WifiNetwork>();

  for (const line of listOut.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split(/(?<!\\):/);
    if (parts.length < 3) continue;
    const active = parts[0].trim() === "yes";
    const ssid = parts[1].replace(/\\:/g, ":").trim();
    if (!ssid) continue;
    const signal = Number.parseInt(parts[2] ?? "0", 10) || 0;
    const sec = (parts[3] ?? "").trim();

    if (active) {
      connectedSsid = ssid;
    }
    const prev = dedup.get(ssid);
    if (!prev || signal > prev.signal) {
      dedup.set(ssid, {
        ssid,
        signal,
        secured: Boolean(sec && sec !== "--"),
        band: "5 GHz",
      });
    }
  }

  return {
    connectedSsid,
    networks: Array.from(dedup.values()).sort((a, b) => b.signal - a.signal),
  };
}

/**
 * Reads real Wi-Fi radio state, connected SSID, and nearby networks via `nmcli`.
 */
export async function readSystemWifi(domicile: Domicile): Promise<{
  enabled: boolean;
  connectedSsid: string | null;
  networks: WifiNetwork[];
} | null> {
  const radioOut = await runText(domicile, ["nmcli", "radio", "wifi"]);
  if (radioOut === null) return null;

  const enabled = radioOut.trim().toLowerCase() === "enabled";
  if (!enabled) {
    return { enabled: false, connectedSsid: null, networks: [] };
  }

  const listOut = await runText(domicile, [
    "nmcli",
    "-t",
    "-f",
    "ACTIVE,SSID,SIGNAL,SECURITY",
    "dev",
    "wifi",
    "list",
  ]);
  if (!listOut) {
    return { enabled, connectedSsid: null, networks: [] };
  }

  return {
    enabled,
    ...parseNmcliWifiOutput(listOut),
  };
}

export async function setSystemWifiEnabled(
  domicile: Domicile,
  enabled: boolean
): Promise<void> {
  await runText(domicile, ["nmcli", "radio", "wifi", enabled ? "on" : "off"]);
}

export async function connectSystemWifi(
  domicile: Domicile,
  ssid: string
): Promise<boolean> {
  const res = await runText(domicile, ["nmcli", "dev", "wifi", "connect", ssid]);
  return res !== null;
}

/**
 * Reads active GNOME Power Profile via `powerprofilesctl`.
 */
export async function readSystemPowerProfile(
  domicile: Domicile
): Promise<"balanced" | "performance" | "power-saver" | null> {
  const out = await runText(domicile, ["powerprofilesctl", "get"]);
  if (!out) return null;
  const val = out.trim();
  if (val === "balanced" || val === "performance" || val === "power-saver") {
    return val;
  }
  return null;
}

export async function setSystemPowerProfile(
  domicile: Domicile,
  profile: "balanced" | "performance" | "power-saver"
): Promise<void> {
  await runText(domicile, ["powerprofilesctl", "set", profile]);
}

/**
 * Reads battery status via Linux `/sys/class/power_supply` (zero process spawn)
 * with fallback to `upower`.
 */
export async function readSystemBattery(
  domicile: Domicile
): Promise<BatteryInfo | null> {
  try {
    const dirRes = await domicile.files.readDir("/sys/class/power_supply");
    const entries = dirRes.match({
      Ok: (list) => list,
      Err: () => [],
    });
    const bat = entries.find((e) => /^BAT\d+$/i.test(e.name));
    if (bat) {
      const [capRes, statusRes] = await Promise.all([
        domicile.files.readText(`/sys/class/power_supply/${bat.name}/capacity`),
        domicile.files.readText(`/sys/class/power_supply/${bat.name}/status`),
      ]);
      const capStr = capRes.match({ Ok: (t) => t, Err: () => "" });
      const statusStr = statusRes.match({ Ok: (t) => t, Err: () => "" });
      const pct = Number.parseInt(capStr.trim(), 10);
      if (Number.isFinite(pct)) {
        return {
          present: true,
          percentage: Math.max(0, Math.min(100, pct)),
          charging: /charging|full/i.test(statusStr),
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Sets hardware backlight brightness via `brightnessctl` if present on Linux.
 */
export async function setSystemBrightness(
  domicile: Domicile,
  percentage: number
): Promise<void> {
  const clamped = Math.max(10, Math.min(100, Math.round(percentage)));
  await runText(domicile, ["brightnessctl", "set", `${clamped}%`]);
}
