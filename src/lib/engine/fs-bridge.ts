import type { Piloti } from "@/lib/engine/piloti";
import {
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
  listVfsDir,
  listVfsRecentEntries,
  listVfsTemplates,
  moveVfsEntry,
  normalizeVfsPath,
  parseDotHiddenFile,
  removeVfsEntry,
  renameVfsEntry,
  resolveVfsTemplatesDir,
  restoreVfsEntry,
  setVfsEntryMetadata,
  trashVfsEntry,
  WEB_VFS_HOME,
  WEB_VFS_TEMPLATES,
  WEB_VFS_TRASH,
  type WebVfsEntry,
  writeVfsTextFile,
  listVfsFavoriteEntries,
  syncVfsEmblemsFromHost,
  loadVfsFavorites,
} from "@/lib/engine-web/web-vfs";
import {
  parseRecentlyUsedXbel,
  serializeRecentlyUsedXbel,
  upsertRecentXbelItem,
} from "@/lib/xdg/xdg-recents";
import { getEngine } from "@/lib/engine/engine";
import { compressNative, extractNative } from "@/lib/engine-native/archive";
import { createFileService, type FileService } from "@/lib/core/file-service";
import { watchNativeDir } from "@/lib/engine-native/file-watch";
import { hostFiles } from "@/lib/engine/host-files";
import {
  createNativeFileStore,
  parseGioMetadataInfo,
  toDomicilePath,
} from "@/lib/engine-native/native-file-store";
import { isSimulatedUsbPath } from "@/lib/engine-web/usb-drive";

const RECENTLY_USED_XBEL_PATH = `${WEB_VFS_HOME}/.local/share/recently-used.xbel`;

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

export { toDomicilePath };

/** The file operations for the current engine: the demo VFS alone, or the VFS cache over `domicile.files`. */
/** Files live on a real disk (the VFS is a cache), as opposed to the browser VFS being the only copy. */
const hasRealFilesystem = (): boolean => getEngine().capabilities.realFilesystem;

function fileServiceFor(piloti: Piloti): FileService {
  return createFileService({
    onDiskChange: notifyVfsChanged,
    store: hasRealFilesystem() ? createNativeFileStore(piloti) : null,
    cacheOnly: isSimulatedUsbPath,
    cache: {
      getVfsEntry,
      listVfsDir,
      writeVfsTextFile,
      createVfsFolder,
      createVfsTextFile,
      renameVfsEntry,
      moveVfsEntry,
      copyVfsEntry,
      createVfsSymlink,
      trashVfsEntry,
      restoreVfsEntry,
      removeVfsEntry,
      emptyVfsTrash,
      syncVfsEmblemsFromHost,
      setVfsEntryMetadata,
    },
  });
}

/**
 * Lists directory entries from `domicile.files` on Linux (Domicile runtime)
 * or `web-vfs` in browser mode.
 */
export async function listFsDir(
  piloti: Piloti,
  dirPath: string,
): Promise<WebVfsEntry[]> {
  return fileServiceFor(piloti).listDir(dirPath);
}

/**
 * Reads a UTF-8 text file via `domicile.files` on Linux or `web-vfs` in browser mode.
 */
export async function readFsTextFile(
  piloti: Piloti,
  filePath: string,
): Promise<string> {
  return fileServiceFor(piloti).readText(filePath);
}

/**
 * Writes a UTF-8 text file to `web-vfs` and (on Linux) persists via `domicile.files.write`.
 */
export function writeFsTextFile(
  piloti: Piloti,
  filePath: string,
  content: string,
): WebVfsEntry | null {
  return fileServiceFor(piloti).writeText(filePath, content);
}

/**
 * Creates a new folder in `dirPath` on both `web-vfs` and `domicile.files`.
 */
export function createFsFolder(
  piloti: Piloti,
  dirPath: string,
  baseName?: string,
): WebVfsEntry {
  return fileServiceFor(piloti).createFolder(dirPath, baseName);
}

/**
 * Creates a new text file in `dirPath` on both `web-vfs` and `domicile.files`.
 */
export function createFsTextFile(
  piloti: Piloti,
  dirPath: string,
  baseName?: string,
  content = "",
): WebVfsEntry {
  return fileServiceFor(piloti).createTextFile(dirPath, baseName, content);
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
  if (!hasRealFilesystem() || isSimulatedUsbPath(dirPath)) {
    return (
      createVfsFileFromTemplate(dirPath, template.path) ??
      createVfsTextFile(dirPath, template.name, template.content ?? "")
    );
  }
  const content =
    template.content !== undefined
      ? template.content
      : await readFsTextFile(piloti, template.path);
  return createFsTextFile(piloti, dirPath,
    template.name,
    content,
  );
}

