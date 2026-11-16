/**
 * FreeDesktop.org XDG Desktop Entry Specification (v1.5).
 * https://specifications.freedesktop.org/desktop-entry-spec/latest/
 */

import { XDG_APPLICATION_DIRS, type XdgFileReader } from "./xdg-basedir";
import {
  buildXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
  type XdgIconThemeIndex,
} from "./xdg-icon-theme";

interface XdgDesktopAction {
  id: string;
  name: string;
  icon?: string;
  exec?: string;
  execArgv: string[];
}

interface XdgDesktopEntry {
  desktopId: string;
  appId: string;
  filePath: string;
  type: "Application" | "Link" | "Directory" | string;
  version?: string;
  name: string;
  genericName?: string;
  comment?: string;
  icon?: string;
  iconPath?: string;
  iconUrl?: string;
  exec?: string;
  execArgv: string[];
  tryExec?: string;
  workingDirectory?: string;
  terminal: boolean;
  noDisplay: boolean;
  hidden: boolean;
  startupNotify: boolean;
  startupWMClass?: string;
  categories: string[];
  primaryCategory:
    | "System"
    | "Development"
    | "Productivity"
    | "Utilities"
    | "Internet"
    | "Media";
  keywords: string[];
  mimeTypes: string[];
  onlyShowIn: string[];
  notShowIn: string[];
  dbusActivatable: boolean;
  prefersCsd: boolean;
  actions: XdgDesktopAction[];
  rawGroups: Record<string, Record<string, string>>;
}

interface ParseDesktopEntryOptions {
  filePath?: string;
  baseDir?: string;
  locale?: string;
  currentDesktops?: string[];
  terminalExecPrefix?: string[];
  iconThemes?: string[];
  iconSize?: number;
  iconScale?: number;
  /** Populate `iconPath` without awaiting base64 `iconUrl` payloads upfront. */
  deferIconDataLoad?: boolean;
}

const ESCAPE_MAP: Record<string, string> = {
  s: " ",
  n: "\n",
  t: "\t",
  r: "\r",
  "\\": "\\",
  ";": ";",
};

function unescapeXdgValue(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[++i];
      out += ESCAPE_MAP[next] ?? next;
    } else {
      out += ch;
    }
  }
  return out;
}

function splitXdgList(raw: string | undefined): string[] {
  if (!raw) return [];
  const items: string[] = [];
  let current = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length && raw[i + 1] === ";") {
      current += ";";
      i++;
      continue;
    }
    if (ch === ";") {
      const cleaned = unescapeXdgValue(current.trim());
      if (cleaned.length > 0) items.push(cleaned);
      current = "";
    } else {
      current += ch;
    }
  }
  const trailing = unescapeXdgValue(current.trim());
  if (trailing.length > 0) items.push(trailing);
  return items;
}

function getLocaleFallbacks(locale?: string): string[] {
  const raw = (
    locale ||
    (typeof navigator !== "undefined" ? navigator.language : undefined) ||
    (typeof process !== "undefined" ? process.env.LC_ALL || process.env.LANG : undefined) ||
    "en_US"
  ).replace("-", "_");

  const [withoutEncoding] = raw.split(".");
  const [langCountry, modifier] = withoutEncoding.split("@");
  const [lang, country] = langCountry.split("_");

  const candidates: string[] = [];
  if (lang && country && modifier) candidates.push(`${lang}_${country}@${modifier}`);
  if (lang && country) candidates.push(`${lang}_${country}`);
  if (lang && modifier) candidates.push(`${lang}@${modifier}`);
  if (lang) candidates.push(lang);
  return candidates;
}

function getLocalizedKey(
  group: Record<string, string>,
  key: string,
  localeFallbacks: string[]
): string | undefined {
  for (const loc of localeFallbacks) {
    const localized = group[`${key}[${loc}]`];
    if (localized !== undefined && localized !== "") {
      return unescapeXdgValue(localized);
    }
  }
  const base = group[key];
  return base !== undefined ? unescapeXdgValue(base) : undefined;
}

function parseXdgBoolean(val: string | undefined): boolean {
  if (!val) return false;
  const normalized = val.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

function parseIniGroups(content: string): Record<string, Record<string, string>> {
  const groups: Record<string, Record<string, string>> = {};
  let current: string | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      current = line.slice(1, -1).trim();
      groups[current] ??= {};
      continue;
    }

    if (!current) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;

    groups[current][line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
  }
  return groups;
}

