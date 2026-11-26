import { normalizeVfsPath, WEB_VFS_HOME } from "@/lib/core/vfs-paths";

/** `domicile.files` and processes resolve relative paths against `$HOME`. */
export function toDomicilePath(vfsPath: string): string {
  const norm = normalizeVfsPath(vfsPath);
  if (norm === WEB_VFS_HOME) return ".";
  if (norm.startsWith(`${WEB_VFS_HOME}/`)) return norm.slice(WEB_VFS_HOME.length + 1);
  return norm;
}
