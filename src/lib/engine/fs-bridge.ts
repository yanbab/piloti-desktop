import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import {
  createVfsFileFromTemplate,
  copyVfsEntry,
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
import { createFileService, type FileService } from "@/lib/core/file-service";
import { createNativeFileStore, toDomicilePath } from "@/lib/engine-native/native-file-store";
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

function fileServiceFor(domicile: Domicile): FileService {
  return createFileService({
    store: hasRealFilesystem() ? createNativeFileStore(domicile) : null,
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
    },
  });
}

/**
 * Lists directory entries from `domicile.files` on Linux (Domicile runtime)
 * or `web-vfs` in browser mode.
 */
export async function listFsDir(
  domicile: Domicile,
  dirPath: string,
): Promise<WebVfsEntry[]> {
  return fileServiceFor(domicile).listDir(dirPath);
}

/**
 * Reads a UTF-8 text file via `domicile.files` on Linux or `web-vfs` in browser mode.
 */
export async function readFsTextFile(
  domicile: Domicile,
  filePath: string,
): Promise<string> {
  return fileServiceFor(domicile).readText(filePath);
}

/**
 * Writes a UTF-8 text file to `web-vfs` and (on Linux) persists via `domicile.files.write`.
 */
export function writeFsTextFile(
  domicile: Domicile,
  filePath: string,
  content: string,
): WebVfsEntry | null {
  return fileServiceFor(domicile).writeText(filePath, content);
}

/**
 * Creates a new folder in `dirPath` on both `web-vfs` and `domicile.files`.
 */
export function createFsFolder(
  domicile: Domicile,
  dirPath: string,
  baseName?: string,
): WebVfsEntry {
  return fileServiceFor(domicile).createFolder(dirPath, baseName);
}

/**
 * Creates a new text file in `dirPath` on both `web-vfs` and `domicile.files`.
 */
export function createFsTextFile(
  domicile: Domicile,
  dirPath: string,
  baseName?: string,
  content = "",
): WebVfsEntry {
  return fileServiceFor(domicile).createTextFile(dirPath, baseName, content);
}

/**
 * Lists document templates from `$XDG_TEMPLATES_DIR` (`~/Templates`).
 */
export async function listFsTemplates(
  domicile: Domicile,
  templatesDirPath?: string,
): Promise<WebVfsEntry[]> {
  if (!hasRealFilesystem()) {
    return listVfsTemplates();
  }
  const dir = normalizeVfsPath(templatesDirPath || resolveVfsTemplatesDir());
  const entries = await listFsDir(domicile, dir);
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
  domicile: Domicile,
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
      : await readFsTextFile(domicile, template.path);
  return createFsTextFile(domicile, dirPath,
    template.name,
    content,
  );
}

/** Renames a file or folder (cache and disk). */
export function renameFsEntry(
  domicile: Domicile,
  path: string,
  newName: string,
): WebVfsEntry | null {
  return fileServiceFor(domicile).rename(path, newName);
}

/** Moves a file or folder into `targetDirPath` (cache and disk). */
export function moveFsEntry(
  domicile: Domicile,
  path: string,
  targetDirPath: string,
): WebVfsEntry | null {
  return fileServiceFor(domicile).move(path, targetDirPath);
}

/**
 * Copies `srcPath` into `targetDirPath`, or with `symlink` links it there.
 * Returns the created path (null when nothing was created).
 */
export async function copyFsEntry(
  domicile: Domicile,
  srcPath: string,
  targetDirPath: string,
  options: { symlink?: boolean; name?: string } = {},
): Promise<string | null> {
  return fileServiceFor(domicile).copy(srcPath, targetDirPath, options);
}

/** Moves an entry to Trash (cache and XDG Trash). */
export function trashFsEntry(domicile: Domicile, path: string): void {
  fileServiceFor(domicile).trash(path);
}

/** Restores an entry from Trash to its original location. */
export function restoreFsEntry(
  domicile: Domicile,
  trashPath: string,
): WebVfsEntry | null {
  return fileServiceFor(domicile).restore(trashPath);
}

