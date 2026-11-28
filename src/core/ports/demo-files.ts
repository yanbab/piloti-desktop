import type { WebVfsEntry } from "@/core/files/vfs-paths";

/**
 * What the browser demo does itself with its files, where Linux asks a program
 * (`xdg-open`) or the disk. Only for `!realFilesystem`; the web entry point
 * sets it (`engine-web/demo-files.ts`).
 */
export interface DemoFiles {
  /** Read synchronously from the browser VFS. */
  entry(path: string): WebVfsEntry | undefined;
  /** An object URL showing the file as a web page. */
  pageUrl(file: WebVfsEntry): string;
  isTextEditable(name: string): boolean;
  recordAccess(path: string): void;
  /** Returns the folder it made. */
  extract(path: string): Promise<WebVfsEntry | undefined>;
  download(path: string): void;
  /** Calls `onChange` when something directly inside `dir` changes. */
  watchFolder(dir: string, onChange: () => void): () => void;
  /** The same for any change, for listings that gather files from anywhere. */
  watchAll(onChange: () => void): () => void;

  // The demo's side of `engine/fs-bridge.ts`.
  list(dir: string, options?: { includeHidden?: boolean }): WebVfsEntry[];
  templates(): WebVfsEntry[];
  /** From the demo's `user-dirs.dirs`. */
  templatesDir(): string;
  createFromTemplate(dir: string, template: { name: string; path: string; content?: string }): WebVfsEntry;
  /** Copies files from outside the page into `dir`. */
  importFiles(dir: string, files: FileList | readonly File[]): Promise<WebVfsEntry[]>;
  /** Where the entry trashed from `path` went, or `null`. */
  trashedPath(path: string): string | null;
  favorites(): WebVfsEntry[];
  /** From the demo's own access history. */
  recents(): WebVfsEntry[];
  /** Returns the archive's path. */
  compress(paths: readonly string[]): Promise<string | null>;
  writeText(path: string, text: string): void;
}

const none: DemoFiles = {
  entry: () => undefined,
  pageUrl: () => "about:blank",
  isTextEditable: () => false,
  recordAccess: () => undefined,
  extract: async () => undefined,
  download: () => undefined,
  watchFolder: () => () => undefined,
  watchAll: () => () => undefined,
  list: () => [],
  templates: () => [],
  templatesDir: () => "",
  createFromTemplate: () => {
    throw new Error("Only the browser demo creates files this way");
  },
  importFiles: async () => [],
  trashedPath: () => null,
  favorites: () => [],
  recents: () => [],
  compress: async () => null,
  writeText: () => undefined,
};

let current: DemoFiles = none;

export function setDemoFiles(next: DemoFiles): void {
  current = next;
}

export const demoFiles = (): DemoFiles => current;
