import { parseDesktopEntry } from "./xdg-desktop-entry";

export interface XdgAutostartEntry {
  id: string;
  path: string;
  source: "user" | "system";
  name: string;
  comment?: string;
  icon?: string;
  exec?: string;
  tryExec?: string;
  autostartCondition?: string;
  enabled: boolean;
  hidden: boolean;
  terminal: boolean;
}

const DEFAULT_CURRENT_DESKTOPS: readonly string[] = ["Piloti", "GNOME"];

function normalizeCurrentDesktops(
  currentDesktop: string | readonly string[]
): string[] {
  const list =
    typeof currentDesktop === "string"
      ? currentDesktop.split(":")
      : [...currentDesktop];
  return list.map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function matchesAnyDesktop(
  entryList: readonly string[],
  currentDesktops: readonly string[]
): boolean {
  return entryList.some((d) =>
    currentDesktops.includes(d.trim().toLowerCase())
  );
}

/**
 * Parses an XDG Autostart `.desktop` file per the FreeDesktop Desktop
 * Application Autostart Specification.
 */
export function parseAutostartDesktopFile(
  id: string,
  path: string,
  content: string,
  source: "user" | "system",
  currentDesktop: string | readonly string[] = DEFAULT_CURRENT_DESKTOPS
): XdgAutostartEntry | null {
  const parsed = parseDesktopEntry(content);
  if (!parsed) return null;

  const lines = content.split(/\r?\n/);
  let inDesktopEntry = false;
  let hidden = false;
  let gnomeEnabled: boolean | undefined;
  let tryExec: string | undefined;
  let autostartCondition: string | undefined;
  let onlyShowIn: string[] = [];
  let notShowIn: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inDesktopEntry = line === "[Desktop Entry]";
      continue;
    }
    if (!inDesktopEntry) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key === "Hidden") {
      hidden = val.toLowerCase() === "true";
    } else if (key === "X-GNOME-Autostart-enabled") {
      gnomeEnabled = val.toLowerCase() !== "false";
    } else if (key === "TryExec") {
      tryExec = val || undefined;
    } else if (key === "AutostartCondition") {
      autostartCondition = val || undefined;
    } else if (key === "OnlyShowIn") {
      onlyShowIn = val.split(";").filter(Boolean);
    } else if (key === "NotShowIn") {
      notShowIn = val.split(";").filter(Boolean);
    }
  }

  const desktops = normalizeCurrentDesktops(currentDesktop);
  if (onlyShowIn.length > 0 && !matchesAnyDesktop(onlyShowIn, desktops)) {
    return null;
  }
  if (notShowIn.length > 0 && matchesAnyDesktop(notShowIn, desktops)) {
    return null;
  }

  return {
    id,
    path,
    source,
    name: parsed.name,
    comment: parsed.comment,
    icon: parsed.icon,
    exec: parsed.exec,
    tryExec,
    autostartCondition,
    hidden,
    enabled: !hidden && (gnomeEnabled ?? true),
    terminal: Boolean(parsed.terminal),
  };
}

/**
 * Merges system (`/etc/xdg/autostart`) and user (`~/.config/autostart`) entries
 * with user entries overriding system entries of the same filename.
 */
export function mergeAutostartEntries(
  systemEntries: readonly XdgAutostartEntry[],
  userEntries: readonly XdgAutostartEntry[]
): XdgAutostartEntry[] {
  const map = new Map<string, XdgAutostartEntry>();
  for (const entry of systemEntries) {
    map.set(entry.id, entry);
  }
  for (const entry of userEntries) {
    map.set(entry.id, entry);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

/**
 * Serializes an XDG Autostart override `.desktop` file when toggling enabled state.
 */
export function buildAutostartOverrideDesktopContent(
  entry: Pick<XdgAutostartEntry, "name" | "comment" | "icon" | "exec" | "terminal">,
  enabled: boolean
): string {
  const lines = [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${entry.name}`,
    ...(entry.comment ? [`Comment=${entry.comment}`] : []),
    ...(entry.icon ? [`Icon=${entry.icon}`] : []),
    ...(entry.exec ? [`Exec=${entry.exec}`] : []),
    `Terminal=${entry.terminal ? "true" : "false"}`,
    `Hidden=${enabled ? "false" : "true"}`,
    `X-GNOME-Autostart-enabled=${enabled ? "true" : "false"}`,
  ];
  return `${lines.join("\n")}\n`;
}
