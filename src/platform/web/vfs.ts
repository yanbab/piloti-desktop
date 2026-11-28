/**
 * `piloti.vfs` in the browser demo: the home folder (and the simulated USB
 * stick) is the browser VFS; system folders are the shipped files, read through
 * the demo's Domicile.
 */
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { getVfsImageThumbnailUrl } from "@/core/files/vfs-media";
import { WEB_VFS_TRASH, type WebVfsEntry } from "@/core/files/vfs-paths";
import { createDemoProc } from "@/platform/web/proc";
import {
  copyVfsEntry,
  createVfsSymlink,
  emptyVfsTrash,
  ensureVfsDir,
  getVfsEntry,
  listVfsDir,
  moveVfsEntry,
  normalizeVfsPath,
  removeVfsEntry,
  renameVfsEntry,
  restoreVfsEntry,
  setVfsEntryMetadata,
  subscribeWebVfs,
  trashVfsEntry,
  writeVfsTextFile,
} from "@/platform/web/web-vfs";
import { VFS_HOME } from "@/core/state/vfs-home";
import { baseName, createPathQueue, joinPath, parentPath, VfsError, type Vfs } from "@/core/ports/vfs";

const inProc = (path: string) => path === "/proc" || path.startsWith("/proc/");

const inBrowserVfs = (path: string) =>
  [VFS_HOME, "/media/user"].some((root) => path === root || path.startsWith(`${root}/`));

/** The entry a path leads to, through symlinks. */
function resolve(path: string, hops = 0): WebVfsEntry | undefined {
  const entry = getVfsEntry(path);
  if (!entry?.isSymlink || !entry.symlinkTarget || hops > 8) return entry;
  return resolve(entry.symlinkTarget, hops + 1) ?? entry;
}

function required(path: string): WebVfsEntry {
  const entry = getVfsEntry(path);
  if (!entry) throw new VfsError("not-found", `${path}: no such file`);
  return entry;
}

function requireFolder(path: string): void {
  if (resolve(path)?.kind !== "directory") throw new VfsError("not-found", `${path}: no such folder`);
}

function requireFree(path: string): void {
  if (getVfsEntry(path)) throw new VfsError("exists", `${path} already exists`);
}

/** Binary content is stored as a base64 data URL. */
function toContent(data: string | Uint8Array): string {
  if (typeof data === "string") return data;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    let binary = "";
    for (const byte of data) binary += String.fromCharCode(byte);
    return `data:application/octet-stream;base64,${btoa(binary)}`;
  }
}

function toBytes(content: string): Uint8Array {
  const base64 = /^data:[^,]*;base64,/.exec(content);
  // Anything else is text, `data:…;utf8,` pictures included.
  if (!base64) return new TextEncoder().encode(content);
  return Uint8Array.from(atob(content.slice(base64[0].length)), (c) => c.charCodeAt(0));
}

/** The browser VFS moves into a folder keeping the name; give it the asked one. */
function renameTo(entry: WebVfsEntry | null, to: string): void {
  if (!entry) throw new VfsError("failed", `could not write ${to}`);
  if (entry.name !== baseName(to) && !renameVfsEntry(entry.path, baseName(to))) {
    throw new VfsError("failed", `could not name ${to}`);
  }
}

