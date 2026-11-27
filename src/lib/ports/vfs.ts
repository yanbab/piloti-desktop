/**
 * The one filesystem API (`piloti.vfs`). Linux: the disk, watched
 * (`engine-native/vfs.ts`). Browser demo: the browser VFS
 * (`engine-web/vfs.ts`). Paths are absolute. Every operation is async, and
 * failures reject with a `VfsError`.
 */
export interface VfsEntry {
  name: string;
  path: string;
  /** What the path is, following symlinks. A dangling link is a file. */
  kind: "file" | "directory";
}

export interface VfsListedEntry extends VfsEntry {
  isSymlink?: boolean;
}

export interface VfsStat extends VfsEntry {
  size?: number;
  modifiedMs?: number;
  /** The path with every link resolved. */
  realPath: string;
}

export interface Vfs {
  /** `null` if there is no such file. */
  readText(path: string): Promise<string | null>;
  read(path: string): Promise<Uint8Array | null>;
  /** The folder must exist. A symlink keeps being one: its target is written. */
  write(path: string, data: string | Uint8Array): Promise<void>;
  stat(path: string): Promise<VfsStat | null>;
  /** Every entry, hidden ones included, or `null` if there is no such folder. Sizes come from `stat`. */
  list(dir: string): Promise<VfsListedEntry[] | null>;
  /**
   * Calls `onChange` once the watch is in place, then whenever the file or
   * folder may have changed (own writes included): read there. A folder's
   * watch does not cover its subfolders. The path may be missing. Returns stop.
   */
  watch(path: string, onChange: () => void): () => void;
  /** Creates missing parents; an existing folder is fine. */
  createDir(path: string): Promise<void>;
  /** `to` is the full new path. An existing `to` rejects unless `overwrite`. */
  move(from: string, to: string, options?: { overwrite?: boolean }): Promise<void>;
  /** `to` is the full path of the copy; an existing `to` rejects. */
  copy(from: string, to: string): Promise<void>;
  symlink(target: string, linkPath: string): Promise<void>;
  /** Moves to the user's Trash. */
  trash(path: string): Promise<void>;
  /** Puts a trashed entry back (under another name if taken); returns its path. */
  restore(trashPath: string): Promise<string>;
  /** Deletes for good, folders with their content. A missing path is fine. */
  remove(path: string): Promise<void>;
  emptyTrash(): Promise<void>;
  /** The `metadata::*` values that are set, among `keys`. */
  metadata(path: string, keys: readonly string[]): Promise<Record<string, string>>;
  setMetadata(path: string, patch: Record<string, string | number>): Promise<void>;
  /** A thumbnail data URL, if there is one. */
  thumbnail(path: string): Promise<string | undefined>;
}

export type VfsErrorCode = "not-found" | "exists" | "failed";

export class VfsError extends Error {
  constructor(
    readonly code: VfsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VfsError";
  }
}

export const parentPath = (path: string): string => path.slice(0, path.lastIndexOf("/")) || "/";
export const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
export const joinPath = (dir: string, name: string): string => `${dir === "/" ? "" : dir}/${name}`;

/** First name in `existing` (lower case) not used yet: "Name.ext" -> "Name 2.ext". */
export function uniqueName(existing: ReadonlySet<string>, name: string): string {
  if (!existing.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  while (existing.has(`${stem} ${index}${ext}`.toLowerCase())) index += 1;
  return `${stem} ${index}${ext}`;
}

/** Runs the writes of one path in the order they were asked. */
export function createPathQueue() {
  const tails = new Map<string, Promise<unknown>>();
  return <T>(paths: readonly string[], run: () => Promise<T>): Promise<T> => {
    const before = paths.map((p) => tails.get(p));
    const result = Promise.all(before).then(run);
    const tail = result.catch(() => undefined);
    for (const p of paths) tails.set(p, tail);
    void tail.then(() => {
      for (const p of paths) if (tails.get(p) === tail) tails.delete(p);
    });
    return result;
  };
}
