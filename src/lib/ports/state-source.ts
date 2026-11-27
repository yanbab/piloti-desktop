/**
 * Where Piloti's own config and state files are kept, as the shell reads them:
 * synchronously, from what is already loaded. These are the only files held in
 * memory (see `_docs/NOTES.md`). Linux: `engine-native/state-store.ts`; the
 * browser demo: the browser VFS itself (`engine-web/state-source.ts`).
 */
export interface StateFile {
  path: string;
  name: string;
  content: string;
  updatedAt?: number;
}

export interface StateSource {
  /** Every file it holds, for the Console's inspector. */
  files(): StateFile[];
  read(path: string): string | null;
  write(path: string, content: string): void;
  remove(path: string): void;
  /** `listener` runs when the file may have changed, here or on disk. */
  subscribe(path: string, listener: () => void): () => void;
  /** The same for any file directly inside `dir`. */
  subscribeDir(dir: string, listener: () => void): () => void;
  /** Takes a value out of `localStorage`, where early releases kept it (demo). */
  consumeLegacy?(key: string): string | null;
  /** Moves of the storage's own layout (demo; Linux moves its folders itself). */
  migrate?(): void;
}
