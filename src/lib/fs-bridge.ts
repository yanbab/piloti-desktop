import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import {
  createVfsFolder,
  createVfsTextFile,
  emptyVfsTrash,
  getVfsEntry,
  listVfsDir,
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
} from "./web-vfs";
import { emptyXdgTrash, resolveXdgTrashPaths } from "./xdg-trash";

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
} from "./web-vfs";

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
  if (isBrowserRuntime) {
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
    return rawEntries.map((item) => {
      const entryPath = `${normDir === "/" ? "" : normDir}/${item.name}`;
      const cached = getVfsEntry(entryPath);
      return {
        id: entryPath,
        name: item.name,
        kind: item.fileType === 1 ? "directory" : "file",
        path: entryPath,
        parentPath: normDir,
        content: cached?.content,
        updatedAt: cached?.updatedAt ?? now,
      };
    });
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
  if (isBrowserRuntime) {
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
  if (!isBrowserRuntime) {
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
  if (!isBrowserRuntime) {
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
  if (!isBrowserRuntime) {
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
  if (renamed && !isBrowserRuntime) {
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
  if (moved && !isBrowserRuntime) {
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
  if (!isBrowserRuntime) {
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
  if (!isBrowserRuntime && restored) {
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
  if (!isBrowserRuntime) {
    await domicile.processes.run(["rm", "-f", "--", toDomicilePath(norm)]).catch(() => undefined);
  }
}
