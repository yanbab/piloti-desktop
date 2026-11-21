import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { readFsTextFile, writeFsTextFile } from "../fs-bridge";
import { DEFAULT_MIMEAPPS_INI, WEB_VFS_HOME } from "../web-vfs";

export { DEFAULT_MIMEAPPS_INI };
export const MIMEAPPS_PATH = `${WEB_VFS_HOME}/.config/mimeapps.list`;

export interface MimeAppsConfig {
  defaults: Record<string, string[]>;
  added: Record<string, string[]>;
}

export interface MimeAppOption {
  desktopId: string;
  appId: string;
  label: string;
}

const KNOWN_MIME_APPS: Record<string, { appId: string; label: string }> = {
  "nautilus.desktop": { appId: "nautilus", label: "Folders" },
  "org.gnome.Nautilus.desktop": { appId: "nautilus", label: "Folders" },
  "text-editor.desktop": { appId: "text-editor", label: "Notepad" },
  "terminal.desktop": { appId: "terminal", label: "Desktop Shell" },
  "image-viewer.desktop": { appId: "image-viewer", label: "Image Viewer" },
  "browser.desktop": { appId: "browser", label: "Web Browser" },
  "console.desktop": { appId: "console", label: "Desktop Console" },
};

export function inferMimeType(
  name: string,
  kind: "file" | "directory",
): string {
  if (kind === "directory") return "inode/directory";
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".js") ||
    lower.endsWith(".css") ||
    lower.endsWith(".sh") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".desktop") ||
    lower.endsWith(".list") ||
    !lower.includes(".")
  ) {
    return "text/plain";
  }
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

export function resolveAppsForMime(
  mimeType: string,
  config: MimeAppsConfig,
): MimeAppOption[] {
  const [category] = mimeType.split("/");
  const genericMime = category ? `${category}/*` : "";

  const orderedDesktopIds: string[] = [];
  const pushAll = (ids?: string[]) => {
    if (!ids) return;
    for (const id of ids) {
      if (!orderedDesktopIds.includes(id)) {
        orderedDesktopIds.push(id);
      }
    }
  };

  pushAll(config.defaults[mimeType]);
  pushAll(config.added[mimeType]);
  if (genericMime) {
    pushAll(config.defaults[genericMime]);
    pushAll(config.added[genericMime]);
  }

  return orderedDesktopIds.map((desktopId) => {
    const known = KNOWN_MIME_APPS[desktopId];
    return {
      desktopId,
      appId: known?.appId ?? desktopId.replace(/\.desktop$/i, ""),
      label: known?.label ?? desktopId.replace(/\.desktop$/i, ""),
    };
  });
}

export async function loadMimeAppsConfig(
  domicile: Domicile,
  isBrowserRuntime: boolean,
): Promise<MimeAppsConfig> {
  const raw = await readFsTextFile(domicile, isBrowserRuntime, MIMEAPPS_PATH);
  return parseMimeAppsList(raw || DEFAULT_MIMEAPPS_INI);
}

export async function setDefaultMimeApp(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  mimeType: string,
  desktopId: string,
): Promise<void> {
  const raw =
    (await readFsTextFile(domicile, isBrowserRuntime, MIMEAPPS_PATH)) ||
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
  writeFsTextFile(domicile, isBrowserRuntime, MIMEAPPS_PATH, `${lines.join("\n")}\n`);
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
