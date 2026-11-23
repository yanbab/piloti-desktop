import * as React from "react";
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { isBrowserDevRuntime } from "@/context/SettingsContext";
import {
  getCachedPilotiAppIni,
  shouldConfirmUnsavedOnClose,
  writePilotiAppIni,
} from "@/lib/config/piloti-ini";
import { readFsMetadata, writeFsMetadata } from "@/lib/engine/fs-bridge";
import { readVfsStateJson, writeVfsStateJson } from "@/lib/engine/vfs-state";
import {
  getVfsEntry,
  normalizeVfsPath,
  renameVfsEntry,
  subscribeVfsRenamed,
  subscribeWebVfs,
} from "@/lib/engine-web/web-vfs";
import { emitShellEvent, onShellEvent } from "@/lib/shell/shell-events";

/**
 * Everything the Text Editor needs from the host it runs in. The in-shell host
 * below is backed by the shell's VFS and contexts. A Domicile app-module host
 * (see _docs/APP-ARCHITECTURE.md) will implement the same port on top of
 * `domicile.files`, so TextEditorApp itself never imports shell modules.
 *
 * `peek*` and state/prefs reads are synchronous cache reads: a remote host must
 * preload its cache before mounting the app.
 */
export interface TextEditorHost {
  /** True when files live on the real filesystem (not the browser demo VFS). */
  nativeFs: boolean;
  normalizePath(path: string): string;
  /** Cached file content/metadata, if the host has it locally. */
  peekFile(path: string): { kind?: string; content?: string; metadata?: Record<string, unknown> } | undefined;
  /** Calls `listener` when this one file changes. */
  watchFile(path: string, listener: () => void): () => void;
  onRenamed(listener: (e: { oldPath: string; newPath: string }) => void): () => void;
  renameFile(path: string, newName: string): { path: string; name: string } | null;
  readMetadata(path: string, keys: readonly string[]): Promise<Record<string, string>>;
  writeMetadata(path: string, patch: Record<string, string | number>): void;
  /** Per-user JSON state (cursor, scroll, unsaved text per file). */
  readState<T>(path: string, isValid: (v: unknown) => v is T): T | null;
  writeState(path: string, value: unknown): void;
  /** Editor preferences (`notepad.ini` [Editor]). */
  readEditorPrefs(): Record<string, string>;
  writeEditorPrefs(values: Record<string, string | number | boolean>): void;
  confirmUnsavedOnClose(): boolean;
  /** Close through the shell's animated close when running in-shell. */
  requestAnimatedClose(windowId: string): void;
  onPrintFocused(listener: (detail: { windowId?: string } | undefined) => void): () => void;
  onBeforeClose(
    listener: (detail: { windowId: string }, e: { preventDefault: () => void }) => void,
  ): () => void;
}

export function createInShellEditorHost(
  domicile: Domicile | undefined,
  isBrowserRuntime: boolean,
): TextEditorHost {
  return {
    nativeFs: !isBrowserRuntime,
    normalizePath: normalizeVfsPath,
    peekFile: (path) => getVfsEntry(path),
    watchFile: (path, listener) =>
      subscribeWebVfs(() => listener(), { path, mode: "exact" }),
    onRenamed: subscribeVfsRenamed,
    renameFile: (path, newName) => {
      const r = renameVfsEntry(path, newName);
      return r ? { path: r.path, name: r.name } : null;
    },
    readMetadata: (path, keys) => readFsMetadata(domicile, false, path, keys),
    writeMetadata: (path, patch) =>
      writeFsMetadata(domicile, isBrowserRuntime, path, patch),
    readState: (path, isValid) =>
      readVfsStateJson(path, undefined, isValid),
    writeState: (path, value) => {
      writeVfsStateJson(path, value, false);
    },
    readEditorPrefs: () => getCachedPilotiAppIni("notepad").Editor ?? {},
    writeEditorPrefs: (values) => {
      void writePilotiAppIni(null, "notepad", "Editor", values);
    },
    confirmUnsavedOnClose: shouldConfirmUnsavedOnClose,
    requestAnimatedClose: (windowId) =>
      emitShellEvent("piloti:request-animated-close", { windowId }),
    onPrintFocused: (listener) => onShellEvent("piloti:print-focused", listener),
    onBeforeClose: (listener) =>
      onShellEvent("piloti:before-close-window", listener),
  };
}

const TextEditorHostContext = React.createContext<TextEditorHost | null>(null);
export const TextEditorHostProvider = TextEditorHostContext.Provider;

/** The host the editor runs in; defaults to the in-shell host. */
export function useTextEditorHost(): TextEditorHost {
  const provided = React.useContext(TextEditorHostContext);
  const domicile = useDomicile();
  const isBrowserRuntime = isBrowserDevRuntime();
  const inShell = React.useMemo(
    () => createInShellEditorHost(domicile, isBrowserRuntime),
    [domicile, isBrowserRuntime],
  );
  return provided ?? inShell;
}
