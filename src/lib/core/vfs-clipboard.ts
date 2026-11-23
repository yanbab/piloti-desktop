import { normalizeVfsPath } from "@/lib/core/vfs-paths";

export interface VfsClipboardState {
  mode: "cut" | "copy";
  paths: string[];
}

export const WEB_VFS_CLIPBOARD_CHANGED_EVENT = "piloti:vfs-clipboard-changed";

const clipboardListeners = new Set<() => void>();
let sharedVfsClipboard: VfsClipboardState | null = null;

export function getVfsClipboard(): VfsClipboardState | null {
  return sharedVfsClipboard
    ? { mode: sharedVfsClipboard.mode, paths: [...sharedVfsClipboard.paths] }
    : null;
}

export function setVfsClipboard(next: VfsClipboardState | null): void {
  const cleaned =
    next && next.paths.length > 0
      ? {
          mode: next.mode,
          paths: Array.from(
            new Set(next.paths.map((p) => normalizeVfsPath(p))),
          ),
        }
      : null;
  sharedVfsClipboard = cleaned;
  for (const listener of [...clipboardListeners]) listener();
}

export function subscribeVfsClipboard(listener: () => void): () => void {
  clipboardListeners.add(listener);
  return () => {
    clipboardListeners.delete(listener);
  };
}

