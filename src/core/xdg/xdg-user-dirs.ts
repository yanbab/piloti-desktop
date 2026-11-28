import type { XdgFileReader } from "./xdg-basedir";

/**
 * FreeDesktop.org XDG User Directories (`~/.config/user-dirs.dirs`).
 * https://www.freedesktop.org/wiki/Software/xdg-user-dirs/
 */

export type XdgUserDirKey =
  | "HOME"
  | "DESKTOP"
  | "DOCUMENTS"
  | "DOWNLOAD"
  | "MUSIC"
  | "PICTURES"
  | "VIDEOS"
  | "PUBLICSHARE"
  | "TEMPLATES";

export interface XdgUserDir {
  key: XdgUserDirKey;
  /** Localized folder name shown in launchers (falls back to English default). */
  name: string;
  /** Human-readable path such as `~`, `~/Downloads`, or `/data/Music`. */
  displayPath: string;
  /** Path relative to `$HOME` (`""` for `$HOME` itself), when under `$HOME`. */
  relativeHomePath?: string;
  /** Explicit absolute path when configured outside `$HOME`. */
  absolutePath?: string;
  /** Ordered XDG icon name candidates to look up in the active icon theme. */
  iconCandidates: readonly string[];
  /** Search keywords (English default + env variable name). */
  keywords: readonly string[];
}

export interface DefaultUserDirSpec {
  key: Exclude<XdgUserDirKey, "HOME">;
  defaultName: string;
  defaultRelativePath: string;
  iconCandidates: readonly string[];
  keywords: readonly string[];
}

export const DEFAULT_USER_DIR_SPECS: readonly DefaultUserDirSpec[] = [
  {
    key: "DESKTOP",
    defaultName: "Desktop",
    defaultRelativePath: "Desktop",
    iconCandidates: ["user-desktop", "desktop", "folder-desktop", "folder"],
    keywords: ["desktop", "bureau", "xdg_desktop_dir"],
  },
  {
    key: "DOCUMENTS",
    defaultName: "Documents",
    defaultRelativePath: "Documents",
    iconCandidates: ["folder-documents", "user-documents", "folder"],
    keywords: ["documents", "docs", "xdg_documents_dir"],
  },
  {
    key: "DOWNLOAD",
    defaultName: "Downloads",
    defaultRelativePath: "Downloads",
    iconCandidates: [
      "folder-download",
      "folder-downloads",
      "user-download",
      "folder",
    ],
    keywords: ["downloads", "download", "telechargements", "xdg_download_dir"],
  },
  {
    key: "MUSIC",
    defaultName: "Music",
    defaultRelativePath: "Music",
    iconCandidates: ["folder-music", "user-music", "folder"],
    keywords: ["music", "audio", "musique", "xdg_music_dir"],
  },
  {
    key: "PICTURES",
    defaultName: "Pictures",
    defaultRelativePath: "Pictures",
    iconCandidates: ["folder-pictures", "user-pictures", "folder"],
    keywords: ["pictures", "photos", "images", "xdg_pictures_dir"],
  },
  {
    key: "VIDEOS",
    defaultName: "Videos",
    defaultRelativePath: "Videos",
    iconCandidates: ["folder-videos", "user-videos", "folder"],
    keywords: ["videos", "movies", "films", "xdg_videos_dir"],
  },
  {
    key: "PUBLICSHARE",
    defaultName: "Public",
    defaultRelativePath: "Public",
    iconCandidates: ["folder-publicshare", "folder"],
    keywords: ["public", "share", "xdg_publicshare_dir"],
  },
  {
    key: "TEMPLATES",
    defaultName: "Templates",
    defaultRelativePath: "Templates",
    iconCandidates: ["folder-templates", "folder"],
    keywords: ["templates", "modeles", "xdg_templates_dir"],
  },
];

const USER_DIR_SPEC_BY_KEY = new Map<string, DefaultUserDirSpec>(
  DEFAULT_USER_DIR_SPECS.map((spec) => [spec.key, spec])
);

function unquoteShellValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = trimmed.slice(1, -1);
      if (first === "'") return inner;
      return inner.replace(/\\(["\\$])/g, "$1");
    }
  }
  return trimmed;
}

/**
 * Parses `~/.config/user-dirs.dirs` assignments (`XDG_<KEY>_DIR="..."`).
 */
export function parseXdgUserDirs(
  content: string
): Partial<Record<Exclude<XdgUserDirKey, "HOME">, string>> {
  const result: Partial<Record<Exclude<XdgUserDirKey, "HOME">, string>> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;

    const varName = line.slice(0, eqIdx).trim();
    const match = /^XDG_([A-Z]+)_DIR$/.exec(varName);
    if (!match) continue;

    const key = match[1];
    if (!USER_DIR_SPEC_BY_KEY.has(key)) continue;

    const value = unquoteShellValue(line.slice(eqIdx + 1)).replace(/\/+$/, "");
    if (value) {
      result[key as Exclude<XdgUserDirKey, "HOME">] = value;
    }
  }

  return result;
}

