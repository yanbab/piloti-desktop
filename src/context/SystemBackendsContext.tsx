import { getEngine } from "@/lib/engine/engine";
import * as React from "react";
import { usePiloti } from "@/lib/engine/piloti";
import { useCapturing } from "@domicile-desktop/react/portals";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { type Capturing, CapturingKind } from "@domicile-desktop/sdk/portal";
import { ScreenshotKeptKind, UnlockRefusal, type UnlockRefused } from "@domicile-desktop/sdk/system";
import { SAMPLE_WIFI_NETWORKS, type WifiNetwork } from "@/data/catalog";
import { listVfsDir, writeVfsTextFile } from "@/lib/engine-web/web-vfs";
import { WEB_VFS_HOME } from "@/lib/core/vfs-paths";
import {
  migrateLegacyStateFilesToJson,
  readVfsStateJson,
  readVfsStateText,
  VFS_STATE_PATHS,
  writeVfsStateJson,
  writeVfsStateText,
} from "@/lib/engine/vfs-state";
import {
  type GnomeBackgroundSettings,
  isGnomeBackgroundConfigured,
} from "@/lib/engine-native/gnome-background";
import { startBootPhase } from "@/lib/core/perf-log";
import { isAppNotificationAllowed } from "@/lib/core/app-permissions";
import { _ } from "@/lib/core/i18n";
import {
  captureOpenAction,
  screenshotBaseName,
  uniqueCaptureName,
  videoBaseName,
  parseOpenAction,
} from "@/lib/shell/capture-files";
import { toDomicilePath } from "@/lib/engine/fs-bridge";
import {
  type AudioSinkInfo,
  type BluetoothDeviceInfo,
  type BatteryInfo,
  type GnomeControlCenterPanelInfo,
  type GnomeInterfaceSnapshot,
  type GnomeSystemCapabilities,
  type MprisMediaInfo,
  DEFAULT_GNOME_PANELS,
  connectSystemWifi,
  controlMprisMedia,
  discoverGnomeControlCenterPanels,
  monitorGnomeDesktopSettings,
  probeGnomeCapabilities,
  readGnomeDesktopSettingsBatch,
  watchSystemAudio,
  watchSystemBluetooth,
  setSystemBluetoothConnected,
  readSystemBattery,
  watchSystemBattery,
  watchSystemBrightness,
  watchMprisMedia,
  watchSystemPowerProfile,
  scanSystemWifi,
  watchSystemWifi,
  setDefaultAudioSink,
  syncGnomePanelOverrides,
  syncGtkIconTheme,
  runXdgAutostartOnce,
} from "@/lib/engine-native";
import { playSoundThemeEvent } from "@/lib/shell/sound-effects";
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
} from "@/lib/shell/notifications";
import { subscribeWebBattery } from "@/lib/engine-web/web-battery";
import { clearXdgSession } from "@/lib/xdg/xdg-session-management";
import {
  type DesktopSettings,
  type SettingsContextValue,
} from "./SettingsContext";

export type PowerAction = "logout" | "restart" | "poweroff";

export type { ShellNotification };

/** Seconds of warning before the screens blank for inactivity. */
const IDLE_WARNING_SECONDS = 30;

/** A stream from a Domicile `Listening` (items + stop). */
type StreamListening<T> = { items: ReadableStream<T>; stop: () => void };