function tokenizeExec(execLine: string): string[] {
  const unescaped = unescapeXdgValue(execLine.trim());
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let hasChars = false;

  for (let i = 0; i < unescaped.length; i++) {
    const ch = unescaped[i];
    if (inQuotes) {
      if (ch === "\\" && i + 1 < unescaped.length) {
        current += unescaped[++i];
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
      hasChars = true;
    } else if (ch === "\\" && i + 1 < unescaped.length) {
      current += unescaped[++i];
      hasChars = true;
    } else if (/\s/.test(ch)) {
      if (hasChars) {
        tokens.push(current);
        current = "";
        hasChars = false;
      }
    } else {
      current += ch;
      hasChars = true;
    }
  }
  if (hasChars) tokens.push(current);
  return tokens;
}

function expandExecArgv(
  execLine: string,
  context: {
    name?: string;
    icon?: string;
    filePath?: string;
    filesOrUrls?: string[];
  } = {}
): string[] {
  const rawTokens = tokenizeExec(execLine);
  const argv: string[] = [];
  const targets = context.filesOrUrls ?? [];

  for (const token of rawTokens) {
    if (token === "%F" || token === "%U") {
      if (targets.length > 0) argv.push(...targets);
      continue;
    }
    if (token === "%f" || token === "%u") {
      if (targets[0]) argv.push(targets[0]);
      continue;
    }
    if (token === "%i") {
      if (context.icon) argv.push("--icon", context.icon);
      continue;
    }
    if (/^%[dDnNvm]$/.test(token)) continue;

    let expanded = "";
    let skipToken = false;
    for (let i = 0; i < token.length; i++) {
      const ch = token[i];
      if (ch === "%" && i + 1 < token.length) {
        const code = token[++i];
        if (code === "%") {
          expanded += "%";
        } else if (code === "c") {
          expanded += context.name ?? "";
        } else if (code === "k") {
          expanded += context.filePath ?? "";
        } else if (code === "f" || code === "u" || code === "F" || code === "U") {
          if (targets[0]) expanded += targets[0];
          else if (token.length === 2) skipToken = true;
        } else if (!"dDnNvmi".includes(code)) {
          expanded += `%${code}`;
        }
      } else {
        expanded += ch;
      }
    }

    if (!skipToken && expanded.length > 0) {
      argv.push(expanded);
    }
  }

  if (argv[0] === "env" || argv[0] === "/usr/bin/env") {
    let idx = 1;
    while (idx < argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[idx])) {
      idx++;
    }
    if (idx < argv.length) return argv.slice(idx);
  }

  return argv;
}

