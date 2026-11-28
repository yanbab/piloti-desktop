import { VFS_HOME } from "@/platform/shared/vfs-home";
/** Pure helpers for folders pinned to the right side of the Dock (macOS-style stacks). */

export const DEFAULT_WEB_DOWNLOADS_PATH = `${VFS_HOME}/Downloads`;

export function normalizeDockFolderPath(raw: string): string {
  const trimmed = (raw ?? "").trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (!trimmed) return "";
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

/** Trims, de-duplicates, and drops empty / non-string entries (keeps order). */
export function normalizeDockFolders(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const p = normalizeDockFolderPath(item);
    if (!p || p === "/" || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function addDockFolder(list: readonly string[], path: string): string[] {
  return normalizeDockFolders([...list, path]);
}

export function removeDockFolder(list: readonly string[], path: string): string[] {
  const target = normalizeDockFolderPath(path);
  return normalizeDockFolders(list).filter((p) => p !== target);
}

export function dockFolderLabel(path: string): string {
  const p = normalizeDockFolderPath(path);
  const name = p.split("/").filter(Boolean).pop();
  return name || p || "/";
}

/** Resolves the default docked folder (XDG Downloads) to a VFS path. */
export function resolveDefaultDockFolders(
  userDirs: ReadonlyArray<{
    key: string;
    relativeHomePath?: string;
    absolutePath?: string;
  }>,
  virtualHome: boolean,
  homePath = `${VFS_HOME}`
): string[] {
  if (virtualHome) return [DEFAULT_WEB_DOWNLOADS_PATH];
  const dl = userDirs.find((d) => d.key === "DOWNLOAD");
  if (!dl) return [`${homePath}/Downloads`];
  if (dl.absolutePath) return [normalizeDockFolderPath(dl.absolutePath)];
  const rel = dl.relativeHomePath ?? "Downloads";
  return [rel ? `${homePath}/${rel}` : homePath];
}

export function effectiveDockFolders(
  stored: readonly string[] | undefined,
  defaults: readonly string[]
): string[] {
  return normalizeDockFolders(stored === undefined ? defaults : stored);
}
