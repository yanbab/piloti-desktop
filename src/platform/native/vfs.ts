/**
 * `piloti.vfs` on Linux: the disk, through Domicile's file calls, coreutils and
 * `gio`. Nothing is cached. Paths are absolute.
 */
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { parseGioMetadataInfo } from "@/platform/native/gio";
import { createWatchHub, type WatchHubOptions } from "@/platform/native/vfs-watch";
import {
  baseName,
  createPathQueue,
  joinPath,
  parentPath,
  uniqueName,
  VfsError,
  type Vfs,
  type VfsStat,
} from "@/core/ports/vfs";
import { parseTrashInfo } from "@/core/xdg/xdg-trash";
import { lookupXdgThumbnailDataUrl } from "@/core/xdg/xdg-thumbnails";

/** Domicile's `FileType` and `SystemErrorKind` values. */
const DIRECTORY = 1;
const SYMLINK = 2;
const NOT_FOUND = 0;

/** What a shell has, and an app module too (no `files.search`, no `processes.launch`). */
export type NativeVfsHost = {
  files: Omit<Domicile["files"], "search">;
  processes: Pick<Domicile["processes"], "run">;
};

export function createNativeVfs(domicile: NativeVfsHost, watchOptions?: WatchHubOptions): Vfs {
  const { files, processes } = domicile;
  const queue = createPathQueue();

  /** A Domicile result's value; `null` for a missing path, a rejection otherwise. */
  const found = async <T>(
    call: Promise<{ match<R>(on: { Ok: (v: T) => R; Err: (e: { kind: number; message: string }) => R }): R }>,
    what: string,
  ): Promise<T | null> => {
    const result = await call;
    return result.match<T | null>({
      Ok: (value) => value,
      Err: (error) => {
        if (error.kind === NOT_FOUND) return null;
        throw new VfsError("failed", `${what}: ${error.message}`);
      },
    });
  };

  const run = async (argv: string[]): Promise<string> => {
    const result = await processes.run(argv);
    return result.match({
      Ok: (ran) => {
        if (ran.code !== 0) throw new VfsError("failed", `${argv[0]}: ${ran.stderr?.trim() || `exit ${ran.code}`}`);
        return ran.stdout;
      },
      Err: (error) => {
        throw new VfsError("failed", `${argv[0]}: ${error.message}`);
      },
    });
  };

  const stat = async (path: string): Promise<VfsStat | null> => {
    const st = await found(files.stat(path), path);
    if (!st) return null;
    return {
      name: baseName(path),
      path,
      kind: st.fileType === DIRECTORY ? "directory" : "file",
      size: st.size,
      modifiedMs: st.modifiedMs,
      realPath: st.realPath ?? path,
    };
  };

  /** Where a link to something missing points, else `null`. */
  const danglingTarget = async (path: string): Promise<string | null> => {
    const siblings = await found(files.readDir(parentPath(path)), path);
    if (!siblings?.some((e) => e.name === baseName(path) && e.fileType === SYMLINK)) return null;
    return (await run(["readlink", "-m", "--", path])).replace(/\n$/, "");
  };

  const list: Vfs["list"] = async (dir) => {
    if ((await stat(dir))?.kind !== "directory") return null;
    const entries = await found(files.readDir(dir), dir);
    if (!entries) return null;
    return Promise.all(
      entries.map(async (entry) => {
        const path = joinPath(dir, entry.name);
        if (entry.fileType !== SYMLINK) {
          return { name: entry.name, path, kind: entry.fileType === DIRECTORY ? ("directory" as const) : ("file" as const) };
        }
        const target = await stat(path).catch(() => null);
        return { name: entry.name, path, kind: target?.kind ?? ("file" as const), isSymlink: true };
      }),
    );
  };

  /** Whether anything has the name, a dangling link included. */
  const taken = async (path: string) =>
    Boolean((await list(parentPath(path)))?.some((e) => e.name === baseName(path)));

  const requireSource = async (path: string) => {
    if (!(await taken(path))) throw new VfsError("not-found", `${path}: no such file`);
  };
  const requireFree = async (path: string) => {
    if (await taken(path)) throw new VfsError("exists", `${path} already exists`);
  };

  // `-T`: `to` is the new path itself, never a folder to put things into.
  const move = async (from: string, to: string, overwrite: boolean) => {
    await requireSource(from);
    if (!overwrite) await requireFree(to);
    await run(["mv", "-T", ...(overwrite ? [] : ["-n"]), "--", from, to]);
  };

  const hub = createWatchHub(
    {
      stat: (path) => stat(path).catch(() => null),
      async watchDir(dir, listener) {
        const result = await files.watch(dir);
        return result.match({
          Ok: (listening) => {
            const reader = listening.items.getReader();
            void (async () => {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                // `Missed`: the compositor restarted and changes went unheard.
                listener("item" in value ? value.item : null);
              }
            })().catch(() => undefined);
            return { stop: () => listening.stop() };
          },
          Err: () => null,
        });
      },
    },
    watchOptions,
  );

  return {
    readText: (path) => found(files.readText(path), path),
    read: (path) => found(files.read(path), path),
    write: (path, data) =>
      queue([path], async () => {
        // Domicile replaces the file, which would turn a symlink into a plain one.
        const target = (await stat(path))?.realPath ?? (await danglingTarget(path)) ?? path;
        const result = await files.write(target, data);
        result.match({
          Ok: () => undefined,
          Err: (error) => {
            throw new VfsError(error.kind === NOT_FOUND ? "not-found" : "failed", `${path}: ${error.message}`);
          },
        });
      }),
    stat,
    list,
    watch: (path, onChange) => hub.watch(path, onChange),
    createDir: (path) => queue([path], async () => void (await run(["mkdir", "-p", "--", path]))),
    move: (from, to, options) => queue([from, to], () => move(from, to, Boolean(options?.overwrite))),
    copy: (from, to) =>
      queue([from, to], async () => {
        await requireSource(from);
        await requireFree(to);
        await run(["cp", "-a", "-T", "--", from, to]);
      }),
    symlink: (target, linkPath) =>
      queue([linkPath], async () => {
        await requireFree(linkPath);
        await run(["ln", "-s", "-T", "--", target, linkPath]);
      }),
    trash: (path) => queue([path], async () => void (await run(["gio", "trash", "--", path]))),
    async restore(trashPath) {
      // FreeDesktop trash: `files/<name>` is described by `info/<name>.trashinfo`.
      const infoPath = joinPath(joinPath(parentPath(parentPath(trashPath)), "info"), `${baseName(trashPath)}.trashinfo`);
      const raw = await found(files.readText(infoPath), infoPath);
      const info = raw === null ? null : parseTrashInfo(raw);
      if (!info || !info.originalPath.startsWith("/")) {
        throw new VfsError("not-found", `${trashPath}: where it came from is unknown`);
      }
      const dir = parentPath(info.originalPath);
      await run(["mkdir", "-p", "--", dir]);
      const names = new Set((await list(dir))?.map((e) => e.name.toLowerCase()));
      const to = joinPath(dir, uniqueName(names, baseName(info.originalPath)));
      await queue([trashPath, to], async () => {
        await move(trashPath, to, false);
        await run(["rm", "-f", "--", infoPath]);
      });
      return to;
    },
    remove: (path) =>
      queue([path], async () => {
        if (!path.startsWith("/") || path.replace(/\/+/g, "/") === "/") {
          throw new VfsError("failed", `refusing to delete "${path}"`);
        }
        await run(["rm", "-rf", "--", path]);
      }),
    emptyTrash: async () => void (await run(["gio", "trash", "--empty"])),
    async metadata(path, keys) {
      return parseGioMetadataInfo(await run(["gio", "info", "-a", keys.join(","), "--", path]));
    },
    setMetadata: (path, patch) =>
      queue([path], async () => {
        for (const [key, value] of Object.entries(patch)) {
          await run(["gio", "set", "-t", "string", "--", path, key, String(value)]);
        }
      }),
    async thumbnail(path) {
      const realPath = (await stat(path))?.realPath;
      if (!realPath) return undefined;
      return (await lookupXdgThumbnailDataUrl(domicile, realPath)) ?? undefined;
    },
  };
}
