import { VFS_HOME } from "@/lib/engine/vfs-home";
import type { StateFile, StateSource } from "@/lib/ports/state-source";
import { normalizeVfsPath } from "@/lib/core/vfs-paths";

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
  consoleLog: `${VFS_HOME}/.local/state/piloti/piloti.log`,
  appStoreMeta: `${VFS_HOME}/.cache/piloti/app-store-meta.json`,
  appStoreSources: `${VFS_HOME}/.config/piloti/app-store-sources.json`,
  userDirsCache: `${VFS_HOME}/.cache/piloti/user-dirs.json`,
  favorites: `${VFS_HOME}/.local/state/piloti/favorites.json`,
  appPermissions: `${VFS_HOME}/.config/piloti/app-permissions.json`,
  browserBookmarks: `${VFS_HOME}/.config/piloti/browser/bookmarks.json`,
  iconIndexCache: `${VFS_HOME}/.cache/piloti/icon-index.json`,
  iconIndexStamp: `${VFS_HOME}/.cache/piloti/icon-index-stamp.json`,
  dockIconsCache: `${VFS_HOME}/.cache/piloti/dock-icons.json`,
  xdgAppsCache: `${VFS_HOME}/.cache/piloti/xdg-apps.json`,
  cacheDir: `${VFS_HOME}/.cache/piloti`,
} as const;

/** Until an engine sets one: nothing outlives the page. */
function memoryStateSource(): StateSource {
  const files = new Map<string, string>();
  return {
    files: () => [...files].map(([path, content]) => ({ path, name: path.slice(path.lastIndexOf("/") + 1), content })),
    read: (path) => files.get(path) ?? null,
    write: (path, content) => void files.set(path, content),
    remove: (path) => void files.delete(path),
    subscribe: () => () => undefined,
    subscribeDir: () => () => undefined,
  };
}

let fallback: StateSource = memoryStateSource();
let source: StateSource = fallback;

/** The demo's storage, set once by its entry point; `setStateSource(null)` returns to it. */
export function setDefaultStateSource(next: StateSource): void {
  if (source === fallback) source = next;
  fallback = next;
}

/** The Linux entry points set their disk-backed store here before the shell loads. */
export function setStateSource(next: StateSource | null): void {
  source = next ?? fallback;
}

/** A value an early release kept in `localStorage`, taken out of it. */
export function consumeLegacyLocalStorageValue(key: string): string | null {
  return source.consumeLegacy?.(key) ?? null;
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
  const existing = source.read(norm);
  if (existing !== null) return existing;
  const keys =
    typeof legacyStorageKeys === "string"
      ? [legacyStorageKeys]
      : legacyStorageKeys ?? [];
  for (const key of keys) {
    const legacy = consumeLegacyLocalStorageValue(key);
    if (legacy !== null) {
      try {
        source.write(norm, legacy);
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
  if (source.read(norm) === content) return false;
  source.write(norm, content);
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
 * Removes a state/config file.
 */
export function removeVfsStateFile(vfsPath: string): void {
  const norm = normalizeVfsPath(vfsPath);
  if (source.read(norm) !== null) source.remove(norm);
}

/**
 * Subscribes to live content changes on a single VFS file path (e.g. edited in Files / Texts).
 * Invokes `onChange` only when the file's content string changes.
 */
export function subscribeVfsPath(
  vfsPath: string,
  onChange: (content: string | null) => void,
): () => void {
  const norm = normalizeVfsPath(vfsPath);
  const from = source;
  let lastContent = from.read(norm);
  return from.subscribe(norm, () => {
    const nextContent = from.read(norm);
    if (nextContent === lastContent) return;
    lastContent = nextContent;
    onChange(nextContent);
  });
}

/** Wait before reading a large cache that may still be loading. */
export function whenStateReady(vfsPath: string): Promise<void> {
  return source.ready?.(normalizeVfsPath(vfsPath)) ?? Promise.resolve();
}

/** The files behind the shell's state (the whole VFS in the browser demo). */
export function listVfsStateFiles(): StateFile[] {
  return source.files();
}

/** Subscribes to changes of the files directly inside a config folder. */
export function subscribeVfsStateDir(dir: string, onChange: () => void): () => void {
  return source.subscribeDir(normalizeVfsPath(dir), onChange);
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
    const old = source.read(normalizeVfsPath(m.from));
    if (old === null) continue;
    try {
      if (source.read(normalizeVfsPath(m.to)) === null) {
        writeVfsStateJson(m.to, m.convert(old));
      }
    } catch {
      // ignore write failures; keep legacy file for the next attempt
      continue;
    }
    removeVfsStateFile(m.from);
  }
}

/**
 * Runs every startup VFS state migration (idempotent).
 */
export function runVfsStateMigrations(): void {
  migrateLegacyStateFilesToJson();
  source.migrate?.();
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
