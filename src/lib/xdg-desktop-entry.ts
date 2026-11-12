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

  const lowerMeta = `${desktopId} ${categories.join(" ")} ${exec ?? ""}`.toLowerCase();
  const prefersCsd =
    lowerMeta.includes("gnome") ||
    lowerMeta.includes("gtk") ||
    lowerMeta.includes("adwaita") ||
    lowerMeta.includes("nautilus") ||
    lowerMeta.includes("loupe") ||
    lowerMeta.includes("evince") ||
    lowerMeta.includes("kgx") ||
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
    onlyShowIn: splitXdgList(main["OnlyShowIn"]),
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
  existingIconIndex?: XdgIconThemeIndex
): Promise<XdgDesktopEntry[]> {
  const seenIds = new Set<string>();
  const results: XdgDesktopEntry[] = [];

  const iconIndexPromise =
    existingIconIndex !== undefined
      ? Promise.resolve(existingIconIndex)
      : buildXdgIconThemeIndex(files, options.iconThemes);

  async function scanDir(baseDir: string, currentDir: string, depth: number) {
    if (depth > 2) return;
    const dirRes = await files.readDir(currentDir);
    const entries = dirRes.match({ Ok: (list) => list, Err: () => [] });

    for (const item of entries) {
      const fullPath = `${currentDir}/${item.name}`;
      if (item.fileType === 1 && !item.name.startsWith(".")) {
        await scanDir(baseDir, fullPath, depth + 1);
        continue;
      }
      if (!item.name.endsWith(".desktop")) continue;

      const desktopId = computeDesktopFileId(fullPath, baseDir);
      if (seenIds.has(desktopId)) continue;

      const textRes = await files.readText(fullPath);
      const text = textRes.match({ Ok: (t) => t, Err: () => undefined });
      if (!text) continue;

      const parsed = parseDesktopEntry(text, {
        ...options,
        filePath: fullPath,
        baseDir,
      });
      if (!parsed) continue;

      seenIds.add(desktopId);
      if (isLaunchableDesktopApp(parsed, options.currentDesktops)) {
        results.push(parsed);
      }
    }
  }

  for (const appDir of XDG_APPLICATION_DIRS) {
    await scanDir(appDir, appDir, 0);
  }

  const iconIndex = await iconIndexPromise;
  const iconSize = options.iconSize ?? 64;
  const iconScale = options.iconScale ?? 1;

  await Promise.all(
    results.map(async (entry) => {
      const candidates = [entry.icon, entry.appId].filter(
        (c): c is string => Boolean(c)
      );
      for (const candidate of candidates) {
        const iconPath = lookupXdgIconPath(iconIndex, candidate, iconSize, iconScale);
        if (iconPath) {
          entry.iconPath = iconPath;
          const iconUrl = await loadXdgIconDataUrl(files, iconPath);
          if (iconUrl) {
            entry.iconUrl = iconUrl;
            break;
          }
        }
      }
    })
  );

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export {
  computeDesktopFileId,
  discoverInstalledXdgApps,
  expandExecArgv,
  isLaunchableDesktopApp,
  parseDesktopEntry,
  splitXdgList,
  unescapeXdgValue,
};
export type {
  ParseDesktopEntryOptions,
  XdgDesktopAction,
  XdgDesktopEntry,
};

