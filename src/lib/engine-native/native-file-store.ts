import type { Piloti } from "@/lib/engine/piloti";
import type { FileStore, FileStoreEntry } from "@/lib/ports/file-store";
import { normalizeVfsPath, WEB_VFS_HOME, WEB_VFS_TRASH } from "@/lib/core/vfs-paths";
import { lookupXdgThumbnailDataUrl } from "@/lib/xdg/xdg-thumbnails";
import { emptyXdgTrash, resolveXdgTrashPaths } from "@/lib/xdg/xdg-trash";

const THUMBNAIL_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif|pdf|mp4|mkv|webm|mov)$/i;

/** Parses `gio info -a metadata::*` stdout lines into a key/value map. */
export function parseGioMetadataInfo(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of stdout.split(/\r?\n/)) {
    const match = /^\s*(metadata::[A-Za-z0-9_.:-]+)\s*:\s*(.*)$/.exec(rawLine);
    if (!match) continue;
    const val = match[2].trim();
    if (val) out[match[1]] = val;
  }
  return out;
}

/** Parses `gio list -a metadata::emblems` lines: `name<TAB>size<TAB>(type)<TAB>metadata::emblems=[a, b]`. */
export function parseGioListEmblems(stdout: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of stdout.split("\n")) {
    const cols = line.split("\t");
    const attr = cols.find((c) => c.startsWith("metadata::emblems="));
    if (cols.length < 2 || !attr) continue;
    const names = attr
      .slice("metadata::emblems=".length)
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length > 0) out[cols[0]!] = names;
  }
  return out;
}

/** Parses the `metadata::emblems: [a, b]` line of `gio info`. */
export function parseGioInfoEmblems(stdout: string): string[] {
  const m = /metadata::emblems:\s*\[(.*)\]/.exec(stdout);
  return m ? m[1]!.split(",").map((n) => n.trim()).filter(Boolean) : [];
}

/** `domicile.files` resolves relative paths against `$HOME`. */
export function toDomicilePath(vfsPath: string): string {
  const norm = normalizeVfsPath(vfsPath);
  if (norm === WEB_VFS_HOME) return ".";
  if (norm.startsWith(`${WEB_VFS_HOME}/`)) return norm.slice(WEB_VFS_HOME.length + 1);
  return norm;
}

/** FileStore over the compositor's file calls (`domicile.files`). */
export function createNativeFileStore(piloti: Pick<Piloti, "files" | "processes">): FileStore {
  const stat = async (path: string): Promise<FileStoreEntry | null> => {
    if (typeof piloti.files.stat !== "function") return null;
    const res = await piloti.files.stat(toDomicilePath(path));
    return res.match({
      Ok: (st) => ({
        name: path.slice(path.lastIndexOf("/") + 1),
        kind: st.fileType === 1 ? ("directory" as const) : ("file" as const),
        size: st.size,
        modifiedMs: typeof st.modifiedMs === "number" ? st.modifiedMs : undefined,
        realPath:
          typeof st.realPath === "string" && st.realPath.startsWith("/") ? st.realPath : undefined,
      }),
      Err: () => null,
    });
  };

  const run = async (argv: string[]): Promise<boolean> => {
    const res = await piloti.processes.run(argv).catch(() => null);
    return res?.match({ Ok: (ran) => ran.code === 0, Err: () => false }) ?? false;
  };

  return {
    move: (from, to, options) =>
      run(["mv", ...(options?.noClobber ? ["-n"] : []), "--", toDomicilePath(from), toDomicilePath(to)]),
    copy: (from, to) => run(["cp", "-a", "--", toDomicilePath(from), toDomicilePath(to)]),
    symlink: (target, linkPath) => run(["ln", "-s", "--", target, toDomicilePath(linkPath)]),
    async trash(path) {
      const rel = toDomicilePath(path);
      if (await run(["gio", "trash", "--", rel])) return true;
      return run(["mv", "--", rel, toDomicilePath(WEB_VFS_TRASH)]);
    },
    remove: (path) => run(["rm", "-rf", "--", toDomicilePath(path)]),
    async emblems(dir) {
      const res = await piloti.processes
        .run(["gio", "list", "-a", "metadata::emblems", "--", toDomicilePath(dir)])
        .catch(() => null);
      const out = res?.match({ Ok: (r) => (r.code === 0 ? r.stdout : null), Err: () => null });
      if (out === null || out === undefined) return null;
      return parseGioListEmblems(out);
    },
    async setEmblems(path, names, managed) {
      const rel = toDomicilePath(path);
      const info = await piloti.processes
        .run(["gio", "info", "-a", "metadata::emblems", "--", rel])
        .catch(() => null);
      const current = parseGioInfoEmblems(
        info?.match({ Ok: (r) => r.stdout, Err: () => "" }) ?? "",
      );
      const merged = [...current.filter((n) => !managed.includes(n)), ...names];
      return merged.length === 0
        ? run(["gio", "set", "-t", "unset", "--", rel, "metadata::emblems"])
        : run(["gio", "set", "-t", "stringv", "--", rel, "metadata::emblems", ...merged]);
    },
    async metadata(path, keys) {
      const res = await piloti.processes
        .run(["gio", "info", "-a", keys.join(","), "--", toDomicilePath(path)])
        .catch(() => null);
      const out = res?.match({ Ok: (r) => (r.code === 0 ? r.stdout : ""), Err: () => "" }) ?? "";
      return out ? parseGioMetadataInfo(out) : {};
    },
    async setMetadata(path, patch) {
      const rel = toDomicilePath(path);
      for (const [key, val] of Object.entries(patch)) {
        await run(["gio", "set", "-t", "string", "--", rel, key, String(val)]);
      }
    },
    async emptyTrash() {
      await emptyXdgTrash(piloti.processes, resolveXdgTrashPaths());
    },
    async list(path) {
      const res = await piloti.files.readDir(toDomicilePath(path));
      return res.match({
        Ok: (list) =>
          list.map((item) => ({
            name: item.name,
            kind: item.fileType === 1 ? ("directory" as const) : ("file" as const),
            isSymlink: item.fileType === 2,
          })),
        Err: () => null,
      });
    },
    stat: (path) => stat(path).catch(() => null),
    async readText(path) {
      const res = await piloti.files.readText(toDomicilePath(path));
      return res.match({ Ok: (t) => t, Err: () => null });
    },
    async writeText(path, content) {
      const res = await piloti.files.write(toDomicilePath(path), new TextEncoder().encode(content));
      return res.isOk();
    },
    async createDir(path) {
      const res = await piloti.files.createDir(toDomicilePath(path));
      return res.isOk();
    },
    async thumbnail(realPath, name) {
      if (!THUMBNAIL_EXT_RE.test(name)) return undefined;
      return (await lookupXdgThumbnailDataUrl(piloti, realPath)) ?? undefined;
    },
  };
}
