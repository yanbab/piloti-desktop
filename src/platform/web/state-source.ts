/** The browser demo: the browser VFS is the storage, and is read directly. */
import type { StateSource } from "@/core/ports/state-source";
import { VFS_HOME } from "@/core/state/vfs-home";
import {
  consumeLegacyLocalStorageValue,
  ensureVfsDir,
  getVfsEntry,
  getVfsSnapshotEntries,
  moveVfsEntry,
  removeVfsEntry,
  subscribeWebVfs,
  writeVfsTextFile,
} from "./web-vfs";

const LEGACY_CONFIG_DIR = `${VFS_HOME}/.config/Piloti`;
const CONFIG_DIR = `${VFS_HOME}/.config/piloti`;

/**
 * Moves any files remaining in `~/.config/Piloti` (capital P) to
 * `~/.config/piloti` without overwriting, then removes the old directory.
 */
export function migrateLegacyConfigDir(): void {
  const prefix = `${LEGACY_CONFIG_DIR}/`;
  const entries = getVfsSnapshotEntries()
    .filter((e) => e.kind === "file" && e.path.startsWith(prefix))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (entries.length === 0 && !getVfsEntry(LEGACY_CONFIG_DIR)) return;
  for (const entry of entries) {
    const dest = `${CONFIG_DIR}/${entry.path.slice(prefix.length)}`;
    if (getVfsEntry(dest)) continue;
    const destDir = dest.slice(0, dest.lastIndexOf("/"));
    try {
      ensureVfsDir(destDir);
      moveVfsEntry(entry.path, destDir);
    } catch {
      // ignore; leave the file in place
    }
  }
  removeVfsEntry(LEGACY_CONFIG_DIR);
}

export const browserStateSource: StateSource = {
  files: () =>
    getVfsSnapshotEntries()
      .filter((e) => e.kind === "file")
      .map((e) => ({ path: e.path, name: e.name, content: e.content ?? "", updatedAt: e.updatedAt })),
  read(path) {
    const entry = getVfsEntry(path);
    return entry?.kind === "file" ? (entry.content ?? "") : null;
  },
  write: (path, content) => void writeVfsTextFile(path, content),
  remove: (path) => void removeVfsEntry(path),
  subscribe: (path, listener) => subscribeWebVfs(listener, { path, mode: "exact" }),
  subscribeDir: (path, listener) => subscribeWebVfs(listener, { path, mode: "children" }),
  consumeLegacy: consumeLegacyLocalStorageValue,
  migrate: migrateLegacyConfigDir,
};
