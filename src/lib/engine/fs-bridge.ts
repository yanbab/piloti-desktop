import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import {
  createVfsFolder,
  createVfsTextFile,
  emptyVfsTrash,
  getVfsEntry,
  listVfsDir,
  listVfsRecentEntries,
  moveVfsEntry,
  normalizeVfsPath,
  removeVfsEntry,
  renameVfsEntry,
  restoreVfsEntry,
  trashVfsEntry,
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
  type WebVfsEntry,
  writeVfsTextFile,
} from "@/lib/engine-web/web-vfs";
import { emptyXdgTrash, resolveXdgTrashPaths } from "@/lib/xdg/xdg-trash";
import {
  parseRecentlyUsedXbel,
  serializeRecentlyUsedXbel,
  upsertRecentXbelItem,
} from "@/lib/xdg/xdg-recents";
import { lookupXdgThumbnailDataUrl } from "@/lib/xdg/xdg-thumbnails";
import { isSimulatedUsbPath } from "@/lib/engine-web/usb-drive";

const RECENTLY_USED_XBEL_PATH = `${WEB_VFS_HOME}/.local/share/recently-used.xbel`;
const THUMBNAIL_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif|pdf|mp4|mkv|webm|mov)$/i;

export {
  buildVfsEntryWebAppUrl,
  getVfsEntry,
  importExternalFilesToVfs,
  isTextEditableVfsFile,
  listVfsDir,
  normalizeVfsPath,
  resolveVfsPath,
  subscribeWebVfs,
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
  type WebVfsEntry,
} from "@/lib/engine-web/web-vfs";

/**
 * Converts a normalized `/home/user/...` VFS path into a `$HOME`-relative path
 * suitable for `domicile.files` (which resolves relative paths against `$HOME`).
 */
export function toDomicilePath(vfsPath: string): string {
  const norm = normalizeVfsPath(vfsPath);
  if (norm === WEB_VFS_HOME) return ".";
  if (norm.startsWith(`${WEB_VFS_HOME}/`)) {
    return norm.slice(WEB_VFS_HOME.length + 1);
  }
  return norm;
}

/**
 * Lists directory entries from `domicile.files` on Linux (Domicile runtime)
 * or `web-vfs` in browser mode.
 */
export async function listFsDir(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  dirPath: string,
): Promise<WebVfsEntry[]> {
  const normDir = normalizeVfsPath(dirPath);
  if (isBrowserRuntime || isSimulatedUsbPath(normDir)) {
    return listVfsDir(normDir);
  }
  try {
    const target = toDomicilePath(normDir);
    const res = await domicile.files.readDir(target);
    const rawEntries = res.match({
      Ok: (list) => list,
      Err: () => undefined,
    });
    if (!rawEntries) {
      return listVfsDir(normDir);
    }
    const now = Date.now();
    const canStat = typeof domicile.files.stat === "function";
    return await Promise.all(
      rawEntries.map(async (item): Promise<WebVfsEntry> => {
        const entryPath = `${normDir === "/" ? "" : normDir}/${item.name}`;
        const cached = getVfsEntry(entryPath);
        const kind = item.fileType === 1 ? "directory" : "file";
        let size = cached?.size;
        let updatedAt = cached?.updatedAt ?? now;
        let realPath: string | undefined;
        if (kind === "file" && canStat) {
          try {
            const statRes = await domicile.files.stat(toDomicilePath(entryPath));
            statRes.match({
              Ok: (st) => {
                size = st.size;
                if (typeof st.modifiedMs === "number") {
                  updatedAt = st.modifiedMs;
                }
                if (typeof st.realPath === "string" && st.realPath.startsWith("/")) {
                  realPath = st.realPath;
                }
              },
              Err: () => {},
            });
          } catch {
            // Ignore stat errors for broken symlinks or restricted nodes
          }
        }
        let metadata = cached?.metadata;
        if (
          kind === "file" &&
          realPath &&
          !metadata?.["metadata::thumbnail"] &&
          THUMBNAIL_EXT_RE.test(item.name)
        ) {
          const thumb = await lookupXdgThumbnailDataUrl(domicile, realPath);
          if (thumb) {
            metadata = { ...(metadata ?? {}), "metadata::thumbnail": thumb };
          }
        }
        return {
          id: entryPath,
          name: item.name,
          kind,
          path: entryPath,
          parentPath: normDir,
          content: cached?.content,
          size,
          updatedAt,
          metadata,
        };
      }),
    );
  } catch {
    return listVfsDir(normDir);
  }
}

