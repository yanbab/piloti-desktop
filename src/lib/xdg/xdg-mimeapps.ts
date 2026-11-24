import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { XdgDesktopEntry } from "./xdg-desktop-entry";
import { readFsTextFile, writeFsTextFile } from "@/lib/engine/fs-bridge";
import { WEB_VFS_HOME } from "@/lib/core/vfs-paths";

/** Used when the user has no `mimeapps.list`. */
export const DEFAULT_MIMEAPPS_INI = `[Default Applications]
inode/directory=nautilus.desktop
text/plain=text-editor.desktop
text/markdown=text-editor.desktop
text/html=browser.desktop
application/json=text-editor.desktop
image/png=image-viewer.desktop
image/jpeg=image-viewer.desktop
image/webp=image-viewer.desktop
image/gif=image-viewer.desktop
image/svg+xml=image-viewer.desktop

[Added Associations]
inode/directory=nautilus.desktop;terminal.desktop;
text/plain=text-editor.desktop;terminal.desktop;
text/markdown=text-editor.desktop;browser.desktop;
text/html=browser.desktop;text-editor.desktop;
text/*=text-editor.desktop;terminal.desktop;
application/json=text-editor.desktop;console.desktop;
image/*=image-viewer.desktop;browser.desktop;
`;
export const MIMEAPPS_PATH = `${WEB_VFS_HOME}/.config/mimeapps.list`;

export interface MimeAppsConfig {
  defaults: Record<string, string[]>;
  added: Record<string, string[]>;
}

export interface MimeAppOption {
  desktopId: string;
  appId: string;
  label: string;
  /** Installed `.desktop` entry backing this option (absent for built-in shell apps). */
  entry?: XdgDesktopEntry;
  /** Built-in shell app id (`launchApp`) when this option is one of ours. */
  builtinAppId?: string;
}

/** Built-in shell apps, addressable by several desktop ids (legacy + `piloti-*.desktop`). */
const KNOWN_MIME_APPS: Record<string, { appId: string; label: string }> = {
  "nautilus.desktop": { appId: "nautilus", label: "Folders" },
  "org.gnome.Nautilus.desktop": { appId: "nautilus", label: "Folders" },
  "piloti-files.desktop": { appId: "nautilus", label: "Folders" },
  "text-editor.desktop": { appId: "text-editor", label: "Notepad" },
  "piloti-notepad.desktop": { appId: "text-editor", label: "Notepad" },
  "terminal.desktop": { appId: "terminal", label: "Terminal" },
  "piloti-shell.desktop": { appId: "terminal", label: "Terminal" },
  "image-viewer.desktop": { appId: "image-viewer", label: "Image Viewer" },
  "piloti-image-viewer.desktop": { appId: "image-viewer", label: "Image Viewer" },
  "browser.desktop": { appId: "browser", label: "Web Browser" },
  "piloti-browser.desktop": { appId: "browser", label: "Web Browser" },
  "console.desktop": { appId: "console", label: "Piloti Devtools" },
  "piloti-console.desktop": { appId: "console", label: "Piloti Devtools" },
  "app-store.desktop": { appId: "app-store", label: "App Store" },
  "piloti-appstore.desktop": { appId: "app-store", label: "App Store" },
  "piloti-calculator.desktop": { appId: "calculator", label: "Calculator" },
  "piloti-camera.desktop": { appId: "camera", label: "Camera" },
  "piloti-system-monitor.desktop": { appId: "system-monitor", label: "System Monitor" },
};

/**
 * Used when `mimeapps.list` has nothing for a type, so every common file kind
 * still has a sensible default (first match wins; patterns end in `/*` for a family).
 */
const BUILTIN_MIME_DEFAULTS: ReadonlyArray<readonly [pattern: string, desktopIds: readonly string[]]> = [
  ["inode/directory", ["nautilus.desktop"]],
  ["image/*", ["image-viewer.desktop", "browser.desktop"]],
  ["text/html", ["browser.desktop", "text-editor.desktop"]],
  ["application/pdf", ["browser.desktop"]],
  ["audio/*", ["browser.desktop"]],
  ["video/*", ["browser.desktop"]],
  ["text/*", ["text-editor.desktop"]],
  ["application/json", ["text-editor.desktop"]],
  ["application/xml", ["text-editor.desktop"]],
  ["application/x-shellscript", ["text-editor.desktop", "terminal.desktop"]],
  ["application/vnd.debian.binary-package", ["piloti-appstore.desktop"]],
  ["application/vnd.flatpak.ref", ["piloti-appstore.desktop"]],
  ["application/vnd.flatpak", ["piloti-appstore.desktop"]],
  ["x-scheme-handler/http", ["browser.desktop"]],
  ["x-scheme-handler/https", ["browser.desktop"]],
];

