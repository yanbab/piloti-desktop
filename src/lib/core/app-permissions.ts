import {
  DEFAULT_FLATPAK_PERMISSIONS,
  type FlatpakPermissionsState,
} from "@/lib/core/flatpak-permissions";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";

export interface AppSecurityPreferences {
  notifications: boolean;
  search: boolean;
  flatpak?: Partial<FlatpakPermissionsState>;
}

export type AppPermissionsMap = Record<string, AppSecurityPreferences>;

const APP_PERMISSIONS_STORAGE_KEY = "piloti.app-permissions.v1";

export const DEFAULT_APP_SECURITY_PREFS: AppSecurityPreferences = {
  notifications: true,
  search: true,
};

export function readAppPermissionsMap(): AppPermissionsMap {
  const raw = readVfsStateJson<AppPermissionsMap>(
    VFS_STATE_PATHS.appPermissions,
    APP_PERMISSIONS_STORAGE_KEY
  );
  return raw && typeof raw === "object" ? raw : {};
}

export function writeAppPermissionsMap(map: AppPermissionsMap): void {
  writeVfsStateJson(
    VFS_STATE_PATHS.appPermissions,
    map
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("piloti:app-permissions-changed"));
  }
}

export function getAppSecurityPrefs(
  appId: string,
  map?: AppPermissionsMap
): AppSecurityPreferences {
  const source = map ?? readAppPermissionsMap();
  const entry = source[appId];
  return {
    notifications: entry?.notifications ?? true,
    search: entry?.search ?? true,
    flatpak: {
      ...DEFAULT_FLATPAK_PERMISSIONS,
      ...(entry?.flatpak ?? {}),
    },
  };
}

export function isAppNotificationAllowed(appNameOrId?: string): boolean {
  if (!appNameOrId) return true;
  const map = readAppPermissionsMap();
  const normalized = appNameOrId.trim().toLowerCase();
  for (const [key, prefs] of Object.entries(map)) {
    if (key.toLowerCase() === normalized) {
      return prefs.notifications !== false;
    }
  }
  return true;
}

export function isAppSearchEnabled(appId: string): boolean {
  const map = readAppPermissionsMap();
  return map[appId]?.search !== false;
}

