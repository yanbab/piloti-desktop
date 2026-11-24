/**
 * The real filesystem behind the VFS cache, as the shell sees it. Paths are
 * absolute VFS paths (the real `$HOME` on native); each adapter maps them to
 * whatever its API wants. The browser demo has no store: the VFS is the truth.
 */
export interface FileStoreEntry {
  name: string;
  /** What the path is, following symlinks. */
  kind: "file" | "directory";
  isSymlink?: boolean;
  size?: number;
  modifiedMs?: number;
  /** Absolute path with links resolved. */
  realPath?: string;
}

export interface FileStore {
  /** The entries of a directory, or `null` if it cannot be listed. */
  list(path: string): Promise<FileStoreEntry[] | null>;
  /** Details of one path (symlinks followed), or `null`. */
  stat(path: string): Promise<FileStoreEntry | null>;
  readText(path: string): Promise<string | null>;
  /** Fire and forget from the caller's view; resolves to success. */
  writeText(path: string, content: string): Promise<boolean>;
  createDir(path: string): Promise<boolean>;
  /** Rename or move to a full destination path. `noClobber` keeps an existing target. */
  move(from: string, to: string, options?: { noClobber?: boolean }): Promise<boolean>;
  /** Copy a file or folder (links and modes kept) to a full destination path. */
  copy(from: string, to: string): Promise<boolean>;
  symlink(target: string, linkPath: string): Promise<boolean>;
  /** Move to the user's Trash. */
  trash(path: string): Promise<boolean>;
  /** Delete for good. */
  remove(path: string): Promise<boolean>;
  emptyTrash(): Promise<void>;
  /** `metadata::emblems` of every entry in a folder that has some (file name -> emblem names). */
  emblems?(dir: string): Promise<Record<string, string[]> | null>;
  /**
   * Set a file's `metadata::emblems`, keeping names not in `managed` untouched;
   * an empty result removes the attribute.
   */
  setEmblems?(path: string, names: string[], managed: readonly string[]): Promise<boolean>;
  /** A thumbnail data URL for a real file path, if the platform has one. */
  thumbnail?(realPath: string, name: string): Promise<string | undefined>;
}
