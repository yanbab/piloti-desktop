import * as React from "react";
import type { IsolatedAppBridge } from "@/lib/engine/app-bridge";

/**
 * Everything the Text Editor needs from the host it runs in. The in-shell host
 * below is backed by the shell's VFS and contexts. A Domicile app-module host
 * (see docs/APP-MODULES.md) will implement the same port on top of
 * `domicile.files`, so TextEditorApp itself never imports shell modules.
 *
 * `peek*` and state/prefs reads are synchronous cache reads: a remote host must
 * preload its cache before mounting the app.
 */
export interface TextEditorHost {
  /** True when files live on the real filesystem (not the browser demo VFS). */
  nativeFs: boolean;
  /** The shell's window menu is available (false in a frame, which has no shell around it). */
  windowMenu?: boolean;
  normalizePath(path: string): string;
  /** Where an unsaved document goes on first save (the user's Desktop). */
  defaultNewFilePath(name: string): string;
  /** Cached file content/metadata, if the host has it locally. */
  peekFile(path: string): { kind?: string; content?: string; metadata?: Record<string, unknown> } | undefined;
  /** Calls `listener` when this one file changes. */
  watchFile(path: string, listener: () => void): () => void;
  onRenamed(listener: (e: { oldPath: string; newPath: string }) => void): () => void;
  renameFile(path: string, newName: string): { path: string; name: string } | null;
  readMetadata(path: string, keys: readonly string[]): Promise<Record<string, string>>;
  writeMetadata(path: string, patch: Record<string, string | number>): void;
  /** Per-user JSON state by key (cursor, scroll, unsaved text per file). */
  readState<T>(key: string, isValid: (v: unknown) => v is T): T | null;
  writeState(key: string, value: unknown): void;
  /** Editor preferences (`notepad.ini` [Editor]). */
  readEditorPrefs(): Record<string, string>;
  writeEditorPrefs(values: Record<string, string | number | boolean>): void;
  confirmUnsavedOnClose(): boolean;
  /** Close through the shell's animated close when running in-shell. */
  requestAnimatedClose(windowId: string): void;
  onPrintFocused(listener: (detail: { windowId?: string } | undefined) => void): () => void;
  /** Overrides for the window bridge (file RPC, title, close) when the host has no shell to message. */
  bridge?: Partial<Pick<IsolatedAppBridge, "fs" | "setTitle" | "closeWindow">>;
  onBeforeClose(
    listener: (detail: { windowId: string }, e: { preventDefault: () => void }) => void,
  ): () => void;
}

const TextEditorHostContext = React.createContext<TextEditorHost | null>(null);
export const TextEditorHostProvider = TextEditorHostContext.Provider;

/** The host the editor runs in (provided by whoever mounts it). */
export function useTextEditorHost(): TextEditorHost {
  const host = React.useContext(TextEditorHostContext);
  if (!host) throw new Error("TextEditorApp needs a TextEditorHostProvider");
  return host;
}
