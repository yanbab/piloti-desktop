import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useCapturing } from "@domicile-desktop/react/portals";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { type Capturing, CapturingKind } from "@domicile-desktop/sdk/portal";
import { ScreenshotKeptKind, UnlockRefusal, type UnlockRefused } from "@domicile-desktop/sdk/system";
import { SAMPLE_WIFI_NETWORKS, type WifiNetwork } from "@/data/catalog";
import { listVfsDir, WEB_VFS_HOME, writeVfsTextFile } from "@/lib/web-vfs";
import {
  readVfsStateText,
  VFS_STATE_PATHS,
  writeVfsStateText,
} from "@/lib/vfs-state";
import {
  type GnomeBackgroundSettings,
  isGnomeBackgroundConfigured,
} from "@/lib/gnome-background";
import { startBootPhase } from "@/lib/perf-log";
import {
  type AudioSinkInfo,
  type BatteryInfo,
  type GnomeControlCenterPanelInfo,
  type GnomeSystemCapabilities,
  type MprisMediaInfo,
  DEFAULT_GNOME_PANELS,
  connectSystemWifi,
  controlMprisMedia,
  discoverGnomeControlCenterPanels,
  listSystemAudioSinks,
  monitorGnomeBackgroundSettings,
  monitorGnomeInterfaceSettings,
  monitorGnomeWmPreferences,
  probeGnomeCapabilities,
  readGnomeBackgroundSettings,
  readGnomeInterfaceSettings,
  readGnomeNotificationSettings,
  readGnomeWmPreferences,
  readMprisMediaInfo,
  readSystemAudio,
  readSystemBattery,
  readSystemPowerProfile,
  readSystemWifi,
  setDefaultAudioSink,
  syncGnomePanelOverrides,
  syncGtkIconTheme,
  ensureXwaylandSatellite,
} from "@/lib/engine-desktop";
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
} from "@/lib/notifications";
import { subscribeWebBattery } from "@/lib/web-battery";
import { clearXdgSession } from "@/lib/xdg/xdg-session-management";
import {
  type DesktopSettings,
  type SettingsContextValue,
} from "./SettingsContext";

export type PowerAction = "logout" | "restart" | "poweroff";

export type { ShellNotification };

export interface SystemBackendsContextValue {
  gnomeCapabilities: GnomeSystemCapabilities;
  availableGnomePanels: GnomeControlCenterPanelInfo[];
  batteryInfo: BatteryInfo;
  audioSinks: AudioSinkInfo[];
  liveWifiNetworks: WifiNetwork[];
  mprisMedia: MprisMediaInfo | null;
  controlMpris: (action: "play-pause" | "next" | "previous") => Promise<void>;
  refreshSystemBackends: (options?: { scanWifi?: boolean }) => Promise<void>;
  connectWifiNetwork: (ssid: string) => Promise<void>;
  selectAudioSink: (sinkName: string) => Promise<void>;
  gnomeIconThemeOverride: string | undefined;
  // Notifications & History
  notifications: ShellNotification[];
  unreadNotificationCount: number;
  pushNotification: (n: {
    appName: string;
    summary: string;
    body: string;
    urgency?: string;
    icon?: string;
    actions?: readonly NotificationActionItem[];
    timeoutMs?: number;
  }) => void;
  dismissNotification: (id: number) => void;
  clearAllNotifications: () => void;
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  invokeNotificationAction: (id: number, action: string) => void;
  replyToNotification: (id: number, text: string) => void;
  // Compositor session lock & idle warnings
  locked: boolean;
  lockSession: () => void;
  unlockSession: (passphrase: string) => void;
  unlockError: string | null;
  unlockRefusal: UnlockRefused | null;
  idleWarningMs: number | undefined;
  // Session & power actions (Piloti menu)
  sessionExiting: boolean;
  pendingPowerAction: PowerAction | null;
  requestPowerAction: (action: PowerAction) => void;
  cancelPowerAction: () => void;
  confirmPowerAction: (restoreWindows?: boolean) => Promise<void>;
  executePowerAction: (
    action: PowerAction,
    restoreWindows?: boolean
  ) => Promise<void>;
  // Capture / Recording / Portal sessions
  capturingSessions: readonly Capturing[];
  takeScreenshot: () => Promise<void>;
  startScreenRecording: () => Promise<void>;
  startAudioRecording: () => Promise<void>;
  stopCapturing: (id: number) => void;
  pauseRecording: (id: number) => void;
  resumeRecording: (id: number) => void;
  discardRecording: (id: number) => void;
}

