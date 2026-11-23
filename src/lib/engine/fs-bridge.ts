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
        const isSymlink = item.fileType === 2;
        let kind: "directory" | "file" = item.fileType === 1 ? "directory" : "file";
        let symlinkTarget: string | undefined;
        let size = cached?.size;
        let updatedAt = cached?.updatedAt ?? now;
        let realPath: string | undefined;
        if ((kind === "file" || isSymlink) && canStat) {
          try {
            const statRes = await domicile.files.stat(toDomicilePath(entryPath));
            statRes.match({
              Ok: (st) => {
                if (isSymlink) {
                  if (st.fileType === 1) kind = "directory";
                  if (typeof st.realPath === "string" && st.realPath.startsWith("/")) {
                    symlinkTarget = st.realPath;
                  }
                }
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
        let content = cached?.content;
        if (kind === "file" && item.name === ".hidden") {
          try {
            const textRes = await domicile.files.readText(toDomicilePath(entryPath));
            textRes.match({
              Ok: (t) => {
                content = t;
                writeVfsTextFile(entryPath, t);
              },
              Err: () => {},
            });
          } catch {
            // ignore .hidden read errors
          }
        }
        return {
          id: entryPath,
          name: item.name,
          kind,
          path: entryPath,
          parentPath: normDir,
          content,
          size,
          updatedAt,
          metadata,
          ...(isSymlink ? { isSymlink: true, symlinkTarget } : {}),
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
 * Lists document templates from `$XDG_TEMPLATES_DIR` (`~/Templates`).
 */
export async function listFsTemplates(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  templatesDirPath?: string,
): Promise<WebVfsEntry[]> {
  if (isBrowserRuntime) {
    return listVfsTemplates();
  }
  const dir = normalizeVfsPath(templatesDirPath || resolveVfsTemplatesDir());
  const entries = await listFsDir(domicile, isBrowserRuntime, dir);
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
  isBrowserRuntime: boolean,
  dirPath: string,
  template: { name: string; path: string; content?: string },
): Promise<WebVfsEntry> {
  if (isBrowserRuntime || isSimulatedUsbPath(dirPath)) {
    return (
      createVfsFileFromTemplate(dirPath, template.path) ??
      createVfsTextFile(dirPath, template.name, template.content ?? "")
    );
  }
  const content =
    template.content !== undefined
      ? template.content
      : await readFsTextFile(domicile, isBrowserRuntime, template.path);
  return createFsTextFile(
    domicile,
    isBrowserRuntime,
    dirPath,
    template.name,
    content,
  );
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
  if (!moved && !isBrowserRuntime && !isSimulatedUsbPath(path) && !isSimulatedUsbPath(targetDirPath)) {
    // Native files are not always mirrored in the VFS cache: move on disk anyway.
    const base = normalizeVfsPath(path).split("/").filter(Boolean).pop();
    if (base) {
      const dir = normalizeVfsPath(targetDirPath);
      const newRel = toDomicilePath(`${dir === "/" ? "" : dir}/${base}`);
      if (oldRel !== newRel) void domicile.processes.run(["mv", "-n", "--", oldRel, newRel]);
    }
    return null;
  }
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

/** First name in `dir` not already used, "Name.ext" → "Name 2.ext" (reads the real directory). */
async function uniqueNativeName(
  domicile: Domicile,
  dir: string,
  name: string,
): Promise<string> {
  const res = await domicile.files.readDir(toDomicilePath(dir)).catch(() => undefined);
  const existing = new Set(
    res?.match({ Ok: (list) => list.map((e) => e.name.toLowerCase()), Err: () => [] as string[] }) ?? [],
  );
  if (!existing.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0;
  const stem = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : "";
  let index = 2;
  while (existing.has(`${stem} ${index}${ext}`.toLowerCase())) index += 1;
  return `${stem} ${index}${ext}`;
}

/**
 * Copies `srcPath` into `targetDirPath`, or with `symlink` creates a symbolic
 * link to it there. Returns the created path (null when nothing was created).
 * In the browser the copy / link lives in the web VFS.
 */
export async function copyFsEntry(
  domicile: Domicile,
  isBrowserRuntime: boolean,
  srcPath: string,
  targetDirPath: string,
  options: { symlink?: boolean; name?: string } = {},
): Promise<string | null> {
  const src = normalizeVfsPath(srcPath);
  const dir = normalizeVfsPath(targetDirPath);
  if (isBrowserRuntime || isSimulatedUsbPath(src) || isSimulatedUsbPath(dir)) {
    const created = options.symlink ? createVfsSymlink(src, dir, options.name) : copyVfsEntry(src, dir);
    return created?.path ?? null;
  }
  const baseName = options.name ?? src.split("/").filter(Boolean).pop() ?? "item";
  if (!options.symlink && (dir === src || dir.startsWith(`${src}/`))) return null;
  const name = await uniqueNativeName(domicile, dir, baseName);
  const dest = `${dir === "/" ? "" : dir}/${name}`;
  if (options.symlink) {
    let absTarget = src;
    const st = await domicile.files.stat(toDomicilePath(src)).catch(() => undefined);
    const real = st?.match({ Ok: (s) => s.realPath, Err: () => undefined });
    if (real && real.startsWith("/")) absTarget = real;
    await domicile.processes.run(["ln", "-s", "--", absTarget, toDomicilePath(dest)]).catch(() => undefined);
  } else {
    await domicile.processes
      .run(["cp", "-a", "--", toDomicilePath(src), toDomicilePath(dest)])
      .catch(() => undefined);
  }
  return dest;
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
  isBrowserRuntime: boolean,
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
  if (isBrowserRuntime || !domicile || isSimulatedUsbPath(norm) || keys.length === 0) {
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
  isBrowserRuntime: boolean,
  filePath: string,
  patch: Record<string, string | number>,
): void {
  const norm = normalizeVfsPath(filePath);
  setVfsEntryMetadata(norm, patch);
  if (isBrowserRuntime || !domicile || isSimulatedUsbPath(norm)) {
    return;
  }
  const rel = toDomicilePath(norm);
  for (const [key, val] of Object.entries(patch)) {
    void domicile.processes
      .run(["gio", "set", "-t", "string", "--", rel, key, String(val)])
      .catch(() => undefined);
  }
}
