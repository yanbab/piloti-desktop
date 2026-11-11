/**
 * xdg-desktop — Single-file Node / Web / Domicile module implementing:
 *   1. FreeDesktop.org XDG Desktop Entry Specification (v1.5)
 *   2. FreeDesktop.org XDG Icon Theme Specification (v0.13)
 *   3. FreeDesktop.org XDG Base Directory Specification (v0.8)
 *
 * Spec references:
 * - https://specifications.freedesktop.org/desktop-entry-spec/latest/
 * - https://specifications.freedesktop.org/icon-theme-spec/latest/
 * - https://specifications.freedesktop.org/basedir-spec/latest/
 */

export interface XdgDesktopAction {
  /** Action identifier from `Actions=` and `[Desktop Action <id>]`. */
  id: string;
  /** Localized display name of the action. */
  name: string;
  /** Optional icon name or path for the action. */
  icon?: string;
  /** Raw `Exec=` string for the action. */
  exec?: string;
  /** Parsed argv array with XDG field codes expanded/stripped. */
  execArgv: string[];
}

export interface XdgDesktopEntry {
  /**
   * Canonical XDG Desktop File ID (e.g. `org.gnome.Nautilus.desktop` or
   * `kde4-kate.desktop` when nested in a subdirectory).
   */
  desktopId: string;
  /** Base id without the `.desktop` suffix (e.g. `org.gnome.Nautilus`). */
  appId: string;
  /** Absolute or home-relative path to the `.desktop` file. */
  filePath: string;
  /** Entry type (`Application`, `Link`, or `Directory`). */
  type: "Application" | "Link" | "Directory" | string;
  /** Spec version string if present (e.g. `1.0` or `1.5`). */
  version?: string;
  /** Localized application name (`Name`). */
  name: string;
  /** Localized generic name (`GenericName`), e.g. "File Manager". */
  genericName?: string;
  /** Localized description (`Comment`). */
  comment?: string;
  /** Icon name or path (`Icon`). */
  icon?: string;
  /** Resolved filesystem path to the icon file per the XDG Icon Theme Spec. */
  iconPath?: string;
  /** Loaded `data:image/...` URL for rendering the real XDG application icon. */
  iconUrl?: string;
  /** Raw `Exec=` command string. */
  exec?: string;
  /**
   * Tokenized and unescaped `Exec` argv array with XDG field codes (`%U`, `%F`,
   * `%i`, `%c`, `%k`, etc.) expanded per section "The Exec key" of the spec.
   */
  execArgv: string[];
  /** `TryExec=` binary name or path if specified. */
  tryExec?: string;
  /** Working directory (`Path=`) for launching the process. */
  workingDirectory?: string;
  /** Whether the application runs in a terminal (`Terminal=true`). */
  terminal: boolean;
  /** Whether the entry is hidden (`NoDisplay=true`). */
  noDisplay: boolean;
  /** Whether the user deleted/disabled the entry (`Hidden=true`). */
  hidden: boolean;
  /** Startup notification support (`StartupNotify=true`). */
  startupNotify: boolean;
  /** `StartupWMClass` for matching X11/Wayland surfaces. */
  startupWMClass?: string;
  /** Registered XDG categories (`Categories=`). */
  categories: string[];
  /** Primary UI category mapped from XDG categories. */
  primaryCategory:
    | "System"
    | "Development"
    | "Productivity"
    | "Utilities"
    | "Internet"
    | "Media";
  /** Localized search keywords (`Keywords=`). */
  keywords: string[];
  /** Supported MIME types (`MimeType=`). */
  mimeTypes: string[];
  /** Desktop environments where this app should be shown (`OnlyShowIn=`). */
  onlyShowIn: string[];
  /** Desktop environments where this app should be hidden (`NotShowIn=`). */
  notShowIn: string[];
  /** Whether the app uses D-Bus activation (`DBusActivatable=true`). */
  dbusActivatable: boolean;
  /** Whether the app prefers GNOME / GTK / Libadwaita Client-Side Decorations. */
  prefersCsd: boolean;
  /** Additional desktop actions (`[Desktop Action ...]`). */
  actions: XdgDesktopAction[];
  /** Raw group -> key -> value dictionary for custom `X-*` extensions. */
  rawGroups: Record<string, Record<string, string>>;
}

export interface ParseDesktopEntryOptions {
  /** Path where the `.desktop` file resides. */
  filePath?: string;
  /** Root applications directory used to compute the canonical `desktopId`. */
  baseDir?: string;
  /** Preferred locale code (e.g. `"en_US"`, `"fr_FR"`). Defaults to navigator/system locale. */
  locale?: string;
  /** Current desktop names (`$XDG_CURRENT_DESKTOP`) for `OnlyShowIn` / `NotShowIn` checks. */
  currentDesktops?: string[];
  /** Terminal emulator argv prefix when `Terminal=true` (defaults to `["kitty", "-e"]`). */
  terminalExecPrefix?: string[];
  /** Preferred XDG icon themes in priority order (e.g. `["Adwaita", "hicolor"]`). */
  iconThemes?: string[];
  /** Preferred nominal icon size in pixels (defaults to `64`). */
  iconSize?: number;
  /** Preferred display scale factor for icon lookup (defaults to `1`). */
  iconScale?: number;
}