function resolveUserDirEntry(
  spec: DefaultUserDirSpec,
  rawTemplate: string | undefined
): XdgUserDir {
  const raw = rawTemplate ?? `$HOME/${spec.defaultRelativePath}`;

  if (raw === "$HOME" || raw === "${HOME}" || raw === "~") {
    return {
      key: spec.key,
      name: spec.defaultName,
      displayPath: "~",
      relativeHomePath: "",
      iconCandidates: spec.iconCandidates,
      keywords: spec.keywords,
    };
  }

  let relativeHomePath: string | undefined;
  let absolutePath: string | undefined;
  let displayPath = raw;

  if (raw.startsWith("$HOME/")) {
    relativeHomePath = raw.slice("$HOME/".length);
    displayPath = `~/${relativeHomePath}`;
  } else if (raw.startsWith("${HOME}/")) {
    relativeHomePath = raw.slice("${HOME}/".length);
    displayPath = `~/${relativeHomePath}`;
  } else if (raw.startsWith("~/")) {
    relativeHomePath = raw.slice(2);
    displayPath = raw;
  } else if (raw.startsWith("/")) {
    absolutePath = raw;
    displayPath = raw;
  } else {
    relativeHomePath = raw;
    displayPath = `~/${raw}`;
  }

  const baseName = displayPath.split("/").filter(Boolean).pop();
  const name = baseName && baseName !== "~" ? baseName : spec.defaultName;

  return {
    key: spec.key,
    name,
    displayPath,
    relativeHomePath,
    absolutePath,
    iconCandidates: spec.iconCandidates,
    keywords: Array.from(
      new Set([spec.defaultName.toLowerCase(), name.toLowerCase(), ...spec.keywords])
    ),
  };
}

/**
 * Returns the default ordered list of XDG user folders (`HOME` + standard XDG user dirs),
 * applying overrides parsed from `~/.config/user-dirs.dirs` when available.
 */
export function buildXdgUserDirList(
  parsedOverrides: Partial<Record<Exclude<XdgUserDirKey, "HOME">, string>> = {}
): XdgUserDir[] {
  const homeEntry: XdgUserDir = {
    key: "HOME",
    name: "Home",
    displayPath: "~",
    relativeHomePath: "",
    iconCandidates: ["user-home", "folder-home", "go-home", "folder"],
    keywords: ["home", "dossier personnel", "accueil", "folder"],
  };

  return [
    homeEntry,
    ...DEFAULT_USER_DIR_SPECS.map((spec) =>
      resolveUserDirEntry(spec, parsedOverrides[spec.key])
    ),
  ];
}

/**
 * Discovers configured XDG user folders from `~/.config/user-dirs.dirs`.
 */
export async function discoverXdgUserDirs(
  files: Pick<XdgFileReader, "readText">,
  configPath = ".config/user-dirs.dirs"
): Promise<XdgUserDir[]> {
  try {
    const res = await files.readText(configPath);
    const content = res.match({ Ok: (t) => t, Err: () => undefined });
    if (!content) {
      return buildXdgUserDirList();
    }
    return buildXdgUserDirList(parseXdgUserDirs(content));
  } catch {
    return buildXdgUserDirList();
  }
}

/**
 * Builds an argv invocation to open an XDG folder in Nautilus (`$HOME` expanded safely).
 */
export function buildOpenXdgFolderArgv(
  folder: XdgUserDir,
  virtualHome: boolean
): string[] {
  if (virtualHome) {
    return ["nautilus", "--new-window", folder.displayPath];
  }
  if (folder.absolutePath) {
    return ["nautilus", "--new-window", folder.absolutePath];
  }
  const rel = folder.relativeHomePath ?? "";
  if (!rel) {
    return ["sh", "-c", 'exec nautilus --new-window "$HOME"'];
  }
  return [
    "sh",
    "-c",
    'exec nautilus --new-window "$HOME/$1"',
    "sh",
    rel,
  ];
}


/**
 * Absolute path of an XDG user folder. Falls back to the English default
 * (`<home>/Desktop`…) when the folder isn't configured, as on the web demo.
 */
export function resolveUserDirPath(
  key: Exclude<XdgUserDirKey, "HOME">,
  userDirs: ReadonlyArray<Pick<XdgUserDir, "key" | "relativeHomePath" | "absolutePath">>,
  homePath: string
): string {
  const dir = userDirs.find((d) => d.key === key);
  if (dir?.absolutePath) return dir.absolutePath;
  const rel =
    dir?.relativeHomePath ?? USER_DIR_SPEC_BY_KEY.get(key)?.defaultRelativePath ?? "";
  return rel ? `${homePath}/${rel}` : homePath;
}
