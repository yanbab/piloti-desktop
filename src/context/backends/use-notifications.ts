import * as React from "react";
import { useWatch } from "@domicile-desktop/react/use-watch";
import type { Piloti } from "@/lib/engine/piloti";
import {
  migrateLegacyStateFilesToJson,
  readVfsStateJson,
  readVfsStateText,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";
import { isAppNotificationAllowed } from "@/lib/core/app-permissions";
import { parseOpenAction } from "@/lib/files/capture-files";
import {
  type NotificationActionItem,
  type ShellNotification,
  clampHistoryLimit,
  loadLocalNotificationHistory,
  loadReadNotificationIds,
  pilotiToastManager,
  resolveNotificationTimeoutMs,
  saveLocalNotificationHistory,
  saveReadNotificationIds,
  shouldShowNotificationBanner,
  toToastId,
} from "@/lib/core/notifications";
import type { DesktopSettings } from "../SettingsContext";

let nextNotifCounter = 5000;

/** One list for "none yet", so effects don't run on every render. */
const NO_NOTIFICATIONS: never[] = [];

/** Notifications from apps and the shell: history, read state and banners. */
export function useNotifications(piloti: Piloti, settings: DesktopSettings, locked: boolean) {
  // Notifications + Persistent History + Toast Banners
  const domicileNotifs =
    useWatch(piloti.notifications, "change", () => piloti.notifications.list) ?? NO_NOTIFICATIONS;
  const [localNotifs, setLocalNotifs] = React.useState<ShellNotification[]>(() => {
    const initial = loadLocalNotificationHistory(settings.notificationHistoryLimit);
    for (const item of initial) {
      if (item.id >= nextNotifCounter) {
        nextNotifCounter = item.id + 1;
      }
    }
    return initial;
  });
  const [readIds, setReadIds] = React.useState<Set<number>>(() =>
    loadReadNotificationIds()
  );

  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;
  const lockedRef = React.useRef(locked);
  lockedRef.current = locked;

  const maybeShowBanner = React.useCallback((item: ShellNotification) => {
    const curSettings = settingsRef.current;
    if (!shouldShowNotificationBanner(item, curSettings, lockedRef.current)) {
      return;
    }
    const timeout = resolveNotificationTimeoutMs(
      item,
      curSettings.notificationBannerTimeoutMs
    );
    const description = curSettings.notificationShowPreviews
      ? item.body
      : item.body
        ? "Notification preview hidden"
        : "";
    pilotiToastManager.add({
      id: toToastId(item.id),
      title: item.summary,
      description,
      type: item.urgency,
      priority: item.urgency === "critical" ? "high" : "low",
      timeout,
      data: {
        notificationId: item.id,
        appName: item.appName,
        icon: item.icon,
        urgency: item.urgency,
        clickable: item.clickable,
        fromDomicile: item.fromDomicile,
        actions: item.actions,
        browserWindow: item.browserWindow,
      },
    });
  }, []);

  React.useEffect(() => {
    saveLocalNotificationHistory(localNotifs, settings.notificationHistoryLimit);
  }, [localNotifs, settings.notificationHistoryLimit]);

  React.useEffect(() => {
    const limit = clampHistoryLimit(settings.notificationHistoryLimit);
    setLocalNotifs((prev) => (prev.length > limit ? prev.slice(0, limit) : prev));
  }, [settings.notificationHistoryLimit]);

  React.useEffect(() => {
    saveReadNotificationIds(readIds);
  }, [readIds]);

  const seenDomicileTimesRef = React.useRef<Map<number, number> | null>(null);
  React.useEffect(() => {
    const prevSeen = seenDomicileTimesRef.current;
    const nextSeen = new Map<number, number>();
    const now = Date.now();

    for (const n of domicileNotifs) {
      nextSeen.set(n.id, n.time);
    }

    if (prevSeen === null) {
      seenDomicileTimesRef.current = nextSeen;
      // Only show banners on startup if a notification arrived immediately at launch
      for (const n of domicileNotifs) {
        if (now - n.time < 2500 && settingsRef.current.notificationsEnabled) {
          maybeShowBanner({
            id: n.id,
            appName: n.appName || "System",
            summary: n.summary,
            body: n.body,
            icon: n.icon || undefined,
            urgency: n.urgency,
            time: n.time,
            source: "domicile",
            fromDomicile: true,
            actions: n.actions,
            clickable: n.clickable,
            timeoutMs: n.timeoutMs,
            browserWindow: n.browserWindow || undefined,
          });
        }
      }
      return;
    }

    for (const oldId of prevSeen.keys()) {
      if (!nextSeen.has(oldId)) {
        pilotiToastManager.close(toToastId(oldId));
      }
    }

    const arrivedIds: number[] = [];
    for (const n of domicileNotifs) {
      const prevTime = prevSeen.get(n.id);
      if (prevTime === undefined || n.time > prevTime) {
        arrivedIds.push(n.id);
        console.info(
          `[Piloti] notification: ${n.appName || "System"} - ${n.summary}`
        );
        if (settingsRef.current.notificationsEnabled) {
          maybeShowBanner({
            id: n.id,
            appName: n.appName || "System",
            summary: n.summary,
            body: n.body,
            icon: n.icon || undefined,
            urgency: n.urgency,
            time: n.time,
            source: "domicile",
            fromDomicile: true,
            actions: n.actions,
            clickable: n.clickable,
            timeoutMs: n.timeoutMs,
            browserWindow: n.browserWindow || undefined,
          });
        }
      }
    }

    if (arrivedIds.length > 0) {
      setReadIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of arrivedIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    }

    seenDomicileTimesRef.current = nextSeen;
  }, [domicileNotifs, maybeShowBanner]);

  const notifications = React.useMemo<ShellNotification[]>(() => {
    const mappedDomicile: ShellNotification[] = domicileNotifs.map((n) => ({
      id: n.id,
      appName: n.appName || "System",
      summary: n.summary,
      body: n.body,
      icon: n.icon || undefined,
      urgency: n.urgency,
      time: n.time,
      read: readIds.has(n.id),
      source: "domicile",
      fromDomicile: true,
      actions: n.actions,
      clickable: n.clickable,
      timeoutMs: n.timeoutMs,
      browserWindow: n.browserWindow || undefined,
    }));
    const mappedLocal: ShellNotification[] = localNotifs.map((n) => ({
      ...n,
      source: "local",
      read: readIds.has(n.id),
    }));
    return [...mappedLocal, ...mappedDomicile].sort((a, b) => b.time - a.time);
  }, [domicileNotifs, localNotifs, readIds]);

  const unreadNotificationCount = React.useMemo(
    () => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [notifications]
  );

  const markNotificationRead = React.useCallback((id: number) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markAllNotificationsRead = React.useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const n of localNotifs) {
        if (!next.has(n.id)) {
          next.add(n.id);
          changed = true;
        }
      }
      for (const n of domicileNotifs) {
        if (!next.has(n.id)) {
          next.add(n.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [domicileNotifs, localNotifs]);

  const pushNotification = React.useCallback(
    (n: {
      appName: string;
      summary: string;
      body: string;
      urgency?: string;
      icon?: string;
      actions?: readonly NotificationActionItem[];
      timeoutMs?: number;
    }) => {
      if (!settingsRef.current.notificationsEnabled) return;
      if (!isAppNotificationAllowed(n.appName)) return;
      const item: ShellNotification = {
        id: ++nextNotifCounter,
        appName: n.appName,
        summary: n.summary,
        body: n.body,
        icon: n.icon,
        urgency: n.urgency ?? "normal",
        time: Date.now(),
        source: "local",
        fromDomicile: false,
        actions: n.actions,
        timeoutMs: n.timeoutMs,
      };
      const limit = clampHistoryLimit(
        settingsRef.current.notificationHistoryLimit
      );
      console.info(
        `[Piloti] notification: ${item.appName} - ${item.summary}`
      );
      setLocalNotifs((prev) => [item, ...prev].slice(0, limit));
      maybeShowBanner(item);
    },
    [maybeShowBanner]
  );

  const welcomeFiredRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (welcomeFiredRef.current) return;
    const key = "piloti.firstRunNotif.v1";
    try {
      migrateLegacyStateFilesToJson();
      const welcome = readVfsStateJson<{ shown?: boolean }>(
        VFS_STATE_PATHS.welcomeShown,
      );
      if (welcome?.shown === true) return;
      if (readVfsStateText(VFS_STATE_PATHS.welcomeShown, key) === "1") return;
    } catch {
      // ignore storage errors
    }
    const timer = window.setTimeout(() => {
      if (welcomeFiredRef.current) return;
      welcomeFiredRef.current = true;
      try {
        writeVfsStateJson(VFS_STATE_PATHS.welcomeShown, { shown: true });
      } catch {
        // ignore storage errors
      }
      pushNotification({
        appName: "Piloti Desktop",
        summary: "Welcome to your Piloti Desktop !",
        body: "Press Alt+Space to open the Launcher",
        actions: [{ key: "launcher", label: "Open Launcher" }],
      });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [pushNotification]);

  const dismissNotification = React.useCallback(
    (id: number) => {
      console.info("[Piloti] notification dismissed:", id);
      pilotiToastManager.close(toToastId(id));
      setLocalNotifs((prev) => prev.filter((n) => n.id !== id));
      setReadIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      try {
        piloti.notifications.dismiss([id]);
      } catch {
        // ignore
      }
    },
    [piloti.notifications]
  );

  const clearAllNotifications = React.useCallback(() => {
    console.info("[Piloti] notifications cleared");
    pilotiToastManager.close();
    setLocalNotifs([]);
    setReadIds(new Set());
    const ids = domicileNotifs.map((n) => n.id);
    if (ids.length > 0) {
      try {
        piloti.notifications.dismiss(ids);
      } catch {
        // ignore
      }
    }
  }, [piloti.notifications, domicileNotifs]);

  const invokeNotificationAction = React.useCallback(
    (id: number, action: string) => {
      console.info("[Piloti] notification action:", id, action);
      markNotificationRead(id);
      pilotiToastManager.close(toToastId(id));
      const isDomicile = domicileNotifs.some((n) => n.id === id);
      if (action === "launcher" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("piloti:open-launcher"));
      } else if (typeof window !== "undefined") {
        const path = parseOpenAction(action);
        if (path) {
          window.dispatchEvent(
            new CustomEvent("piloti:open-path", { detail: { path } })
          );
        }
      }
      if (isDomicile) {
        try {
          piloti.notifications.invoke(id, action);
        } catch {
          // ignore
        }
      }
    },
    [piloti.notifications, domicileNotifs, markNotificationRead]
  );

  const replyToNotification = React.useCallback(
    (id: number, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      console.info("[Piloti] notification reply:", id);
      markNotificationRead(id);
      pilotiToastManager.close(toToastId(id));
      const isDomicile = domicileNotifs.some((n) => n.id === id);
      if (isDomicile) {
        try {
          piloti.notifications.reply(id, trimmed);
        } catch {
          // ignore
        }
      }
    },
    [piloti.notifications, domicileNotifs, markNotificationRead]
  );

  return React.useMemo(
    () => ({
      notifications,
      unreadNotificationCount,
      pushNotification,
      dismissNotification,
      clearAllNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      invokeNotificationAction,
      replyToNotification,
    }),
    [
      notifications,
      unreadNotificationCount,
      pushNotification,
      dismissNotification,
      clearAllNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      invokeNotificationAction,
      replyToNotification,
    ],
  );
}