/**
 * Reads a UTF-8 text file via `domicile.files` on Linux or `web-vfs` in browser mode.
 */
export async function readFsTextFile(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  filePath: string,
): Promise<string> {
  const norm = normalizeVfsPath(filePath);
  if (isBrowserRuntime || isSimulatedUsbPath(norm)) {
    const entry = getVfsEntry(norm);
    return entry?.kind === "file" ? (entry.content ?? "") : "";
  }
  try {
    const res = await domicile.files.readText(toDomicilePath(norm));
    const text = res.match({
      Ok: (t) => t,
      Err: () => undefined,
    });
    if (text !== undefined) {
      writeVfsTextFile(norm, text);
      return text;
    }
  } catch {
    // fall back to VFS cache
  }
  const entry = getVfsEntry(norm);
  return entry?.kind === "file" ? (entry.content ?? "") : "";
}

/**
 * Writes a UTF-8 text file to `web-vfs` and (on Linux) persists via `domicile.files.write`.
 */
export function writeFsTextFile(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  filePath: string,
  content: string,
): WebVfsEntry | null {
  const norm = normalizeVfsPath(filePath);
  const updated = writeVfsTextFile(norm, content);
  if (!isBrowserRuntime && !isSimulatedUsbPath(norm)) {
    const bytes = new TextEncoder().encode(content);
    void domicile.files.write(toDomicilePath(norm), bytes);
  }
  return updated;
}

/**
 * Creates a new folder in `dirPath` on both `web-vfs` and `domicile.files`.
 */
export function createFsFolder(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  dirPath: string,
  baseName?: string,
): WebVfsEntry {
  const created = createVfsFolder(dirPath, baseName);
  if (!isBrowserRuntime && !isSimulatedUsbPath(created.path)) {
    void domicile.files.createDir(toDomicilePath(created.path));
  }
  return created;
}

/**
 * Creates a new text file in `dirPath` on both `web-vfs` and `domicile.files`.
 */
export function createFsTextFile(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  dirPath: string,
  baseName?: string,
  content = "",
): WebVfsEntry {
  const created = createVfsTextFile(dirPath, baseName, content);
  if (!isBrowserRuntime && !isSimulatedUsbPath(created.path)) {
    const bytes = new TextEncoder().encode(content);
    void domicile.files.write(toDomicilePath(created.path), bytes);
  }
  return created;
}

/**
 * Renames a file or directory on both `web-vfs` and (via `mv`) on Linux.
 */
export function renameFsEntry(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  path: string,
  newName: string,
): WebVfsEntry | null {
  const oldRel = toDomicilePath(path);
  const renamed = renameVfsEntry(path, newName);
  if (renamed && !isBrowserRuntime && !isSimulatedUsbPath(path)) {
    const newRel = toDomicilePath(renamed.path);
    if (oldRel !== newRel) {
      void domicile.processes.run(["mv", "--", oldRel, newRel]);
    }
  }
  return renamed;
}

/**
 * Moves a file or directory into `targetDirPath` on both `web-vfs` and Linux.
 */
export function moveFsEntry(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  path: string,
  targetDirPath: string,
): WebVfsEntry | null {
  const oldRel = toDomicilePath(path);
  const moved = moveVfsEntry(path, targetDirPath);
  if (
    moved &&
    !isBrowserRuntime &&
    !isSimulatedUsbPath(path) &&
    !isSimulatedUsbPath(targetDirPath)
  ) {
    const newRel = toDomicilePath(moved.path);
    if (oldRel !== newRel) {
      void domicile.processes.run(["mv", "--", oldRel, newRel]);
    }
  }
  return moved;
}

/**
 * Moves an entry to Trash on both `web-vfs` and Linux (`gio trash` / XDG Trash).
 */
export function trashFsEntry(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  path: string,
): void {
  const rel = toDomicilePath(path);
  trashVfsEntry(path);
  if (!isBrowserRuntime && !isSimulatedUsbPath(path)) {
    void domicile.processes
      .run(["gio", "trash", "--", rel])
      .catch(() =>
        domicile.processes.run([
          "mv",
          "--",
          rel,
          toDomicilePath(WEB_VFS_TRASH),
        ]),
      );
  }
}