export interface SystemBackendsContextValue {
  gnomeCapabilities: GnomeSystemCapabilities;
  availableGnomePanels: GnomeControlCenterPanelInfo[];
  batteryInfo: BatteryInfo;
  audioSinks: AudioSinkInfo[];
  liveWifiNetworks: WifiNetwork[];
  bluetoothDevices: BluetoothDeviceInfo[];
  /** False when the machine has no such hardware: not "off", absent. */
  wifiPresent: boolean;
  bluetoothPresent: boolean;
  toggleBluetoothDevice: (path: string) => Promise<void>;
  mprisMedia: MprisMediaInfo | null;
  controlMpris: (action: "play-pause" | "next" | "previous") => Promise<void>;
  refreshSystemBackends: (options?: { scanWifi?: boolean }) => Promise<void>;
  /** Joins a network; on a real system answers whether it needs a passphrase. */
  connectWifiNetwork: (
    ssid: string,
    passphrase?: string,
  ) => Promise<"connected" | "needs-passphrase" | "failed">;
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
  webPowerPhase: "active" | "restarting" | "powered-off";
  powerOnSimulatedMachine: () => void;
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
  settingsCtx: SettingsContextValue,
  options?: { greeterMode?: boolean }
): SystemBackendsContextValue {
  const greeterMode = Boolean(options?.greeterMode);
  const piloti = usePiloti();
  const { systemServices } = getEngine().capabilities;
  const {
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
  const [bluetoothDevices, setBluetoothDevices] = React.useState<BluetoothDeviceInfo[]>([]);
  const [wifiPresent, setWifiPresent] = React.useState(true);
  const [bluetoothPresent, setBluetoothPresent] = React.useState(true);
  const [availableGnomePanels, setAvailableGnomePanels] = React.useState<
    GnomeControlCenterPanelInfo[]
  >(() => [...DEFAULT_GNOME_PANELS]);
  const [liveWifiNetworks, setLiveWifiNetworks] = React.useState<WifiNetwork[]>(
    getEngine().capabilities.simulatedHardware ? SAMPLE_WIFI_NETWORKS : []
  );
  const [mprisMedia, setMprisMedia] = React.useState<MprisMediaInfo | null>(
    null
  );
  const [gnomeIconThemeOverride, setGnomeIconThemeOverride] = React.useState<
    string | undefined
  >(undefined);

  // Notifications + Persistent History + Toast Banners
  const domicileNotifs =
    useWatch(piloti.notifications, "change", () => piloti.notifications.list) ??
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
    useWatch(piloti.session, "lockchange", () => piloti.session.locked) ??
    false;
  const [browserLocked, setBrowserLocked] = React.useState(false);
  const locked = !systemServices ? browserLocked : sessionLocked;

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
    if (systemServices) return;
    return subscribeWebBattery(setBatteryInfo);
  }, [systemServices]);

  React.useEffect(() => {
    if (!systemServices) return;
    let cancelled = false;
    let stopWarnings: (() => void) | undefined;
    let stopRefusals: (() => void) | undefined;

    // "Screen will dim in Ns": Domicile ≥ 1.3 says `true` that many seconds
    // before blanking and `false` when it is called off; older ones sent the
    // milliseconds left (`idleWarnings`).
    let countdown: ReturnType<typeof setInterval> | undefined;
    const stopCountdown = () => {
      if (countdown) clearInterval(countdown);
      countdown = undefined;
    };
    const listen = async <T,>(
      open: () => Promise<{ match: (arms: { Ok: (l: StreamListening<T>) => void; Err: () => void }) => void }>,
      onValue: (value: T) => void,
    ) => {
      try {
        (await open()).match({
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
              onValue(value);
            }
          },
          Err: () => {},
        });
      } catch {
        // ignore
      }
    };
    const session = piloti.session as typeof piloti.session & {
      idleWarnings?: () => Promise<{
        match: (arms: { Ok: (l: StreamListening<number | undefined>) => void; Err: () => void }) => void;
      }>;
    };
    if (typeof session.idleBeforeBlanking === "function") {
      void listen<boolean>(
        () => session.idleBeforeBlanking(IDLE_WARNING_SECONDS),
        (warn) => {
          stopCountdown();
          if (!warn) {
            setIdleWarningMs(undefined);
            return;
          }
          const deadline = Date.now() + IDLE_WARNING_SECONDS * 1000;
          const tick = () => setIdleWarningMs(Math.max(0, deadline - Date.now()));
          tick();
          countdown = setInterval(tick, 1000);
        },
      );
    } else if (typeof session.idleWarnings === "function") {
      const idleWarnings = session.idleWarnings;
      void listen<number | undefined>(() => idleWarnings(), setIdleWarningMs);
    }

    (async () => {
      try {
        const res = await piloti.session.unlockRefusals();
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
      stopCountdown();
      cancelled = true;
      stopWarnings?.();
      stopRefusals?.();
    };
  }, [piloti.session, systemServices]);

  const lockSession = React.useCallback(() => {
    console.info("[Piloti] session: lock");
    setUnlockError(null);
    setUnlockRefusal(null);
    if (!systemServices) {
      setBrowserLocked(true);
      return;
    }
    piloti.session.lock();
  }, [piloti.session, systemServices]);

  const unlockSession = React.useCallback(
    (passphrase: string) => {
      console.info("[Piloti] session: unlock attempt");
      setUnlockError(null);
      if (!systemServices) {
        if (!passphrase.trim()) {
          setUnlockError("Please enter your password.");
          return;
        }
        setBrowserLocked(false);
        return;
      }
      piloti.session.unlock(passphrase);
    },
    [piloti.session, systemServices]
  );

  const [pendingPowerAction, setPendingPowerAction] =
    React.useState<PowerAction | null>(null);
  const [sessionExiting, setSessionExiting] = React.useState(false);
  const [webPowerPhase, setWebPowerPhase] = React.useState<
    "active" | "restarting" | "powered-off"
  >("active");

  const powerOnSimulatedMachine = React.useCallback(() => {
    setWebPowerPhase("restarting");
    window.setTimeout(() => {
      setWebPowerPhase("active");
      setBrowserLocked(true);
    }, 850);
  }, []);

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

      if (!systemServices) {
        setSessionExiting(true);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        if (action === "logout") {
          lockSession();
          setSessionExiting(false);
        } else if (action === "restart") {
          setWebPowerPhase("restarting");
          setSessionExiting(false);
          await new Promise((resolve) => window.setTimeout(resolve, 950));
          setWebPowerPhase("active");
          lockSession();
        } else {
          setWebPowerPhase("powered-off");
          setSessionExiting(false);
        }
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
        const res = await piloti.processes.run(argv);
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
      piloti.processes,
      systemServices,
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
    if (!systemServices || greeterMode) return;
    const timer = window.setTimeout(() => {
      void syncGnomePanelOverrides(piloti, settings.hiddenGnomePanels);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [piloti, greeterMode, systemServices, settings.hiddenGnomePanels]);

  // Battery and brightness follow the system (UPower, backlight), whoever changes them.
  React.useEffect(() => {
    if (!systemServices) return;
    const stopBattery = watchSystemBattery(piloti, setBatteryInfo);
    const stopAudio = watchSystemAudio(piloti, (audio) => {
      applySettingsState({ volume: audio.volume, muted: audio.muted });
      if (audio.sinks.length > 0) setAudioSinks(audio.sinks);
    });
    const stopBluetooth = watchSystemBluetooth(piloti, (bt) => {
      setBluetoothPresent(Boolean(bt));
      if (!bt) {
        setBluetoothDevices([]);
        applySettingsState({ bluetoothEnabled: false });
        return;
      }
      applySettingsState({ bluetoothEnabled: bt.powered });
      setBluetoothDevices(bt.devices);
    });
    const stopWifi = watchSystemWifi(piloti, (wifi) => {
      setWifiPresent(Boolean(wifi));
      if (!wifi) {
        // No Wi-Fi hardware: show it off and empty.
        setLiveWifiNetworks([]);
        applySettingsState({ wifiEnabled: false, connectedWifi: "" });
        return;
      }
      setLiveWifiNetworks(wifi.networks);
      applySettingsState({
        wifiEnabled: wifi.enabled,
        connectedWifi: wifi.connectedSsid ?? "",
      });
    });
    const stopBrightness = greeterMode
      ? () => undefined
      : watchSystemBrightness(piloti, (brightness) => applySettingsState({ brightness }));
    // Power profile and media players arrive as D-Bus signals.
    const stopPowerProfile = greeterMode
      ? () => undefined
      : watchSystemPowerProfile(piloti, (powerMode) => applySettingsState({ powerMode }));
    const stopMpris = greeterMode ? () => undefined : watchMprisMedia(piloti, setMprisMedia);
    return () => {
      stopPowerProfile();
      stopMpris();
      stopBattery();
      stopWifi();
      stopBluetooth();
      stopAudio();
      stopBrightness();
    };
  }, [applySettingsState, piloti, greeterMode, systemServices]);

  // Backends probing + GSettings monitor
  const refreshSystemBackends = React.useCallback(
    async (options?: { scanWifi?: boolean }) => {
      if (!systemServices) return;
      const finishBackends = startBootPhase("system backends");
      const battery = await readSystemBattery(piloti);
      setBatteryInfo(
        battery ?? { present: false, percentage: 100, charging: true }
      );

      if (options?.scanWifi) void scanSystemWifi(piloti);

      if (greeterMode) {
        finishBackends();
        return;
      }

      const [caps, panels] = await Promise.all([
        probeGnomeCapabilities(piloti),
        discoverGnomeControlCenterPanels(piloti),
        runXdgAutostartOnce(piloti),
      ]);
      finishBackends();

      setGnomeCapabilities(caps);
      setAvailableGnomePanels(panels);

    },
    [applySettingsState, piloti, greeterMode, systemServices]
  );

  const controlMpris = React.useCallback(
    async (action: "play-pause" | "next" | "previous") => {
      console.info("[Piloti] control-panel: mpris", action);
      if (!systemServices) return;
      await controlMprisMedia(piloti, action); // the watcher reports the new state
    },
    [piloti, systemServices]
  );

  const gnomeBackgroundRef = React.useRef(settings.gnomeBackground);
  gnomeBackgroundRef.current = settings.gnomeBackground;

  React.useEffect(() => {
    if (!systemServices) return;
    let cancelled = false;

    const deferTimer = window.setTimeout(() => {
      if (!cancelled) void refreshSystemBackends();
    }, 250);

    if (greeterMode) {
      return () => {
        cancelled = true;
        window.clearTimeout(deferTimer);
      };
    }

    const applyGnomeSnapshot = (snap: GnomeInterfaceSnapshot) => {
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

    const applyGnomeNotificationSnapshot = (snap: {
      doNotDisturb?: boolean;
      showInLockScreen?: boolean;
    }) => {
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
    };

    const applyGnomeWmSnapshot = (snap: { buttonLayout?: string }) => {
      if (cancelled || !settings.syncGnomeSettings || !snap.buttonLayout) return;
      applyingGnomeSyncRef.current = true;
      applySettingsState({ windowButtonLayout: snap.buttonLayout });
      applyingGnomeSyncRef.current = false;
    };

    void readGnomeDesktopSettingsBatch(piloti).then((batch) => {
      applyGnomeSnapshot(batch.interface);
      applyGnomeBackgroundSnapshot(batch.background, false);
      applyGnomeNotificationSnapshot(batch.notifications);
      applyGnomeWmSnapshot(batch.wm);
    });

    const stopDesktopSettingsMonitor = monitorGnomeDesktopSettings(piloti, {
      onInterface: applyGnomeSnapshot,
      onBackground: (snap) => applyGnomeBackgroundSnapshot(snap, true),
      onWm: applyGnomeWmSnapshot,
      onNotifications: applyGnomeNotificationSnapshot,
    });

    return () => {
      cancelled = true;
      window.clearTimeout(deferTimer);
      stopDesktopSettingsMonitor();
    };
  }, [
    applySettingsState,
    applyingGnomeSyncRef,
    piloti,
    greeterMode,
    systemServices,
    refreshSystemBackends,
    settings.syncGnomeSettings,
  ]);

  const connectWifiNetwork = React.useCallback(
    async (ssid: string, passphrase?: string) => {
      console.info("[Piloti] control-panel: wifi connect", ssid);
      if (!systemServices) {
        updateSettings({ connectedWifi: ssid, wifiEnabled: true });
        return "connected" as const;
      }
      const result = await connectSystemWifi(piloti, ssid, passphrase);
      if (result === "connected") updateSettings({ connectedWifi: ssid, wifiEnabled: true });
      void refreshSystemBackends();
      return result;
    },
    [piloti, systemServices, refreshSystemBackends, updateSettings]
  );

  const toggleBluetoothDevice = React.useCallback(
    async (path: string) => {
      if (!systemServices) return;
      const device = bluetoothDevices.find((d) => d.path === path);
      if (device) await setSystemBluetoothConnected(piloti, path, !device.connected);
    },
    [bluetoothDevices, piloti, systemServices]
  );

  const selectAudioSink = React.useCallback(
    async (sinkName: string) => {
      console.info("[Piloti] control-panel: audio sink", sinkName);
      setAudioSinks((prev) =>
        prev.map((s) => ({ ...s, active: s.name === sinkName }))
      );
      if (systemServices) {
        await setDefaultAudioSink(piloti, sinkName);
        void refreshSystemBackends();
      }
    },
    [piloti, systemServices, refreshSystemBackends]
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
  const capturingSessions = !systemServices
    ? browserCapturingSessions
    : nativeCapturingSessions;

  const desktopCaptureName = React.useCallback(
    (base: string, ext: string) =>
      uniqueCaptureName(
        listVfsDir(`${WEB_VFS_HOME}/Desktop`).map((e) => e.name),
        base,
        ext,
      ),
    []
  );

  const takeScreenshot = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screenshot");
    if (!systemServices) {
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
        const filename = desktopCaptureName(screenshotBaseName(canvas.width, canvas.height), "png");
        const savedPath = `${WEB_VFS_HOME}/Desktop/${filename}`;
        try {
          writeVfsTextFile(savedPath, dataUrl);
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Captured",
            body: `${WEB_VFS_HOME}/Desktop/${filename}`,
            actions: [captureOpenAction(savedPath)],
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
    const res = await piloti.capture.screenshot();
    res.match({
      Ok: (kept) => {
        void playSoundThemeEvent("screenshot", settings.volume, settings.muted);
        if (kept.kind === ScreenshotKeptKind.Saved) {
          pushNotification({
            appName: "Screenshot",
            summary: "Screenshot Saved",
            body: kept.path,
            actions: [{ key: `open:${kept.path}`, label: _("Open") }],
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
  }, [piloti.capture, systemServices, desktopCaptureName, pushNotification, settings.muted, settings.volume]);

  const startScreenRecording = React.useCallback(async () => {
    console.info("[Piloti] control-panel: screen recording");
    if (!systemServices) {
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
            const filename = desktopCaptureName(videoBaseName(Date.now() - id), "webm");
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
                const savedPath = `${WEB_VFS_HOME}/Desktop/${filename}`;
                writeVfsTextFile(savedPath, dataUrl, {
                  metadata: {
                    "standard::content-type": "video/webm",
                    ...(firstFrameThumb ? { "metadata::thumbnail": firstFrameThumb } : {}),
                  },
                });
                pushNotification({
                  appName: "Screen Recorder",
                  summary: "Screen Recording Saved",
                  body: `${WEB_VFS_HOME}/Desktop/${filename}`,
                  actions: [captureOpenAction(savedPath)],
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
    const res = await piloti.capture.screenRecord();
    res.match({
      Ok: (filePath) => {
        pushNotification({
          appName: "Screen Recorder",
          summary: "Screen Recording Saved",
          body: filePath,
          actions: [captureOpenAction(filePath)],
        });
      },
      Err: () => {},
    });
  }, [piloti.capture, systemServices, desktopCaptureName, pushNotification, settings.muted, settings.volume]);

  return React.useMemo<SystemBackendsContextValue>(
    () => ({
      gnomeCapabilities,
      availableGnomePanels,
      batteryInfo,
      audioSinks,
      liveWifiNetworks,
      bluetoothDevices,
      wifiPresent,
      bluetoothPresent,
      toggleBluetoothDevice,
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
      webPowerPhase,
      powerOnSimulatedMachine,
      pendingPowerAction,
      requestPowerAction,
      cancelPowerAction,
      confirmPowerAction,
      executePowerAction,
      capturingSessions,
      takeScreenshot,
      startScreenRecording,
      stopCapturing: (id) => {
        if (!systemServices) {
          const rec = browserRecordersRef.current.get(id);
          if (rec && rec.recorder.state !== "inactive") rec.recorder.stop();
          return;
        }
        piloti.portals.stopCapturing(id);
      },
      pauseRecording: (id) => {
        if (!systemServices) {
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
        piloti.portals.pauseRecording(id);
      },
      resumeRecording: (id) => {
        if (!systemServices) {
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
        piloti.portals.resumeRecording(id);
      },
      discardRecording: (id) => {
        if (!systemServices) {
          const rec = browserRecordersRef.current.get(id);
          if (rec) {
            rec.discarded = true;
            if (rec.recorder.state !== "inactive") rec.recorder.stop();
          }
          return;
        }
        piloti.portals.discardRecording(id);
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
      piloti.portals,
      executePowerAction,
      gnomeCapabilities,
      gnomeIconThemeOverride,
      idleWarningMs,
      invokeNotificationAction,
      liveWifiNetworks,
      bluetoothDevices,
      wifiPresent,
      bluetoothPresent,
      toggleBluetoothDevice,
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

