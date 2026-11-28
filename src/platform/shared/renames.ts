/**
 * "This file has a new path", for what follows a file: desktop cells, open
 * documents, viewers. The shell's own renames and moves announce it
 * (`fs-bridge.ts`); the demo's storage also does for renames it makes itself or
 * hears from another window.
 */
export interface Rename {
  oldPath: string;
  newPath: string;
}

const listeners = new Set<(rename: Rename) => void>();

export function announceRename(from: string, to: string): void {
  for (const listener of [...listeners]) listener({ oldPath: from, newPath: to });
}

export function subscribeRenames(listener: (rename: Rename) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
