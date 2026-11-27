import type { Piloti } from "@/lib/engine/piloti";
import {
  announceVfsRenamed,
  notifyVfsChanged,
  subscribeWebVfs as subscribeVfs,
  compressVfsEntries,
  createVfsFileFromTemplate,
  copyVfsEntry,
  extractVfsZip,
  createVfsFolder,
  createVfsSymlink,
  createVfsTextFile,
  emptyVfsTrash,
  getVfsDirHiddenNames,
  getVfsEntry,
  importExternalFilesToVfs,
  listVfsDir,
  listVfsRecentEntries,
  listVfsTemplates,
  moveVfsEntry,
  parseDotHiddenFile,
  removeVfsEntry,
  renameVfsEntry,
  resolveVfsTemplatesDir,
  restoreVfsEntry,
  setVfsEntryMetadata,
  trashVfsEntry,
  writeVfsTextFile,
  listVfsFavoriteEntries,
  syncVfsEmblemsFromHost,
  loadVfsFavorites,
} from "@/lib/engine-web/web-vfs";
import {
  normalizeVfsPath,
  WEB_VFS_HOME,
  WEB_VFS_TEMPLATES,
  WEB_VFS_TRASH,
  type WebVfsEntry,
} from "@/lib/core/vfs-paths";
import {
  parseRecentlyUsedXbel,
  serializeRecentlyUsedXbel,
  upsertRecentXbelItem,
} from "@/lib/xdg/xdg-recents";
import { getEngine } from "@/lib/engine/engine";
import { compressNative, extractNative } from "@/lib/engine-native/archive";
import { listEmblems } from "@/lib/engine-native/gio";
import { toDomicilePath } from "@/lib/engine-native/paths";
import { baseName, joinPath, parentPath, uniqueName } from "@/lib/ports/vfs";
import { queryClient } from "@/lib/engine/query-client";
import { vfsCache } from "@/lib/engine/vfs-cache";
import { vfsKeys } from "@/lib/engine/vfs-query";

export { toDomicilePath };

export const RECENTLY_USED_XBEL_PATH = `${WEB_VFS_HOME}/.local/share/recently-used.xbel`;

export {
  buildVfsEntryWebAppUrl,
  createVfsFileFromTemplate,
  getVfsDirHiddenNames,
  getVfsEntry,
  importExternalFilesToVfs,
  isTextEditableVfsFile,
  listVfsDir,
  listVfsTemplates,
  normalizeVfsPath,
  parseDotHiddenFile,
  resolveVfsPath,
  resolveVfsTemplatesDir,
  setVfsEntryMetadata,
  subscribeWebVfs,
  WEB_VFS_HOME,
  WEB_VFS_TEMPLATES,
  WEB_VFS_TRASH,
  type WebVfsEntry,
} from "@/lib/engine-web/web-vfs";


/** Files live on a real disk, as opposed to the browser VFS being the only copy. */
const hasRealFilesystem = (): boolean => getEngine().capabilities.realFilesystem;

const entryFor = (path: string, kind: WebVfsEntry["kind"], more: Partial<WebVfsEntry> = {}): WebVfsEntry => ({
  id: path,
  name: baseName(path),
  kind,
  path,
  parentPath: parentPath(path),
  updatedAt: Date.now(),
  ...more,
});

/** The names in use in a folder, lower case. */
async function namesIn(piloti: Piloti, dir: string): Promise<Set<string>> {
  return new Set(((await piloti.vfs.list(dir)) ?? []).map((e) => e.name.toLowerCase()));
}

const logFailure = (what: string, path: string) => (error: unknown) => {
  console.warn(`[piloti] cannot ${what}`, path, error);
  return null;
};

/** Reads the `metadata::emblems` of a folder's entries into the emblem list. */
async function syncEmblems(piloti: Piloti, dirPath: string): Promise<void> {
  const dir = normalizeVfsPath(dirPath);
  const [onDisk, listed] = await Promise.all([
    listEmblems(piloti.processes, dir),
    piloti.vfs.list(dir).catch(() => null),
  ]);
  if (!onDisk || !listed) return;
  for (const item of listed) syncVfsEmblemsFromHost(item.path, onDisk[item.name] ?? []);
}

