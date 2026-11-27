import * as React from "react";
import { usePiloti, type Piloti } from "@/lib/engine/piloti";
import { shouldConfirmUnsavedOnClose, readTextsSettings, writeTextsSettings } from "@/lib/config/piloti-ini";
import { readVfsStateJson, writeVfsStateJson } from "@/lib/engine/vfs-state";
import { normalizeVfsPath } from "@/lib/core/vfs-paths";
import { subscribeRenames } from "@/lib/engine/renames";
import { announceRename, moveKeepingEmblems } from "@/lib/engine/fs-bridge";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import { emitShellEvent, onShellEvent } from "@/lib/core/shell-events";

import type { TextsHost } from "@/lib/engine/texts-host";
import { TextsHostProvider } from "@/lib/engine/texts-host";
import { TextsApp, type TextsAppProps } from "@/apps/texts/TextsApp";

const stateFile = (key: string) => `${VFS_HOME}/.local/state/piloti/${key}.json`;

export function createInShellEditorHost(piloti: Piloti): TextsHost {
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
    readEditorPrefs: () => readTextsSettings().Editor ?? {},
    writeEditorPrefs: (values) => {
      writeTextsSettings("Editor", values);
    },
    confirmUnsavedOnClose: shouldConfirmUnsavedOnClose,
    requestAnimatedClose: (windowId) =>
      emitShellEvent("piloti:request-animated-close", { windowId }),
    onPrintFocused: (listener) => onShellEvent("piloti:print-focused", listener),
    onBeforeClose: (listener) =>
      onShellEvent("piloti:before-close-window", listener),
  };
}


/** TextsApp running in the shell (or its web iframe) with the shell's host. */
export const ShellTextsApp: React.FC<TextsAppProps> = (props) => {
  const piloti = usePiloti();
  const host = React.useMemo(() => createInShellEditorHost(piloti), [piloti]);
  return (
    <TextsHostProvider value={host}>
      <TextsApp {...props} />
    </TextsHostProvider>
  );
};
