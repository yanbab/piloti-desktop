import { getEngine } from "@/lib/engine/engine";
import * as React from "react";
import { usePiloti, type Piloti } from "@/lib/engine/piloti";
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
import { VFS_HOME } from "@/lib/engine/vfs-home";
import { emitShellEvent, onShellEvent } from "@/lib/shell/shell-events";

import type { TextEditorHost } from "@/lib/engine/text-editor-host";
import { TextEditorHostProvider } from "@/lib/engine/text-editor-host";
import { TextEditorApp, type TextEditorAppProps } from "@/components/apps/TextEditorApp";

const stateFile = (key: string) => `${VFS_HOME}/.local/state/piloti/${key}.json`;

export function createInShellEditorHost(
  piloti: Piloti | undefined,
): TextEditorHost {
  return {
    nativeFs: getEngine().capabilities.realFilesystem,
    windowMenu: typeof window === "undefined" || window.parent === window,
    normalizePath: normalizeVfsPath,
    defaultNewFilePath: (name) => `${VFS_HOME}/Desktop/${name}`,
    peekFile: (path) => getVfsEntry(path),
    watchFile: (path, listener) =>
      subscribeWebVfs(() => listener(), { path, mode: "exact" }),
    onRenamed: subscribeVfsRenamed,
    renameFile: (path, newName) => {
      const r = renameVfsEntry(path, newName);
      return r ? { path: r.path, name: r.name } : null;
    },
    readMetadata: (path, keys) => readFsMetadata(piloti, path, keys),
    writeMetadata: (path, patch) =>
      writeFsMetadata(piloti, path, patch),
    readState: (key, isValid) =>
      readVfsStateJson(stateFile(key), undefined, isValid),
    writeState: (key, value) => {
      writeVfsStateJson(stateFile(key), value, false);
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
  const piloti = usePiloti();
  const host = React.useMemo(() => createInShellEditorHost(piloti), [piloti]);
  return (
    <TextEditorHostProvider value={host}>
      <TextEditorApp {...props} />
    </TextEditorHostProvider>
  );
};
