import * as React from "react";
import { usePiloti, type Piloti } from "@/lib/engine/piloti";
import {
  getCachedPilotiAppIni,
  shouldConfirmUnsavedOnClose,
  writePilotiAppIni,
} from "@/lib/config/piloti-ini";
import { readVfsStateJson, writeVfsStateJson } from "@/lib/engine/vfs-state";
import { normalizeVfsPath } from "@/lib/core/vfs-paths";
import { subscribeRenames } from "@/lib/engine/renames";
import { announceRename, moveKeepingEmblems } from "@/lib/engine/fs-bridge";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import { emitShellEvent, onShellEvent } from "@/lib/core/shell-events";

import type { TextEditorHost } from "@/lib/engine/text-editor-host";
import { TextEditorHostProvider } from "@/lib/engine/text-editor-host";
import { TextEditorApp, type TextEditorAppProps } from "@/apps/text-editor/TextEditorApp";

const stateFile = (key: string) => `${VFS_HOME}/.local/state/piloti/${key}.json`;

export function createInShellEditorHost(piloti: Piloti): TextEditorHost {
  return {
    // The title rename keeps the file's emblems, as Folders does.
    vfs: { ...piloti.vfs, move: (from, to) => moveKeepingEmblems(piloti, from, to) },
    normalizePath: normalizeVfsPath,
    defaultNewFilePath: (name) => `${VFS_HOME}/Desktop/${name}`,
    onRenamed: subscribeRenames,
    moved: announceRename,
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
