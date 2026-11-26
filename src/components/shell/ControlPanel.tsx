import * as React from "react";
import { countRender } from "@/lib/core/render-stats";
import { usePortalRequests } from "@domicile-desktop/react/portals";
import { PortalKind, type PortalRequest } from "@domicile-desktop/sdk/portal";
import {
  AlertTriangleIcon,
  BellOffIcon,
  BluetoothIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  FlameIcon,
  GaugeIcon,
  LockIcon,
  MoonIcon,
  Music2Icon,
  PauseIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SpeakerIcon,
  SunIcon,
  VideoIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  XIcon,
} from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import { Slider } from "@/components/ui/slider";
import {
  useSystemBackends,
  useWindowActions,
  useDesktopSettings,
  useUpdateSettings,
  useSettingsSelector,
} from "@/context/DesktopStateContext";
import { _, getLocale } from "@/lib/core/i18n";
import { formatRelativeNotificationTime } from "@/lib/shell/notifications";
import { NotificationBodyText } from "@/components/shell/NicePathLabel";
import { captureLaunchOriginFromElement } from "@/lib/shell/launch-origin";
import { cn } from "@/lib/core/utils";
import {
  NotificationActionControls,
  NotificationAppIcon,
} from "./NotificationParts";

/** Stays mounted while closed (built once); `open` says when it is shown. */
export function ControlPanel({ open = true }: { open?: boolean }) {
  countRender("ControlPanel");
  const portalRequests = usePortalRequests() ?? [];
  const activeInhibitors = React.useMemo(
    () =>
      portalRequests.filter(
        (r): r is Extract<PortalRequest, { kind: PortalKind.Inhibit }> =>
          r.kind === PortalKind.Inhibit
      ),
    [portalRequests]
  );
  const isBrowserRuntime = useSettingsSelector((v) => v.isBrowserRuntime); // FIXME : Capabilities
  const settings = useDesktopSettings(["bluetoothEnabled", "brightness", "connectedWifi", "doNotDisturb", "dockAutoHide", "dockPosition", "dockSize", "muted", "nightLight", "notificationsEnabled", "powerMode", "themeMode", "volume", "wifiEnabled"]);
  const updateSettings = useUpdateSettings();
  const {
    gnomeCapabilities,
    liveWifiNetworks,
    wifiPresent,
    bluetoothPresent,
    connectWifiNetwork,
    bluetoothDevices,
    toggleBluetoothDevice,
    audioSinks,
    selectAudioSink,
    mprisMedia,
    controlMpris,
    refreshSystemBackends,
    unreadNotificationCount,
    markAllNotificationsRead,
    takeScreenshot,
    startScreenRecording,
  } = useSystemBackends();
  const { setControlPanelOpen, launchApp, openGnomeSettings } =
    useWindowActions();
  // Secured network waiting for its passphrase (no saved profile).
  const [wifiPrompt, setWifiPrompt] = React.useState<{
    ssid: string;
    passphrase: string;
    busy: boolean;
    failed: boolean;
  } | null>(null);
  const joinWifi = async (ssid: string, passphrase?: string) => {
    const result = await connectWifiNetwork(ssid, passphrase);
    if (result === "connected") setWifiPrompt(null);
    else if (result === "needs-passphrase") {
      setWifiPrompt({ ssid, passphrase: "", busy: false, failed: false });
    } else if (passphrase) {
      setWifiPrompt({ ssid, passphrase, busy: false, failed: true });
    } else setWifiPrompt(null);
  };
  const [expandedPicker, setExpandedPicker] = React.useState<
    "wifi" | "bluetooth" | "audio" | null
  >(null);

  // Opening the panel reads the notifications; pickers start folded.
  React.useEffect(() => {
    if (open && unreadNotificationCount > 0) {
      markAllNotificationsRead();
    }
  }, [open, markAllNotificationsRead, unreadNotificationCount]);
  React.useEffect(() => {
    if (!open) setExpandedPicker(null);
  }, [open]);

  const togglePicker = (picker: "wifi" | "bluetooth" | "audio") => {
    setExpandedPicker((prev) => {
      const next = prev === picker ? null : picker;
      if (next !== null) {
        void refreshSystemBackends({ scanWifi: next === "wifi" });
      }
      return next;
    });
  };

  const activeSink =
    audioSinks.find((s) => s.active) ?? audioSinks[0];

  const togglePowerSaver = () => {
    const nextMode =
      settings.powerMode === "power-saver" ? "balanced" : "power-saver";
    console.info("[Piloti] control-panel: power-mode", nextMode);
    updateSettings({
      powerMode: nextMode,
    });
  };

  const bottomDockClearance =
    settings.dockPosition === "bottom" && !settings.dockAutoHide
      ? settings.dockSize + 38
      : 16;

  return (
    <div
      aria-label="Notifications and Quick Settings"
      style={{
        maxHeight: `calc(100vh - ${44 + bottomDockClearance}px)`,
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") return;
        if (
          (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
          !(
            e.target instanceof HTMLElement &&
            (e.target.closest('[role="slider"]') ||
              e.target instanceof HTMLInputElement ||
              e.target instanceof HTMLTextAreaElement)
          )
        ) {
          return;
        }
        e.stopPropagation();
      }}
      className="flex w-full flex-col gap-3 overflow-hidden"
    >
      {/* Top Header: Settings Shortcut + Date & Quick Actions */}
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={
              isBrowserRuntime  // FIXME : Capabilities
                ? _("Desktop Settings")
                : _("Open System Settings (Shift+Click) or Desktop Settings")
            }
            onClick={(e) => {
              console.info(
                "[Piloti] control-panel: open settings",
                !isBrowserRuntime && e.shiftKey ? "gnome" : "desktop"  // FIXME : Capabilities
              );
              captureLaunchOriginFromElement(e.currentTarget);
              setControlPanelOpen(false);
              if (!isBrowserRuntime && e.shiftKey) {  // FIXME : Capabilities
                openGnomeSettings();
              } else {
                launchApp("settings");
              }
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-ui-label active:bg-black/16 dark:bg-white/10 dark:active:bg-white/22"
          >
            <SymbolicIcon name="emblem-system" fallback={SlidersHorizontalIcon} className="size-3.5" />
          </button>
          <span className="text-ui-body font-medium text-ui-label-secondary">
            {new Date().toLocaleDateString(
              getLocale() === "fr" ? "fr-FR" : "en-US",
              {
                weekday: "long",
                month: "long",
                day: "numeric",
              }
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title={_("Take Screenshot (Print)")}
            onClick={() => {
              setControlPanelOpen(false);
              void takeScreenshot();
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-ui-label active:bg-black/16 dark:bg-white/10 dark:active:bg-white/22"
          >
            <SymbolicIcon name="camera-photo" fallback={CameraIcon} className="size-3.5" />
          </button>
          <button
            type="button"
            title={_("Record Screen")}
            onClick={() => {
              setControlPanelOpen(false);
              void startScreenRecording();
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-ui-label active:bg-black/16 dark:bg-white/10 dark:active:bg-white/22"
          >
            <SymbolicIcon name="camera-video" fallback={VideoIcon} className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Sound Volume & Display Brightness Sliders */}
      <div data-slot="control-card" className="flex flex-col gap-2.5 rounded-[16px] bg-black/6 p-3 dark:bg-white/8">
        {/* Sound Volume + Audio Output Picker Toggle */}
        <div className="flex items-center gap-2 text-ui-label dark:text-white">
          <div className="relative flex flex-1 items-center">
            <Slider
              aria-label="Sound Output"
              variant="capsule"
              icon={
                settings.muted || settings.volume === 0 ? (
                  <SymbolicIcon name="audio-volume-muted" fallback={VolumeXIcon} className="size-3.5" />
                ) : (
                  <SymbolicIcon name="audio-volume-high" fallback={Volume2Icon} className="size-3.5" />
                )
              }
              className="flex-1"
              min={0}
              max={100}
              value={[settings.muted ? 0 : settings.volume]}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? val[0] : val;
                if (typeof next === "number") {
                  updateSettings({ volume: next, muted: next === 0 });
                }
              }}
            />
            <button
              type="button"
              aria-label="Toggle Mute"
              title="Toggle Mute"
              onClick={() => {
                const next = !settings.muted;
                console.info("[Piloti] control-panel: mute", next ? "on" : "off");
                updateSettings({ muted: next });
              }}
              className="absolute inset-y-0 left-0 z-20 w-6 rounded-l-full"
            />
          </div>
          <button
            type="button"
            title={
              activeSink
                ? `Output: ${activeSink.description || activeSink.name}`
                : "Choose audio output device"
            }
            aria-label="Choose audio output device"
            aria-expanded={expandedPicker === "audio"}
            onClick={() => togglePicker("audio")}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full",
              expandedPicker === "audio"
                ? "bg-ui-accent text-white active:bg-[color-mix(in_srgb,var(--ui-accent),white_20%)]"
                : "bg-black/8 text-ui-label-secondary active:bg-black/16 dark:bg-white/10 dark:active:bg-white/18"
            )}
          >
            <SymbolicIcon name="pan-end" fallback={ChevronRightIcon}
              className={cn(
                "size-3.5 transition-transform duration-150",
                expandedPicker === "audio" && "rotate-90"
              )}
            />
          </button>
        </div>

        {expandedPicker === "audio" && (
          <div className="flex flex-col gap-1 border-t border-ui-separator pt-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-ui-small font-medium text-ui-label-secondary">
                {_("Output Device")}
              </span>
              {!isBrowserRuntime && gnomeCapabilities.gnomeControlCenter && (  // FIXME : Capabilities
                <button
                  type="button"
                  onClick={() => {
                    setControlPanelOpen(false);
                    openGnomeSettings("sound");
                  }}
                  className="text-ui-caption font-medium text-ui-accent active:opacity-70"
                >
                  {_("Sound Settings…")}
                </button>
              )}
            </div>
            {audioSinks.length === 0 ? (
              <div className="px-1 py-1.5 text-ui-small text-ui-label-secondary">
                {_("Using default system output.")}
              </div>
            ) : (
              <div className="flex max-h-[132px] flex-col gap-0.5 overflow-y-auto">
                {audioSinks.map((sink) => (
                  <button
                    key={sink.id}
                    type="button"
                    onClick={() => void selectAudioSink(sink.name)}
                    data-slot="control-row" className={cn(
                      "flex items-center justify-between gap-2 rounded-ui-control px-2 py-1.5 text-left text-ui-small",
                      sink.active
                        ? "bg-ui-accent/18 font-medium text-ui-label"
                        : "active:bg-black/10 dark:active:bg-white/12"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SymbolicIcon name="audio-speakers" fallback={SpeakerIcon} className="size-3.5 shrink-0 opacity-80" />
                      <span className="truncate">
                        {sink.description || sink.name}
                      </span>
                    </span>
                    {sink.active && (
                      <SymbolicIcon name="object-select" fallback={CheckIcon} className="size-3.5 shrink-0 text-ui-accent" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Display Brightness */}
        <div className="flex items-center text-ui-label dark:text-white">
          <Slider
            aria-label="Display Brightness"
            variant="capsule"
            icon={<SymbolicIcon name="display-brightness" fallback={SunIcon} className="size-3.5" />}
            className="flex-1"
            min={25}
            max={100}
            value={[settings.brightness]}
            onValueChange={(val) => {
              const next = Array.isArray(val) ? val[0] : val;
              if (typeof next === "number") {
                updateSettings({ brightness: next });
              }
            }}
          />
        </div>
      </div>

      {/* Quick Settings Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Wi-Fi Split Pill (Toggle + Inline Network Picker) */}
        <div
          data-slot="control-pill" className={cn(
            "flex items-stretch overflow-hidden rounded-[12px]",
            !wifiPresent && "opacity-50",
            settings.wifiEnabled
              ? "bg-ui-accent text-white"
              : "bg-black/6 text-ui-label dark:bg-white/8"
          )}
        >
          <button
            type="button"
            disabled={!wifiPresent}
            title={wifiPresent ? undefined : _("No Wi-Fi adapter")}
            onClick={() => {
              const next = !settings.wifiEnabled;
              console.info("[Piloti] control-panel: wifi", next ? "on" : "off");
              updateSettings({ wifiEnabled: next });
            }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left",
              settings.wifiEnabled
                ? "active:bg-white/20"
                : "active:bg-black/14 dark:active:bg-white/18"
            )}
          >
            <SymbolicIcon name="network-wireless-signal-excellent" fallback={WifiIcon} className="size-[18px] shrink-0" />
            <span className="truncate text-ui-body font-medium">Wi-Fi</span>
          </button>
          <button
            type="button"
            disabled={!wifiPresent}
            title={wifiPresent ? undefined : _("No Wi-Fi adapter")}
            aria-label="Choose Wi-Fi network"
            aria-expanded={expandedPicker === "wifi"}
            onClick={() => togglePicker("wifi")}
            className={cn(
              "flex w-7 shrink-0 items-center justify-center border-l",
              settings.wifiEnabled
                ? "border-white/20 active:bg-white/20"
                : "border-black/10 active:bg-black/14 dark:border-white/10 dark:active:bg-white/18"
            )}
          >
            <SymbolicIcon name="pan-end" fallback={ChevronRightIcon}
              className={cn(
                "size-3.5 transition-transform duration-150",
                expandedPicker === "wifi" && "rotate-90"
              )}
            />
          </button>
        </div>

        {/* Bluetooth Split Pill (Toggle + Inline Device Picker) */}
        <div
          data-slot="control-pill" className={cn(
            "flex items-stretch overflow-hidden rounded-[12px]",
            !bluetoothPresent && "opacity-50",
            settings.bluetoothEnabled
              ? "bg-ui-accent text-white"
              : "bg-black/6 text-ui-label dark:bg-white/8"
          )}
        >
          <button
            type="button"
            disabled={!bluetoothPresent}
            title={bluetoothPresent ? undefined : _("No Bluetooth adapter")}
            onClick={() => {
              const next = !settings.bluetoothEnabled;
              console.info(
                "[Piloti] control-panel: bluetooth",
                next ? "on" : "off"
              );
              updateSettings({ bluetoothEnabled: next });
            }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left",
              settings.bluetoothEnabled
                ? "active:bg-white/20"
                : "active:bg-black/14 dark:active:bg-white/18"
            )}
          >
            <SymbolicIcon name="bluetooth-active" fallback={BluetoothIcon} className="size-[18px] shrink-0" />
            <span className="truncate text-ui-body font-medium">
              Bluetooth
            </span>
          </button>
          <button
            type="button"
            disabled={!bluetoothPresent}
            title={bluetoothPresent ? undefined : _("No Bluetooth adapter")}
            aria-label="Choose Bluetooth device"
            aria-expanded={expandedPicker === "bluetooth"}
            onClick={() => togglePicker("bluetooth")}
            className={cn(
              "flex w-7 shrink-0 items-center justify-center border-l",
              settings.bluetoothEnabled
                ? "border-white/20 active:bg-white/20"
                : "border-black/10 active:bg-black/14 dark:border-white/10 dark:active:bg-white/18"
            )}
          >
            <SymbolicIcon name="pan-end" fallback={ChevronRightIcon}
              className={cn(
                "size-3.5 transition-transform duration-150",
                expandedPicker === "bluetooth" && "rotate-90"
              )}
            />
          </button>
        </div>

        {/* Inline Wi-Fi Network Picker (expands directly under Wi-Fi / Bluetooth) */}
        {expandedPicker === "wifi" && (
          <div data-slot="control-card" className="col-span-2 flex flex-col gap-1 rounded-[14px] bg-black/6 p-2.5 dark:bg-white/8">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-ui-small font-medium text-ui-label-secondary">
                {_("Wi-Fi Networks")}
              </span>
              {!isBrowserRuntime && gnomeCapabilities.gnomeControlCenter && (  // FIXME : Capabilities
                <button
                  type="button"
                  onClick={() => {
                    setControlPanelOpen(false);
                    openGnomeSettings("wifi");
                  }}
                  className="text-ui-caption font-medium text-ui-accent active:opacity-70"
                >
                  {_("Network Settings…")}
                </button>
              )}
            </div>
            {!settings.wifiEnabled ? (
              <div className="px-2 py-2 text-ui-small text-ui-label-secondary">
                {_("Wi-Fi is turned off.")}
              </div>
            ) : liveWifiNetworks.length === 0 ? (
              <div className="px-2 py-2 text-ui-small text-ui-label-secondary">
                {_("No wireless networks discovered.")}
              </div>
            ) : (
              <div className="flex max-h-[148px] flex-col gap-0.5 overflow-y-auto">
                {liveWifiNetworks.map((net) => {
                  const connected = net.ssid === settings.connectedWifi;
                  return (
                    <React.Fragment key={net.ssid}>
                    <button
                      type="button"
                      onClick={() => void joinWifi(net.ssid)}
                      data-slot="control-row" className={cn(
                        "flex items-center justify-between gap-2 rounded-ui-control px-2.5 py-1.5 text-left text-ui-small",
                        connected
                          ? "bg-ui-accent/18 font-medium text-ui-label"
                          : "active:bg-black/10 dark:active:bg-white/12"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <SymbolicIcon name="network-wireless-signal-excellent" fallback={WifiIcon} className="size-3.5 shrink-0 opacity-80" />
                        <span className="truncate">{net.ssid}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-ui-caption text-ui-label-secondary tabular-nums">
                        {net.secured && <SymbolicIcon name="network-wireless-encrypted" fallback={LockIcon} className="size-3 opacity-75" />}
                        <span>{net.signal}%</span>
                        {connected && (
                          <SymbolicIcon name="object-select" fallback={CheckIcon} className="size-3.5 text-ui-accent" />
                        )}
                      </span>
                    </button>
                    {wifiPrompt?.ssid === net.ssid && (
                      <form
                        className="flex flex-col gap-1 px-2.5 pb-1.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!wifiPrompt.passphrase || wifiPrompt.busy) return;
                          setWifiPrompt({ ...wifiPrompt, busy: true, failed: false });
                          void joinWifi(net.ssid, wifiPrompt.passphrase);
                        }}
                      >
                        <input
                          type="password"
                          autoFocus
                          value={wifiPrompt.passphrase}
                          disabled={wifiPrompt.busy}
                          placeholder={_("Password")}
                          onChange={(e) =>
                            setWifiPrompt({ ...wifiPrompt, passphrase: e.target.value, failed: false })
                          }
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Escape") setWifiPrompt(null);
                          }}
                          className="h-ui-control-large rounded-ui-control bg-ui-window px-2 text-ui-small text-ui-label outline-none focus:ring-2 focus:ring-ui-accent"
                        />
                        {wifiPrompt.failed && (
                          <span className="text-ui-caption text-destructive">
                            {_("Could not connect. Check the password.")}
                          </span>
                        )}
                      </form>
                    )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Inline Bluetooth Device Picker (expands directly under Wi-Fi / Bluetooth) */}
        {expandedPicker === "bluetooth" && (
          <div data-slot="control-card" className="col-span-2 flex flex-col gap-1 rounded-[14px] bg-black/6 p-2.5 dark:bg-white/8">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-ui-small font-medium text-ui-label-secondary">
                {_("Bluetooth Devices")}
              </span>
              {!isBrowserRuntime && gnomeCapabilities.gnomeControlCenter && (  // FIXME : Capabilities
                <button
                  type="button"
                  onClick={() => {
                    setControlPanelOpen(false);
                    openGnomeSettings("bluetooth");
                  }}
                  className="text-ui-caption font-medium text-ui-accent active:opacity-70"
                >
                  {_("Bluetooth Settings…")}
                </button>
              )}
            </div>
            {!settings.bluetoothEnabled ? (
              <div className="px-2 py-2 text-ui-small text-ui-label-secondary">
                {_("Bluetooth is turned off.")}
              </div>
            ) : bluetoothDevices.length === 0 ? (
              <div className="px-2 py-2 text-ui-small text-ui-label-secondary">
                {_("No paired Bluetooth devices nearby.")}
              </div>
            ) : (
              <div className="flex max-h-[148px] flex-col gap-0.5 overflow-y-auto">
                {bluetoothDevices.map((device) => (
                  <button
                    key={device.path}
                    type="button"
                    onClick={() => void toggleBluetoothDevice(device.path)}
                    data-slot="control-row" className={cn(
                      "flex items-center justify-between gap-2 rounded-ui-control px-2.5 py-1.5 text-left text-ui-small",
                      device.connected
                        ? "bg-ui-accent/18 font-medium text-ui-label"
                        : "active:bg-black/10 dark:active:bg-white/12"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SymbolicIcon name="bluetooth-active" fallback={BluetoothIcon} className="size-3.5 shrink-0 opacity-80" />
                      <span className="truncate">{device.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-ui-caption text-ui-label-secondary tabular-nums">
                      {device.battery !== undefined && <span>{device.battery}%</span>}
                      {device.connected && <SymbolicIcon name="object-select" fallback={CheckIcon} className="size-3.5 text-ui-accent" />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dark Mode Pill */}
        <button
          type="button"
          aria-pressed={settings.themeMode === "dark"}
          onClick={() => {
            const next = settings.themeMode === "dark" ? "light" : "dark";
            console.info("[Piloti] control-panel: theme", next);
            updateSettings({
              themeMode: next,
            });
          }}
          data-slot="control-pill" className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.themeMode === "dark"
              ? "bg-ui-accent text-white active:bg-[color-mix(in_srgb,var(--ui-accent),white_20%)]"
              : "bg-black/6 text-ui-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <SymbolicIcon name="weather-clear-night" fallback={MoonIcon} className="size-[18px] shrink-0" />
          <span className="truncate text-ui-body font-medium">
            {_("Dark Mode")}
          </span>
        </button>

        {/* Do Not Disturb Pill */}
        <button
          type="button"
          aria-pressed={settings.doNotDisturb}
          onClick={() => {
            const next = !settings.doNotDisturb;
            console.info(
              "[Piloti] control-panel: do-not-disturb",
              next ? "on" : "off"
            );
            updateSettings({ doNotDisturb: next });
          }}
          data-slot="control-pill" className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.doNotDisturb
              ? "bg-ui-accent text-white active:bg-[color-mix(in_srgb,var(--ui-accent),white_20%)]"
              : "bg-black/6 text-ui-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <SymbolicIcon name="notifications-disabled" fallback={BellOffIcon} className="size-[18px] shrink-0" />
          <span className="truncate text-ui-body font-medium">
            {_("Silent")}
          </span>
        </button>

        {/* Night Light Pill */}
        <button
          type="button"
          aria-pressed={settings.nightLight}
          onClick={() => {
            const next = !settings.nightLight;
            console.info(
              "[Piloti] control-panel: night-light",
              next ? "on" : "off"
            );
            updateSettings({ nightLight: next });
          }}
          data-slot="control-pill" className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.nightLight
              ? "bg-ui-accent text-white active:bg-[color-mix(in_srgb,var(--ui-accent),white_20%)]"
              : "bg-black/6 text-ui-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <SymbolicIcon name="night-light" fallback={FlameIcon} className="size-[18px] shrink-0" />
          <span className="truncate text-ui-body font-medium">
            {_("Night Light")}
          </span>
        </button>

        {/* Power Saver Pill */}
        <button
          type="button"
          aria-pressed={settings.powerMode === "power-saver"}
          onClick={togglePowerSaver}
          data-slot="control-pill" className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.powerMode === "power-saver"
              ? "bg-ui-accent text-white active:bg-[color-mix(in_srgb,var(--ui-accent),white_20%)]"
              : "bg-black/6 text-ui-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <SymbolicIcon name="power-profile-power-saver" fallback={GaugeIcon} className="size-[18px] shrink-0" />
          <span className="truncate text-ui-body font-medium">
            {_("Power Saver")}
          </span>
        </button>
      </div>

      {/* MPRIS Media Player Card */}
      {mprisMedia && (
        <div data-slot="control-card" className="flex items-center justify-between gap-2.5 rounded-ui-card bg-black/6 px-3 py-2.5 dark:bg-white/8">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-ui-control bg-ui-accent/20 text-ui-accent">
              <SymbolicIcon name="audio-x-generic" fallback={Music2Icon} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-ui-body font-medium text-ui-label">
                {mprisMedia.title}
              </div>
              <div className="truncate text-ui-caption text-ui-label-secondary">
                {mprisMedia.artist}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Previous track"
              onClick={() => void controlMpris("previous")}
              className="flex size-7 items-center justify-center rounded-full text-ui-label active:bg-black/14 dark:active:bg-white/18"
            >
              <SymbolicIcon name="media-skip-backward" fallback={SkipBackIcon} className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={mprisMedia.status === "Playing" ? "Pause" : "Play"}
              onClick={() => void controlMpris("play-pause")}
              className="flex size-7 items-center justify-center rounded-full bg-ui-accent text-white active:bg-ui-accent/80"
            >
              {mprisMedia.status === "Playing" ? (
                <SymbolicIcon name="media-playback-pause" fallback={PauseIcon} className="size-3.5" />
              ) : (
                <SymbolicIcon name="media-playback-start" fallback={PlayIcon} className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Next track"
              onClick={() => void controlMpris("next")}
              className="flex size-7 items-center justify-center rounded-full text-ui-label active:bg-black/14 dark:active:bg-white/18"
            >
              <SymbolicIcon name="media-skip-forward" fallback={SkipForwardIcon} className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {activeInhibitors.length > 0 && (
        <div className="flex items-start gap-2 rounded-[10px] border border-amber-500/30 bg-amber-500/12 px-2.5 py-1.5 text-ui-small text-amber-900 dark:text-amber-200">
          <SymbolicIcon name="dialog-warning" fallback={AlertTriangleIcon} className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {_("Sleep or logout inhibited")}
            </div>
            <div className="truncate text-ui-caption opacity-85">
              {activeInhibitors
                .map((i) =>
                  i.body.reason
                    ? `${i.appId || _("Application")}: ${i.body.reason}`
                    : i.appId || _("Application")
                )
                .join(" · ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MAX_COLLAPSED_NOTIFICATIONS = 3;

export function FloatingNotifications({ open = true }: { open?: boolean }) {
  const settings = useDesktopSettings(["bluetoothEnabled", "brightness", "connectedWifi", "doNotDisturb", "dockAutoHide", "dockPosition", "dockSize", "muted", "nightLight", "notificationsEnabled", "powerMode", "themeMode", "volume", "wifiEnabled"]);
  const updateSettings = useUpdateSettings();
  const {
    notifications,
    dismissNotification,
    clearAllNotifications,
    invokeNotificationAction,
  } = useSystemBackends();
  const { setControlPanelOpen } = useWindowActions();
  const [expanded, setExpanded] = React.useState(false);

  // Notifications unread when the panel opens are marked new for this opening.
  const [unreadSnapshot, setUnreadSnapshot] = React.useState<Set<number>>(
    () => new Set(notifications.filter((n) => !n.read).map((n) => n.id))
  );
  const notificationsRef = React.useRef(notifications);
  notificationsRef.current = notifications;
  React.useLayoutEffect(() => {
    if (open) {
      setUnreadSnapshot(
        new Set(notificationsRef.current.filter((n) => !n.read).map((n) => n.id))
      );
    } else {
      setExpanded(false);
    }
  }, [open]);

  if (notifications.length === 0) {
    return null;
  }

  const visibleNotifications = expanded
    ? notifications
    : notifications.slice(0, MAX_COLLAPSED_NOTIFICATIONS);
  const hiddenCount = Math.max(
    0,
    notifications.length - MAX_COLLAPSED_NOTIFICATIONS
  );

  return (
    <div
      aria-label={_("Notifications")}
      className="mt-2.5 flex w-full flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        {hiddenCount > 0 || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-full border border-black/8 px-3.5 py-1 text-ui-small font-medium text-ui-label shadow-ui-popover backdrop-blur-xl transition-colors ui-material-popover hover-fill:bg-black/6 dark:border-white/10 dark:hover-fill:bg-white/10"
          >
            {expanded
              ? _("Show less")
              : hiddenCount === 1
                ? _("1 more notification")
                : _("%d more notifications", hiddenCount)}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-label={_("Clear All")}
          title={_("Clear All")}
          onClick={clearAllNotifications}
          className="flex size-ui-control-medium shrink-0 items-center justify-center rounded-full border border-black/8 text-ui-label shadow-ui-popover backdrop-blur-xl transition-colors ui-material-popover hover-fill:bg-black/6 dark:border-white/10 dark:hover-fill:bg-white/10"
        >
          <SymbolicIcon name="window-close" fallback={XIcon} className="size-3.5" />
        </button>
      </div>

      {(settings.doNotDisturb || !settings.notificationsEnabled) && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-black/8 px-3 py-2 text-ui-small text-ui-label-secondary shadow-ui-popover backdrop-blur-xl ui-material-popover dark:border-white/10">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <SymbolicIcon name="notifications-disabled" fallback={BellOffIcon} className="size-3 shrink-0 text-ui-accent" />
            <span className="truncate">
              {!settings.notificationsEnabled
                ? _("Notifications paused in Settings")
                : _("Silent · Banners silenced")}
            </span>
          </span>
          <button
            type="button"
            onClick={() =>
              updateSettings(
                !settings.notificationsEnabled
                  ? { notificationsEnabled: true }
                  : { doNotDisturb: false }
              )
            }
            className="shrink-0 font-medium text-ui-accent active:opacity-70"
          >
            {_("Resume")}
          </button>
        </div>
      )}

      {visibleNotifications.map((n) => {
        const isNew = unreadSnapshot.has(n.id);
        const isCritical = n.urgency === "critical";
        return (
          <div
            key={n.id}
            onClick={() => {
              if (n.fromDomicile && n.clickable) {
                invokeNotificationAction(n.id, "default");
              }
            }}
            className={cn(
              "group/card relative flex items-start gap-2.5 rounded-2xl border border-black/8 p-3 shadow-ui-popover backdrop-blur-xl ui-material-popover dark:border-white/10",
              isCritical && "ring-1 ring-ui-accent/45",
              n.fromDomicile && n.clickable && "cursor-default"
            )}
          >
            <NotificationAppIcon
              appName={n.appName}
              icon={n.icon}
              urgency={n.urgency}
              className="mt-0.5 size-9 rounded-ui-control"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  {isNew && (
                    <span
                      title="New"
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        isCritical ? "bg-ui-accent" : "bg-ui-label-secondary"
                      )}
                    />
                  )}
                  <span className="truncate text-ui-body font-semibold leading-snug text-ui-label">
                    {n.summary}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-ui-small text-ui-label-tertiary tabular-nums">
                    {formatRelativeNotificationTime(n.time)}
                  </span>
                  <button
                    type="button"
                    aria-label={_("Dismiss notification")}
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotification(n.id);
                    }}
                    className="flex size-4 items-center justify-center rounded-full bg-black/10 text-ui-label-secondary opacity-0 transition-opacity group-hover/card:opacity-80 hover:opacity-100 focus-visible:opacity-100 active:bg-black/20 dark:bg-white/15 dark:active:bg-white/25"
                  >
                    <SymbolicIcon name="window-close" fallback={XIcon} className="size-2.5" />
                  </button>
                </div>
              </div>

              {n.body && (
                <div className="mt-0.5 line-clamp-3 text-ui-body leading-snug text-ui-label-secondary">
                  <NotificationBodyText body={n.body} />
                </div>
              )}

              <NotificationActionControls
                notificationId={n.id}
                actions={n.actions}
                fromDomicile={n.fromDomicile}
                onAfterAction={() => setControlPanelOpen(false)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

