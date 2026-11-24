import { basename, dirname, normalizeVfsPath, type WebVfsEntry } from "@/lib/core/vfs-paths";
import type { FileStore } from "@/lib/ports/file-store";

/** The VFS cache operations the service builds on (supplied by the engine wiring). */
export interface VfsCacheApi {
  getVfsEntry(path: string): WebVfsEntry | undefined;
  listVfsDir(path: string): WebVfsEntry[];
  writeVfsTextFile(path: string, content: string): WebVfsEntry | null;
  createVfsFolder(dirPath: string, baseName?: string): WebVfsEntry;
  createVfsTextFile(dirPath: string, baseName?: string, content?: string): WebVfsEntry;
  renameVfsEntry(path: string, newName: string): WebVfsEntry | null;
  moveVfsEntry(path: string, targetDirPath: string): WebVfsEntry | null;
  copyVfsEntry(src: string, targetDirPath: string): WebVfsEntry | null;
  createVfsSymlink(src: string, targetDirPath: string, name?: string): WebVfsEntry | null;
  trashVfsEntry(path: string): void;
  restoreVfsEntry(trashPath: string): WebVfsEntry | null;
  removeVfsEntry(path: string): boolean;
  emptyVfsTrash(): void;
}

export interface FileServiceDeps {
  /** `null` in the browser demo: the cache is the only copy. */
  store: FileStore | null;
  cache: VfsCacheApi;
  /** Paths that exist only in the cache even when a store is present (simulated USB sticks). */
  cacheOnly?: (path: string) => boolean;
}

/**
 * File operations the UI calls. Reads fill the VFS cache from the store;
 * writes update the cache first (so subscribers see them at once) and then
 * persist to the store in the background.
 */
export interface FileService {
  listDir(dirPath: string): Promise<WebVfsEntry[]>;
  readText(filePath: string): Promise<string>;
  writeText(filePath: string, content: string): WebVfsEntry | null;
  createFolder(dirPath: string, baseName?: string): WebVfsEntry;
  createTextFile(dirPath: string, baseName?: string, content?: string): WebVfsEntry;
  rename(path: string, newName: string): WebVfsEntry | null;
  move(path: string, targetDirPath: string): WebVfsEntry | null;
  /** Copies (or with `symlink` links) into a folder; resolves to the created path. */
  copy(
    srcPath: string,
    targetDirPath: string,
    options?: { symlink?: boolean; name?: string },
  ): Promise<string | null>;
  trash(path: string): void;
  restore(trashPath: string): WebVfsEntry | null;
  remove(path: string): Promise<void>;
  emptyTrash(): Promise<void>;
}

const join = (dir: string, name: string) => `${dir === "/" ? "" : dir}/${name}`;

