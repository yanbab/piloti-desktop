import {
  consumeLegacyLocalStorageValue,
  getVfsEntry,
  normalizeVfsPath,
  removeVfsEntry,
  subscribeWebVfs,
  writeVfsTextFile,
} from "@/lib/engine-web/web-vfs";

export const VFS_STATE_PATHS = {
  settings: "/home/user/.config/piloti/settings.ini",
  legacySettingsJson: "/home/user/.config/piloti/settings.json",
  locale: "/home/user/.config/piloti/locale.ini",
  legacyLocale: "/home/user/.config/piloti/locale",
  welcomeShown: "/home/user/.local/state/piloti/welcome-shown",
  windowBounds: "/home/user/.local/state/piloti/window-bounds.json",
  desktopIcons: "/home/user/.local/state/piloti/desktop-icons.json",
  notificationsHistory: "/home/user/.local/state/piloti/notifications.json",
  notificationsReadIds: "/home/user/.local/state/piloti/notifications-read.json",
  session: "/home/user/.local/state/piloti/session.json",
  launcher: "/home/user/.local/state/piloti/launcher.json",
  calculator: "/home/user/.local/state/piloti/calculator.json",
  settingsPane: "/home/user/.local/state/piloti/settings-pane.txt",
  devtoolsModule: "/home/user/.local/state/piloti/devtools-module.txt",
  terminalHistory: "/home/user/.piloti_history",
  workspaceSnapshots: "/home/user/.cache/piloti/workspace-snapshots.json",
  consoleLog: "/home/user/.cache/piloti/piloti.log",
  appStoreMeta: "/home/user/.cache/piloti/app-store-meta.json",
  appStoreSources: "/home/user/.config/piloti/app-store-sources.json",
  appPermissions: "/home/user/.config/piloti/app-permissions.json",
  iconIndexCache: "/home/user/.cache/piloti/icon-index.json",
  dockIconsCache: "/home/user/.cache/piloti/dock-icons.json",
  xdgAppsCache: "/home/user/.cache/piloti/xdg-apps.json",
  cacheDir: "/home/user/.cache/piloti",
} as const;

export interface VfsHostSync {
  writeText: (vfsPath: string, content: string) => void;
  removeFile: (vfsPath: string) => void;
}

let hostSync: VfsHostSync | null = null;

/**
 * Registers an optional host-filesystem mirror (Domicile on Linux) so state
 * and config writes to `web-vfs` also persist under the user's real `$HOME`.
 */
export function registerVfsHostSync(sync: VfsHostSync | null): void {
  hostSync = sync;
}

/**
 * Maps a cache storage key name into a deterministic `/home/user/.cache/piloti/<name>.json` path.
 */
export function getVfsCacheFilePath(cacheKey: string): string {
  const safe = cacheKey
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${VFS_STATE_PATHS.cacheDir}/${safe || "cache"}.json`;
}

/**
 * Reads UTF-8 text from VFS at `vfsPath`, migrating a legacy `localStorage` key
 * into VFS on first read if present.
 */
export function readVfsStateText(
  vfsPath: string,
  legacyStorageKeys?: string | readonly string[],
): string | null {
  const norm = normalizeVfsPath(vfsPath);
  const existing = getVfsEntry(norm);
  if (existing?.kind === "file") {
    return existing.content ?? "";
  }
  const keys =
    typeof legacyStorageKeys === "string"
      ? [legacyStorageKeys]
      : legacyStorageKeys ?? [];
  for (const key of keys) {
    const legacy = consumeLegacyLocalStorageValue(key);
    if (legacy !== null) {
      try {
        writeVfsTextFile(norm, legacy);
        hostSync?.writeText(norm, legacy);
      } catch {
        // ignore migration write failures (e.g., quota)
      }
      return legacy;
    }
  }
  return null;
}

/**
 * Writes UTF-8 text to VFS only when the file content actually changed,
 * preventing redundant VFS change notifications and write loops.
 */
export function writeVfsStateText(vfsPath: string, content: string): boolean {
  const norm = normalizeVfsPath(vfsPath);
  const existing = getVfsEntry(norm);
  if (existing?.kind === "file" && (existing.content ?? "") === content) {
    return false;
  }
  writeVfsTextFile(norm, content);
  hostSync?.writeText(norm, content);
  return true;
}

/**
 * Reads and parses a JSON file from VFS (with optional legacy key migration and type guard).
 */
export function readVfsStateJson<T>(
  vfsPath: string,
  legacyStorageKeys?: string | readonly string[],
  isValid?: (val: unknown) => val is T,
): T | null {
  const raw = readVfsStateText(vfsPath, legacyStorageKeys);
  if (!raw || !raw.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid && !isValid(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Serializes `value` as JSON and writes it to VFS if changed.
 */
export function writeVfsStateJson(
  vfsPath: string,
  value: unknown,
  pretty = true,
): boolean {
  const serialized = pretty
    ? `${JSON.stringify(value, null, 2)}\n`
    : JSON.stringify(value);
  return writeVfsStateText(vfsPath, serialized);
}

/**
 * Removes a state/config file from VFS (and host mirror if registered).
 */
export function removeVfsStateFile(vfsPath: string): void {
  const norm = normalizeVfsPath(vfsPath);
  const removed = removeVfsEntry(norm);
  if (removed) {
    hostSync?.removeFile(norm);
  }
}

/**
 * Subscribes to live content changes on a single VFS file path (e.g. edited in Files / Text Editor).
 * Invokes `onChange` only when the file's content string changes.
 */
export function subscribeVfsPath(
  vfsPath: string,
  onChange: (content: string | null) => void,
): () => void {
  const norm = normalizeVfsPath(vfsPath);
  const readCurrent = (): string | null => {
    const entry = getVfsEntry(norm);
    return entry?.kind === "file" ? (entry.content ?? "") : null;
  };
  let lastContent = readCurrent();
  return subscribeWebVfs(() => {
    const nextContent = readCurrent();
    if (nextContent === lastContent) return;
    lastContent = nextContent;
    onChange(nextContent);
  });
}
