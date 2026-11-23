import { normalizeVfsPath, type WebVfsEntry } from "@/lib/core/vfs-paths";
import type { FileStore } from "@/lib/ports/file-store";

/** The VFS cache operations the service builds on (supplied by the engine wiring). */
export interface VfsCacheApi {
  getVfsEntry(path: string): WebVfsEntry | undefined;
  listVfsDir(path: string): WebVfsEntry[];
  writeVfsTextFile(path: string, content: string): WebVfsEntry | null;
  createVfsFolder(dirPath: string, baseName?: string): WebVfsEntry;
  createVfsTextFile(dirPath: string, baseName?: string, content?: string): WebVfsEntry;
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
  };
}