/**
 * Standard XDG Base Directory application search paths in priority order
 * (`$XDG_DATA_HOME/applications` followed by `$XDG_DATA_DIRS/applications`,
 * Flatpak exports, and Snap desktop exports).
 * Note: Relative paths in Domicile start at `$HOME`.
 */
export const XDG_APPLICATION_DIRS: readonly string[] = [
  ".local/share/applications",
  ".local/share/flatpak/exports/share/applications",
  "/var/lib/flatpak/exports/share/applications",
  "/var/lib/snapd/desktop/applications",
  "/usr/local/share/applications",
  "/usr/share/applications",
];

/**
 * Standard XDG Icon Theme base directories in priority order per the
 * FreeDesktop.org Icon Theme Specification (`$HOME/.icons`,
 * `$XDG_DATA_HOME/icons`, Flatpak exports, `$XDG_DATA_DIRS/icons`, and
 * `/usr/share/pixmaps`).
 */
export const XDG_ICON_BASE_DIRS: readonly string[] = [
  ".icons",
  ".local/share/icons",
  ".local/share/flatpak/exports/share/icons",
  "/var/lib/flatpak/exports/share/icons",
  "/usr/local/share/icons",
  "/usr/share/icons",
  "/var/lib/snapd/desktop/icons",
];

export const XDG_PIXMAPS_DIRS: readonly string[] = [
  "/usr/share/pixmaps",
  "/usr/local/share/pixmaps",
];

export type XdgIconThresholdType = "Fixed" | "Scalable" | "Threshold";

export interface XdgIconSubdirDescriptor {
  /** Subdirectory path relative to the theme root (e.g. `scalable/apps` or `48x48/apps`). */
  path: string;
  /** Nominal icon size for this directory (e.g. `48`, `64`, `128`). */
  size: number;
  /** Target display scale for this directory (defaults to `1`). */
  scale: number;
  /** Icon context (e.g. `Applications`, `Actions`, `Places`, `MimeTypes`, `Devices`). */
  context?: string;
  /** Size matching type (`Fixed`, `Scalable`, or `Threshold`). */
  type: XdgIconThresholdType;
  /** Maximum size for `Scalable` directories (defaults to `size`). */
  maxSize: number;
  /** Minimum size for `Scalable` directories (defaults to `size`). */
  minSize: number;
  /** Allowed size deviation for `Threshold` directories (defaults to `2`). */
  threshold: number;
}

export interface XdgIconThemeDescriptor {
  /** Internal directory name of the theme (e.g. `Adwaita`, `hicolor`). */
  id: string;
  /** Display name from `Name=` in `index.theme`. */
  name: string;
  /** Parent themes from `Inherits=` in `index.theme`. */
  inherits: string[];
  /** Subdirectory descriptors parsed from `Directories=` and `ScaledDirectories=`. */
  directories: XdgIconSubdirDescriptor[];
}

export interface XdgIconThemeIndex {
  /** Ordered list of theme IDs searched during lookup (including inherited themes and `hicolor`). */
  themeOrder: string[];
  /** Parsed theme descriptors keyed by theme directory ID. */
  themes: Map<string, XdgIconThemeDescriptor>;
  /**
   * Indexed icon files inside `${baseDir}/${themeId}/${subDir}`:
   * maps `${themeId}::${subDir}` -> Map<iconBaseName, fullFilePath>.
   */
  subdirFiles: Map<string, Map<string, string>>;
  /**
   * Fallback unthemed icons in `/usr/share/pixmaps` and top-level icon roots:
   * maps `iconBaseName` -> `fullFilePath`.
   */
  fallbackFiles: Map<string, string>;
}

/**
 * Unescapes an XDG Desktop Entry `string` or `localestring` value per spec:
 * `\s` -> space, `\n` -> newline, `\t` -> tab, `\r` -> carriage return, `\\` -> backslash.
 */
export function unescapeXdgValue(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[++i];
      switch (next) {
        case "s":
          out += " ";
          break;
        case "n":
          out += "\n";
          break;
        case "t":
          out += "\t";
          break;
        case "r":
          out += "\r";
          break;
        case "\\":
          out += "\\";
          break;
        case ";":
          out += ";";
          break;
        default:
          out += next;
          break;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Splits an XDG semicolon-separated list (`string(s)` / `localestring(s)`)
 * while respecting escaped `\;` delimiters.
 */
export function splitXdgList(raw: string | undefined): string[] {
  if (!raw) return [];
  const items: string[] = [];
  let current = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === ";") {
        current += ";";
        i++;
        continue;
      }
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
  if (trailing.length > 0) {
    items.push(trailing);
  }
  return items;
}

/**
 * Splits a comma- or semicolon-separated list in `index.theme` (`Inherits=`, `Directories=`).
 */
function splitThemeList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Computes candidate locale keys in decreasing specificity per XDG spec section
 * "Localized values for keys":
 * `lang_COUNTRY@MODIFIER`, `lang_COUNTRY`, `lang@MODIFIER`, `lang`.
 */
export function getLocaleFallbacks(locale?: string): string[] {
  const raw = (
    locale ||
    (typeof navigator !== "undefined" ? navigator.language : "en_US") ||
    "en_US"
  ).replace("-", "_");

  const [withoutEncoding] = raw.split(".");
  const [langCountry, modifier] = withoutEncoding.split("@");
  const [lang, country] = langCountry.split("_");

  const candidates: string[] = [];
  if (lang && country && modifier)
    candidates.push(`${lang}_${country}@${modifier}`);
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
  const rawGroups: Record<string, Record<string, string>> = {};
  let currentGroup: string | null = null;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      currentGroup = line.slice(1, -1).trim();
      if (!rawGroups[currentGroup]) {
        rawGroups[currentGroup] = {};
      }
      continue;
    }

    if (!currentGroup) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;

    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    rawGroups[currentGroup][key] = val;
  }
  return rawGroups;
}

