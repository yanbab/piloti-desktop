/**
 * What an app is handed by whoever runs it: the shell, or its own process as a
 * Domicile app module. An app that takes everything from here (and settings
 * from `defineSettings`) can run in either.
 */
import type { Apps } from "@/lib/ports/apps";
import type { Vfs } from "@/lib/ports/vfs";

export interface AppHost {
  vfs: Vfs;
  apps: Apps;
  /**
   * What the app remembers by itself (`~/.local/state/piloti/<key>.json`).
   * Synchronous: a host loads it before the app mounts.
   */
  readState<T>(key: string, isValid: (v: unknown) => v is T): T | null;
  writeState(key: string, value: unknown): void;
  /** Closes the app's window. */
  close(windowId: string): void;
}
