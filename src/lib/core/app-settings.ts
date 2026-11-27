/**
 * Per-app settings kept by the shell, one INI file per app in
 * `~/.config/piloti/apps/<app-id>.ini`:
 *
 *   [General]
 *   color-scheme=dark
 *
 * Keys the shell itself applies: `color-scheme` (`dark` forces the app's
 * windows dark; absent = follow the desktop). Plugins read and write them
 * through `ctx.apps`. Stored through the settings layer (`engine/settings.ts`);
 * the app's own schemas live in other sections of the same file.
 */
import {
  APP_SETTINGS_DIR,
  appSettingsPath,
  keyfileSettingsBackend,
} from "@/lib/engine/settings";

export { APP_SETTINGS_DIR, appSettingsPath };

// Untyped keys in `[General]` of the app's own file, next to its schemas.
const backend = keyfileSettingsBackend({
  path: appSettingsPath,
  section: () => "General",
  dirs: [APP_SETTINGS_DIR],
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
  // Edits made in Folders / Texts apply live.
  unsubscribeAll ??= backend.subscribeAll(notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribeAll) {
      unsubscribeAll();
      unsubscribeAll = null;
    }
  };
}