/** First name in `names` not used yet: "Name.ext" -> "Name 2.ext". */
export function uniqueName(existing: ReadonlySet<string>, name: string): string {
  if (!existing.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  while (existing.has(`${stem} ${index}${ext}`.toLowerCase())) index += 1;
  return `${stem} ${index}${ext}`;
}

export function createFileService({ store, cache, cacheOnly }: FileServiceDeps): FileService {
  const backed = (path: string): FileStore | null =>
    store && !cacheOnly?.(path) ? store : null;

  return {
    async listDir(dirPath) {
      const normDir = normalizeVfsPath(dirPath);
      const s = backed(normDir);
      if (!s) return cache.listVfsDir(normDir);
      try {
        const items = await s.list(normDir);
        if (!items) return cache.listVfsDir(normDir);
        const now = Date.now();
        return await Promise.all(
          items.map(async (item): Promise<WebVfsEntry> => {
            const entryPath = `${normDir === "/" ? "" : normDir}/${item.name}`;
            const cached = cache.getVfsEntry(entryPath);
            let kind = item.kind;
            let symlinkTarget: string | undefined;
            let size = cached?.size;
            let updatedAt = cached?.updatedAt ?? now;
            let realPath: string | undefined;
            if (kind === "file" || item.isSymlink) {
              const st = await s.stat(entryPath).catch(() => null);
              if (st) {
                if (item.isSymlink) {
                  if (st.kind === "directory") kind = "directory";
                  if (st.realPath) symlinkTarget = st.realPath;
                }
                size = st.size ?? size;
                if (typeof st.modifiedMs === "number") updatedAt = st.modifiedMs;
                if (st.realPath) realPath = st.realPath;
              }
            }
            let metadata = cached?.metadata;
            if (kind === "file" && realPath && !metadata?.["metadata::thumbnail"] && s.thumbnail) {
              const thumb = await s.thumbnail(realPath, item.name);
              if (thumb) metadata = { ...(metadata ?? {}), "metadata::thumbnail": thumb };
            }
            let content = cached?.content;
            if (kind === "file" && item.name === ".hidden") {
              const text = await s.readText(entryPath).catch(() => null);
              if (text !== null) {
                content = text;
                cache.writeVfsTextFile(entryPath, text);
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
              ...(item.isSymlink ? { isSymlink: true, symlinkTarget } : {}),
            };
          }),
        );
      } catch {
        return cache.listVfsDir(normDir);
      }
    },

    async readText(filePath) {
      const norm = normalizeVfsPath(filePath);
      const s = backed(norm);
      if (s) {
        try {
          const text = await s.readText(norm);
          if (text !== null) {
            cache.writeVfsTextFile(norm, text);
            return text;
          }
        } catch {
          // fall back to the cache
        }
      }
      const entry = cache.getVfsEntry(norm);
      return entry?.kind === "file" ? (entry.content ?? "") : "";
    },

    writeText(filePath, content) {
      const norm = normalizeVfsPath(filePath);
      const updated = cache.writeVfsTextFile(norm, content);
      void backed(norm)?.writeText(norm, content);
      return updated;
    },

    createFolder(dirPath, baseName) {
      const created = cache.createVfsFolder(dirPath, baseName);
      void backed(created.path)?.createDir(created.path);
      return created;
    },

    createTextFile(dirPath, baseName, content = "") {
      const created = cache.createVfsTextFile(dirPath, baseName, content);
      void backed(created.path)?.writeText(created.path, content);
      return created;
    },

    rename(path, newName) {
      const from = normalizeVfsPath(path);
      const renamed = cache.renameVfsEntry(from, newName);
      // The cache may not know the entry (native files appear in it once listed): still rename on disk.
      const to = renamed?.path ?? join(dirname(from), newName);
      if (from !== to) void backed(from)?.move(from, to);
      return renamed;
    },

    move(path, targetDirPath) {
      const from = normalizeVfsPath(path);
      const dir = normalizeVfsPath(targetDirPath);
      const moved = cache.moveVfsEntry(from, dir);
      const to = moved?.path ?? join(dir, basename(from));
      const s = backed(from);
      if (s && !cacheOnly?.(dir) && from !== to) void s.move(from, to, { noClobber: !moved });
      return moved;
    },

    async copy(srcPath, targetDirPath, options = {}) {
      const src = normalizeVfsPath(srcPath);
      const dir = normalizeVfsPath(targetDirPath);
      const s = backed(src);
      if (!s || cacheOnly?.(dir)) {
        const created = options.symlink
          ? cache.createVfsSymlink(src, dir, options.name)
          : cache.copyVfsEntry(src, dir);
        return created?.path ?? null;
      }
      if (!options.symlink && (dir === src || dir.startsWith(`${src}/`))) return null;
      const listed = await s.list(dir).catch(() => null);
      const existing = new Set((listed ?? []).map((e) => e.name.toLowerCase()));
      const dest = join(dir, uniqueName(existing, options.name ?? (basename(src) || "item")));
      if (options.symlink) {
        const st = await s.stat(src).catch(() => null);
        await s.symlink(st?.realPath ?? src, dest).catch(() => false);
      } else {
        await s.copy(src, dest).catch(() => false);
      }
      return dest;
    },

    trash(path) {
      const norm = normalizeVfsPath(path);
      cache.trashVfsEntry(norm);
      void backed(norm)?.trash(norm);
    },

    restore(trashPath) {
      const norm = normalizeVfsPath(trashPath);
      const restored = cache.restoreVfsEntry(norm);
      const s = backed(norm);
      if (s && restored && !cacheOnly?.(restored.path)) void s.move(norm, restored.path);
      return restored;
    },

    async remove(path) {
      const norm = normalizeVfsPath(path);
      cache.removeVfsEntry(norm);
      await backed(norm)?.remove(norm);
    },

    async emptyTrash() {
      cache.emptyVfsTrash();
      await store?.emptyTrash();
    },
  };
}
