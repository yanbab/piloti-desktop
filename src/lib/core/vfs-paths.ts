import { VFS_HOME } from "@/lib/engine/vfs-home";

export interface WebVfsEntry {
  id: string;
  name: string;
  kind: "directory" | "file";
  path: string;
  parentPath: string;
  content?: string;
  /** True when `content` is stored in IndexedDB instead of the localStorage JSON. */
  externalContent?: boolean;
  size?: number;
  accessCount?: number;
  trashedFromPath?: string;
  /** True for a symbolic link; `kind` is then the kind of the link target. */
  isSymlink?: boolean;
  /** Absolute path a symbolic link points to. */
  symlinkTarget?: string;
  metadata?: {
    "standard::content-type"?: string;
    "metadata::emblems"?: string[];
    "metadata::thumbnail"?: string;
    [key: string]: unknown;
  };
  updatedAt: number;
}

export const WEB_VFS_HOME = `${VFS_HOME}`;
export const WEB_VFS_TEMPLATES = `${VFS_HOME}/Templates`;
export const WEB_VFS_TRASH = `${VFS_HOME}/.local/share/Trash/files`;

export function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "/";
}

export function dirname(path: string): string {
  const normalized = normalizeVfsPath(path);
  if (normalized === "/") return "/";
  const idx = normalized.lastIndexOf("/");
  return idx <= 0 ? "/" : normalized.slice(0, idx);
}

/**
 * Normalizes a VFS path into an absolute `/home/user/...` path.
 */
export function normalizeVfsPath(rawPath?: string): string {
  if (!rawPath || rawPath === "~" || rawPath === "~/") return WEB_VFS_HOME;
  let trimmed = rawPath.trim();
  if (trimmed.startsWith("~/")) {
    trimmed = `${WEB_VFS_HOME}/${trimmed.slice(2)}`;
  } else if (!trimmed.startsWith("/")) {
    trimmed = `${WEB_VFS_HOME}/${trimmed}`;
  }
  const normalized = trimmed.replace(/\/+/g, "/").replace(/\/+$/, "");
  return normalized || "/";
}

/**
 * Resolves a relative or `~`-prefixed path against a VFS working directory.
 */
export function resolveVfsPath(cwd: string, rawTarget?: string): string {
  const base = normalizeVfsPath(cwd);
  if (!rawTarget || !rawTarget.trim()) return base;
  const target = rawTarget.trim();
  if (target === "~") return WEB_VFS_HOME;
  const combined = target.startsWith("~/")
    ? `${WEB_VFS_HOME}/${target.slice(2)}`
    : target.startsWith("/")
      ? target
      : `${base === "/" ? "" : base}/${target}`;

  const parts: string[] = [];
  for (const seg of combined.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return `/${parts.join("/")}`;
}
