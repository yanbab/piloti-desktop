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

import type { TextEditorHost } from "@/lib/engine/text-editor-host";
import { TextEditorHostProvider } from "@/lib/engine/text-editor-host";
import { TextEditorApp, type TextEditorAppProps } from "@/components/apps/TextEditorApp";

export function createInShellEditorHost(
  domicile: Domicile | undefined,
  isBrowserRuntime: boolean,
): TextEditorHost {
  return {
    nativeFs: !isBrowserRuntime,
    normalizePath: normalizeVfsPath,
    defaultNewFilePath: (name) => `/home/user/Desktop/${name}`,
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


/** TextEditorApp running in the shell (or its web iframe) with the shell's host. */
export const ShellTextEditorApp: React.FC<TextEditorAppProps> = (props) => {
  const domicile = useDomicile();
  const isBrowserRuntime = isBrowserDevRuntime();
  const host = React.useMemo(
    () => createInShellEditorHost(domicile, isBrowserRuntime),
    [domicile, isBrowserRuntime],
  );
  return (
    <TextEditorHostProvider value={host}>
      <TextEditorApp {...props} />
    </TextEditorHostProvider>
  );
};
