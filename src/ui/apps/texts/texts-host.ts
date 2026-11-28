import * as React from "react";
import type { DocumentHost } from "@/core/ports/app-host";

/**
 * Everything the Texts needs from the host it runs in: the shell, or a
 * Domicile app module (see docs/ARCHITECTURE.md). TextsApp itself never imports
 * shell modules.
 */
export interface TextsHost extends DocumentHost {
  /** Where an unsaved document goes on first save (the user's Desktop). */
  defaultNewFilePath(name: string): string;
  /** Editor preferences (`piloti-texts/settings.ini` [Editor]). */
  readEditorPrefs(): Record<string, string>;
  writeEditorPrefs(values: Record<string, string | number | boolean>): void;
  onPrintFocused(listener: (detail: { windowId?: string } | undefined) => void): () => void;
}

const TextsHostContext = React.createContext<TextsHost | null>(null);
export const TextsHostProvider = TextsHostContext.Provider;

/** The host the editor runs in (provided by whoever mounts it). */
export function useTextsHost(): TextsHost {
  const host = React.useContext(TextsHostContext);
  if (!host) throw new Error("TextsApp needs a TextsHostProvider");
  return host;
}
