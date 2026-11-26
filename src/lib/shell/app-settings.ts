/**
 * Per-app settings kept by the shell, one INI file per app in
 * `~/.config/piloti/apps/<app-id>.ini`:
 *
 *   [General]
 *   color-scheme=dark
 *
 * Keys the shell itself applies: `color-scheme` (`dark` forces the app's
 * windows dark; absent = follow the desktop). Plugins read and write them
 * through `ctx.apps`. Stored through the settings layer (`engine/settings.ts`),
 * one schema per app id.
 */
import { VFS_HOME } from "@/lib/engine/vfs-home";
import { keyfileSettingsBackend } from "@/lib/engine/settings";

export const APP_SETTINGS_DIR = `${VFS_HOME}/.config/piloti/apps`;

const safeName = (appId: string) => appId.replace(/[^A-Za-z0-9._-]/g, "_");

export function appSettingsPath(appId: string): string {
  return `${APP_SETTINGS_DIR}/${safeName(appId)}.ini`;
}

const backend = keyfileSettingsBackend({
  dir: APP_SETTINGS_DIR,
  fileName: safeName,
  section: () => "General",
});

let version = 0;
const listeners = new Set<() => void>();
let unsubscribeAll: (() => void) | null = null;

function notify() {
  version += 1;
  for (const l of listeners) l();
}

export function getAppSetting(appId: string, key: string): string | undefined {
  return backend.read(appId, key);
}

export function setAppSetting(appId: string, key: string, value: string | null): void {
  if (value === null || value === "") backend.reset(appId, key);
  else backend.write(appId, key, value);
  notify();
}

/** For `useSyncExternalStore`: changes on every write, here or on disk. */
export function getAppSettingsVersion(): number {
  return version;
}

export function subscribeAppSettings(listener: () => void): () => void {
  listeners.add(listener);
  // Edits made in Folders / Text Editor apply live.
  unsubscribeAll ??= backend.subscribeAll(notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribeAll) {
      unsubscribeAll();
      unsubscribeAll = null;
    }
  };
}
