import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useCapturing } from "@domicile-desktop/react/portals";
import { useWatch } from "@domicile-desktop/react/use-watch";
import type { Capturing } from "@domicile-desktop/sdk/portal";
import { ScreenshotKeptKind, UnlockRefusal, type UnlockRefused } from "@domicile-desktop/sdk/system";
import { SAMPLE_WIFI_NETWORKS, type WifiNetwork } from "@/data/catalog";
import {
  type AudioSinkInfo,
  type BatteryInfo,
  type GnomeControlCenterPanelInfo,
  type GnomeSystemCapabilities,
  DEFAULT_GNOME_PANELS,
  connectSystemWifi,
  discoverGnomeControlCenterPanels,
  listSystemAudioSinks,
  monitorGnomeInterfaceSettings,
  probeGnomeCapabilities,
  readGnomeInterfaceSettings,
  readSystemAudio,
  readSystemBattery,
  readSystemPowerProfile,
  readSystemWifi,
  setDefaultAudioSink,
  syncGnomePanelOverrides,
} from "@/lib/gnome-bridge";
import { type DesktopSettings, useSettings } from "./SettingsContext";

export type PowerAction = "logout" | "restart" | "poweroff";

export interface ShellNotification {
  id: number;
  appName: string;
  summary: string;
  body: string;
  urgency: string;
  time: number;
  fromDomicile?: boolean;
  actions?: readonly { key: string; label: string }[];
}

interface SystemBackendsContextValue {
  gnomeCapabilities: GnomeSystemCapabilities;
  availableGnomePanels: GnomeControlCenterPanelInfo[];
  batteryInfo: BatteryInfo;
  audioSinks: AudioSinkInfo[];
  liveWifiNetworks: WifiNetwork[];
  refreshSystemBackends: () => Promise<void>;
  connectWifiNetwork: (ssid: string) => Promise<void>;
  selectAudioSink: (sinkName: string) => Promise<void>;
  gnomeIconThemeOverride: string | undefined;
  // Notifications
  notifications: ShellNotification[];
  pushNotification: (n: {
    appName: string;
    summary: string;
    body: string;
    urgency?: string;
  }) => void;
  dismissNotification: (id: number) => void;
  clearAllNotifications: () => void;
  // Compositor session lock & idle warnings
  locked: boolean;
  lockSession: () => void;
  unlockSession: (passphrase: string) => void;
  unlockError: string | null;
  unlockRefusal: UnlockRefused | null;
  idleWarningMs: number | undefined;
  // Session & power actions (Piloti menu)
  pendingPowerAction: PowerAction | null;
  requestPowerAction: (action: PowerAction) => void;
  cancelPowerAction: () => void;
  confirmPowerAction: () => Promise<void>;
  // Capture / Recording / Portal sessions
  capturingSessions: readonly Capturing[];
  takeScreenshot: () => Promise<void>;
  startScreenRecording: () => Promise<void>;
  stopCapturing: (id: number) => void;
  pauseRecording: (id: number) => void;
  resumeRecording: (id: number) => void;
  discardRecording: (id: number) => void;
}

const SystemBackendsContext = React.createContext<SystemBackendsContextValue | null>(
  null
);

let nextNotifCounter = 5000;