/**
 * Tokenizes an XDG `Exec=` string and expands/strips field codes (`%f`, `%F`,
 * `%u`, `%U`, `%i`, `%c`, `%k`, `%%`, etc.) per the XDG Desktop Entry Spec.
 */
export function expandExecArgv(
  execLine: string,
  context: {
    name?: string;
    icon?: string;
    filePath?: string;
    filesOrUrls?: string[];
  } = {}
): string[] {
  const unescaped = unescapeXdgValue(execLine.trim());
  const rawTokens: string[] = [];
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
    } else {
      if (ch === '"') {
        inQuotes = true;
        hasChars = true;
      } else if (ch === "\\" && i + 1 < unescaped.length) {
        current += unescaped[++i];
        hasChars = true;
      } else if (/\s/.test(ch)) {
        if (hasChars) {
          rawTokens.push(current);
          current = "";
          hasChars = false;
        }
      } else {
        current += ch;
        hasChars = true;
      }
    }
  }
  if (hasChars) {
    rawTokens.push(current);
  }

  const argv: string[] = [];
  const targets = context.filesOrUrls ?? [];

  for (const token of rawTokens) {
    if (token === "%F" || token === "%U") {
      if (targets.length > 0) {
        argv.push(...targets);
      }
      continue;
    }
    if (token === "%f" || token === "%u") {
      if (targets[0]) {
        argv.push(targets[0]);
      }
      continue;
    }
    if (token === "%i") {
      if (context.icon) {
        argv.push("--icon", context.icon);
      }
      continue;
    }
    if (/^%[dDnNvm]$/.test(token)) {
      continue;
    }

    let expanded = "";
    let skipToken = false;
    for (let i = 0; i < token.length; i++) {
      const ch = token[i];
      if (ch === "%" && i + 1 < token.length) {
        const code = token[++i];
        switch (code) {
          case "%":
            expanded += "%";
            break;
          case "c":
            expanded += context.name ?? "";
            break;
          case "k":
            expanded += context.filePath ?? "";
            break;
          case "f":
          case "u":
          case "F":
          case "U":
            if (targets[0]) {
              expanded += targets[0];
            } else if (token.length === 2) {
              skipToken = true;
            }
            break;
          case "d":
          case "D":
          case "n":
          case "N":
          case "v":
          case "m":
          case "i":
            break;
          default:
            expanded += `%${code}`;
            break;
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
    if (idx < argv.length) {
      return argv.slice(idx);
    }
  }

  return argv;
}

/**
 * Computes the canonical XDG Desktop File ID from a file path and its base
 * applications directory (replacing subdirectory `/` with `-` per spec).
 */
export function computeDesktopFileId(
  filePath: string,
  baseDir?: string
): string {
  if (baseDir && filePath.startsWith(baseDir)) {
    const rel = filePath.slice(baseDir.length).replace(/^\/+/, "");
    return rel.replace(/\//g, "-");
  }
  const parts = filePath.split("/");
  return parts[parts.length - 1] || "app.desktop";
}

function mapPrimaryCategory(
  categories: string[]
): XdgDesktopEntry["primaryCategory"] {
  const joined = categories.join(" ").toLowerCase();
  if (joined.includes("development") || joined.includes("ide")) {
    return "Development";
  }
  if (joined.includes("network") || joined.includes("webbrowser")) {
    return "Internet";
  }
  if (
    joined.includes("audio") ||
    joined.includes("video") ||
    joined.includes("graphics")
  ) {
    return "Media";
  }
  if (joined.includes("office") || joined.includes("texteditor")) {
    return "Productivity";
  }
  if (
    joined.includes("system") ||
    joined.includes("settings") ||
    joined.includes("monitor")
  ) {
    return "System";
  }
  return "Utilities";
}

/**
 * Parses the contents of a `.desktop` file according to the FreeDesktop.org
 * XDG Desktop Entry Specification (v1.5).
 */
export function parseDesktopEntry(
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

  const genericName = getLocalizedKey(main, "GenericName", localeFallbacks);
  const comment = getLocalizedKey(main, "Comment", localeFallbacks);
  const icon = main["Icon"] ? unescapeXdgValue(main["Icon"]) : undefined;
  const exec = main["Exec"];
  const tryExec = main["TryExec"]
    ? unescapeXdgValue(main["TryExec"])
    : undefined;
  const workingDirectory = main["Path"]
    ? unescapeXdgValue(main["Path"])
    : undefined;
  const terminal = parseXdgBoolean(main["Terminal"]);
  const noDisplay = parseXdgBoolean(main["NoDisplay"]);
  const hidden = parseXdgBoolean(main["Hidden"]);
  const startupNotify = parseXdgBoolean(main["StartupNotify"]);
  const startupWMClass = main["StartupWMClass"]
    ? unescapeXdgValue(main["StartupWMClass"])
    : undefined;
  const dbusActivatable = parseXdgBoolean(main["DBusActivatable"]);

  const categories = splitXdgList(main["Categories"]);
  const keywords = splitXdgList(
    getLocalizedKey(main, "Keywords", localeFallbacks) ?? main["Keywords"]
  );
  const mimeTypes = splitXdgList(main["MimeType"]);
  const onlyShowIn = splitXdgList(main["OnlyShowIn"]);
  const notShowIn = splitXdgList(main["NotShowIn"]);

  const filePath = options.filePath ?? "application.desktop";
  const desktopId = computeDesktopFileId(filePath, options.baseDir);
  const appId = desktopId.replace(/\.desktop$/i, "");

  let execArgv = exec ? expandExecArgv(exec, { name, icon, filePath }) : [];
  if (terminal && execArgv.length > 0) {
    const prefix = options.terminalExecPrefix ?? ["kitty", "-e"];
    execArgv = [...prefix, ...execArgv];
  }

  const actionIds = splitXdgList(main["Actions"]);
  const actions: XdgDesktopAction[] = [];
  for (const actId of actionIds) {
    const actGroup = rawGroups[`Desktop Action ${actId}`];
    if (!actGroup) continue;
    const actName = getLocalizedKey(actGroup, "Name", localeFallbacks);
    if (!actName) continue;
    const actIcon = actGroup["Icon"]
      ? unescapeXdgValue(actGroup["Icon"])
      : icon;
    const actExec = actGroup["Exec"];
    const actArgv = actExec
      ? expandExecArgv(actExec, { name: actName, icon: actIcon, filePath })
      : [];
    actions.push({
      id: actId,
      name: actName,
      icon: actIcon,
      exec: actExec,
      execArgv: actArgv,
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
    genericName,
    comment,
    icon,
    exec,
    execArgv,
    tryExec,
    workingDirectory,
    terminal,
    noDisplay,
    hidden,
    startupNotify,
    startupWMClass,
    categories,
    primaryCategory: mapPrimaryCategory(categories),
    keywords,
    mimeTypes,
    onlyShowIn,
    notShowIn,
    dbusActivatable,
    prefersCsd,
    actions,
    rawGroups,
  };
}

/**
 * Determines whether a parsed `XdgDesktopEntry` should be visible in an
 * application launcher / command palette according to the XDG spec.
 */
export function isLaunchableDesktopApp(
  entry: XdgDesktopEntry,
  currentDesktops: string[] = ["Piloti", "Domicile", "GNOME"]
): boolean {
  if (entry.type !== "Application") return false;
  if (entry.hidden || entry.noDisplay) return false;
  if (entry.execArgv.length === 0) return false;

  if (entry.onlyShowIn.length > 0) {
    const allowed = entry.onlyShowIn.some((d) =>
      currentDesktops.some((cd) => cd.toLowerCase() === d.toLowerCase())
    );
    if (!allowed) return false;
  }

  if (entry.notShowIn.length > 0) {
    const excluded = entry.notShowIn.some((d) =>
      currentDesktops.some((cd) => cd.toLowerCase() === d.toLowerCase())
    );
    if (excluded) return false;
  }

  return true;
}

/**
 * Maps an XDG icon name or category to one of Piloti's fallback squircle icon
 * identifiers and gradient palettes.
 */
export function resolveXdgVisualStyle(entry: XdgDesktopEntry): {
  iconName:
    | "settings"
    | "terminal"
    | "folder"
    | "globe"
    | "notes"
    | "activity"
    | "code"
    | "sparkles";
  gradient: string;
} {
  const lower = `${entry.desktopId} ${entry.icon ?? ""} ${entry.categories.join(" ")}`.toLowerCase();

  if (
    lower.includes("terminal") ||
    lower.includes("console") ||
    lower.includes("kitty") ||
    lower.includes("alacritty")
  ) {
    return {
      iconName: "terminal",
      gradient: "from-zinc-700 via-zinc-800 to-zinc-950",
    };
  }
  if (
    lower.includes("nautilus") ||
    lower.includes("folder") ||
    lower.includes("filemanager") ||
    lower.includes("baobab")
  ) {
    return {
      iconName: "folder",
      gradient: "from-sky-400 via-blue-500 to-blue-600",
    };
  }
  if (
    lower.includes("browser") ||
    lower.includes("firefox") ||
    lower.includes("chromium") ||
    lower.includes("epiphany") ||
    lower.includes("web")
  ) {
    return {
      iconName: "globe",
      gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    };
  }
  if (
    lower.includes("code") ||
    lower.includes("builder") ||
    lower.includes("development") ||
    lower.includes("ide")
  ) {
    return {
      iconName: "code",
      gradient: "from-blue-500 via-indigo-500 to-purple-600",
    };
  }
  if (
    lower.includes("texteditor") ||
    lower.includes("gedit") ||
    lower.includes("notes") ||
    lower.includes("evince") ||
    lower.includes("office")
  ) {
    return {
      iconName: "notes",
      gradient: "from-amber-400 via-orange-500 to-amber-600",
    };
  }
  if (
    lower.includes("monitor") ||
    lower.includes("htop") ||
    lower.includes("system")
  ) {
    return {
      iconName: "activity",
      gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    };
  }
  if (
    lower.includes("settings") ||
    lower.includes("controlcenter") ||
    lower.includes("tweaks") ||
    lower.includes("dconf")
  ) {
    return {
      iconName: "settings",
      gradient: "from-slate-400 via-slate-600 to-zinc-800",
    };
  }
  return {
    iconName: "sparkles",
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
  };
}

// ============================================================================
// FreeDesktop.org XDG Icon Theme Specification Implementation
// ============================================================================

/**
 * Fallback subdirectory layout for `hicolor` / `Adwaita` when `index.theme` is
 * missing or when packages install icons into standard Freedesktop subdirectories
 * not explicitly listed in `index.theme`.
 */
const DEFAULT_ICON_SUBDIRS: readonly XdgIconSubdirDescriptor[] = [
  {
    path: "scalable/apps",
    size: 128,
    scale: 1,
    context: "Applications",
    type: "Scalable",
    minSize: 16,
    maxSize: 512,
    threshold: 2,
  },
  {
    path: "256x256/apps",
    size: 256,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 256,
    maxSize: 256,
    threshold: 2,
  },
  {
    path: "128x128/apps",
    size: 128,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 128,
    maxSize: 128,
    threshold: 2,
  },
  {
    path: "96x96/apps",
    size: 96,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 96,
    maxSize: 96,
    threshold: 2,
  },
  {
    path: "64x64/apps",
    size: 64,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 64,
    maxSize: 64,
    threshold: 2,
  },
  {
    path: "48x48/apps",
    size: 48,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 48,
    maxSize: 48,
    threshold: 2,
  },
  {
    path: "32x32/apps",
    size: 32,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 32,
    maxSize: 32,
    threshold: 2,
  },
  {
    path: "24x24/apps",
    size: 24,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 24,
    maxSize: 24,
    threshold: 2,
  },
  {
    path: "16x16/apps",
    size: 16,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: 16,
    maxSize: 16,
    threshold: 2,
  },
  {
    path: "scalable/places",
    size: 128,
    scale: 1,
    context: "Places",
    type: "Scalable",
    minSize: 16,
    maxSize: 512,
    threshold: 2,
  },
  {
    path: "scalable/categories",
    size: 128,
    scale: 1,
    context: "Categories",
    type: "Scalable",
    minSize: 16,
    maxSize: 512,
    threshold: 2,
  },
  {
    path: "scalable/devices",
    size: 128,
    scale: 1,
    context: "Devices",
    type: "Scalable",
    minSize: 16,
    maxSize: 512,
    threshold: 2,
  },
  {
    path: "scalable/mimetypes",
    size: 128,
    scale: 1,
    context: "MimeTypes",
    type: "Scalable",
    minSize: 16,
    maxSize: 512,
    threshold: 2,
  },
  {
    path: "symbolic/apps",
    size: 16,
    scale: 1,
    context: "Applications",
    type: "Scalable",
    minSize: 8,
    maxSize: 512,
    threshold: 2,
  },
];

/**
 * Parses an XDG `index.theme` file per the FreeDesktop.org Icon Theme Spec.
 */
export function parseIconThemeIndex(
  content: string,
  themeId: string
): XdgIconThemeDescriptor | null {
  const groups = parseIniGroups(content);
  const header = groups["Icon Theme"];
  if (!header) return null;

  const name = header["Name"] ?? themeId;
  const inherits = splitThemeList(header["Inherits"]);
  if (themeId !== "hicolor" && !inherits.includes("hicolor")) {
    inherits.push("hicolor");
  }

  const dirNames = [
    ...splitThemeList(header["Directories"]),
    ...splitThemeList(header["ScaledDirectories"]),
  ];

  const directories: XdgIconSubdirDescriptor[] = [];
  const seenPaths = new Set<string>();

  for (const dirPath of dirNames) {
    if (seenPaths.has(dirPath)) continue;
    const sec = groups[dirPath];
    if (!sec) continue;
    const size = Number.parseInt(sec["Size"] ?? "", 10);
    if (!Number.isFinite(size) || size <= 0) continue;

    const scale = Number.parseInt(sec["Scale"] ?? "1", 10) || 1;
    const rawType = (sec["Type"] ?? "Threshold").trim();
    const type: XdgIconThresholdType =
      rawType === "Fixed" || rawType === "Scalable" || rawType === "Threshold"
        ? rawType
        : "Threshold";
    const maxSize = Number.parseInt(sec["MaxSize"] ?? String(size), 10) || size;
    const minSize = Number.parseInt(sec["MinSize"] ?? String(size), 10) || size;
    const threshold = Number.parseInt(sec["Threshold"] ?? "2", 10) || 2;

    seenPaths.add(dirPath);
    directories.push({
      path: dirPath,
      size,
      scale,
      context: sec["Context"],
      type,
      maxSize,
      minSize,
      threshold,
    });
  }

  // Ensure standard Freedesktop app/place/category subdirectories are also registered
  for (const fallback of DEFAULT_ICON_SUBDIRS) {
    if (!seenPaths.has(fallback.path)) {
      seenPaths.add(fallback.path);
      directories.push(fallback);
    }
  }

  return {
    id: themeId,
    name,
    inherits,
    directories,
  };
}

/**
 * Implements `DirectoryMatchesSize(subdir, iconsize, iconscale)` from the
 * FreeDesktop.org XDG Icon Theme Specification.
 */
export function directoryMatchesSize(
  subdir: XdgIconSubdirDescriptor,
  iconSize: number,
  iconScale = 1
): boolean {
  if (subdir.scale !== iconScale) return false;
  if (subdir.type === "Fixed") {
    return subdir.size === iconSize;
  }
  if (subdir.type === "Scalable") {
    return subdir.minSize <= iconSize && iconSize <= subdir.maxSize;
  }
  return (
    subdir.size - subdir.threshold <= iconSize &&
    iconSize <= subdir.size + subdir.threshold
  );
}

/**
 * Implements `DirectorySizeDistance(subdir, iconsize, iconscale)` from the
 * FreeDesktop.org XDG Icon Theme Specification.
 */
export function directorySizeDistance(
  subdir: XdgIconSubdirDescriptor,
  iconSize: number,
  iconScale = 1
): number {
  const targetScaled = iconSize * iconScale;
  if (subdir.type === "Fixed") {
    return Math.abs(subdir.size * subdir.scale - targetScaled);
  }
  if (subdir.type === "Scalable") {
    if (targetScaled < subdir.minSize * subdir.scale) {
      return subdir.minSize * subdir.scale - targetScaled;
    }
    if (targetScaled > subdir.maxSize * subdir.scale) {
      return targetScaled - subdir.maxSize * subdir.scale;
    }
    return 0;
  }
  if (targetScaled < (subdir.size - subdir.threshold) * subdir.scale) {
    return subdir.minSize * subdir.scale - targetScaled;
  }
  if (targetScaled > (subdir.size + subdir.threshold) * subdir.scale) {
    return targetScaled - subdir.maxSize * subdir.scale;
  }
  return 0;
}

/** Minimal interface matching `domicile.files` from `@domicile-desktop/sdk`. */
export interface XdgFileReader {
  readDir: (
    path: string
  ) => Promise<{
    match: <U>(m: {
      Ok: (entries: { name: string; fileType: number }[]) => U;
      Err: () => U;
    }) => U;
  }>;
  readText: (
    path: string
  ) => Promise<{
    match: <U>(m: { Ok: (text: string) => U; Err: () => U }) => U;
  }>;
  read?: (
    path: string
  ) => Promise<{
    match: <U>(m: { Ok: (bytes: Uint8Array) => U; Err: () => U }) => U;
  }>;
}

function isRelevantIconSubdir(subdir: XdgIconSubdirDescriptor): boolean {
  const lowerPath = subdir.path.toLowerCase();
  const lowerCtx = (subdir.context ?? "").toLowerCase();
  // Skip cursor/animation/emblem/intl directories when indexing app icons
  if (
    lowerPath.includes("cursors") ||
    lowerPath.includes("animations") ||
    lowerPath.includes("emblems") ||
    lowerPath.includes("intl")
  ) {
    return false;
  }
  // Prefer full-color / scalable / >= 24px or symbolic app/place/category/device/mimetype icons
  return (
    lowerPath.includes("apps") ||
    lowerPath.includes("places") ||
    lowerPath.includes("categories") ||
    lowerPath.includes("devices") ||
    lowerPath.includes("mimetypes") ||
    lowerPath.includes("status") ||
    lowerPath.includes("legacy") ||
    lowerCtx.includes("application") ||
    lowerCtx.includes("place") ||
    lowerCtx.includes("category") ||
    lowerCtx.includes("device")
  );
}

function iconExtensionPriority(filename: string): number {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".svg")) return 3;
  if (lower.endsWith(".png")) return 2;
  if (lower.endsWith(".xpm")) return 1;
  return 0;
}

function stripIconExtension(filename: string): string {
  return filename.replace(/\.(svg|png|xpm)$/i, "");
}

/**
 * Builds an in-memory `XdgIconThemeIndex` by parsing `index.theme` files and
 * indexing icon directories across all XDG icon base paths in parallel.
 */
export async function buildXdgIconThemeIndex(
  files: XdgFileReader,
  preferredThemes: string[] = ["Adwaita", "hicolor"]
): Promise<XdgIconThemeIndex> {
  const themes = new Map<string, XdgIconThemeDescriptor>();
  const subdirFiles = new Map<string, Map<string, string>>();
  const fallbackFiles = new Map<string, string>();
  const themeOrder: string[] = [];
  const visitedThemes = new Set<string>();

  // 1. Discover which baseDir + theme directories actually exist on disk
  const baseDirEntries = new Map<string, Set<string>>();
  await Promise.all(
    XDG_ICON_BASE_DIRS.map(async (baseDir) => {
      const res = await files.readDir(baseDir);
      const list = res.match({
        Ok: (entries) => entries,
        Err: () => [],
      });
      if (list.length === 0) return;
      const names = new Set<string>();
      for (const entry of list) {
        // Directory (1) or Symlink (2)
        if (entry.fileType === 1 || entry.fileType === 2) {
          names.add(entry.name);
        } else if (iconExtensionPriority(entry.name) > 0) {
          const baseName = stripIconExtension(entry.name);
          if (!fallbackFiles.has(baseName)) {
            fallbackFiles.set(baseName, `${baseDir}/${entry.name}`);
          }
        }
      }
      baseDirEntries.set(baseDir, names);
    })
  );

  // 2. Index `/usr/share/pixmaps` fallback icons in parallel
  await Promise.all(
    XDG_PIXMAPS_DIRS.map(async (pixDir) => {
      const res = await files.readDir(pixDir);
      const list = res.match({
        Ok: (entries) => entries,
        Err: () => [],
      });
      for (const entry of list) {
        if (entry.fileType === 1) continue;
        const prio = iconExtensionPriority(entry.name);
        if (prio === 0) continue;
        const baseName = stripIconExtension(entry.name);
        const existing = fallbackFiles.get(baseName);
        if (!existing || prio > iconExtensionPriority(existing)) {
          fallbackFiles.set(baseName, `${pixDir}/${entry.name}`);
        }
      }
    })
  );

  // 3. Resolve theme inheritance graph starting from preferredThemes -> Adwaita -> hicolor
  const queue = [
    ...preferredThemes,
    "Adwaita",
    "Papirus",
    "breeze",
    "Yaru",
    "gnome",
    "hicolor",
  ];

  while (queue.length > 0) {
    const themeId = queue.shift()!;
    if (!themeId || visitedThemes.has(themeId)) continue;
    visitedThemes.add(themeId);

    // Check if any baseDir has this theme directory
    const matchingBaseDirs = XDG_ICON_BASE_DIRS.filter((bd) =>
      baseDirEntries.get(bd)?.has(themeId)
    );
    if (matchingBaseDirs.length === 0 && themeId !== "hicolor" && themeId !== "Adwaita") {
      continue;
    }

    let descriptor: XdgIconThemeDescriptor | null = null;
    for (const baseDir of matchingBaseDirs) {
      const indexRes = await files.readText(`${baseDir}/${themeId}/index.theme`);
      const text = indexRes.match({
        Ok: (t) => t,
        Err: () => undefined,
      });
      if (text) {
        descriptor = parseIconThemeIndex(text, themeId);
        if (descriptor) break;
      }
    }

    if (!descriptor) {
      descriptor = {
        id: themeId,
        name: themeId,
        inherits: themeId === "hicolor" ? [] : ["hicolor"],
        directories: [...DEFAULT_ICON_SUBDIRS],
      };
    }

    themes.set(themeId, descriptor);
    themeOrder.push(themeId);

    for (const parent of descriptor.inherits) {
      if (!visitedThemes.has(parent)) {
        queue.unshift(parent);
      }
    }
  }

  // 4. Read all relevant icon subdirectories across existing `(baseDir, themeId)` pairs in parallel
  const readTasks: Promise<void>[] = [];
  for (const themeId of themeOrder) {
    const descriptor = themes.get(themeId);
    if (!descriptor) continue;
    const matchingBaseDirs = XDG_ICON_BASE_DIRS.filter((bd) =>
      baseDirEntries.get(bd)?.has(themeId)
    );
    if (matchingBaseDirs.length === 0) continue;

    const relevantSubdirs = descriptor.directories.filter(isRelevantIconSubdir);

    for (const subdir of relevantSubdirs) {
      const mapKey = `${themeId}::${subdir.path}`;
      let fileMap = subdirFiles.get(mapKey);
      if (!fileMap) {
        fileMap = new Map<string, string>();
        subdirFiles.set(mapKey, fileMap);
      }
      const targetMap = fileMap;

      for (const baseDir of matchingBaseDirs) {
        const fullSubdirPath = `${baseDir}/${themeId}/${subdir.path}`;
        readTasks.push(
          files.readDir(fullSubdirPath).then((res) => {
            const entries = res.match({
              Ok: (list) => list,
              Err: () => [],
            });
            for (const entry of entries) {
              if (entry.fileType === 1) continue;
              const prio = iconExtensionPriority(entry.name);
              if (prio === 0) continue;
              const baseName = stripIconExtension(entry.name);
              const existing = targetMap.get(baseName);
              if (!existing || prio > iconExtensionPriority(existing)) {
                targetMap.set(baseName, `${fullSubdirPath}/${entry.name}`);
              }
            }
          })
        );
      }
    }
  }

  await Promise.all(readTasks);

  return {
    themeOrder,
    themes,
    subdirFiles,
    fallbackFiles,
  };
}

function lookupSingleIconInTheme(
  index: XdgIconThemeIndex,
  themeId: string,
  iconName: string,
  size: number,
  scale: number
): string | undefined {
  const theme = index.themes.get(themeId);
  if (!theme) return undefined;

  let bestSymbolicFallback: string | undefined;
  let closestPath: string | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  // Pass 1: Exact or scalable match (`DirectoryMatchesSize`), preferring non-symbolic full-color icons
  for (const subdir of theme.directories) {
    const filesInSubdir = index.subdirFiles.get(`${themeId}::${subdir.path}`);
    if (!filesInSubdir || filesInSubdir.size === 0) continue;

    const found = filesInSubdir.get(iconName);
    if (!found) continue;

    const isSymbolicDir = subdir.path.includes("symbolic") || iconName.endsWith("-symbolic");
    if (directoryMatchesSize(subdir, size, scale)) {
      if (!isSymbolicDir) {
        return found;
      }
      bestSymbolicFallback ??= found;
    }

    const dist = directorySizeDistance(subdir, size, scale);
    // Prefer scalable or larger icons over upscaling tiny 16x16 icons
    const penalty = subdir.size < size && subdir.type !== "Scalable" ? 500 : 0;
    const totalDist = dist + penalty + (isSymbolicDir ? 1000 : 0);
    if (totalDist < closestDistance) {
      closestDistance = totalDist;
      closestPath = found;
    }
  }

  return closestPath ?? bestSymbolicFallback;
}

/**
 * Looks up an icon's filesystem path using the FreeDesktop.org XDG Icon Theme
 * Specification (`FindIcon` / `LookupIcon` / `LookupFallbackIcon`).
 */
export function lookupXdgIconPath(
  index: XdgIconThemeIndex,
  rawIconName: string | undefined,
  size = 64,
  scale = 1
): string | undefined {
  if (!rawIconName) return undefined;
  const trimmed = rawIconName.trim();
  if (!trimmed) return undefined;

  // 1. Direct path (`Icon=/path/to/icon.svg` or `.png`)
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  // Strip extension if a `.desktop` file specified e.g. `Icon=firefox.png`
  const baseIcon = stripIconExtension(trimmed);

  // Build candidate icon names in priority order:
  // exact name -> lowercase name -> reverse-DNS last segment (e.g. `org.gnome.Nautilus` -> `nautilus`) -> symbolic fallback
  const candidateNames: string[] = [baseIcon];
  if (baseIcon.toLowerCase() !== baseIcon) {
    candidateNames.push(baseIcon.toLowerCase());
  }
  if (baseIcon.includes(".")) {
    const lastSegment = baseIcon.split(".").pop()!;
    if (lastSegment) {
      candidateNames.push(lastSegment, `gnome-${lastSegment.toLowerCase()}`, lastSegment.toLowerCase());
    }
  }

  // 2. Search across all themes in inheritance order for full-color icons first
  for (const name of candidateNames) {
    for (const themeId of index.themeOrder) {
      const hit = lookupSingleIconInTheme(index, themeId, name, size, scale);
      if (hit && !hit.includes("/symbolic/") && !hit.endsWith("-symbolic.svg")) {
        return hit;
      }
    }
    // Check `/usr/share/pixmaps` fallback
    const pixmapHit = index.fallbackFiles.get(name);
    if (pixmapHit) return pixmapHit;
  }

  // 3. Fallback to symbolic icons (`<name>-symbolic`) if no full-color icon exists
  for (const name of [...candidateNames, `${baseIcon}-symbolic`]) {
    for (const themeId of index.themeOrder) {
      const hit = lookupSingleIconInTheme(index, themeId, name, size, scale);
      if (hit) return hit;
    }
  }

  return undefined;
}

const iconDataUrlCache = new Map<string, Promise<string | undefined>>();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

/**
 * Reads an icon file (`.svg` or `.png`) via `domicile.files` and encodes it as
 * a cached `data:image/...;base64,...` URL suitable for `<img src={...} />`.
 */
export function loadXdgIconDataUrl(
  files: XdgFileReader,
  iconPath: string
): Promise<string | undefined> {
  const cached = iconDataUrlCache.get(iconPath);
  if (cached) return cached;

  const promise = (async (): Promise<string | undefined> => {
    const lower = iconPath.toLowerCase();
    const mime = lower.endsWith(".svg")
      ? "image/svg+xml"
      : lower.endsWith(".png")
        ? "image/png"
        : undefined;
    if (!mime) return undefined;

    if (files.read) {
      const res = await files.read(iconPath);
      const bytes = res.match({
        Ok: (b) => b,
        Err: () => undefined,
      });
      if (bytes && bytes.length > 0) {
        return `data:${mime};base64,${bytesToBase64(bytes)}`;
      }
    }

    if (lower.endsWith(".svg")) {
      const textRes = await files.readText(iconPath);
      const text = textRes.match({
        Ok: (t) => t,
        Err: () => undefined,
      });
      if (text) {
        const bytes = new TextEncoder().encode(text);
        return `data:image/svg+xml;base64,${bytesToBase64(bytes)}`;
      }
    }

    return undefined;
  })();

  iconDataUrlCache.set(iconPath, promise);
  return promise;
}

/**
 * Resolves the first matching icon name from `iconNameOrCandidates` using the
 * XDG Icon Theme Index and returns its loaded `data:` URL.
 */
export async function resolveXdgIconUrl(
  files: XdgFileReader,
  index: XdgIconThemeIndex,
  iconNameOrCandidates: string | readonly string[] | undefined,
  size = 64,
  scale = 1
): Promise<string | undefined> {
  if (!iconNameOrCandidates) return undefined;
  const list =
    typeof iconNameOrCandidates === "string"
      ? [iconNameOrCandidates]
      : iconNameOrCandidates;

  for (const candidate of list) {
    const path = lookupXdgIconPath(index, candidate, size, scale);
    if (path) {
      const url = await loadXdgIconDataUrl(files, path);
      if (url) return url;
    }
  }
  return undefined;
}

/**
 * Scans all XDG application directories in precedence order, parses `.desktop`
 * files, applies Desktop File ID override/masking rules, resolves each app's
 * icon through the XDG Icon Theme Specification, and returns all launchable
 * installed applications sorted alphabetically by localized `Name`.
 */
export async function discoverInstalledXdgApps(
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
    const entries = dirRes.match({
      Ok: (list) => list,
      Err: () => [],
    });

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
      const text = textRes.match({
        Ok: (t) => t,
        Err: () => undefined,
      });
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
