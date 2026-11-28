/**
 * What an app is handed by whoever runs it: the shell, or its own process as a
 * Domicile app module. An app that takes everything from here (and settings
 * from `defineSettings`) can run in either.
 */
import type { Apps } from "@/core/ports/apps";
import type { Vfs } from "@/core/ports/vfs";

export interface AppHost {
  vfs: Vfs;
  apps: Apps;
  /** The user's folder, localized on Linux (`~/Bureau`…). */
  userDir(kind: "DESKTOP"): string;
  /**
   * What the app remembers by itself (`~/.local/state/piloti/<key>.json`).
   * Synchronous: a host loads it before the app mounts.
   */
  readState<T>(key: string, isValid: (v: unknown) => v is T): T | null;
  writeState(key: string, value: unknown): void;
  notify(notification: { summary: string; body?: string }): void;
  /** Closes the app's window. */
  close(windowId: string): void;
}

/** For an app whose window holds a file: an editor, a viewer. */
export interface DocumentHost extends AppHost {
  normalizePath(path: string): string;
  /** Renames in place; the new path, or `null` if it could not. */
  rename(path: string, name: string): Promise<string | null>;
  /** Told which file the window holds (`null`: a new document). */
  opened?(path: string | null): void;
  /** Told after the app renames its file itself. */
  moved?(from: string, to: string): void;
  /** Another part of the desktop renamed or moved a file. */
  onRenamed(listener: (e: { oldPath: string; newPath: string }) => void): () => void;
  /** The setting that asks before closing a window with unsaved changes. */
  confirmUnsavedOnClose(): boolean;
  /** For a host whose window closes without asking the shell first. */
  guardClose?(mustAsk: () => boolean, ask: () => void): () => void;
  onBeforeClose(
    listener: (detail: { windowId: string }, e: { preventDefault: () => void }) => void,
  ): () => void;
  /** Overrides for the window bridge when there is no shell to message. */
  bridge?: { setTitle?: (title: string) => void; closeWindow?: () => void };
}
