import { getEngine } from "@/lib/engine/engine";
import { settingsBackend } from "@/lib/engine/settings";
import * as React from "react";
import { usePiloti } from "@/lib/engine/piloti";
import { type UnlockRefused } from "@domicile-desktop/sdk/system";
import { SAMPLE_WIFI_NETWORKS, type WifiNetwork } from "@/data/catalog";
import { hardware } from "@/lib/engine/hardware";
import type {
  AudioSinkInfo,
  BatteryInfo,
  BluetoothDeviceInfo,
  MprisMediaInfo,
} from "@/lib/ports/hardware";
import { startBootPhase } from "@/lib/core/perf-log";
import { _ } from "@/lib/core/i18n";
import {
  type GnomeControlCenterPanelInfo,
  type GnomeSystemCapabilities,
  DEFAULT_GNOME_PANELS,
  discoverGnomeControlCenterPanels,
  probeGnomeCapabilities,
  syncGnomePanelOverrides,
  runXdgAutostartOnce,
  ensurePolkitAgent,
} from "@/lib/engine-native";
import {
  type NotificationActionItem,
  type ShellNotification,
} from "@/lib/core/notifications";
import {
  type SettingsContextValue,
} from "./SettingsContext";

import { type PowerAction, usePower } from "./backends/use-power";
import { useCapture } from "./backends/use-capture";
import { useNotifications } from "./backends/use-notifications";
import { useSessionLock } from "./backends/use-session-lock";
import type { CaptureBackend } from "@/lib/ports/capture";

export type { PowerAction };

export type { ShellNotification };

export interface SystemBackendsContextValue extends CaptureBackend {
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
}

export const SystemBackendsContext = React.createContext<SystemBackendsContextValue | null>(
  null
);

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

  const session = useSessionLock(piloti);
  const { locked, lockSession, setBrowserLocked } = session;
  const notificationsBackend = useNotifications(piloti, settings, locked);
  const { pushNotification } = notificationsBackend;
  const power = usePower({
    piloti,
    settings,
    updateSettings,
    lockSession,
    setBrowserLocked,
    pushNotification,
  });
  const capture = useCapture({
    piloti,
    pushNotification,
    volume: settings.volume,
    muted: settings.muted,
  });

  // UPower on Linux, the browser's own in the demo.
  React.useEffect(() => hardware().battery.watch(piloti, setBatteryInfo), [piloti]);

  // Sync GNOME Control Center panel overrides whenever hiddenGnomePanels changes
  React.useEffect(() => {
    if (!systemServices || greeterMode) return;
    const timer = window.setTimeout(() => {
      void syncGnomePanelOverrides(piloti, settings.hiddenGnomePanels);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [piloti, greeterMode, systemServices, settings.hiddenGnomePanels]);

  // Settings follow the hardware, whoever changes it.
  React.useEffect(() => {
    if (!systemServices) return;
    const { audio, bluetooth, wifi, brightness, powerProfile, media } = hardware();
    const stopAudio = audio.watch(piloti, (state) => {
      applySettingsState({ volume: state.volume, muted: state.muted });
      if (state.sinks.length > 0) setAudioSinks(state.sinks);
    });
    const stopBluetooth = bluetooth.watch(piloti, (bt) => {
      setBluetoothPresent(Boolean(bt));
      if (!bt) {
        setBluetoothDevices([]);
        applySettingsState({ bluetoothEnabled: false });
        return;
      }
      applySettingsState({ bluetoothEnabled: bt.powered });
      setBluetoothDevices(bt.devices);
    });
    const stopWifi = wifi.watch(piloti, (state) => {
      setWifiPresent(Boolean(state));
      if (!state) {
        // No Wi-Fi hardware: show it off and empty.
        setLiveWifiNetworks([]);
        applySettingsState({ wifiEnabled: false, connectedWifi: "" });
        return;
      }
      setLiveWifiNetworks(state.networks);
      applySettingsState({
        wifiEnabled: state.enabled,
        connectedWifi: state.connectedSsid ?? "",
      });
    });
    const stopBrightness = greeterMode
      ? () => undefined
      : brightness.watch(piloti, (level) => applySettingsState({ brightness: level }));
    // Power profile and media players arrive as D-Bus signals.
    const stopPowerProfile = greeterMode
      ? () => undefined
      : powerProfile.watch(piloti, (powerMode) => applySettingsState({ powerMode }));
    const stopMpris = greeterMode ? () => undefined : media.watch(piloti, setMprisMedia);
    return () => {
      stopPowerProfile();
      stopMpris();
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
      const battery = await hardware().battery.read(piloti);
      setBatteryInfo(
        battery ?? { present: false, percentage: 100, charging: true }
      );

      if (options?.scanWifi) void hardware().wifi.scan(piloti);

      if (greeterMode) {
        finishBackends();
        return;
      }

      void ensurePolkitAgent(piloti);

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
      await hardware().media.control(piloti, action); // the watcher reports the new state
    },
    [piloti, systemServices]
  );

  React.useEffect(() => {
    if (!systemServices) return;
    const deferTimer = window.setTimeout(() => void refreshSystemBackends(), 250);
    return () => window.clearTimeout(deferTimer);
  }, [systemServices, refreshSystemBackends]);

  // GNOME's icon theme stands in when Piloti's is the default one.
  React.useEffect(() => {
    if (!systemServices || greeterMode) return;
    const backend = settingsBackend();
    const read = () =>
      setGnomeIconThemeOverride(backend.linkedValue?.("org.piloti.desktop.interface", "icon-theme"));
    read();
    return backend.subscribeAll(read);
  }, [systemServices, greeterMode]);

  const connectWifiNetwork = React.useCallback(
    async (ssid: string, passphrase?: string) => {
      console.info("[Piloti] control-panel: wifi connect", ssid);
      if (!systemServices) {
        updateSettings({ connectedWifi: ssid, wifiEnabled: true });
        return "connected" as const;
      }
      const result = await hardware().wifi.connect(piloti, ssid, passphrase);
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
      if (device) await hardware().bluetooth.setConnected(piloti, path, !device.connected);
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
        await hardware().audio.setDefaultSink(piloti, sinkName);
        void refreshSystemBackends();
      }
    },
    [piloti, systemServices, refreshSystemBackends]
  );

  return React.useMemo<SystemBackendsContextValue>(
    () => ({
      ...notificationsBackend,
      locked: session.locked,
      lockSession: session.lockSession,
      unlockSession: session.unlockSession,
      unlockError: session.unlockError,
      unlockRefusal: session.unlockRefusal,
      idleWarningMs: session.idleWarningMs,
      ...power,
      ...capture,
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
    }),
    [
      notificationsBackend,
      session,
      power,
      capture,
      audioSinks,
      availableGnomePanels,
      batteryInfo,
      connectWifiNetwork,
      controlMpris,
      gnomeCapabilities,
      gnomeIconThemeOverride,
      liveWifiNetworks,
      bluetoothDevices,
      wifiPresent,
      bluetoothPresent,
      toggleBluetoothDevice,
      mprisMedia,
      refreshSystemBackends,
      selectAudioSink,
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

