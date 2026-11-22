import * as React from "react";
import {
  BellIcon,
  BellOffIcon,
  BluetoothIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  FlameIcon,
  GaugeIcon,
  LockIcon,
  MicIcon,
  MoonIcon,
  Music2Icon,
  PauseIcon,
  PlayIcon,
  SlidersVerticalIcon,
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
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { _, getLocale } from "@/lib/i18n";
import { formatRelativeNotificationTime } from "@/lib/notifications";
import { captureLaunchOriginFromElement } from "@/lib/launch-origin";
import { cn } from "@/lib/utils";
import {
  NotificationActionControls,
  NotificationAppIcon,
} from "./NotificationParts";

export function ControlPanel() {
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const {
    gnomeCapabilities,
    liveWifiNetworks,
    connectWifiNetwork,
    audioSinks,
    selectAudioSink,
    mprisMedia,
    controlMpris,
    refreshSystemBackends,
    notifications,
    unreadNotificationCount,
    dismissNotification,
    clearAllNotifications,
    markAllNotificationsRead,
    invokeNotificationAction,
    takeScreenshot,
    startScreenRecording,
    startAudioRecording,
  } = useSystemBackends();
  const { setControlPanelOpen, launchApp, openGnomeSettings } =
    useWindowManager();
  const [expandedPicker, setExpandedPicker] = React.useState<
    "wifi" | "bluetooth" | "audio" | null
  >(null);

  const [unreadSnapshot] = React.useState<Set<number>>(
    () => new Set(notifications.filter((n) => !n.read).map((n) => n.id))
  );

  React.useEffect(() => {
    if (unreadNotificationCount > 0) {
      markAllNotificationsRead();
    }
  }, [markAllNotificationsRead, unreadNotificationCount]);

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

  return (
    <div
      aria-label="Notifications and Quick Settings"
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
      className="flex max-h-[calc(100vh-52px)] w-full flex-col gap-3 overflow-hidden"
    >
      {/* Top Header: Settings Shortcut + Date & Quick Actions */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={_("Open System Settings (Shift+Click) or Desktop Settings")}
            onClick={(e) => {
              console.info(
                "[Piloti] control-panel: open settings",
                e.shiftKey ? "gnome" : "desktop"
              );
              captureLaunchOriginFromElement(e.currentTarget);
              setControlPanelOpen(false);
              if (e.shiftKey) {
                openGnomeSettings();
              } else {
                launchApp("settings");
              }
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-adw-label active:bg-black/16 dark:bg-white/10 dark:active:bg-white/22"
          >
            <SlidersVerticalIcon className="size-3.5" />
          </button>
          <span className="text-[12px] font-medium text-adw-label-secondary">
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
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-adw-label active:bg-black/16 dark:bg-white/10 dark:active:bg-white/22"
          >
            <CameraIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title={_("Record Screen")}
            onClick={() => {
              setControlPanelOpen(false);
              void startScreenRecording();
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-adw-label active:bg-black/16 dark:bg-white/10 dark:active:bg-white/22"
          >
            <VideoIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title={_("Record Audio")}
            onClick={() => {
              setControlPanelOpen(false);
              void startAudioRecording();
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-adw-label active:bg-black/16 dark:bg-white/10 dark:active:bg-white/22"
          >
            <MicIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Sound Volume & Display Brightness Sliders */}
      <div className="flex flex-col gap-2.5 rounded-[16px] bg-black/6 p-3 dark:bg-white/8">
        {/* Sound Volume + Audio Output Picker Toggle */}
        <div className="flex items-center gap-2 text-adw-label dark:text-white">
          <div className="relative flex flex-1 items-center">
            <Slider
              aria-label="Sound Output"
              variant="capsule"
              icon={
                settings.muted || settings.volume === 0 ? (
                  <VolumeXIcon className="size-3.5" />
                ) : (
                  <Volume2Icon className="size-3.5" />
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
                ? "bg-adw-accent text-white active:bg-[color-mix(in_srgb,var(--adw-accent),white_20%)]"
                : "bg-black/8 text-adw-label-secondary active:bg-black/16 dark:bg-white/10 dark:active:bg-white/18"
            )}
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 transition-transform duration-150",
                expandedPicker === "audio" && "rotate-90"
              )}
            />
          </button>
        </div>

        {expandedPicker === "audio" && (
          <div className="flex flex-col gap-1 border-t border-adw-separator pt-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-medium text-adw-label-secondary">
                {_("Output Device")}
              </span>
              {!isBrowserRuntime && gnomeCapabilities.gnomeControlCenter && (
                <button
                  type="button"
                  onClick={() => {
                    setControlPanelOpen(false);
                    openGnomeSettings("sound");
                  }}
                  className="text-[10.5px] font-medium text-adw-accent active:opacity-70"
                >
                  {_("Sound Settings…")}
                </button>
              )}
            </div>
            {audioSinks.length === 0 ? (
              <div className="px-1 py-1.5 text-[11px] text-adw-label-secondary">
                {_("Using default system output.")}
              </div>
            ) : (
              <div className="flex max-h-[132px] flex-col gap-0.5 overflow-y-auto">
                {audioSinks.map((sink) => (
                  <button
                    key={sink.id}
                    type="button"
                    onClick={() => void selectAudioSink(sink.name)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-[9px] px-2 py-1.5 text-left text-[11.5px]",
                      sink.active
                        ? "bg-adw-accent/18 font-medium text-adw-label"
                        : "active:bg-black/10 dark:active:bg-white/12"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SpeakerIcon className="size-3.5 shrink-0 opacity-80" />
                      <span className="truncate">
                        {sink.description || sink.name}
                      </span>
                    </span>
                    {sink.active && (
                      <CheckIcon className="size-3.5 shrink-0 text-adw-accent" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Display Brightness */}
        <div className="flex items-center text-adw-label dark:text-white">
          <Slider
            aria-label="Display Brightness"
            variant="capsule"
            icon={<SunIcon className="size-3.5" />}
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
          className={cn(
            "flex items-stretch overflow-hidden rounded-[12px]",
            settings.wifiEnabled
              ? "bg-adw-accent text-white"
              : "bg-black/6 text-adw-label dark:bg-white/8"
          )}
        >
          <button
            type="button"
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
            <WifiIcon className="size-[18px] shrink-0" />
            <span className="truncate text-[12.5px] font-medium">Wi-Fi</span>
          </button>
          <button
            type="button"
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
            <ChevronRightIcon
              className={cn(
                "size-3.5 transition-transform duration-150",
                expandedPicker === "wifi" && "rotate-90"
              )}
            />
          </button>
        </div>

        {/* Bluetooth Split Pill (Toggle + Inline Device Picker) */}
        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-[12px]",
            settings.bluetoothEnabled
              ? "bg-adw-accent text-white"
              : "bg-black/6 text-adw-label dark:bg-white/8"
          )}
        >
          <button
            type="button"
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
            <BluetoothIcon className="size-[18px] shrink-0" />
            <span className="truncate text-[12.5px] font-medium">
              Bluetooth
            </span>
          </button>
          <button
            type="button"
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
            <ChevronRightIcon
              className={cn(
                "size-3.5 transition-transform duration-150",
                expandedPicker === "bluetooth" && "rotate-90"
              )}
            />
          </button>
        </div>

        {/* Inline Wi-Fi Network Picker (expands directly under Wi-Fi / Bluetooth) */}
        {expandedPicker === "wifi" && (
          <div className="col-span-2 flex flex-col gap-1 rounded-[14px] bg-black/6 p-2.5 dark:bg-white/8">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-adw-label-secondary">
                {_("Wi-Fi Networks")}
              </span>
              {!isBrowserRuntime && gnomeCapabilities.gnomeControlCenter && (
                <button
                  type="button"
                  onClick={() => {
                    setControlPanelOpen(false);
                    openGnomeSettings("wifi");
                  }}
                  className="text-[10.5px] font-medium text-adw-accent active:opacity-70"
                >
                  {_("Network Settings…")}
                </button>
              )}
            </div>
            {!settings.wifiEnabled ? (
              <div className="px-2 py-2 text-[11px] text-adw-label-secondary">
                {_("Wi-Fi is turned off.")}
              </div>
            ) : liveWifiNetworks.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-adw-label-secondary">
                {_("No wireless networks discovered.")}
              </div>
            ) : (
              <div className="flex max-h-[148px] flex-col gap-0.5 overflow-y-auto">
                {liveWifiNetworks.map((net) => {
                  const connected = net.ssid === settings.connectedWifi;
                  return (
                    <button
                      key={net.ssid}
                      type="button"
                      onClick={() => void connectWifiNetwork(net.ssid)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[11.5px]",
                        connected
                          ? "bg-adw-accent/18 font-medium text-adw-label"
                          : "active:bg-black/10 dark:active:bg-white/12"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <WifiIcon className="size-3.5 shrink-0 opacity-80" />
                        <span className="truncate">{net.ssid}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-adw-label-secondary tabular-nums">
                        {net.secured && <LockIcon className="size-3 opacity-75" />}
                        <span>{net.signal}%</span>
                        {connected && (
                          <CheckIcon className="size-3.5 text-adw-accent" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Inline Bluetooth Device Picker (expands directly under Wi-Fi / Bluetooth) */}
        {expandedPicker === "bluetooth" && (
          <div className="col-span-2 flex flex-col gap-1 rounded-[14px] bg-black/6 p-2.5 dark:bg-white/8">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-adw-label-secondary">
                {_("Bluetooth Devices")}
              </span>
              {!isBrowserRuntime && gnomeCapabilities.gnomeControlCenter && (
                <button
                  type="button"
                  onClick={() => {
                    setControlPanelOpen(false);
                    openGnomeSettings("bluetooth");
                  }}
                  className="text-[10.5px] font-medium text-adw-accent active:opacity-70"
                >
                  {_("Bluetooth Settings…")}
                </button>
              )}
            </div>
            {!settings.bluetoothEnabled ? (
              <div className="px-2 py-2 text-[11px] text-adw-label-secondary">
                {_("Bluetooth is turned off.")}
              </div>
            ) : (
              <div className="px-2 py-2 text-[11px] text-adw-label-secondary">
                {_("No paired Bluetooth devices nearby.")}
              </div>
            )}
          </div>
        )}

        {/* Dark Mode Pill */}
        <button
          type="button"
          onClick={() => {
            const next = settings.themeMode === "dark" ? "light" : "dark";
            console.info("[Piloti] control-panel: theme", next);
            updateSettings({
              themeMode: next,
            });
          }}
          className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.themeMode === "dark"
              ? "bg-adw-accent text-white active:bg-[color-mix(in_srgb,var(--adw-accent),white_20%)]"
              : "bg-black/6 text-adw-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <MoonIcon className="size-[18px] shrink-0" />
          <span className="truncate text-[12.5px] font-medium">
            {_("Dark Mode")}
          </span>
        </button>

        {/* Do Not Disturb Pill */}
        <button
          type="button"
          onClick={() => {
            const next = !settings.doNotDisturb;
            console.info(
              "[Piloti] control-panel: do-not-disturb",
              next ? "on" : "off"
            );
            updateSettings({ doNotDisturb: next });
          }}
          className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.doNotDisturb
              ? "bg-adw-accent text-white active:bg-[color-mix(in_srgb,var(--adw-accent),white_20%)]"
              : "bg-black/6 text-adw-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <BellOffIcon className="size-[18px] shrink-0" />
          <span className="truncate text-[12.5px] font-medium">
            {_("Silent")}
          </span>
        </button>

        {/* Night Light Pill */}
        <button
          type="button"
          onClick={() => {
            const next = !settings.nightLight;
            console.info(
              "[Piloti] control-panel: night-light",
              next ? "on" : "off"
            );
            updateSettings({ nightLight: next });
          }}
          className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.nightLight
              ? "bg-adw-accent text-white active:bg-[color-mix(in_srgb,var(--adw-accent),white_20%)]"
              : "bg-black/6 text-adw-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <FlameIcon className="size-[18px] shrink-0" />
          <span className="truncate text-[12.5px] font-medium">
            {_("Night Light")}
          </span>
        </button>

        {/* Power Saver Pill */}
        <button
          type="button"
          onClick={togglePowerSaver}
          className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left",
            settings.powerMode === "power-saver"
              ? "bg-adw-accent text-white active:bg-[color-mix(in_srgb,var(--adw-accent),white_20%)]"
              : "bg-black/6 text-adw-label active:bg-black/14 dark:bg-white/8 dark:active:bg-white/18"
          )}
        >
          <GaugeIcon className="size-[18px] shrink-0" />
          <span className="truncate text-[12.5px] font-medium">
            {_("Power Saver")}
          </span>
        </button>
      </div>

      {/* MPRIS Media Player Card */}
      {mprisMedia && (
        <div className="flex items-center justify-between gap-2.5 rounded-adw-card bg-black/6 px-3 py-2.5 dark:bg-white/8">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-adw-accent/20 text-adw-accent">
              <Music2Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-adw-label">
                {mprisMedia.title}
              </div>
              <div className="truncate text-[10.5px] text-adw-label-secondary">
                {mprisMedia.artist}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Previous track"
              onClick={() => void controlMpris("previous")}
              className="flex size-7 items-center justify-center rounded-full text-adw-label active:bg-black/14 dark:active:bg-white/18"
            >
              <SkipBackIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={mprisMedia.status === "Playing" ? "Pause" : "Play"}
              onClick={() => void controlMpris("play-pause")}
              className="flex size-7 items-center justify-center rounded-full bg-adw-accent text-white active:bg-adw-accent/80"
            >
              {mprisMedia.status === "Playing" ? (
                <PauseIcon className="size-3.5" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Next track"
              onClick={() => void controlMpris("next")}
              className="flex size-7 items-center justify-center rounded-full text-adw-label active:bg-black/14 dark:active:bg-white/18"
            >
              <SkipForwardIcon className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Notifications History Section */}
      {notifications.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-adw-label-secondary">
              {_("Notifications")}
            </span>
            {notifications.length > 0 && (
              <span className="rounded-full bg-adw-accent/20 px-1.5 py-0.2 text-[10px] font-medium text-adw-accent tabular-nums">
                {notifications.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                size="icon"
                variant="secondary"
                aria-label={_("Clear")}
                title={_("Clear")}
                className="rounded-full"
                onClick={clearAllNotifications}
              >
                <XIcon className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {(settings.doNotDisturb || !settings.notificationsEnabled) && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-[10px] bg-black/5 px-2.5 py-1.5 text-[11px] text-adw-label-secondary dark:bg-white/6">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <BellOffIcon className="size-3 shrink-0 text-adw-accent" />
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
              className="shrink-0 font-medium text-adw-accent active:opacity-70"
            >
              {_("Resume")}
            </button>
          </div>
        )}

        <div className="flex max-h-[min(460px,calc(100vh-310px))] flex-col gap-2 overflow-y-auto pr-0.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[14px] bg-black/4 py-4 text-center dark:bg-white/5">
              <BellIcon className="mb-1 size-5 text-adw-label-tertiary" />
              <div className="text-[12px] font-medium text-adw-label-secondary">
                {_("No notifications")}
              </div>
              <div className="mt-0.5 text-[10.5px] text-adw-label-tertiary">
                {_("Recent alerts appear here")}
              </div>
            </div>
          ) : (
            notifications.map((n) => {
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
                    "group relative flex items-start gap-2.5 rounded-[14px] bg-black/6 p-3 dark:bg-white/8",
                    isCritical && "ring-1 ring-rose-500/35",
                    n.fromDomicile && n.clickable && "cursor-default"
                  )}
                >
                  <NotificationAppIcon
                    appName={n.appName}
                    icon={n.icon}
                    urgency={n.urgency}
                    className="mt-0.5 size-8 rounded-[7px]"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {isNew && (
                          <span
                            title="New"
                            className="size-1.5 shrink-0 rounded-full bg-adw-accent"
                          />
                        )}
                        <span className="truncate text-[12.5px] font-medium leading-snug">
                          {n.summary}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[10px] text-adw-label-tertiary tabular-nums">
                          {formatRelativeNotificationTime(n.time)}
                        </span>
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(n.id);
                          }}
                          className="flex size-4 items-center justify-center rounded-full bg-black/10 text-adw-label-secondary opacity-70 active:bg-black/20 active:opacity-100 dark:bg-white/15 dark:active:bg-white/25"
                        >
                          <XIcon className="size-2.5" />
                        </button>
                      </div>
                    </div>

                    {n.body && (
                      <div className="mt-0.5 text-[11.5px] leading-relaxed text-adw-label-secondary">
                        {n.body}
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
            })
          )}
        </div>
        </div>
      )}
    </div>
  );
}