export function SystemBackendsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const domicile = useDomicile();
  const {
    isBrowserRuntime,
    settings,
    applySettingsState,
    updateSettings,
    applyingGnomeSyncRef,
  } = useSettings();

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
    present: true,
    percentage: 94,
    charging: true,
  });
  const [audioSinks, setAudioSinks] = React.useState<AudioSinkInfo[]>([]);
  const [availableGnomePanels, setAvailableGnomePanels] = React.useState<
    GnomeControlCenterPanelInfo[]
  >(() => [...DEFAULT_GNOME_PANELS]);
  const [liveWifiNetworks, setLiveWifiNetworks] = React.useState<WifiNetwork[]>(
    SAMPLE_WIFI_NETWORKS
  );
  const [gnomeIconThemeOverride, setGnomeIconThemeOverride] = React.useState<
    string | undefined
  >(undefined);

  // Notifications
  const domicileNotifs =
    useWatch(domicile.notifications, "change", () => domicile.notifications.list) ??
    [];
  const [localNotifs, setLocalNotifs] = React.useState<ShellNotification[]>([]);

  const notifications = React.useMemo<ShellNotification[]>(() => {
    const mappedDomicile: ShellNotification[] = domicileNotifs.map((n) => ({
      id: n.id,
      appName: n.appName || "System",
      summary: n.summary,
      body: n.body,
      urgency: n.urgency,
      time: n.time,
      fromDomicile: true,
      actions: n.actions,
    }));
    return [...localNotifs, ...mappedDomicile].sort((a, b) => b.time - a.time);
  }, [domicileNotifs, localNotifs]);

  const pushNotification = React.useCallback(
    (n: { appName: string; summary: string; body: string; urgency?: string }) => {
      const item: ShellNotification = {
        id: ++nextNotifCounter,
        appName: n.appName,
        summary: n.summary,
        body: n.body,
        urgency: n.urgency ?? "normal",
        time: Date.now(),
      };
      setLocalNotifs((prev) => [item, ...prev]);
    },
    []
  );

  const dismissNotification = React.useCallback(
    (id: number) => {
      setLocalNotifs((prev) => prev.filter((n) => n.id !== id));
      try {
        domicile.notifications.dismiss([id]);
      } catch {
        // ignore
      }
    },
    [domicile.notifications]
  );

  const clearAllNotifications = React.useCallback(() => {
    setLocalNotifs([]);
    const ids = domicileNotifs.map((n) => n.id);
    if (ids.length > 0) {
      try {
        domicile.notifications.dismiss(ids);
      } catch {
        // ignore
      }
    }
  }, [domicile.notifications, domicileNotifs]);

  // Real compositor session lock + idle warnings + unlock refusals
  const sessionLocked =
    useWatch(domicile.session, "lockchange", () => domicile.session.locked) ??
    false;
  const [browserLocked, setBrowserLocked] = React.useState(false);
  const locked = isBrowserRuntime ? browserLocked : sessionLocked;

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

  const requestPowerAction = React.useCallback((action: PowerAction) => {
    setPendingPowerAction(action);
  }, []);

  const cancelPowerAction = React.useCallback(() => {
    setPendingPowerAction(null);
  }, []);

  const confirmPowerAction = React.useCallback(async () => {
    const action = pendingPowerAction;
    setPendingPowerAction(null);
    if (!action) return;

    const labels: Record<PowerAction, string> = {
      logout: "Log Out",
      restart: "Restart",
      poweroff: "Turn Off",
    };

    if (isBrowserRuntime) {
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
      return;
    }

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
            pushNotification({
              appName: "Piloti Session",
              summary: `${labels[action]} Failed`,
              body: ran.stderr?.trim() || `Exited with status ${ran.code}`,
              urgency: "critical",
            });
          }
        },
        Err: (err) => {
          pushNotification({
            appName: "Piloti Session",
            summary: `${labels[action]} Failed`,
            body: String(err),
            urgency: "critical",
          });
        },
      });
    } catch (err) {
      pushNotification({
        appName: "Piloti Session",
        summary: `${labels[action]} Failed`,
        body: err instanceof Error ? err.message : String(err),
        urgency: "critical",
      });
    }
  }, [
    domicile.processes,
    isBrowserRuntime,
    lockSession,
    pendingPowerAction,
    pushNotification,
  ]);

  // Sync GNOME Control Center panel overrides whenever hiddenGnomePanels changes
  React.useEffect(() => {
    if (isBrowserRuntime) return;
    void syncGnomePanelOverrides(domicile, settings.hiddenGnomePanels);
  }, [domicile, isBrowserRuntime, settings.hiddenGnomePanels]);

  // Backends probing + GSettings monitor
  const refreshSystemBackends = React.useCallback(async () => {
    if (isBrowserRuntime) return;
    const [caps, panels, audio, sinks, wifi, battery, powerProfile] =
      await Promise.all([
        probeGnomeCapabilities(domicile),
        discoverGnomeControlCenterPanels(domicile),
        readSystemAudio(domicile),
        listSystemAudioSinks(domicile),
        readSystemWifi(domicile),
        readSystemBattery(domicile),
        readSystemPowerProfile(domicile),
      ]);

    setGnomeCapabilities(caps);
    setAvailableGnomePanels(panels);
    if (sinks.length > 0) setAudioSinks(sinks);
    setBatteryInfo(
      battery ?? { present: false, percentage: 100, charging: true }
    );

    if (wifi) {
      if (wifi.networks.length > 0) setLiveWifiNetworks(wifi.networks);
      applySettingsState({
        wifiEnabled: wifi.enabled,
        ...(wifi.connectedSsid ? { connectedWifi: wifi.connectedSsid } : {}),
      });
    }
    if (audio) {
      applySettingsState({ volume: audio.volume, muted: audio.muted });
    }
    if (powerProfile) {
      applySettingsState({ powerMode: powerProfile });
    }
  }, [applySettingsState, domicile, isBrowserRuntime]);

  React.useEffect(() => {
    if (isBrowserRuntime) return;
    let cancelled = false;

    void refreshSystemBackends();

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
      if (snap.iconTheme) {
        setGnomeIconThemeOverride(snap.iconTheme);
      }
      if (Object.keys(patch).length > 0) {
        applyingGnomeSyncRef.current = true;
        applySettingsState(patch);
        applyingGnomeSyncRef.current = false;
      }
    };

    void readGnomeInterfaceSettings(domicile).then(applyGnomeSnapshot);
    const stopMonitor = monitorGnomeInterfaceSettings(domicile, applyGnomeSnapshot);

    return () => {
      cancelled = true;
      stopMonitor();
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
  const capturingSessions = useCapturing() ?? [];

  const takeScreenshot = React.useCallback(async () => {
    if (isBrowserRuntime) {
      pushNotification({
        appName: "Screenshot",
        summary: "Screenshot Captured (Browser Preview)",
        body: "Under Domicile Linux, this opens the interactive FrozenDesk area & window picker.",
      });
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
  }, [domicile.capture, isBrowserRuntime, pushNotification]);

  const startScreenRecording = React.useCallback(async () => {
    if (isBrowserRuntime) {
      pushNotification({
        appName: "Screen Recorder",
        summary: "Screen Recorder Available on Domicile Linux",
        body: "Records monitors, windows, or regions to WebM under ~/Videos/Screen recordings.",
      });
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
  }, [domicile.capture, isBrowserRuntime, pushNotification]);

  const value = React.useMemo<SystemBackendsContextValue>(
    () => ({
      gnomeCapabilities,
      availableGnomePanels,
      batteryInfo,
      audioSinks,
      liveWifiNetworks,
      refreshSystemBackends,
      connectWifiNetwork,
      selectAudioSink,
      gnomeIconThemeOverride,
      notifications,
      pushNotification,
      dismissNotification,
      clearAllNotifications,
      locked,
      lockSession,
      unlockSession,
      unlockError,
      unlockRefusal,
      idleWarningMs,
      pendingPowerAction,
      requestPowerAction,
      cancelPowerAction,
      confirmPowerAction,
      capturingSessions,
      takeScreenshot,
      startScreenRecording,
      stopCapturing: (id) => domicile.portals.stopCapturing(id),
      pauseRecording: (id) => domicile.portals.pauseRecording(id),
      resumeRecording: (id) => domicile.portals.resumeRecording(id),
      discardRecording: (id) => domicile.portals.discardRecording(id),
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
      dismissNotification,
      domicile.portals,
      gnomeCapabilities,
      gnomeIconThemeOverride,
      idleWarningMs,
      liveWifiNetworks,
      lockSession,
      locked,
      notifications,
      pendingPowerAction,
      pushNotification,
      refreshSystemBackends,
      requestPowerAction,
      selectAudioSink,
      startScreenRecording,
      takeScreenshot,
      unlockError,
      unlockRefusal,
      unlockSession,
    ]
  );

  return (
    <SystemBackendsContext.Provider value={value}>
      {children}
    </SystemBackendsContext.Provider>
  );
}

export function useSystemBackends() {
  const ctx = React.useContext(SystemBackendsContext);
  if (!ctx) {
    throw new Error(
      "useSystemBackends must be used within SystemBackendsProvider"
    );
  }
  return ctx;
}

