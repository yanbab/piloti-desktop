import { createToastManager } from "@/components/ui/toast";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/vfs-state";

export interface NotificationActionItem {
  key: string;
  label: string;
}

export interface ShellNotification {
  id: number;
  appName: string;
  summary: string;
  body: string;
  icon?: string;
  urgency: string;
  time: number;
  read?: boolean;
  source?: "local" | "domicile";
  fromDomicile?: boolean;
  actions?: readonly NotificationActionItem[];
  clickable?: boolean;
  timeoutMs?: number;
  browserWindow?: string;
}

export interface NotificationPolicySettings {
  notificationsEnabled: boolean;
  notificationBannersEnabled: boolean;
  notificationShowOnLockScreen: boolean;
  notificationShowPreviews: boolean;
  notificationAllowCriticalInDnd: boolean;
  notificationBannerTimeoutMs: number;
  notificationHistoryLimit: number;
  doNotDisturb: boolean;
}

export interface NotificationToastData {
  notificationId: number;
  appName: string;
  icon?: string;
  urgency: string;
  clickable?: boolean;
  fromDomicile?: boolean;
  actions?: readonly NotificationActionItem[];
  browserWindow?: string;
}

export const pilotiToastManager = createToastManager<NotificationToastData>();

export const NOTIFICATIONS_HISTORY_STORAGE_KEY =
  "piloti.desktop.notifications.v1";
export const NOTIFICATIONS_READ_IDS_STORAGE_KEY =
  "piloti.desktop.notifications.read.v1";

export function toToastId(notificationId: number): string {
  return `notif-${notificationId}`;
}

export function shouldShowNotificationBanner(
  notification: Pick<ShellNotification, "urgency">,
  settings: NotificationPolicySettings,
  locked: boolean
): boolean {
  if (!settings.notificationsEnabled || !settings.notificationBannersEnabled) {
    return false;
  }
  if (locked && !settings.notificationShowOnLockScreen) {
    return false;
  }
  if (settings.doNotDisturb) {
    return (
      settings.notificationAllowCriticalInDnd &&
      notification.urgency === "critical"
    );
  }
  return true;
}

export function resolveNotificationTimeoutMs(
  notification: Pick<ShellNotification, "urgency" | "timeoutMs">,
  defaultTimeoutMs: number
): number {
  if (notification.urgency === "critical") {
    return 0;
  }
  if (typeof notification.timeoutMs === "number" && Number.isFinite(notification.timeoutMs)) {
    return Math.max(0, notification.timeoutMs);
  }
  return Math.max(0, defaultTimeoutMs);
}

export function formatRelativeNotificationTime(
  timestamp: number,
  now = Date.now()
): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function clampHistoryLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 50;
  return Math.min(200, Math.max(5, Math.round(limit)));
}

export function loadLocalNotificationHistory(
  limit = 50
): ShellNotification[] {
  try {
    const parsed = readVfsStateJson<unknown>(
      VFS_STATE_PATHS.notificationsHistory,
      NOTIFICATIONS_HISTORY_STORAGE_KEY,
    );
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .filter(
        (item): item is ShellNotification =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as ShellNotification).id === "number" &&
          typeof (item as ShellNotification).summary === "string" &&
          typeof (item as ShellNotification).time === "number"
      )
      .map((item) => ({
        ...item,
        appName: item.appName || "System",
        body: item.body || "",
        urgency: item.urgency || "normal",
        source: "local" as const,
        fromDomicile: false,
      }))
      .sort((a, b) => b.time - a.time);
    return normalized.slice(0, clampHistoryLimit(limit));
  } catch {
    return [];
  }
}

export function saveLocalNotificationHistory(
  notifications: readonly ShellNotification[],
  limit = 50
): void {
  try {
    const trimmed = notifications.slice(0, clampHistoryLimit(limit));
    writeVfsStateJson(VFS_STATE_PATHS.notificationsHistory, trimmed);
  } catch {
    // ignore storage errors
  }
}

export function loadReadNotificationIds(): Set<number> {
  try {
    const parsed = readVfsStateJson<unknown>(
      VFS_STATE_PATHS.notificationsReadIds,
      NOTIFICATIONS_READ_IDS_STORAGE_KEY,
    );
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is number => typeof id === "number")
    );
  } catch {
    return new Set();
  }
}

export function saveReadNotificationIds(ids: ReadonlySet<number>): void {
  try {
    const arr = Array.from(ids).slice(-250);
    writeVfsStateJson(VFS_STATE_PATHS.notificationsReadIds, arr, false);
  } catch {
    // ignore storage errors
  }
}