/** One entry as the disk has it, or `null`. */
async function statEntry(piloti: Piloti, path: string): Promise<WebVfsEntry | null> {
  const norm = normalizeVfsPath(path);
  const st = await piloti.vfs.stat(norm).catch(() => null);
  if (!st) return null;
  return entryFor(norm, st.kind, { size: st.size, updatedAt: st.modifiedMs ?? Date.now() });
}

/**
 * Lists a folder: from the disk on Linux (with sizes, thumbnails and emblems),
 * from the browser VFS in the demo.
 */
export async function listFsDir(
  piloti: Piloti,
  dirPath: string,
  options?: { includeHidden?: boolean },
): Promise<WebVfsEntry[]> {
  const dir = normalizeVfsPath(dirPath);
  // The disk lists everything; the demo leaves hidden ones out unless asked.
  if (!hasRealFilesystem()) return listVfsDir(dir, options);
  const [listed] = await Promise.all([
    piloti.vfs.list(dir).catch(() => null),
    syncEmblems(piloti, dir).catch(() => undefined),
  ]);
  if (!listed) return [];
  return Promise.all(
    listed.map(async (item) => {
      const needsStat = item.kind === "file" || item.isSymlink;
      const st = needsStat ? await piloti.vfs.stat(item.path).catch(() => null) : null;
      const thumbnail =
        item.kind === "file" && st
          ? await piloti.vfs.thumbnail(item.path).catch(() => undefined)
          : undefined;
      const hidden =
        item.kind === "file" && item.name === ".hidden"
          ? await piloti.vfs.readText(item.path).catch(() => null)
          : null;
      return entryFor(item.path, item.kind, {
        size: st?.size,
        updatedAt: st?.modifiedMs ?? Date.now(),
        ...(hidden !== null ? { content: hidden } : {}),
        ...(thumbnail ? { metadata: { "metadata::thumbnail": thumbnail } } : {}),
        ...(item.isSymlink ? { isSymlink: true, symlinkTarget: st?.realPath } : {}),
      });
    }),
  );
}

/** A file's text, or "" if there is none. */
export async function readFsTextFile(
  piloti: Piloti,
  filePath: string,
): Promise<string> {
  return (await piloti.vfs.readText(normalizeVfsPath(filePath)).catch(() => null)) ?? "";
}

/** Writes a file, making its folder; `null` if it could not. */
export async function writeFsTextFile(
  piloti: Piloti,
  filePath: string,
  content: string,
): Promise<WebVfsEntry | null> {
  const path = normalizeVfsPath(filePath);
  return piloti.vfs
    .createDir(parentPath(path))
    .then(() => piloti.vfs.write(path, content))
    .then(() => entryFor(path, "file", { content }))
    .catch(logFailure("save", path));
}

/** Creates a new folder in `dirPath`, numbering the name if it is taken. */
export async function createFsFolder(
  piloti: Piloti,
  dirPath: string,
  baseName = "New Folder",
): Promise<WebVfsEntry> {
  const dir = normalizeVfsPath(dirPath);
  const path = joinPath(dir, uniqueName(await namesIn(piloti, dir), baseName));
  await piloti.vfs.createDir(path);
  const entry = entryFor(path, "directory");
  vfsCache.added(entry);
  return entry;
}

/** Creates a new text file in `dirPath`; never one that exists. */
export async function createFsTextFile(
  piloti: Piloti,
  dirPath: string,
  baseName = "Untitled",
  content = "",
): Promise<WebVfsEntry> {
  const dir = normalizeVfsPath(dirPath);
  const named = /\.[a-z0-9]+$/i.test(baseName) ? baseName : `${baseName}.txt`;
  const path = joinPath(dir, uniqueName(await namesIn(piloti, dir), named));
  await piloti.vfs.write(path, content);
  const entry = entryFor(path, "file", { content });
  vfsCache.added(entry);
  return entry;
}

/**
 * Lists document templates from `$XDG_TEMPLATES_DIR` (`~/Templates`).
 */