/** XDG `sub-class-of`: a type also inherits the apps of its parent types. */
function mimeParents(mime: string): string[] {
  const parents: string[] = [];
  if (/^(text\/.+|application\/(json|xml|javascript|x-shellscript|x-yaml|toml|sql|x-desktop))$/.test(mime) && mime !== "text/plain") {
    parents.push("text/plain");
  }
  if (mime === "image/svg+xml") parents.push("application/xml", "text/xml");
  return parents;
}

/** True when `pattern` (`text/plain`, `image/*`) covers `mime`. */
export function mimeMatchesPattern(pattern: string, mime: string): boolean {
  if (pattern === mime) return true;
  if (pattern.endsWith("/*")) return mime.startsWith(pattern.slice(0, -1));
  return false;
}

const EXT_MIME: Record<string, string> = {
  md: "text/markdown", markdown: "text/markdown",
  html: "text/html", htm: "text/html",
  css: "text/css", csv: "text/csv", tsv: "text/tab-separated-values",
  xml: "application/xml", json: "application/json",
  js: "text/javascript", mjs: "text/javascript", cjs: "text/javascript",
  ts: "text/x-typescript", tsx: "text/x-typescript", jsx: "text/jsx",
  sh: "application/x-shellscript", bash: "application/x-shellscript", zsh: "application/x-shellscript",
  py: "text/x-python", rs: "text/rust", go: "text/x-go", c: "text/x-csrc", h: "text/x-chdr",
  cpp: "text/x-c++src", hpp: "text/x-c++hdr", java: "text/x-java", sql: "application/sql",
  yml: "application/x-yaml", yaml: "application/x-yaml", toml: "application/toml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  svg: "image/svg+xml", bmp: "image/bmp", ico: "image/vnd.microsoft.icon", avif: "image/avif",
  tif: "image/tiff", tiff: "image/tiff",
  pdf: "application/pdf",
  mp3: "audio/mpeg", wav: "audio/x-wav", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac",
  m4a: "audio/mp4", aac: "audio/aac", opus: "audio/opus",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mkv: "video/x-matroska",
  mov: "video/quicktime", avi: "video/x-msvideo", ogv: "video/ogg",
  zip: "application/zip", tar: "application/x-tar", gz: "application/gzip", tgz: "application/gzip",
  bz2: "application/x-bzip2", xz: "application/x-xz", zst: "application/zstd",
  "7z": "application/x-7z-compressed", rar: "application/vnd.rar",
  deb: "application/vnd.debian.binary-package", rpm: "application/x-rpm",
  flatpakref: "application/vnd.flatpak.ref", flatpak: "application/vnd.flatpak",
  appimage: "application/vnd.appimage",
  url: "application/x-mswinurl", webloc: "application/x-apple-webloc",
  desktop: "application/x-desktop",
  txt: "text/plain", ini: "text/plain", list: "text/plain", conf: "text/plain",
  cfg: "text/plain", log: "text/plain",
};

export function inferMimeType(
  name: string,
  kind: "file" | "directory",
): string {
  if (kind === "directory") return "inode/directory";
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot > 0 && dot < lower.length - 1) {
    const mapped = EXT_MIME[lower.slice(dot + 1)];
    if (mapped) return mapped;
  }
  if (dot <= 0 || dot === lower.length - 1) return "text/plain";
  return "application/octet-stream";
}

export function parseMimeAppsList(content: string): MimeAppsConfig {
  const defaults: Record<string, string[]> = {};
  const added: Record<string, string[]> = {};
  let section: "defaults" | "added" | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[Default Applications]") {
      section = "defaults";
      continue;
    }
    if (line === "[Added Associations]") {
      section = "added";
      continue;
    }
    if (line.startsWith("[")) {
      section = null;
      continue;
    }
    if (!section) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const mime = line.slice(0, eqIdx).trim();
    const list = line
      .slice(eqIdx + 1)
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) continue;
    if (section === "defaults") defaults[mime] = list;
    else added[mime] = list;
  }

  return { defaults, added };
}

function toOption(desktopId: string, installed?: readonly XdgDesktopEntry[]): MimeAppOption {
  const known = KNOWN_MIME_APPS[desktopId];
  const entry = installed?.find(
    (e) => e.desktopId === desktopId || e.desktopId.toLowerCase() === desktopId.toLowerCase(),
  );
  return {
    desktopId,
    appId: known?.appId ?? entry?.appId ?? desktopId.replace(/\.desktop$/i, ""),
    label: entry?.name ?? known?.label ?? desktopId.replace(/\.desktop$/i, ""),
    ...(known ? { builtinAppId: known.appId } : {}),
    ...(entry ? { entry } : {}),
  };
}

