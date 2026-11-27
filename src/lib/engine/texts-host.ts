import * as React from "react";
import type { IsolatedAppBridge } from "@/lib/engine/app-bridge";
import type { Vfs } from "@/lib/ports/vfs";

/**
 * Everything the Texts needs from the host it runs in: the shell, or a
 * Domicile app module (see docs/ARCHITECTURE.md). Files go through `vfs` on
 * both, so TextsApp itself never imports shell modules.
 *
 * State and prefs reads are synchronous: a host loads them before mounting.
 */
export interface TextsHost {
  vfs: Pick<Vfs, "readText" | "write" | "stat" | "watch" | "move" | "metadata" | "setMetadata">;
  normalizePath(path: string): string;
  /** Where an unsaved document goes on first save (the user's Desktop). */
  defaultNewFilePath(name: string): string;
  /** Told which file the editor holds (`null`: a new document). */
  opened?(path: string | null): void;
  /** For a host whose window closes without asking the shell first. */
  guardClose?(mustAsk: () => boolean, ask: () => void): () => void;
  /** Told after the editor renames its file. */
  moved?(from: string, to: string): void;
  /** Another part of the host renamed a file. */
  onRenamed(listener: (e: { oldPath: string; newPath: string }) => void): () => void;
  /** Per-user JSON state by key (cursor, scroll, unsaved text per file). */
  readState<T>(key: string, isValid: (v: unknown) => v is T): T | null;
  writeState(key: string, value: unknown): void;
  /** Editor preferences (`piloti-texts/settings.ini` [Editor]). */
  readEditorPrefs(): Record<string, string>;
  writeEditorPrefs(values: Record<string, string | number | boolean>): void;
  confirmUnsavedOnClose(): boolean;
  /** Close through the shell's animated close when running in-shell. */
  requestAnimatedClose(windowId: string): void;
  onPrintFocused(listener: (detail: { windowId?: string } | undefined) => void): () => void;
  /** Overrides for the window bridge (title, close) when the host has no shell to message. */
  bridge?: Partial<Pick<IsolatedAppBridge, "setTitle" | "closeWindow">>;
  onBeforeClose(
    listener: (detail: { windowId: string }, e: { preventDefault: () => void }) => void,
  ): () => void;
}

const TextsHostContext = React.createContext<TextsHost | null>(null);
export const TextsHostProvider = TextsHostContext.Provider;

/** The host the editor runs in (provided by whoever mounts it). */
export function useTextsHost(): TextsHost {
  const host = React.useContext(TextsHostContext);
  if (!host) throw new Error("TextsApp needs a TextsHostProvider");
  return host;
}