export async function listFsTemplates(
  piloti: Piloti,
  templatesDirPath?: string,
): Promise<WebVfsEntry[]> {
  if (!hasRealFilesystem()) {
    return listVfsTemplates();
  }
  const dir = normalizeVfsPath(templatesDirPath || resolveVfsTemplatesDir());
  const entries = await listFsDir(piloti, dir);
  const dotHidden = entries.find((e) => e.name === ".hidden");
  const hiddenNames = parseDotHiddenFile(dotHidden?.content);
  return entries
    .filter(
      (e) =>
        e.kind === "file" &&
        !e.name.startsWith(".") &&
        !hiddenNames.has(e.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Creates a new file in `dirPath` cloned from an XDG template entry.
 */
export async function createFsFileFromTemplate(
  piloti: Piloti,
  dirPath: string,
  template: { name: string; path: string; content?: string },
): Promise<WebVfsEntry> {
  if (!hasRealFilesystem()) {
    const entry =
      createVfsFileFromTemplate(dirPath, template.path) ??
      createVfsTextFile(dirPath, template.name, template.content ?? "");
    vfsCache.added(entry);
    return entry;
  }
  // A copy, so binary templates stay intact.
  const path = await copyFsEntry(piloti, template.path, dirPath, { name: template.name });
  if (!path) throw new Error(`Could not copy ${template.path}`);
  return entryFor(path, "file");
}

/**
 * Copies files dragged in from outside the shell into a folder, never over one.
 * Returns the created paths (for undo).
 */
export async function importFsFiles(
  piloti: Piloti,
  dirPath: string,
  files: FileList | readonly File[],
): Promise<string[]> {
  const dir = normalizeVfsPath(dirPath);
  // Taken before any await: a drop's FileList is emptied after the event.
  const dropped = Array.from(files);
  if (!hasRealFilesystem()) {
    return (await importExternalFilesToVfs(dir, dropped)).map((e) => e.path);
  }
  const names = await namesIn(piloti, dir);
  const created: string[] = [];
  for (const file of dropped) {
    const name = uniqueName(names, file.name.replace(/[/\\]/g, "_") || "Imported");
    names.add(name.toLowerCase());
    const path = joinPath(dir, name);
    await file
      .arrayBuffer()
      .then((buffer) => piloti.vfs.write(path, new Uint8Array(buffer)))
      .then(() => void created.push(path))
      .catch(logFailure("import", path));
  }
  vfsCache.changedIn(dir);
  return created;
}

/** Tells views that follow a file (desktop cells, open viewers) it has a new path. */
export function announceRename(from: string, to: string): void {
  // The demo's storage announces its own renames.
  if (hasRealFilesystem()) announceVfsRenamed(from, to);
}

/** Renames in place; `null` if nothing was renamed (the name may be taken). */
export async function renameFsEntry(
  piloti: Piloti,
  path: string,
  newName: string,
): Promise<WebVfsEntry | null> {
  const from = normalizeVfsPath(path);
  const name = newName.trim().replace(/[/\\]/g, "");
  if (!name || name === baseName(from)) return null;
  const to = joinPath(parentPath(from), name);
  const kind = (await piloti.vfs.stat(from).catch(() => null))?.kind ?? "file";
  return piloti.vfs
    .move(from, to)
    .then(() => {
      announceRename(from, to);
      const entry = entryFor(to, kind);
      vfsCache.moved(from, entry);
      return entry;
    })
    .catch(logFailure("rename", from));
}

/**
 * Moves into `targetDirPath` under its own name, or `options.name`, numbered if
 * taken; `null` if nothing moved.
 */
export async function moveFsEntry(
  piloti: Piloti,
  path: string,
  targetDirPath: string,
  options: { name?: string } = {},
): Promise<WebVfsEntry | null> {
  const from = normalizeVfsPath(path);
  const dir = normalizeVfsPath(targetDirPath);
  if (dir === WEB_VFS_TRASH) {
    await trashFsEntry(piloti, from);
    return null;
  }
  if (parentPath(from) === dir || dir === from || dir.startsWith(`${from}/`)) return null;
  try {
    const kind = (await piloti.vfs.stat(from))?.kind ?? "file";
    const to = joinPath(dir, uniqueName(await namesIn(piloti, dir), options.name ?? baseName(from)));
    await piloti.vfs.move(from, to);
    const entry = entryFor(to, kind);
    vfsCache.moved(from, entry);
    return entry;
  } catch (error) {
    return logFailure("move", from)(error);
  }
}

/**
 * Copies `srcPath` into `targetDirPath`, or with `symlink` links it there.
 * Returns the created path (null when nothing was created).
 */
export async function copyFsEntry(
  piloti: Piloti,
  srcPath: string,
  targetDirPath: string,
  options: { symlink?: boolean; name?: string } = {},
): Promise<string | null> {
  const src = normalizeVfsPath(srcPath);
  const dir = normalizeVfsPath(targetDirPath);
  if (!options.symlink && (dir === src || dir.startsWith(`${src}/`))) return null;
  try {
    const dest = joinPath(dir, uniqueName(await namesIn(piloti, dir), options.name ?? (baseName(src) || "item")));
    if (options.symlink) {
      await piloti.vfs.symlink((await piloti.vfs.stat(src))?.realPath ?? src, dest);
    } else {
      await piloti.vfs.copy(src, dest);
    }
    vfsCache.changedIn(dir);
    return dest;
  } catch (error) {
    return logFailure("copy", src)(error);
  }
}

const TRASH_INFO = `${parentPath(WEB_VFS_TRASH)}/info`;
const trashInfoNames = async (piloti: Piloti) =>
  new Set(((await piloti.vfs.list(TRASH_INFO).catch(() => null)) ?? []).map((e) => e.name));

/**
 * Moves to the Trash and returns where it went there (`null` if unknown).
 * Trashing what is already in the Trash deletes it for good.
 */
export async function trashFsEntry(piloti: Piloti, path: string): Promise<string | null> {
  const from = normalizeVfsPath(path);
  try {
    const where = await trashFsEntryNow(piloti, from);
    vfsCache.removed(from);
    return where;
  } catch (error) {
    return logFailure("trash", from)(error);
  } finally {
    trashChanged();
  }
}

/** The Trash's listing and the dock's full/empty icon. */
function trashChanged(): void {
  vfsCache.changedIn(WEB_VFS_TRASH);
  void queryClient.invalidateQueries({ queryKey: vfsKeys.trashEmpty(WEB_VFS_TRASH) });
}

async function trashFsEntryNow(piloti: Piloti, from: string): Promise<string | null> {
  if (from.startsWith(`${WEB_VFS_TRASH}/`)) {
    await piloti.vfs.remove(from);
    if (parentPath(from) === WEB_VFS_TRASH) {
      await piloti.vfs.remove(`${TRASH_INFO}/${baseName(from)}.trashinfo`);
    }
    return null;
  }
  if (!hasRealFilesystem()) {
    await piloti.vfs.trash(from);
    const trashed = listVfsDir(WEB_VFS_TRASH, { includeHidden: true })
      .filter((e) => e.trashedFromPath === from)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return trashed?.path ?? null;
  }
  // `gio` picks the name in the Trash: it is the one that was not there before.
  const before = await trashInfoNames(piloti);
  await piloti.vfs.trash(from);
  const added = [...(await trashInfoNames(piloti))].find((name) => !before.has(name));
  return added ? `${WEB_VFS_TRASH}/${added.replace(/\.trashinfo$/, "")}` : null;
}

/** Restores an entry from Trash to its original location. */
export async function restoreFsEntry(
  piloti: Piloti,
  trashPath: string,
): Promise<WebVfsEntry | null> {
  const from = normalizeVfsPath(trashPath);
  const kind = (await piloti.vfs.stat(from).catch(() => null))?.kind ?? "file";
  return piloti.vfs
    .restore(from)
    .then((path) => {
      const entry = entryFor(path, kind);
      vfsCache.moved(from, entry);
      trashChanged();
      return entry;
    })
    .catch(logFailure("restore", from));
}

/** Empties Trash. */
export async function emptyFsTrash(piloti: Piloti): Promise<void> {
  await piloti.vfs.emptyTrash().catch(logFailure("empty", WEB_VFS_TRASH));
  trashChanged();
}

/** Permanently removes a file or folder. */
export async function removeFsFile(
  piloti: Piloti,
  filePath: string,
): Promise<void> {
  const path = normalizeVfsPath(filePath);
  await piloti.vfs.remove(path);
  vfsCache.removed(path);
}

/** The favorite (starred) entries, looked up on disk on Linux. */
export async function listFsFavoriteEntries(
  piloti: Piloti,
): Promise<WebVfsEntry[]> {
  if (!hasRealFilesystem()) return listVfsFavoriteEntries();
  // Another app may have (un)starred files: read the folders' metadata first.
  const dirs = new Set(loadVfsFavorites().map((p) => p.slice(0, p.lastIndexOf("/")) || "/"));
  await Promise.all([...dirs].map((dir) => syncEmblems(piloti, dir)));
  const found = await Promise.all(loadVfsFavorites().map((path) => statEntry(piloti, path)));
  return found.filter((e): e is WebVfsEntry => e !== null);
}

/** The files of `recently-used.xbel`, newest first; `[]` if it can't be read. */
async function readRecentItems(piloti: Piloti): Promise<{ path: string; time: number; mimeType: string }[]> {
  const xml = await readFsTextFile(piloti, RECENTLY_USED_XBEL_PATH);
  if (!xml) return [];
  try {
    return parseRecentlyUsedXbel(xml)
      .filter((item) => item.path && item.path !== "/")
      .map((item) => ({
        path: item.path.replace(/\/+$/, ""),
        time: Date.parse(item.visited || item.modified || item.added),
        mimeType: item.mimeType,
      }))
      .sort((a, b) => (b.time || 0) - (a.time || 0));
  } catch {
    return [];
  }
}

/**
 * Recent files from FreeDesktop `~/.local/share/recently-used.xbel`: on Linux
 * those still on disk, in the demo merged with its own access history.
 */
export async function listFsRecentEntries(
  piloti: Piloti,
): Promise<WebVfsEntry[]> {
  const items = await readRecentItems(piloti);
  const seen = new Set<string>();
  const entries = await Promise.all(
    items
      .filter((item) => !seen.has(item.path) && seen.add(item.path))
      .map(async ({ path, time, mimeType }) => {
        const found = hasRealFilesystem() ? await statEntry(piloti, path) : getVfsEntry(path);
        if (!found && hasRealFilesystem()) return null;
        const thumbnail =
          found?.kind === "file" && hasRealFilesystem()
            ? await piloti.vfs.thumbnail(path).catch(() => undefined)
            : undefined;
        return {
          ...(found ?? entryFor(path, "file")),
          updatedAt: Number.isFinite(time) ? time : (found?.updatedAt ?? Date.now()),
          metadata: {
            ...(found?.metadata ?? {}),
            "standard::content-type": mimeType,
            ...(thumbnail ? { "metadata::thumbnail": thumbnail } : {}),
          },
        } as WebVfsEntry;
      }),
  );
  const byPath = new Map(entries.filter((e): e is WebVfsEntry => e !== null).map((e) => [e.path, e]));
  if (!hasRealFilesystem()) {
    for (const entry of listVfsRecentEntries()) if (!byPath.has(entry.path)) byPath.set(entry.path, entry);
  }
  return Array.from(byPath.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * Records an opened file into FreeDesktop `~/.local/share/recently-used.xbel`.
 */
export async function recordFsRecentFile(
  piloti: Piloti,
  filePath: string,
  mimeType = "application/octet-stream",
): Promise<void> {
  if (!filePath || !filePath.startsWith("/")) return;
  try {
    const xml = await readFsTextFile(piloti, RECENTLY_USED_XBEL_PATH,
    );
    const current = xml ? parseRecentlyUsedXbel(xml) : [];
    const next = upsertRecentXbelItem(current, filePath, mimeType);
    const serialized = serializeRecentlyUsedXbel(next);
    await writeFsTextFile(piloti, RECENTLY_USED_XBEL_PATH, serialized);
  } catch {
    // non-fatal recents write failure
  }
}

/** Archives "Extract Here" can open: zip everywhere, more with bsdtar on Linux. */
export function isExtractableArchive(name: string): boolean {
  return hasRealFilesystem()
    ? /\.(zip|tar|tar\.(gz|xz|bz2|zst)|tgz|txz|tbz2?|7z|rar)$/i.test(name)
    : /\.zip$/i.test(name);
}

/** Zips sibling entries next to them; returns the new archive's path, or null. */
export async function compressFsEntries(
  piloti: Piloti,
  paths: readonly string[],
): Promise<string | null> {
  if (hasRealFilesystem()) return compressNative(piloti, paths);
  return (await compressVfsEntries(paths))?.path ?? null;
}

/** Extracts an archive into a new folder next to it; returns its path, or null. */
export async function extractFsArchive(
  piloti: Piloti,
  path: string,
): Promise<string | null> {
  if (hasRealFilesystem()) return extractNative(piloti, path);
  return (await extractVfsZip(path))?.path ?? null;
}