/**
 * Applications able to open `mimeType`, best first:
 * `mimeapps.list` defaults → added associations (exact, parent types, family) →
 * installed `.desktop` entries declaring the type (our apps, web apps, .deb apps) →
 * built-in fallbacks. Apps that aren't installed or are hidden are dropped when
 * an `installed` list is given.
 */
export function resolveAppsForMime(
  mimeType: string,
  config: MimeAppsConfig,
  installed?: readonly XdgDesktopEntry[],
): MimeAppOption[] {
  const types = [mimeType, ...mimeParents(mimeType)];
  const [category] = mimeType.split("/");
  const genericMime = category ? `${category}/*` : "";
  if (genericMime) types.push(genericMime);

  const ordered: string[] = [];
  const pushAll = (ids?: readonly string[]) => {
    for (const id of ids ?? []) if (!ordered.includes(id)) ordered.push(id);
  };

  for (const t of types) pushAll(config.defaults[t]);
  for (const t of types) pushAll(config.added[t]);

  if (installed) {
    for (const entry of installed) {
      if (entry.hidden || entry.noDisplay) continue;
      if (entry.mimeTypes.some((p) => types.some((t) => mimeMatchesPattern(p, t) || mimeMatchesPattern(t, p)))) {
        pushAll([entry.desktopId]);
      }
    }
  }

  for (const [pattern, ids] of BUILTIN_MIME_DEFAULTS) {
    if (types.some((t) => mimeMatchesPattern(pattern, t))) pushAll(ids);
  }

  // One option per application: `text-editor.desktop` and `piloti-notepad.desktop` are the same app.
  const seen = new Set<string>();
  const options = ordered
    .map((id) => toOption(id, installed))
    .filter((o) => {
      const key = o.builtinAppId ?? o.desktopId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!installed) return options;
  // Keep our built-in apps and anything actually installed; drop dangling ids.
  return options.filter((o) => o.builtinAppId || o.entry);
}

export async function loadMimeAppsConfig(
  domicile: Domicile,
): Promise<MimeAppsConfig> {
  const raw = await readFsTextFile(domicile, MIMEAPPS_PATH);
  return parseMimeAppsList(raw || DEFAULT_MIMEAPPS_INI);
}

export async function setDefaultMimeApp(
  domicile: Domicile,
  mimeType: string,
  desktopId: string,
): Promise<void> {
  const raw =
    (await readFsTextFile(domicile, MIMEAPPS_PATH)) ||
    DEFAULT_MIMEAPPS_INI;
  const config = parseMimeAppsList(raw);
  const existing = config.defaults[mimeType] ?? [];
  config.defaults[mimeType] = [
    desktopId,
    ...existing.filter((id) => id !== desktopId),
  ];
  const lines: string[] = ["[Default Applications]"];
  for (const [m, ids] of Object.entries(config.defaults)) {
    lines.push(`${m}=${ids.join(";")};`);
  }
  lines.push("", "[Added Associations]");
  for (const [m, ids] of Object.entries(config.added)) {
    lines.push(`${m}=${ids.join(";")};`);
  }
  writeFsTextFile(domicile, MIMEAPPS_PATH, `${lines.join("\n")}\n`);
}

export interface SharedMimeGlob {
  weight: number;
  mimeType: string;
  pattern: string;
}

/**
 * Parses FreeDesktop Shared MIME-info `globs2` lines (`weight:mime:glob`).
 */
export function parseGlobs2(content: string): SharedMimeGlob[] {
  const globs: SharedMimeGlob[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(":");
    if (parts.length < 3) continue;
    const weight = Number.parseInt(parts[0], 10);
    const mimeType = parts[1]?.trim();
    const pattern = parts.slice(2).join(":").trim();
    if (!Number.isFinite(weight) || !mimeType || !pattern) continue;
    globs.push({ weight, mimeType, pattern });
  }
  return globs.sort((a, b) => b.weight - a.weight);
}

/**
 * Infers MIME type via magic header bytes first, then `globs2` patterns,
 * then extension fallback (`inferMimeType`).
 */
export function sniffMimeType(
  filename: string,
  bytes?: Uint8Array,
  globs?: readonly SharedMimeGlob[]
): string {
  if (bytes && bytes.length >= 4) {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "image/png";
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return "image/gif";
    }
    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return "application/pdf";
    }
    if (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05)
    ) {
      return "application/zip";
    }
    if (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return filename.toLowerCase().endsWith(".webm")
        ? "video/webm"
        : "video/x-matroska";
    }
  }
  if (globs && globs.length > 0) {
    const lower = filename.toLowerCase();
    for (const g of globs) {
      if (g.pattern.startsWith("*.") && lower.endsWith(g.pattern.slice(1).toLowerCase())) {
        return g.mimeType;
      }
      if (g.pattern.toLowerCase() === lower) {
        return g.mimeType;
      }
    }
  }
  return inferMimeType(filename, "file");
}
