import * as React from "react";
import { usePiloti, type Piloti } from "@/platform/shared/piloti";
import { readTextsSettings, writeTextsSettings } from "@/core/config/piloti-ini";
import { moveKeepingEmblems } from "@/platform/shared/fs-bridge";
import { createShellDocumentHost } from "@/platform/shared/app-shell-host";
import { onShellEvent } from "@/core/windows/shell-events";

import type { TextsHost } from "@/ui/apps/texts/texts-host";
import { TextsHostProvider } from "@/ui/apps/texts/texts-host";
import { TextsApp, type TextsAppProps } from "@/ui/apps/texts/TextsApp";

export function createInShellEditorHost(piloti: Piloti): TextsHost {
  const documents = createShellDocumentHost(piloti);
  return {
    ...documents,
    // The title rename keeps the file's emblems, as Folders does.
    vfs: { ...piloti.vfs, move: (from, to) => moveKeepingEmblems(piloti, from, to) },
    defaultNewFilePath: (name) => `${documents.userDir("DESKTOP")}/${name}`,
    readEditorPrefs: () => readTextsSettings().Editor ?? {},
    writeEditorPrefs: (values) => {
      writeTextsSettings("Editor", values);
    },
    onPrintFocused: (listener) => onShellEvent("piloti:print-focused", listener),
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