export const SystemBackendsContext = React.createContext<SystemBackendsContextValue | null>(
  null
);

let nextNotifCounter = 5000;

export function useSystemBackendsValue(
  settingsCtx: SettingsContextValue
): SystemBackendsContextValue {
  const domicile = useDomicile();
  const {
    isBrowserRuntime,
    settings,
    applySettingsState,
    updateSettings,
    applyingGnomeSyncRef,
  } = settingsCtx;

  const [gnomeCapabilities, setGnomeCapabilities] =
    React.useState<GnomeSystemCapabilities>({
      gsettings: false,
      gnomeControlCenter: false,
      pipewire: false,
      networkManager: false,
      powerProfiles: false,
      upower: false,
    });
  const [batteryInfo, setBatteryInfo] = React.useState<BatteryInfo>({
    present: false,
    percentage: 100,
    charging: true,
  });
  const [audioSinks, setAudioSinks] = React.useState<AudioSinkInfo[]>([]);
  const [availableGnomePanels, setAvailableGnomePanels] = React.useState<
    GnomeControlCenterPanelInfo[]
  >(() => [...DEFAULT_GNOME_PANELS]);
  const [liveWifiNetworks, setLiveWifiNetworks] = React.useState<WifiNetwork[]>(
    SAMPLE_WIFI_NETWORKS
  );
  const [mprisMedia, setMprisMedia] = React.useState<MprisMediaInfo | null>(
    null
  );
  const [gnomeIconThemeOverride, setGnomeIconThemeOverride] = React.useState<
    string | undefined
  >(undefined);

  // Notifications + Persistent History + Toast Banners
  const domicileNotifs =
    useWatch(domicile.notifications, "change", () => domicile.notifications.list) ??
    [];
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

  // Compositor session lock (declared before banner helpers so lockscreen policy applies)
  const sessionLocked =
    useWatch(domicile.session, "lockchange", () => domicile.session.locked) ??
    false;
  const [browserLocked, setBrowserLocked] = React.useState(false);
  const locked = isBrowserRuntime ? browserLocked : sessionLocked;

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

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "piloti.firstRunNotif.v1";
    try {
      if (readVfsStateText(VFS_STATE_PATHS.welcomeShown, key) === "1") return;
    } catch {
      // ignore storage errors
    }
    const timer = window.setTimeout(() => {
      try {
        writeVfsStateText(VFS_STATE_PATHS.welcomeShown, "1");
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
        domicile.notifications.dismiss([id]);
      } catch {
        // ignore
      }
    },
    [domicile.notifications]
  );

  const clearAllNotifications = React.useCallback(() => {
    console.info("[Piloti] notifications cleared");
    pilotiToastManager.close();
    setLocalNotifs([]);
    setReadIds(new Set());
    const ids = domicileNotifs.map((n) => n.id);
    if (ids.length > 0) {
      try {
        domicile.notifications.dismiss(ids);
      } catch {
        // ignore
      }
    }
  }, [domicile.notifications, domicileNotifs]);

  const invokeNotificationAction = React.useCallback(
    (id: number, action: string) => {
      console.info("[Piloti] notification action:", id, action);
      markNotificationRead(id);
      pilotiToastManager.close(toToastId(id));
      const isDomicile = domicileNotifs.some((n) => n.id === id);
      if (action === "launcher" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("piloti:open-launcher"));
      }
      if (isDomicile) {
        try {
          domicile.notifications.invoke(id, action);
        } catch {
          // ignore
        }
      }
    },
    [domicile.notifications, domicileNotifs, markNotificationRead]
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
          domicile.notifications.reply(id, trimmed);
        } catch {
          // ignore
        }
      }
    },
    [domicile.notifications, domicileNotifs, markNotificationRead]
  );

  const [unlockRefusal, setUnlockRefusal] = React.useState<UnlockRefused | null>(
    null
  );
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [idleWarningMs, setIdleWarningMs] = React.useState<number | undefined>(
    undefined
  );

  React.useEffect(() => {
    if (!locked) {
      setUnlockError(null);
      setUnlockRefusal(null);
    }
  }, [locked]);

  React.useEffect(() => {
    if (!isBrowserRuntime) return;
    return subscribeWebBattery(setBatteryInfo);
  }, [isBrowserRuntime]);

  React.useEffect(() => {
    if (isBrowserRuntime) return;
    let cancelled = false;
    let stopWarnings: (() => void) | undefined;
    let stopRefusals: (() => void) | undefined;

    (async () => {
      try {
        const res = await domicile.session.idleWarnings();
        res.match({
          Ok: async (listening) => {
            if (cancelled) {
              listening.stop();
              return;
            }
            stopWarnings = () => listening.stop();
            const reader = listening.items.getReader();
            while (!cancelled) {
              const { done, value } = await reader.read();
              if (done || cancelled) break;
              setIdleWarningMs(value);
            }
          },
          Err: () => {},
        });
      } catch {
        // ignore
      }
    })();

    (async () => {
      try {
        const res = await domicile.session.unlockRefusals();
        res.match({
          Ok: async (listening) => {
            if (cancelled) {
              listening.stop();
              return;
            }
            stopRefusals = () => listening.stop();
            const reader = listening.items.getReader();
            while (!cancelled) {
              const { done, value } = await reader.read();
              if (done || cancelled) break;
              setUnlockRefusal(value);
              if (value.refusal === UnlockRefusal.WrongPassphrase) {
                setUnlockError("Incorrect passphrase. Please try again.");
              } else if (value.refusal === UnlockRefusal.TooSoon) {
                setUnlockError(
                  `Too many attempts. Try again in ${Math.ceil(value.retryInMs / 1000)}s.`
                );
              } else {
                setUnlockError("Authentication backend unavailable (PAM).");
              }
            }
          },
          Err: () => {},
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      stopWarnings?.();
      stopRefusals?.();
    };
  }, [domicile.session, isBrowserRuntime]);

  const lockSession = React.useCallback(() => {
    console.info("[Piloti] session: lock");
    setUnlockError(null);
    setUnlockRefusal(null);
    if (isBrowserRuntime) {
      setBrowserLocked(true);
      return;
    }
    domicile.session.lock();
  }, [domicile.session, isBrowserRuntime]);

  const unlockSession = React.useCallback(
    (passphrase: string) => {
      console.info("[Piloti] session: unlock attempt");
      setUnlockError(null);
      if (isBrowserRuntime) {
        setBrowserLocked(false);
        return;
      }
      domicile.session.unlock(passphrase);
    },
    [domicile.session, isBrowserRuntime]
  );

  const [pendingPowerAction, setPendingPowerAction] =
    React.useState<PowerAction | null>(null);
  const [sessionExiting, setSessionExiting] = React.useState(false);

  const requestPowerAction = React.useCallback((action: PowerAction) => {
    console.info("[Piloti] power-dialog: open", action);
    setPendingPowerAction(action);
  }, []);

  const cancelPowerAction = React.useCallback(() => {
    console.info("[Piloti] power-dialog: cancel");
    setPendingPowerAction(null);
  }, []);

  const executePowerAction = React.useCallback(
    async (action: PowerAction, restoreWindows?: boolean) => {
      console.info("[Piloti] power-action:", action, {
        restoreWindows: restoreWindows ?? settings.restoreWindowsOnLogin,
      });
      setPendingPowerAction(null);

      if (typeof restoreWindows === "boolean") {
        updateSettings({ restoreWindowsOnLogin: restoreWindows });
        if (!restoreWindows) {
          clearXdgSession();
        }
      } else if (!settings.restoreWindowsOnLogin) {
        clearXdgSession();
      }

      const labels: Record<PowerAction, string> = {
        logout: "Log Out",
        restart: "Restart",
        poweroff: "Turn Off",
      };

      if (isBrowserRuntime) {
        setSessionExiting(true);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        pushNotification({
          appName: "Piloti Session",
          summary: `${labels[action]} (Browser Preview)`,
          body:
            action === "logout"
              ? "On Linux under Domicile, this terminates the current user session."
              : action === "restart"
                ? "On Linux under Domicile, this restarts the computer."
                : "On Linux under Domicile, this powers off the computer.",
        });
        if (action === "logout") {
          lockSession();
        }
        setSessionExiting(false);
        return;
      }

      setSessionExiting(true);
      await new Promise((resolve) => window.setTimeout(resolve, 180));

      const argv =
        action === "logout"
          ? [
              "sh",
              "-c",
              'if [ -n "$XDG_SESSION_ID" ]; then loginctl terminate-session "$XDG_SESSION_ID"; else loginctl terminate-user "$USER"; fi',
            ]
          : action === "restart"
            ? ["systemctl", "reboot"]
            : ["systemctl", "poweroff"];

      try {
        const res = await domicile.processes.run(argv);
        res.match({
          Ok: (ran) => {
            if (ran.code !== 0) {
              setSessionExiting(false);
              pushNotification({
                appName: "Piloti Session",
                summary: `${labels[action]} Failed`,
                body: ran.stderr?.trim() || `Exited with status ${ran.code}`,
                urgency: "critical",
              });
            }
          },
          Err: (err) => {
            setSessionExiting(false);
            pushNotification({
              appName: "Piloti Session",
              summary: `${labels[action]} Failed`,
              body: String(err),
              urgency: "critical",
            });
          },
        });
      } catch (err) {
        setSessionExiting(false);
        pushNotification({
          appName: "Piloti Session",
          summary: `${labels[action]} Failed`,
          body: err instanceof Error ? err.message : String(err),
          urgency: "critical",
        });
      }
    },
    [
      domicile.processes,
      isBrowserRuntime,
      lockSession,
      pushNotification,
      settings.restoreWindowsOnLogin,
      updateSettings,
    ]
  );

  const confirmPowerAction = React.useCallback(
    async (restoreWindows?: boolean) => {
      const action = pendingPowerAction;
      if (!action) return;
      await executePowerAction(action, restoreWindows);
    },
    [executePowerAction, pendingPowerAction]
  );

  // Sync GNOME Control Center panel overrides whenever hiddenGnomePanels changes
  React.useEffect(() => {
    if (isBrowserRuntime) return;
    const timer = window.setTimeout(() => {
      void syncGnomePanelOverrides(domicile, settings.hiddenGnomePanels);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [domicile, isBrowserRuntime, settings.hiddenGnomePanels]);

  // Backends probing + GSettings monitor
  const refreshSystemBackends = React.useCallback(
    async (options?: { scanWifi?: boolean }) => {
      if (isBrowserRuntime) return;
      const finishBackends = startBootPhase("system backends");
      const [audio, battery, powerProfile, mpris] = await Promise.all([
        readSystemAudio(domicile),
        readSystemBattery(domicile),
        readSystemPowerProfile(domicile),
        readMprisMediaInfo(domicile),
      ]);

      setMprisMedia(mpris);
      setBatteryInfo(
        battery ?? { present: false, percentage: 100, charging: true }
      );
      if (audio) {
        applySettingsState({ volume: audio.volume, muted: audio.muted });
      }
      if (powerProfile) {
        applySettingsState({ powerMode: powerProfile });
      }

      const [caps, panels, sinks, wifi] = await Promise.all([
        probeGnomeCapabilities(domicile),
        discoverGnomeControlCenterPanels(domicile),
        listSystemAudioSinks(domicile),
        readSystemWifi(domicile, { scan: Boolean(options?.scanWifi) }),
        ensureXwaylandSatellite(domicile),
      ]);
      finishBackends();

      setGnomeCapabilities(caps);
      setAvailableGnomePanels(panels);
      if (sinks.length > 0) setAudioSinks(sinks);

      if (wifi) {
        if (wifi.networks.length > 0) setLiveWifiNetworks(wifi.networks);
        applySettingsState({
          wifiEnabled: wifi.enabled,
          ...(wifi.connectedSsid ? { connectedWifi: wifi.connectedSsid } : {}),
        });
      }
    },
    [applySettingsState, domicile, isBrowserRuntime]
  );

  const controlMpris = React.useCallback(
    async (action: "play-pause" | "next" | "previous") => {
      console.info("[Piloti] control-panel: mpris", action);
      if (isBrowserRuntime) return;
      await controlMprisMedia(domicile, action);
      const updated = await readMprisMediaInfo(domicile);
      setMprisMedia(updated);
    },
    [domicile, isBrowserRuntime]
  );

  const gnomeBackgroundRef = React.useRef(settings.gnomeBackground);
  gnomeBackgroundRef.current = settings.gnomeBackground;

  React.useEffect(() => {
    if (isBrowserRuntime) return;
    let cancelled = false;

    const deferTimer = window.setTimeout(() => {
      if (!cancelled) void refreshSystemBackends();
    }, 250);

    const applyGnomeSnapshot = (
      snap: Awaited<ReturnType<typeof readGnomeInterfaceSettings>>
    ) => {
      if (cancelled || !settings.syncGnomeSettings) return;
      const patch: Partial<DesktopSettings> = {};
      if (snap.themeMode) patch.themeMode = snap.themeMode;
      if (snap.accentColor) patch.accentColor = snap.accentColor;
      if (snap.clock24Hour !== undefined) patch.clock24Hour = snap.clock24Hour;
      if (snap.clockShowSeconds !== undefined) {
        patch.clockShowSeconds = snap.clockShowSeconds;
      }
      if (snap.fontName) patch.gtkFontName = snap.fontName;
      if (snap.documentFontName) {
        patch.gtkDocumentFontName = snap.documentFontName;
      }
      if (snap.monospaceFontName) {
        patch.gtkMonospaceFontName = snap.monospaceFontName;
      }
      if (snap.textScalingFactor !== undefined) {
        patch.gtkTextScalingFactor = snap.textScalingFactor;
      }
      if (snap.fontAntialiasing) {
        patch.gtkFontAntialiasing = snap.fontAntialiasing;
      }
      if (snap.fontHinting) patch.gtkFontHinting = snap.fontHinting;
      if (snap.fontRgbaOrder) patch.gtkFontRgbaOrder = snap.fontRgbaOrder;
      if (snap.iconTheme) {
        setGnomeIconThemeOverride(snap.iconTheme);
      }
      if (Object.keys(patch).length > 0) {
        applyingGnomeSyncRef.current = true;
        applySettingsState(patch);
        applyingGnomeSyncRef.current = false;
      }
    };

    const applyGnomeBackgroundSnapshot = (
      snap: Partial<GnomeBackgroundSettings>,
      fromMonitor: boolean
    ) => {
      if (cancelled || !settings.syncGnomeSettings) return;
      const keys = Object.keys(snap) as (keyof GnomeBackgroundSettings)[];
      if (keys.length === 0) return;

      const current = gnomeBackgroundRef.current;
      if (!fromMonitor && !isGnomeBackgroundConfigured(snap)) {
        return;
      }
      const changed = keys.some((k) => snap[k] !== current[k]);
      if (!changed) return;

      const nextBg: GnomeBackgroundSettings = { ...current, ...snap };
      gnomeBackgroundRef.current = nextBg;
      applyingGnomeSyncRef.current = true;
      applySettingsState({
        wallpaperId: "gnome",
        customWallpaperUrl: "",
        gnomeBackground: nextBg,
      });
      applyingGnomeSyncRef.current = false;
    };

    void readGnomeInterfaceSettings(domicile).then(applyGnomeSnapshot);
    const stopInterfaceMonitor = monitorGnomeInterfaceSettings(
      domicile,
      applyGnomeSnapshot
    );
    void readGnomeBackgroundSettings(domicile).then((snap) =>
      applyGnomeBackgroundSnapshot(snap, false)
    );
    void readGnomeNotificationSettings(domicile).then((snap) => {
      if (cancelled || !settings.syncGnomeSettings) return;
      const patch: Partial<DesktopSettings> = {};
      if (snap.doNotDisturb !== undefined) {
        patch.doNotDisturb = snap.doNotDisturb;
      }
      if (snap.showInLockScreen !== undefined) {
        patch.notificationShowOnLockScreen = snap.showInLockScreen;
      }
      if (Object.keys(patch).length > 0) {
        applyingGnomeSyncRef.current = true;
        applySettingsState(patch);
        applyingGnomeSyncRef.current = false;
      }
    });
    const stopBackgroundMonitor = monitorGnomeBackgroundSettings(
      domicile,
      (snap) => applyGnomeBackgroundSnapshot(snap, true)
    );

    const applyGnomeWmSnapshot = (snap: { buttonLayout?: string }) => {
      if (cancelled || !settings.syncGnomeSettings || !snap.buttonLayout) return;
      applyingGnomeSyncRef.current = true;
      applySettingsState({ windowButtonLayout: snap.buttonLayout });
      applyingGnomeSyncRef.current = false;
    };
    void readGnomeWmPreferences(domicile).then(applyGnomeWmSnapshot);
    const stopWmMonitor = monitorGnomeWmPreferences(
      domicile,
      applyGnomeWmSnapshot
    );

    return () => {
      cancelled = true;
      window.clearTimeout(deferTimer);
      stopInterfaceMonitor();
      stopBackgroundMonitor();
      stopWmMonitor();
    };
  }, [
    applySettingsState,
    applyingGnomeSyncRef,
    domicile,
    isBrowserRuntime,
    refreshSystemBackends,
    settings.syncGnomeSettings,
  ]);

  const connectWifiNetwork = React.useCallback(
    async (ssid: string) => {
      console.info("[Piloti] control-panel: wifi connect", ssid);
      updateSettings({ connectedWifi: ssid, wifiEnabled: true });
      if (!isBrowserRuntime) {
        await connectSystemWifi(domicile, ssid);
        void refreshSystemBackends();
      }
    },
    [domicile, isBrowserRuntime, refreshSystemBackends, updateSettings]
  );

  const selectAudioSink = React.useCallback(
    async (sinkName: string) => {
      console.info("[Piloti] control-panel: audio sink", sinkName);
      setAudioSinks((prev) =>
        prev.map((s) => ({ ...s, active: s.name === sinkName }))
      );
      if (!isBrowserRuntime) {
        await setDefaultAudioSink(domicile, sinkName);
        void refreshSystemBackends();
      }
    },
    [domicile, isBrowserRuntime, refreshSystemBackends]
  );

  // Screenshots, Screen Recording, and Capturing sessions
  const nativeCapturingSessions = useCapturing() ?? [];
  const [browserCapturingSessions, setBrowserCapturingSessions] =
    React.useState<Capturing[]>([]);
  const browserRecordersRef = React.useRef<
    Map<
      number,
      {
        recorder: MediaRecorder;
        stream: MediaStream;
        discarded: boolean;
      }
    >
  >(new Map());
  const capturingSessions = isBrowserRuntime
    ? browserCapturingSessions
    : nativeCapturingSessions;

  const nextDesktopCaptureFilename = React.useCallback(
    (prefix: string, ext: string) => {
      const existing = new Set(
        listVfsDir(`${WEB_VFS_HOME}/Desktop`).map((e) => e.name)
      );
      let n = 1;
      while (existing.has(`${prefix} ${n}.${ext}`)) {
        n += 1;
      }
      return `${prefix} ${n}.${ext}`;
    },
    []
  );

  const takeScreenshot = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screenshot");
    if (isBrowserRuntime) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        pushNotification({
          appName: "Screenshot",
          summary: "Screen Capture Unavailable",
          body: "navigator.mediaDevices.getDisplayMedia is not supported in this browser.",
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
        await video.play();
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        for (const track of stream.getTracks()) track.stop();
        const dataUrl = canvas.toDataURL("image/png");
        const filename = nextDesktopCaptureFilename("Screenshot", "png");
        try {
          writeVfsTextFile(`${WEB_VFS_HOME}/Desktop/${filename}`, dataUrl);
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Captured",
            body: `Saved to Desktop/${filename}`,
          });
        } catch {
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = filename;
          link.click();
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Captured",
            body: `Downloaded ${filename} (Desktop storage full)`,
          });
        }
      } catch (err) {
        if ((err as Error)?.name !== "NotAllowedError" && (err as Error)?.name !== "AbortError") {
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Failed",
            body: String(err),
          });
        }
      }
      return;
    }
    const res = await domicile.capture.screenshot();
    res.match({
      Ok: (kept) => {
        if (kept.kind === ScreenshotKeptKind.Saved) {
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Saved",
            body: kept.path,
          });
        } else {
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Copied to Clipboard",
            body: "Ready to paste in any application.",
          });
        }
      },
      Err: () => {},
    });
  }, [domicile.capture, isBrowserRuntime, nextDesktopCaptureFilename, pushNotification]);

  const startScreenRecording = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screen recording");
    if (isBrowserRuntime) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        pushNotification({
          appName: "Screen Recorder",
          summary: "Screen Recording Unavailable",
          body: "navigator.mediaDevices.getDisplayMedia is not supported in this browser.",
        });
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
          });
        }
        const id = Date.now();
        const chunks: BlobPart[] = [];
        let firstFrameThumb: string | undefined;
        if (typeof document !== "undefined") {
          try {
            const video = document.createElement("video");
            video.muted = true;
            video.playsInline = true;
            video.srcObject = stream;
            const grab = () => {
              if (firstFrameThumb || video.videoWidth <= 0 || video.videoHeight <= 0) return;
              const maxSide = 256;
              const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
              const w = Math.max(1, Math.round(video.videoWidth * scale));
              const h = Math.max(1, Math.round(video.videoHeight * scale));
              const canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                firstFrameThumb = canvas.toDataURL("image/jpeg", 0.78);
              }
              video.pause();
              video.srcObject = null;
            };
            video.addEventListener("loadeddata", grab, { once: true });
            void video.play().then(grab).catch(() => {});
          } catch {
            // ignore thumbnail capture errors
          }
        }
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        const entry = { recorder, stream, discarded: false };
        browserRecordersRef.current.set(id, entry);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          for (const track of stream.getTracks()) track.stop();
          browserRecordersRef.current.delete(id);
          setBrowserCapturingSessions((prev) => prev.filter((c) => c.id !== id));
          if (!entry.discarded && chunks.length > 0) {
            const blob = new Blob(chunks, { type: "video/webm" });
            const filename = nextDesktopCaptureFilename("Screencast", "webm");
            const fallbackDownload = () => {
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = filename;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
              pushNotification({
                appName: "Screen Recorder",
                summary: "Screen Recording Saved",
                body: `Downloaded ${filename} (Desktop storage full)`,
              });
            };
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = typeof reader.result === "string" ? reader.result : null;
              if (!dataUrl) {
                fallbackDownload();
                return;
              }
              try {
                writeVfsTextFile(`${WEB_VFS_HOME}/Desktop/${filename}`, dataUrl, {
                  metadata: {
                    "standard::content-type": "video/webm",
                    ...(firstFrameThumb ? { "metadata::thumbnail": firstFrameThumb } : {}),
                  },
                });
                pushNotification({
                  appName: "Screen Recorder",
                  summary: "Screen Recording Saved",
                  body: `Saved to Desktop/${filename}`,
                });
              } catch {
                fallbackDownload();
              }
            };
            reader.onerror = fallbackDownload;
            reader.readAsDataURL(blob);
          }
        };
        for (const track of stream.getVideoTracks()) {
          track.onended = () => {
            if (recorder.state !== "inactive") recorder.stop();
          };
        }
        recorder.start(250);
        setBrowserCapturingSessions((prev) => [
          ...prev,
          {
            id,
            kind: CapturingKind.Recording,
            runningSinceMs: Date.now(),
          } as Capturing,
        ]);
      } catch (err) {
        if ((err as Error)?.name !== "NotAllowedError" && (err as Error)?.name !== "AbortError") {
          pushNotification({
            appName: "Screen Recorder",
            summary: "Screen Recording Failed",
            body: String(err),
          });
        }
      }
      return;
    }
    const res = await domicile.capture.screenRecord();
    res.match({
      Ok: (filePath) => {
        pushNotification({
          appName: "Screen Recorder",
          summary: "Screen Recording Saved",
          body: filePath,
        });
      },
      Err: () => {},
    });
  }, [domicile.capture, isBrowserRuntime, nextDesktopCaptureFilename, pushNotification]);

  const startAudioRecording = React.useCallback(async () => {
    console.info("[Piloti] control-panel: audio recording");
    if (!navigator.mediaDevices?.getUserMedia) {
      pushNotification({
        appName: "Audio Recorder",
        summary: "Audio Recording Unavailable",
        body: "navigator.mediaDevices.getUserMedia is not supported in this environment.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const id = Date.now();
      const chunks: BlobPart[] = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const entry = { recorder, stream, discarded: false };
      browserRecordersRef.current.set(id, entry);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        browserRecordersRef.current.delete(id);
        setBrowserCapturingSessions((prev) => prev.filter((c) => c.id !== id));
        if (!entry.discarded && chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
          const filename = nextDesktopCaptureFilename("Record", "webm");
          const fallbackDownload = () => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            pushNotification({
              appName: "Audio Recorder",
              summary: "Audio Note Saved",
              body: `Downloaded ${filename} (Desktop storage full)`,
            });
          };
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : null;
            if (!dataUrl) {
              fallbackDownload();
              return;
            }
            try {
              const contentType =
                (mimeType || "audio/webm").split(";")[0]?.trim() || "audio/webm";
              writeVfsTextFile(`${WEB_VFS_HOME}/Desktop/${filename}`, dataUrl, {
                metadata: {
                  "standard::content-type": contentType,
                },
              });
              pushNotification({
                appName: "Audio Recorder",
                summary: "Audio Note Saved",
                body: `Saved to Desktop/${filename}`,
              });
            } catch {
              fallbackDownload();
            }
          };
          reader.onerror = fallbackDownload;
          reader.readAsDataURL(blob);
        }
      };
      recorder.start(250);
      setBrowserCapturingSessions((prev) => [
        ...prev,
        {
          id,
          kind: CapturingKind.Recording,
          runningSinceMs: Date.now(),
        } as Capturing,
      ]);
    } catch (err) {
      if (
        (err as Error)?.name !== "NotAllowedError" &&
        (err as Error)?.name !== "AbortError"
      ) {
        pushNotification({
          appName: "Audio Recorder",
          summary: "Audio Recording Failed",
          body: String(err),
        });
      }
    }
  }, [nextDesktopCaptureFilename, pushNotification]);

  return React.useMemo<SystemBackendsContextValue>(
    () => ({
      gnomeCapabilities,
      availableGnomePanels,
      batteryInfo,
      audioSinks,
      liveWifiNetworks,
      mprisMedia,
      controlMpris,
      refreshSystemBackends,
      connectWifiNetwork,
      selectAudioSink,
      gnomeIconThemeOverride,
      notifications,
      unreadNotificationCount,
      pushNotification,
      dismissNotification,
      clearAllNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      invokeNotificationAction,
      replyToNotification,
      locked,
      lockSession,
      unlockSession,
      unlockError,
      unlockRefusal,
      idleWarningMs,
      sessionExiting,
      pendingPowerAction,
      requestPowerAction,
      cancelPowerAction,
      confirmPowerAction,
      executePowerAction,
      capturingSessions,
      takeScreenshot,
      startScreenRecording,
      startAudioRecording,
      stopCapturing: (id) => {
        if (isBrowserRuntime) {
          const rec = browserRecordersRef.current.get(id);
          if (rec && rec.recorder.state !== "inactive") rec.recorder.stop();
          return;
        }
        domicile.portals.stopCapturing(id);
      },
      pauseRecording: (id) => {
        if (isBrowserRuntime) {
          const rec = browserRecordersRef.current.get(id);
          if (rec && rec.recorder.state === "recording") {
            rec.recorder.pause();
            setBrowserCapturingSessions((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, runningSinceMs: undefined } : c
              )
            );
          }
          return;
        }
        domicile.portals.pauseRecording(id);
      },
      resumeRecording: (id) => {
        if (isBrowserRuntime) {
          const rec = browserRecordersRef.current.get(id);
          if (rec && rec.recorder.state === "paused") {
            rec.recorder.resume();
            setBrowserCapturingSessions((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, runningSinceMs: Date.now() } : c
              )
            );
          }
          return;
        }
        domicile.portals.resumeRecording(id);
      },
      discardRecording: (id) => {
        if (isBrowserRuntime) {
          const rec = browserRecordersRef.current.get(id);
          if (rec) {
            rec.discarded = true;
            if (rec.recorder.state !== "inactive") rec.recorder.stop();
          }
          return;
        }
        domicile.portals.discardRecording(id);
      },
    }),
    [
      audioSinks,
      availableGnomePanels,
      batteryInfo,
      cancelPowerAction,
      capturingSessions,
      clearAllNotifications,
      confirmPowerAction,
      connectWifiNetwork,
      controlMpris,
      dismissNotification,
      domicile.portals,
      executePowerAction,
      gnomeCapabilities,
      gnomeIconThemeOverride,
      idleWarningMs,
      invokeNotificationAction,
      liveWifiNetworks,
      lockSession,
      locked,
      markAllNotificationsRead,
      markNotificationRead,
      mprisMedia,
      notifications,
      pendingPowerAction,
      pushNotification,
      refreshSystemBackends,
      replyToNotification,
      requestPowerAction,
      selectAudioSink,
      sessionExiting,
      startAudioRecording,
      startScreenRecording,
      takeScreenshot,
      unlockError,
      unlockRefusal,
      unlockSession,
      unreadNotificationCount,
    ]
  );
}

export function useSystemBackends() {
  const ctx = React.useContext(SystemBackendsContext);
  if (!ctx) {
    throw new Error(
      "useSystemBackends must be used within DesktopStateProvider"
    );
  }
  return ctx;
}