/**
 * Restores an entry from Trash back to its original location (`web-vfs` or XDG Trash).
 */
export function restoreFsEntry(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  trashPath: string,
): WebVfsEntry | null {
  const norm = normalizeVfsPath(trashPath);
  const restored = restoreVfsEntry(norm);
  if (!isBrowserRuntime && restored && !isSimulatedUsbPath(restored.path)) {
    void domicile.processes.run([
      "mv",
      "--",
      toDomicilePath(norm),
      toDomicilePath(restored.path),
    ]);
  }
  return restored;
}

/**
 * Empties Trash on both `web-vfs` and Linux XDG Trash.
 */
export async function emptyFsTrash(
  domicile: Domicile,
  isBrowserRuntime: boolean,
): Promise<void> {
  emptyVfsTrash();
  if (!isBrowserRuntime) {
    await emptyXdgTrash(domicile.processes, resolveXdgTrashPaths());
  }
}

/**
 * Permanently removes a file on both `web-vfs` and Linux (`rm -f`).
 */
export async function removeFsFile(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  filePath: string,
): Promise<void> {
  const norm = normalizeVfsPath(filePath);
  removeVfsEntry(norm);
  if (!isBrowserRuntime && !isSimulatedUsbPath(norm)) {
    await domicile.processes.run(["rm", "-f", "--", toDomicilePath(norm)]).catch(() => undefined);
  }
}

/**
 * Lists recent files from FreeDesktop `~/.local/share/recently-used.xbel`
 * merged with Piloti's local VFS recent access history.
 */
export async function listFsRecentEntries(
  domicile: Domicile,
  isBrowserRuntime: boolean,
): Promise<WebVfsEntry[]> {
  const vfsRecents = listVfsRecentEntries();
  const byPath = new Map<string, WebVfsEntry>();

  try {
    const xml = await readFsTextFile(
      domicile,
      isBrowserRuntime,
      RECENTLY_USED_XBEL_PATH,
    );
    if (xml) {
      const parsed = parseRecentlyUsedXbel(xml);
      for (const item of parsed) {
        if (!item.path || item.path === "/") continue;
        const norm = item.path.replace(/\/+$/, "");
        const idx = norm.lastIndexOf("/");
        const name = idx >= 0 ? norm.slice(idx + 1) : norm;
        const parentPath = idx > 0 ? norm.slice(0, idx) : "/";
        const ts = Date.parse(item.visited || item.modified || item.added);
        const existing = getVfsEntry(norm);
        byPath.set(norm, {
          id: norm,
          name: existing?.name || name,
          kind: existing?.kind || "file",
          path: norm,
          parentPath: existing?.parentPath || parentPath,
          content: existing?.content,
          size: existing?.size,
          updatedAt: Number.isFinite(ts) ? ts : (existing?.updatedAt ?? Date.now()),
          metadata: {
            ...(existing?.metadata ?? {}),
            "standard::content-type": item.mimeType,
          },
        });
      }
    }
  } catch {
    // ignore malformed or missing XBEL
  }

  for (const entry of vfsRecents) {
    if (!byPath.has(entry.path)) {
      byPath.set(entry.path, entry);
    }
  }

  return Array.from(byPath.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  );
}

/**
 * Records an opened file into FreeDesktop `~/.local/share/recently-used.xbel`.
 */
export async function recordFsRecentFile(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  filePath: string,
  mimeType = "application/octet-stream",
): Promise<void> {
  if (!filePath || !filePath.startsWith("/")) return;
  try {
    const xml = await readFsTextFile(
      domicile,
      isBrowserRuntime,
      RECENTLY_USED_XBEL_PATH,
    );
    const current = xml ? parseRecentlyUsedXbel(xml) : [];
    const next = upsertRecentXbelItem(current, filePath, mimeType);
    const serialized = serializeRecentlyUsedXbel(next);
    writeFsTextFile(domicile, isBrowserRuntime, RECENTLY_USED_XBEL_PATH, serialized);
  } catch {
    // non-fatal recents write failure
  }
}
