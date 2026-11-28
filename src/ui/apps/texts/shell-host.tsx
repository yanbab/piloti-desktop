import * as React from "react";
import { usePiloti, type Piloti } from "@/platform/shared/piloti";
import { shouldConfirmUnsavedOnClose, readTextsSettings, writeTextsSettings } from "@/core/config/piloti-ini";
import { normalizeVfsPath } from "@/core/files/vfs-paths";
import { subscribeRenames } from "@/platform/shared/renames";
import { announceRename, moveKeepingEmblems } from "@/platform/shared/fs-bridge";
import { VFS_HOME } from "@/core/state/vfs-home";
import { createShellAppHost } from "@/platform/shared/app-shell-host";
import { onShellEvent } from "@/core/windows/shell-events";

import type { TextsHost } from "@/ui/apps/texts/texts-host";
import { TextsHostProvider } from "@/ui/apps/texts/texts-host";
import { TextsApp, type TextsAppProps } from "@/ui/apps/texts/TextsApp";

export function createInShellEditorHost(piloti: Piloti): TextsHost {
  return {
    ...createShellAppHost(piloti),
    // The title rename keeps the file's emblems, as Folders does.
    vfs: { ...piloti.vfs, move: (from, to) => moveKeepingEmblems(piloti, from, to) },
    normalizePath: normalizeVfsPath,
    defaultNewFilePath: (name) => `${VFS_HOME}/Desktop/${name}`,
    onRenamed: subscribeRenames,
    moved: announceRename,
    readEditorPrefs: () => readTextsSettings().Editor ?? {},
    writeEditorPrefs: (values) => {
      writeTextsSettings("Editor", values);
    },
    confirmUnsavedOnClose: shouldConfirmUnsavedOnClose,
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