/** Empties Trash. */
export async function emptyFsTrash(domicile: Domicile): Promise<void> {
  await fileServiceFor(domicile).emptyTrash();
}

/** Permanently removes a file or folder. */
export async function removeFsFile(
  domicile: Domicile,
  filePath: string,
): Promise<void> {
  await fileServiceFor(domicile).remove(filePath);
}

/** The favorite (starred) entries, looked up on disk on Linux. */
export async function listFsFavoriteEntries(
  domicile: Domicile,
): Promise<WebVfsEntry[]> {
  if (!hasRealFilesystem()) return listVfsFavoriteEntries();
  const service = fileServiceFor(domicile);
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
  domicile: Domicile,
): Promise<WebVfsEntry[]> {
  const vfsRecents = listVfsRecentEntries();
  const byPath = new Map<string, WebVfsEntry>();

  try {
    const xml = await readFsTextFile(domicile, RECENTLY_USED_XBEL_PATH,
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
  filePath: string,
  mimeType = "application/octet-stream",
): Promise<void> {
  if (!filePath || !filePath.startsWith("/")) return;
  try {
    const xml = await readFsTextFile(domicile, RECENTLY_USED_XBEL_PATH,
    );
    const current = xml ? parseRecentlyUsedXbel(xml) : [];
    const next = upsertRecentXbelItem(current, filePath, mimeType);
    const serialized = serializeRecentlyUsedXbel(next);
    writeFsTextFile(domicile, RECENTLY_USED_XBEL_PATH, serialized);
  } catch {
    // non-fatal recents write failure
  }
}

/**
 * Parses `gio info -a metadata::*` stdout lines into a key/value map.
 */
export function parseGioMetadataInfo(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of stdout.split(/\r?\n/)) {
    const match = /^\s*(metadata::[A-Za-z0-9_.:-]+)\s*:\s*(.*)$/.exec(rawLine);
    if (!match) continue;
    const key = match[1];
    const val = match[2].trim();
    if (val) {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Reads `metadata::*` attributes from `web-vfs` and (on Linux) `gio info` (`gvfsd-metadata`).
 */
export async function readFsMetadata(
  domicile: Domicile | undefined,
  filePath: string,
  keys: readonly string[],
): Promise<Record<string, string>> {
  const norm = normalizeVfsPath(filePath);
  const out: Record<string, string> = {};
  const cached = getVfsEntry(norm)?.metadata;
  if (cached) {
    for (const key of keys) {
      const val = cached[key];
      if (val !== undefined && val !== null && String(val) !== "") {
        out[key] = String(val);
      }
    }
  }
  if (!hasRealFilesystem() || !domicile || isSimulatedUsbPath(norm) || keys.length === 0) {
    return out;
  }
  try {
    const res = await domicile.processes.run([
      "gio",
      "info",
      "-a",
      keys.join(","),
      "--",
      toDomicilePath(norm),
    ]);
    const stdout = res.match({
      Ok: (ran) => (ran.code === 0 ? ran.stdout : ""),
      Err: () => "",
    });
    if (stdout) {
      const parsed = parseGioMetadataInfo(stdout);
      if (Object.keys(parsed).length > 0) {
        Object.assign(out, parsed);
        setVfsEntryMetadata(norm, parsed);
      }
    }
  } catch {
    // ignore missing gio / gvfsd-metadata
  }
  return out;
}

/**
 * Persists `metadata::*` attributes to `web-vfs` and (on Linux) `gio set` (`gvfsd-metadata`).
 */
export function writeFsMetadata(
  domicile: Domicile | undefined,
  filePath: string,
  patch: Record<string, string | number>,
): void {
  const norm = normalizeVfsPath(filePath);
  setVfsEntryMetadata(norm, patch);
  if (!hasRealFilesystem() || !domicile || isSimulatedUsbPath(norm)) {
    return;
  }
  const rel = toDomicilePath(norm);
  for (const [key, val] of Object.entries(patch)) {
    void domicile.processes
      .run(["gio", "set", "-t", "string", "--", rel, key, String(val)])
      .catch(() => undefined);
  }
}
