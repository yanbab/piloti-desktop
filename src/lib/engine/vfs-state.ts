import { VFS_HOME } from "@/lib/engine/vfs-home";
import {
  consumeLegacyLocalStorageValue,
  ensureVfsDir,
  getVfsEntry,
  getVfsSnapshotEntries,
  moveVfsEntry,
  normalizeVfsPath,
  removeVfsEntry,
  subscribeWebVfs,
  writeVfsTextFile,
} from "@/lib/engine-web/web-vfs";

export const VFS_STATE_PATHS = {
  settings: `${VFS_HOME}/.config/piloti/settings.ini`,
  legacySettingsJson: `${VFS_HOME}/.config/piloti/settings.json`,
  locale: `${VFS_HOME}/.config/piloti/locale.ini`,
  legacyLocale: `${VFS_HOME}/.config/piloti/locale`,
  welcomeShown: `${VFS_HOME}/.local/state/piloti/welcome-shown.json`,
  legacyWelcomeShown: `${VFS_HOME}/.local/state/piloti/welcome-shown`,
  windowBounds: `${VFS_HOME}/.local/state/piloti/window-bounds.json`,
  desktopIcons: `${VFS_HOME}/.local/state/piloti/desktop-icons.json`,
  notificationsHistory: `${VFS_HOME}/.local/state/piloti/notifications.json`,
  notificationsReadIds: `${VFS_HOME}/.local/state/piloti/notifications-read.json`,
  session: `${VFS_HOME}/.local/state/piloti/session.json`,
  launcher: `${VFS_HOME}/.local/state/piloti/launcher.json`,
  calculator: `${VFS_HOME}/.local/state/piloti/calculator.json`,
  settingsPane: `${VFS_HOME}/.local/state/piloti/settings-pane.json`,
  legacySettingsPaneTxt: `${VFS_HOME}/.local/state/piloti/settings-pane.txt`,
  devtoolsModule: `${VFS_HOME}/.local/state/piloti/devtools-module.json`,
  legacyDevtoolsModuleTxt: `${VFS_HOME}/.local/state/piloti/devtools-module.txt`,
  terminalHistory: `${VFS_HOME}/.piloti_history`,
  workspaceSnapshots: `${VFS_HOME}/.cache/piloti/workspace-snapshots.json`,
  consoleLog: `${VFS_HOME}/.cache/piloti/piloti.log`,
  appStoreMeta: `${VFS_HOME}/.cache/piloti/app-store-meta.json`,
  appStoreSources: `${VFS_HOME}/.config/piloti/app-store-sources.json`,
  appPermissions: `${VFS_HOME}/.config/piloti/app-permissions.json`,
  iconIndexCache: `${VFS_HOME}/.cache/piloti/icon-index.json`,
  dockIconsCache: `${VFS_HOME}/.cache/piloti/dock-icons.json`,
  xdgAppsCache: `${VFS_HOME}/.cache/piloti/xdg-apps.json`,
  cacheDir: `${VFS_HOME}/.cache/piloti`,
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
  return subscribeWebVfs(
    () => {
      const nextContent = readCurrent();
      if (nextContent === lastContent) return;
      lastContent = nextContent;
      onChange(nextContent);
    },
    { path: norm, mode: "exact" },
  );
}

/** Legacy `.txt` / extensionless state files that are rewritten as JSON. */
const LEGACY_STATE_FILE_MIGRATIONS: ReadonlyArray<{
  from: string;
  to: string;
  convert: (text: string) => unknown;
}> = [
  {
    from: VFS_STATE_PATHS.legacySettingsPaneTxt,
    to: VFS_STATE_PATHS.settingsPane,
    convert: (text) => text.trim(),
  },
  {
    from: VFS_STATE_PATHS.legacyDevtoolsModuleTxt,
    to: VFS_STATE_PATHS.devtoolsModule,
    convert: (text) => text.trim(),
  },
  {
    from: VFS_STATE_PATHS.legacyWelcomeShown,
    to: VFS_STATE_PATHS.welcomeShown,
    convert: (text) => ({ shown: text.trim() === "1" || text.trim() === "true" }),
  },
];

/**
 * One-time migration of legacy `.txt` state files to `.json`. Keeps an existing
 * `.json` untouched, then deletes the old file.
 */
export function migrateLegacyStateFilesToJson(): void {
  for (const m of LEGACY_STATE_FILE_MIGRATIONS) {
    const old = getVfsEntry(normalizeVfsPath(m.from));
    if (old?.kind !== "file") continue;
    try {
      if (getVfsEntry(normalizeVfsPath(m.to))?.kind !== "file") {
        writeVfsStateJson(m.to, m.convert(old.content ?? ""));
      }
    } catch {
      // ignore write failures; keep legacy file for the next attempt
      continue;
    }
    removeVfsStateFile(m.from);
  }
}

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
    const rel = entry.path.slice(prefix.length);
    const dest = `${CONFIG_DIR}/${rel}`;
    if (getVfsEntry(dest)) continue;
    const slash = dest.lastIndexOf("/");
    const destDir = dest.slice(0, slash);
    try {
      ensureVfsDir(destDir);
      const moved = moveVfsEntry(entry.path, destDir);
      if (moved) {
        hostSync?.writeText(dest, moved.content ?? "");
      }
    } catch {
      // ignore; leave the file in place
    }
  }
  removeVfsEntry(LEGACY_CONFIG_DIR);
}

/**
 * Runs every startup VFS state migration (idempotent).
 */
export function runVfsStateMigrations(): void {
  migrateLegacyStateFilesToJson();
  migrateLegacyConfigDir();
}

/**
 * Reads a JSON string value (e.g. `"appearance"`) from VFS. Also accepts a
 * bare legacy value and migrates legacy files on demand.
 */
export function readVfsStateString(
  vfsPath: string,
  legacyStorageKeys?: string | readonly string[],
): string | null {
  migrateLegacyStateFilesToJson();
  const raw = readVfsStateText(vfsPath, legacyStorageKeys);
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return trimmed;
  }
}

/** Writes a JSON string value to VFS when changed. */
export function writeVfsStateString(vfsPath: string, value: string): boolean {
  return writeVfsStateJson(vfsPath, value);
}

/** Parses a JSON-string (or bare) VFS file content as emitted by `subscribeVfsPath`. */
export function parseVfsStateString(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return trimmed;
  }
}
