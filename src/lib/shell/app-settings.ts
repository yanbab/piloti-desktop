/**
 * Per-app settings kept by the shell, one INI file per app in
 * `~/.config/piloti/apps/<app-id>.ini`:
 *
 *   [General]
 *   color-scheme=dark
 *
 * Keys the shell itself applies: `color-scheme` (`dark` forces the app's
 * windows dark; absent = follow the desktop). Plugins read and write them
 * through `ctx.apps`.
 */
import { VFS_HOME } from "@/lib/engine/vfs-home";
import { parseIniText, serializeIniText, type IniRecord } from "@/lib/config/ini";
import { readVfsStateText, writeVfsStateText } from "@/lib/engine/vfs-state";
import { subscribeWebVfs } from "@/lib/engine-web/web-vfs";

export const APP_SETTINGS_DIR = `${VFS_HOME}/.config/piloti/apps`;
const SECTION = "General";

export function appSettingsPath(appId: string): string {
  const safe = appId.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${APP_SETTINGS_DIR}/${safe}.ini`;
}

const cache = new Map<string, IniRecord>();
let version = 0;
const listeners = new Set<() => void>();
let unsubscribeDir: (() => void) | null = null;

function load(appId: string): IniRecord {
  let data = cache.get(appId);
  if (!data) {
    data = parseIniText(readVfsStateText(appSettingsPath(appId)) ?? "");
    cache.set(appId, data);
  }
  return data;
}

function notify() {
  version += 1;
  for (const l of listeners) l();
}

export function getAppSetting(appId: string, key: string): string | undefined {
  return load(appId)[SECTION]?.[key];
}

export function setAppSetting(appId: string, key: string, value: string | null): void {
  const data = { ...load(appId) };
  const section = { ...(data[SECTION] ?? {}) };
  if (value === null || value === "") delete section[key];
  else section[key] = value;
  if (Object.keys(section).length > 0) data[SECTION] = section;
  else delete data[SECTION];
  cache.set(appId, data);
  writeVfsStateText(appSettingsPath(appId), serializeIniText(data));
  notify();
}

/** For `useSyncExternalStore`: changes on every write, here or on disk. */
export function getAppSettingsVersion(): number {
  return version;
}

export function subscribeAppSettings(listener: () => void): () => void {
  listeners.add(listener);
  if (!unsubscribeDir) {
    // Edits made in Folders / Text Editor apply live.
    unsubscribeDir = subscribeWebVfs(
      () => {
        cache.clear();
        notify();
      },
      { path: APP_SETTINGS_DIR, mode: "children" },
    );
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribeDir) {
      unsubscribeDir();
      unsubscribeDir = null;
    }
  };
}