/** Renames a file or folder (cache and disk). */
export function renameFsEntry(
  piloti: Piloti,
  path: string,
  newName: string,
): WebVfsEntry | null {
  return fileServiceFor(piloti).rename(path, newName);
}

/** Moves a file or folder into `targetDirPath` (cache and disk). */
export function moveFsEntry(
  piloti: Piloti,
  path: string,
  targetDirPath: string,
): WebVfsEntry | null {
  return fileServiceFor(piloti).move(path, targetDirPath);
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
  return fileServiceFor(piloti).copy(srcPath, targetDirPath, options);
}

/** Moves an entry to Trash (cache and XDG Trash). */
export function trashFsEntry(piloti: Piloti, path: string): void {
  fileServiceFor(piloti).trash(path);
}

/** Restores an entry from Trash to its original location. */
export function restoreFsEntry(
  piloti: Piloti,
  trashPath: string,
): WebVfsEntry | null {
  return fileServiceFor(piloti).restore(trashPath);
}

/** Empties Trash. */
export async function emptyFsTrash(piloti: Piloti): Promise<void> {
  await fileServiceFor(piloti).emptyTrash();
}

/** Permanently removes a file or folder. */
export async function removeFsFile(
  piloti: Piloti,
  filePath: string,
): Promise<void> {
  await fileServiceFor(piloti).remove(filePath);
}

/** The favorite (starred) entries, looked up on disk on Linux. */
export async function listFsFavoriteEntries(
  piloti: Piloti,
): Promise<WebVfsEntry[]> {
  if (!hasRealFilesystem()) return listVfsFavoriteEntries();
  const service = fileServiceFor(piloti);
  // Another app may have (un)starred files: read the folders' metadata first.
  const dirs = new Set(loadVfsFavorites().map((p) => p.slice(0, p.lastIndexOf("/")) || "/"));
  await Promise.all([...dirs].map((dir) => service.syncEmblems(dir)));
  const found = await Promise.all(loadVfsFavorites().map((path) => service.statEntry(path)));
  return found.filter((e): e is WebVfsEntry => e !== null);
}

/**
 * Lists recent files from FreeDesktop `~/.local/share/recently-used.xbel`
 * merged with Piloti's local VFS recent access history.
 */
export async function listFsRecentEntries(
  piloti: Piloti,
): Promise<WebVfsEntry[]> {
  const vfsRecents = listVfsRecentEntries();
  const byPath = new Map<string, WebVfsEntry>();

  try {
    const xml = await readFsTextFile(piloti, RECENTLY_USED_XBEL_PATH,
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
    writeFsTextFile(piloti, RECENTLY_USED_XBEL_PATH, serialized);
  } catch {
    // non-fatal recents write failure
  }
}

export { parseGioMetadataInfo };

/**
 * Reads `metadata::*` attributes from `web-vfs` and (on Linux) `gio info` (`gvfsd-metadata`).
 */
export async function readFsMetadata(
  piloti: Piloti | undefined,
  filePath: string,
  keys: readonly string[],
): Promise<Record<string, string>> {
  const norm = normalizeVfsPath(filePath);
  if (!piloti) return metadataFromCache(norm, keys);
  return fileServiceFor(piloti).readMetadata(norm, keys);
}

function metadataFromCache(norm: string, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const cached = getVfsEntry(norm)?.metadata;
  for (const key of keys) {
    const val = cached?.[key];
    if (val !== undefined && val !== null && String(val) !== "") out[key] = String(val);
  }
  return out;
}

/**
 * Persists `metadata::*` attributes to `web-vfs` and (on Linux) `gio set` (`gvfsd-metadata`).
 */
export function writeFsMetadata(
  piloti: Piloti | undefined,
  filePath: string,
  patch: Record<string, string | number>,
): void {
  const norm = normalizeVfsPath(filePath);
  if (!piloti) {
    setVfsEntryMetadata(norm, patch);
    return;
  }
  fileServiceFor(piloti).writeMetadata(norm, patch);
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

/**
 * Calls `onChange` when a folder's content changes: operations made here, and
 * on a real filesystem also changes made by other programs.
 */
export function watchFsDir(piloti: Piloti, dirPath: string, onChange: () => void): () => void {
  const unsubscribe = subscribeVfs(onChange, { path: dirPath, mode: "children" });
  const stop = hasRealFilesystem() ? watchNativeDir(hostFiles(piloti), dirPath, onChange) : null;
  return () => {
    unsubscribe();
    stop?.();
  };
}
