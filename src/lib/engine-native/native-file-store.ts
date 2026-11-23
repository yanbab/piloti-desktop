import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { FileStore, FileStoreEntry } from "@/lib/ports/file-store";
import { normalizeVfsPath, WEB_VFS_HOME } from "@/lib/core/vfs-paths";
import { lookupXdgThumbnailDataUrl } from "@/lib/xdg/xdg-thumbnails";

const THUMBNAIL_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif|pdf|mp4|mkv|webm|mov)$/i;

/** `domicile.files` resolves relative paths against `$HOME`. */
export function toDomicilePath(vfsPath: string): string {
  const norm = normalizeVfsPath(vfsPath);
  if (norm === WEB_VFS_HOME) return ".";
  if (norm.startsWith(`${WEB_VFS_HOME}/`)) return norm.slice(WEB_VFS_HOME.length + 1);
  return norm;
}

/** FileStore over the compositor's file calls (`domicile.files`). */
export function createNativeFileStore(domicile: Domicile): FileStore {
  const stat = async (path: string): Promise<FileStoreEntry | null> => {
    if (typeof domicile.files.stat !== "function") return null;
    const res = await domicile.files.stat(toDomicilePath(path));
    return res.match({
      Ok: (st) => ({
        name: path.slice(path.lastIndexOf("/") + 1),
        kind: st.fileType === 1 ? ("directory" as const) : ("file" as const),
        size: st.size,
        modifiedMs: typeof st.modifiedMs === "number" ? st.modifiedMs : undefined,
        realPath:
          typeof st.realPath === "string" && st.realPath.startsWith("/") ? st.realPath : undefined,
      }),
      Err: () => null,
    });
  };

  return {
    async list(path) {
      const res = await domicile.files.readDir(toDomicilePath(path));
      return res.match({
        Ok: (list) =>
          list.map((item) => ({
            name: item.name,
            kind: item.fileType === 1 ? ("directory" as const) : ("file" as const),
            isSymlink: item.fileType === 2,
          })),
        Err: () => null,
      });
    },
    stat: (path) => stat(path).catch(() => null),
    async readText(path) {
      const res = await domicile.files.readText(toDomicilePath(path));
      return res.match({ Ok: (t) => t, Err: () => null });
    },
    async writeText(path, content) {
      const res = await domicile.files.write(toDomicilePath(path), new TextEncoder().encode(content));
      return res.isOk();
    },
    async createDir(path) {
      const res = await domicile.files.createDir(toDomicilePath(path));
      return res.isOk();
    },
    async thumbnail(realPath, name) {
      if (!THUMBNAIL_EXT_RE.test(name)) return undefined;
      return (await lookupXdgThumbnailDataUrl(domicile, realPath)) ?? undefined;
    },
  };
}