function computeDesktopFileId(filePath: string, baseDir?: string): string {
  if (baseDir && filePath.startsWith(baseDir)) {
    return filePath.slice(baseDir.length).replace(/^\/+/, "").replace(/\//g, "-");
  }
  const parts = filePath.split("/");
  return parts[parts.length - 1] || "app.desktop";
}

function mapPrimaryCategory(
  categories: string[]
): XdgDesktopEntry["primaryCategory"] {
  const joined = categories.join(" ").toLowerCase();
  if (joined.includes("development") || joined.includes("ide")) return "Development";
  if (joined.includes("network") || joined.includes("webbrowser")) return "Internet";
  if (joined.includes("audio") || joined.includes("video") || joined.includes("graphics")) {
    return "Media";
  }
  if (joined.includes("office") || joined.includes("texteditor")) return "Productivity";
  if (joined.includes("system") || joined.includes("settings") || joined.includes("monitor")) {
    return "System";
  }
  return "Utilities";
}

const CSD_HINT_TOKENS = [
  "gnome",
  "gtk",
  "adwaita",
  "nautilus",
  "loupe",
  "papers",
  "evince",
  "gedit",
  "kgx",
  "ptyxis",
  "blanket",
  "snapshot",
  "showtime",
  "baobab",
  "seahorse",
  "dconf",
  "pavucontrol",
  "blueman",
  "nm-connection-editor",
  "simple-scan",
  "file-roller",
] as const;

function hasCsdMetadataHint(text: string): boolean {
  const lower = text.toLowerCase();
  return CSD_HINT_TOKENS.some((token) => lower.includes(token));
}

function parseDesktopEntry(
  content: string,
  options: ParseDesktopEntryOptions = {}
): XdgDesktopEntry | null {
  const rawGroups = parseIniGroups(content);
  const main = rawGroups["Desktop Entry"];
  if (!main) return null;

  const localeFallbacks = getLocaleFallbacks(options.locale);
  const type = unescapeXdgValue(main["Type"] ?? "Application");
  const name = getLocalizedKey(main, "Name", localeFallbacks);
  if (!name) return null;

  const icon = main["Icon"] ? unescapeXdgValue(main["Icon"]) : undefined;
  const exec = main["Exec"];
  const terminal = parseXdgBoolean(main["Terminal"]);
  const filePath = options.filePath ?? "application.desktop";
  const desktopId = computeDesktopFileId(filePath, options.baseDir);
  const appId = desktopId.replace(/\.desktop$/i, "");

  let execArgv = exec ? expandExecArgv(exec, { name, icon, filePath }) : [];
  if (terminal && execArgv.length > 0) {
    execArgv = [...(options.terminalExecPrefix ?? ["kitty", "-e"]), ...execArgv];
  }

  const categories = splitXdgList(main["Categories"]);
  const actions: XdgDesktopAction[] = [];
  for (const actId of splitXdgList(main["Actions"])) {
    const actGroup = rawGroups[`Desktop Action ${actId}`];
    if (!actGroup) continue;
    const actName = getLocalizedKey(actGroup, "Name", localeFallbacks);
    if (!actName) continue;
    const actIcon = actGroup["Icon"] ? unescapeXdgValue(actGroup["Icon"]) : icon;
    const actExec = actGroup["Exec"];
    actions.push({
      id: actId,
      name: actName,
      icon: actIcon,
      exec: actExec,
      execArgv: actExec
        ? expandExecArgv(actExec, { name: actName, icon: actIcon, filePath })
        : [],
    });
  }

  const onlyShowIn = splitXdgList(main["OnlyShowIn"]);
  const lowerMeta = `${desktopId} ${categories.join(" ")} ${exec ?? ""} ${onlyShowIn.join(" ")}`;
  const prefersCsd =
    hasCsdMetadataHint(lowerMeta) ||
    Boolean(main["X-GNOME-UsesNotifications"]);

  return {
    desktopId,
    appId,
    filePath,
    type,
    version: main["Version"],
    name,
    genericName: getLocalizedKey(main, "GenericName", localeFallbacks),
    comment: getLocalizedKey(main, "Comment", localeFallbacks),
    icon,
    exec,
    execArgv,
    tryExec: main["TryExec"] ? unescapeXdgValue(main["TryExec"]) : undefined,
    workingDirectory: main["Path"] ? unescapeXdgValue(main["Path"]) : undefined,
    terminal,
    noDisplay: parseXdgBoolean(main["NoDisplay"]),
    hidden: parseXdgBoolean(main["Hidden"]),
    startupNotify: parseXdgBoolean(main["StartupNotify"]),
    startupWMClass: main["StartupWMClass"]
      ? unescapeXdgValue(main["StartupWMClass"])
      : undefined,
    categories,
    primaryCategory: mapPrimaryCategory(categories),
    keywords: splitXdgList(
      getLocalizedKey(main, "Keywords", localeFallbacks) ?? main["Keywords"]
    ),
    mimeTypes: splitXdgList(main["MimeType"]),
    onlyShowIn,
    notShowIn: splitXdgList(main["NotShowIn"]),
    dbusActivatable: parseXdgBoolean(main["DBusActivatable"]),
    prefersCsd,
    actions,
    rawGroups,
  };
}

function isLaunchableDesktopApp(
  entry: XdgDesktopEntry,
  currentDesktops: string[] = ["Piloti", "Domicile", "GNOME"]
): boolean {
  if (entry.type !== "Application") return false;
  if (entry.hidden || entry.noDisplay || entry.execArgv.length === 0) return false;

  const matchesDesktop = (d: string) =>
    currentDesktops.some((cd) => cd.toLowerCase() === d.toLowerCase());

  if (entry.onlyShowIn.length > 0 && !entry.onlyShowIn.some(matchesDesktop)) {
    return false;
  }
  if (entry.notShowIn.length > 0 && entry.notShowIn.some(matchesDesktop)) {
    return false;
  }
  return true;
}

async function discoverInstalledXdgApps(
  files: XdgFileReader,
  options: ParseDesktopEntryOptions = {},
  existingIconIndex?: XdgIconThemeIndex | Promise<XdgIconThemeIndex>
): Promise<XdgDesktopEntry[]> {
  interface CandidateDesktopFile {
    desktopId: string;
    fullPath: string;
    baseDir: string;
  }

  const iconIndexPromise =
    existingIconIndex !== undefined
      ? Promise.resolve(existingIconIndex)
      : buildXdgIconThemeIndex(files, options.iconThemes);

  async function collectDir(
    baseDir: string,
    currentDir: string,
    depth: number
  ): Promise<CandidateDesktopFile[]> {
    if (depth > 2) return [];
    const dirRes = await files.readDir(currentDir);
    const entries = dirRes.match({ Ok: (list) => list, Err: () => [] });
    if (entries.length === 0) return [];

    const out: CandidateDesktopFile[] = [];
    const childDirTasks: Promise<CandidateDesktopFile[]>[] = [];

    for (const item of entries) {
      const fullPath = `${currentDir}/${item.name}`;
      if (item.fileType === 1 && !item.name.startsWith(".")) {
        childDirTasks.push(collectDir(baseDir, fullPath, depth + 1));
      } else if (item.name.endsWith(".desktop")) {
        out.push({
          desktopId: computeDesktopFileId(fullPath, baseDir),
          fullPath,
          baseDir,
        });
      }
    }

    if (childDirTasks.length > 0) {
      const nested = await Promise.all(childDirTasks);
      for (const batch of nested) out.push(...batch);
    }
    return out;
  }

  // Scan application dirs in parallel, then deduplicate by XDG precedence order.
  const perDirCandidates = await Promise.all(
    XDG_APPLICATION_DIRS.map((appDir) => collectDir(appDir, appDir, 0))
  );
  const seenIds = new Set<string>();
  const uniqueCandidates: CandidateDesktopFile[] = [];
  for (const batch of perDirCandidates) {
    for (const item of batch) {
      if (seenIds.has(item.desktopId)) continue;
      seenIds.add(item.desktopId);
      uniqueCandidates.push(item);
    }
  }

  const results: XdgDesktopEntry[] = [];
  const BATCH_SIZE = 24;
  for (let i = 0; i < uniqueCandidates.length; i += BATCH_SIZE) {
    const chunk = uniqueCandidates.slice(i, i + BATCH_SIZE);
    const parsedBatch = await Promise.all(
      chunk.map(async (item) => {
        const textRes = await files.readText(item.fullPath);
        const text = textRes.match({ Ok: (t) => t, Err: () => undefined });
        if (!text) return null;
        return parseDesktopEntry(text, {
          ...options,
          filePath: item.fullPath,
          baseDir: item.baseDir,
        });
      })
    );
    for (const parsed of parsedBatch) {
      if (parsed && isLaunchableDesktopApp(parsed, options.currentDesktops)) {
        results.push(parsed);
      }
    }
  }

  const iconIndex = await iconIndexPromise;
  const iconSize = options.iconSize ?? 64;
  const iconScale = options.iconScale ?? 1;

  for (const entry of results) {
    const candidates = [entry.icon, entry.appId].filter(
      (c): c is string => Boolean(c)
    );
    const iconPath = lookupXdgIconPath(iconIndex, candidates, iconSize, iconScale);
    if (iconPath) {
      entry.iconPath = iconPath;
    }
  }

  if (!options.deferIconDataLoad) {
    await Promise.all(
      results.map(async (entry) => {
        if (!entry.iconPath) return;
        const iconUrl = await loadXdgIconDataUrl(files, entry.iconPath);
        if (iconUrl) {
          entry.iconUrl = iconUrl;
        }
      })
    );
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Matches a Wayland toplevel's `desktopId` (`xdg_toplevel.app_id`) to its
 * installed `.desktop` entry using Desktop File ID, `StartupWMClass`, or
 * primary executable basename.
 */
function matchXdgEntryForWaylandWindow(
  entries: readonly XdgDesktopEntry[],
  waylandDesktopId: string
): XdgDesktopEntry | undefined {
  const raw = waylandDesktopId.trim();
  if (!raw) return undefined;
  const rawLower = raw.toLowerCase();
  const cleanLower = raw.replace(/\.desktop$/i, "").toLowerCase();

  return (
    entries.find(
      (e) =>
        e.desktopId.toLowerCase() === rawLower ||
        e.appId.toLowerCase() === cleanLower
    ) ??
    entries.find((e) => e.startupWMClass?.toLowerCase() === cleanLower) ??
    entries.find((e) => {
      const bin = e.execArgv[0]?.split("/").pop()?.toLowerCase();
      return bin !== undefined && bin === cleanLower;
    })
  );
}

/**
 * Resolves whether a Wayland toplevel draws Client-Side Decorations (CSD) under
 * `"auto"` mode: respects Domicile's `clientFrame` (`xdg-decoration`), XDG
 * `.desktop` metadata (`prefersCsd`), and GNOME/GTK `desktopId` hints since GTK4
 * apps typically render CSD without advertising `xdg-decoration`.
 */
function resolveWaylandClientFrame(
  win: { clientFrame: boolean; desktopId: string },
  xdgMatch?: XdgDesktopEntry
): boolean {
  return Boolean(
    win.clientFrame || xdgMatch?.prefersCsd || hasCsdMetadataHint(win.desktopId)
  );
}

export {
  computeDesktopFileId,
  discoverInstalledXdgApps,
  expandExecArgv,
  isLaunchableDesktopApp,
  matchXdgEntryForWaylandWindow,
  parseDesktopEntry,
  resolveWaylandClientFrame,
  splitXdgList,
  unescapeXdgValue,
};
export type {
  ParseDesktopEntryOptions,
  XdgDesktopAction,
  XdgDesktopEntry,
};

