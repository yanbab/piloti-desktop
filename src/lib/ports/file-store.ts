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
  /** A thumbnail data URL for a real file path, if the platform has one. */
  thumbnail?(realPath: string, name: string): Promise<string | undefined>;
}