export function createWebVfs(domicile: Pick<Domicile, "files">): Vfs {
  const { files } = domicile;
  const queue = createPathQueue();
  const proc = createDemoProc();
  const ok = <T,>(call: Promise<{ match<R>(on: { Ok: (v: T) => R; Err: () => R }): R }>) =>
    call.then((result) => result.match<T | null>({ Ok: (v) => v, Err: () => null }));

  const stat: Vfs["stat"] = async (path) => {
    if (inProc(path)) {
      const kind = proc.list(path) ? ("directory" as const) : ("file" as const);
      // Sizes are 0, as on Linux; only listings tell which files exist.
      const exists = kind === "directory" || proc.list(parentPath(path))?.some((e) => e.name === baseName(path));
      return exists ? { name: baseName(path), path, kind, size: 0, modifiedMs: Date.now(), realPath: path } : null;
    }
    if (!inBrowserVfs(path)) {
      const st = await ok(files.stat(path));
      if (!st) return null;
      const kind = st.fileType === 1 ? "directory" : "file";
      return { name: baseName(path), path, kind, size: st.size, modifiedMs: st.modifiedMs, realPath: path };
    }
    const entry = resolve(normalizeVfsPath(path));
    if (!entry) return null;
    return {
      name: baseName(path),
      path,
      kind: entry.kind,
      size: entry.size ?? entry.content?.length ?? 0,
      modifiedMs: entry.updatedAt,
      realPath: entry.path,
    };
  };

  const readContent = (path: string): string | null => {
    const entry = resolve(path);
    return entry?.kind === "file" ? (entry.content ?? "") : null;
  };

  return {
    readText: async (path) => {
      if (inProc(path)) return proc.read(path);
      return inBrowserVfs(path) ? readContent(path) : ok(files.readText(path));
    },
    async read(path) {
      if (inProc(path)) {
        const text = proc.read(path);
        return text === null ? null : toBytes(text);
      }
      if (!inBrowserVfs(path)) return ok(files.read(path));
      const content = readContent(path);
      return content === null ? null : toBytes(content);
    },
    write: (path, data) =>
      queue([path], async () => {
        requireFolder(parentPath(path));
        const entry = resolve(path);
        if (entry?.kind === "directory") throw new VfsError("failed", `${path} is a folder`);
        writeVfsTextFile(entry?.path ?? path, toContent(data));
      }),
    stat,
    async list(dir) {
      if (inProc(dir)) return proc.list(dir)?.map((e) => ({ ...e, path: joinPath(dir, e.name) })) ?? null;
      if (!inBrowserVfs(dir)) {
        const entries = await ok(files.readDir(dir));
        return (
          entries?.map((e) => ({
            name: e.name,
            path: joinPath(dir, e.name),
            kind: e.fileType === 1 ? ("directory" as const) : ("file" as const),
          })) ?? null
        );
      }
      const folder = resolve(dir);
      if (folder?.kind !== "directory") return null;
      return listVfsDir(folder.path, { includeHidden: true }).map((e) => ({
        name: e.name,
        path: joinPath(dir, e.name),
        kind: e.kind,
        ...(e.isSymlink ? { isSymlink: true } : {}),
      }));
    },
    watch(path, onChange) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const schedule = () => {
        timer ??= setTimeout(() => {
          timer = null;
          onChange();
        }, 0);
      };
      const target = resolve(path)?.path;
      const paths = target && target !== path ? [path, target] : [path];
      const unsubscribe = subscribeWebVfs(
        schedule,
        paths.flatMap((p) => [
          { path: p, mode: "exact" as const },
          { path: p, mode: "children" as const },
        ]),
      );
      schedule();
      return () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
    },
    createDir: (path) =>
      queue([path], async () => {
        const entry = getVfsEntry(path);
        if (entry && entry.kind !== "directory") throw new VfsError("exists", `${path} is a file`);
        ensureVfsDir(path);
      }),
    move: (from, to, options) =>
      queue([from, to], async () => {
        const source = required(from);
        requireFolder(parentPath(to));
        if (getVfsEntry(to)) {
          if (!options?.overwrite) requireFree(to);
          removeVfsEntry(to);
        }
        if (parentPath(from) === parentPath(to)) renameTo(source, to);
        else renameTo(moveVfsEntry(from, parentPath(to)), to);
      }),
    copy: (from, to) =>
      queue([from, to], async () => {
        required(from);
        requireFolder(parentPath(to));
        requireFree(to);
        renameTo(copyVfsEntry(from, parentPath(to)), to);
      }),
    symlink: (target, linkPath) =>
      queue([linkPath], async () => {
        requireFree(linkPath);
        required(target);
        if (!createVfsSymlink(target, parentPath(linkPath), baseName(linkPath))) {
          throw new VfsError("failed", `could not link ${linkPath}`);
        }
      }),
    trash: (path) =>
      queue([path], async () => {
        required(path);
        if (path.startsWith(`${WEB_VFS_TRASH}/`)) throw new VfsError("failed", `${path} is already in the Trash`);
        ensureVfsDir(WEB_VFS_TRASH);
        trashVfsEntry(path);
      }),
    async restore(trashPath) {
      // Anything else would be moved out of its place (the home folder itself).
      if (!trashPath?.startsWith(`${WEB_VFS_TRASH}/`)) {
        throw new VfsError("not-found", `${trashPath}: not in the Trash`);
      }
      required(trashPath);
      const restored = restoreVfsEntry(trashPath);
      if (!restored) throw new VfsError("failed", `could not restore ${trashPath}`);
      return restored.path;
    },
    remove: (path) => queue([path], async () => void removeVfsEntry(path)),
    emptyTrash: async () => emptyVfsTrash(),
    async metadata(path, keys) {
      const metadata = required(path).metadata ?? {};
      return Object.fromEntries(
        keys.flatMap((key) => (metadata[key] === undefined ? [] : [[key, String(metadata[key])]])),
      );
    },
    setMetadata: (path, patch) =>
      queue([path], async () => {
        required(path);
        setVfsEntryMetadata(path, patch);
      }),
    async thumbnail(path) {
      const entry = resolve(path);
      return entry ? getVfsImageThumbnailUrl(entry.name, entry.content, entry.metadata) : undefined;
    },
  };
}
