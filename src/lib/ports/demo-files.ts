import type { WebVfsEntry } from "@/lib/core/vfs-paths";

/**
 * What the browser demo does itself with its files, where Linux asks a program
 * (`xdg-open`) or the disk. Only for `!realFilesystem`; the web entry point
 * sets it (`engine-web/demo-files.ts`).
 */
export interface DemoFileEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  content?: string;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

export interface DemoFiles {
  /** Read synchronously from the browser VFS. */
  entry(path: string): DemoFileEntry | undefined;
  /** An object URL showing the file as a web page. */
  pageUrl(file: DemoFileEntry): string;
  isTextEditable(name: string): boolean;
  recordAccess(path: string): void;
  /** Returns the folder it made. */
  extract(path: string): Promise<WebVfsEntry | undefined>;
  download(path: string): void;
  /** Calls `onChange` when something directly inside `dir` changes. */
  watchFolder(dir: string, onChange: () => void): () => void;
}

const none: DemoFiles = {
  entry: () => undefined,
  pageUrl: () => "about:blank",
  isTextEditable: () => false,
  recordAccess: () => undefined,
  extract: async () => undefined,
  download: () => undefined,
  watchFolder: () => () => undefined,
};

let current: DemoFiles = none;

export function setDemoFiles(next: DemoFiles): void {
  current = next;
}

export const demoFiles = (): DemoFiles => current;
