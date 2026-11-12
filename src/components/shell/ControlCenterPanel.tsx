import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  BatteryChargingIcon,
  BellIcon,
  BellOffIcon,
  BluetoothIcon,
  CameraIcon,
  FlameIcon,
  GaugeIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  Trash2Icon,
  VideoIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useDesktopState } from "@/context/DesktopStateContext";
import { cn } from "@/lib/utils";

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function ControlCenterPanel() {
  const domicile = useDomicile();
  const {
    controlCenterOpen,
    setControlCenterOpen,
    settings,
    updateSettings,
    batteryInfo,
    notifications,
    pushNotification,
    dismissNotification,
    clearAllNotifications,
    takeScreenshot,
    startScreenRecording,
    launchApp,
    openGnomeSettings,
  } = useDesktopState();

  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!controlCenterOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !target.closest("[data-control-center-trigger]")
      ) {
        setControlCenterOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [controlCenterOpen, setControlCenterOpen]);

  if (!controlCenterOpen) return null;

  const cyclePowerMode = () => {
    const order: ("balanced" | "performance" | "power-saver")[] = [
      "balanced",
      "performance",
      "power-saver",
    ];
    const next = order[(order.indexOf(settings.powerMode) + 1) % order.length];
    updateSettings({ powerMode: next });
  };

  return (
    <aside
      ref={panelRef}
      aria-label="Notifications and Quick Settings"
      className="fixed top-[36px] right-2.5 z-[300] flex max-h-[calc(100vh-52px)] w-[360px] flex-col gap-3 overflow-hidden rounded-mac-popover p-3.5 text-mac-label shadow-mac-window mac-material-menu ring-1 ring-white/15 animate-in fade-in-0 duration-150 motion-reduce:animate-none"
    >
      {/* Top Header: Date, Battery & Settings Shortcut */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[11px] font-semibold text-mac-label-secondary">
          {new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </div>
        <div className="flex items-center gap-1.5">
          {batteryInfo.present && (
            <div className="flex items-center gap-1 rounded-full bg-black/8 px-2.5 py-1 text-[11px] font-semibold text-mac-label dark:bg-white/10 dark:text-white">
              <BatteryChargingIcon className="size-3.5" />
              <span>{batteryInfo.percentage}%</span>
            </div>
          )}
          <button
            type="button"
            title="Take Screenshot (Print)"
            onClick={() => {
              setControlCenterOpen(false);
              void takeScreenshot();
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-mac-accent hover:text-white dark:bg-white/10"
          >
            <CameraIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Record Screen"
            onClick={() => {
              setControlCenterOpen(false);
              void startScreenRecording();
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-mac-accent hover:text-white dark:bg-white/10"
          >
            <VideoIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Open GNOME Settings (Shift+Click) or Piloti Settings"
            onClick={(e) => {
              setControlCenterOpen(false);
              if (e.shiftKey) {
                openGnomeSettings();
              } else {
                launchApp("settings");
              }
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-mac-accent hover:text-white dark:bg-white/10"
          >
            <SettingsIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Settings Grid (GNOME + macOS hybrid pills) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Wi-Fi Pill */}
        <button
          type="button"
          onClick={() => updateSettings({ wifiEnabled: !settings.wifiEnabled })}
          className={cn(
            "flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-all",
            settings.wifiEnabled
              ? "bg-mac-accent text-white shadow-xs"
              : "bg-black/6 text-mac-label hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/12"
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              settings.wifiEnabled ? "bg-white/20" : "bg-black/10 dark:bg-white/10"
            )}
          >
            <WifiIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">Wi-Fi</div>
            <div className="truncate text-[10px] opacity-80">
              {settings.wifiEnabled ? settings.connectedWifi : "Off"}
            </div>
          </div>
        </button>

        {/* Bluetooth Pill */}
        <button
          type="button"
          onClick={() =>
            updateSettings({ bluetoothEnabled: !settings.bluetoothEnabled })
          }
          className={cn(
            "flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-all",
            settings.bluetoothEnabled
              ? "bg-mac-accent text-white shadow-xs"
              : "bg-black/6 text-mac-label hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/12"
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              settings.bluetoothEnabled
                ? "bg-white/20"
                : "bg-black/10 dark:bg-white/10"
            )}
          >
            <BluetoothIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">Bluetooth</div>
            <div className="truncate text-[10px] opacity-80">
              {settings.bluetoothEnabled ? "On · 2 Devices" : "Off"}
            </div>
          </div>
        </button>

        {/* Dark Mode Pill */}
        <button
          type="button"
          onClick={() =>
            updateSettings({
              themeMode: settings.themeMode === "dark" ? "light" : "dark",
            })
          }
          className={cn(
            "flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-all",
            settings.themeMode === "dark"
              ? "bg-mac-accent text-white shadow-xs"
              : "bg-black/6 text-mac-label hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/12"
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              settings.themeMode === "dark"
                ? "bg-white/20"
                : "bg-black/10 dark:bg-white/10"
            )}
          >
            <MoonIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">Dark Mode</div>
            <div className="truncate text-[10px] opacity-80 capitalize">
              {settings.themeMode}
            </div>
          </div>
        </button>

        {/* Do Not Disturb Pill */}
        <button
          type="button"
          onClick={() =>
            updateSettings({ doNotDisturb: !settings.doNotDisturb })
          }
          className={cn(
            "flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-all",
            settings.doNotDisturb
              ? "bg-violet-600 text-white shadow-xs"
              : "bg-black/6 text-mac-label hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/12"
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              settings.doNotDisturb
                ? "bg-white/20"
                : "bg-black/10 dark:bg-white/10"
            )}
          >
            <BellOffIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">Do Not Disturb</div>
            <div className="truncate text-[10px] opacity-80">
              {settings.doNotDisturb ? "Silence Active" : "Off"}
            </div>
          </div>
        </button>

        {/* Night Light Pill */}
        <button
          type="button"
          onClick={() => updateSettings({ nightLight: !settings.nightLight })}
          className={cn(
            "flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-all",
            settings.nightLight
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-black/6 text-mac-label hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/12"
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              settings.nightLight
                ? "bg-white/20"
                : "bg-black/10 dark:bg-white/10"
            )}
          >
            <FlameIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">Night Light</div>
            <div className="truncate text-[10px] opacity-80">
              {settings.nightLight ? "Warm 4200K" : "Off"}
            </div>
          </div>
        </button>

        {/* Power Profile Pill */}
        <button
          type="button"
          onClick={cyclePowerMode}
          className={cn(
            "flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-all",
            settings.powerMode === "performance"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-black/6 text-mac-label hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/12"
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              settings.powerMode === "performance"
                ? "bg-white/20"
                : "bg-black/10 dark:bg-white/10"
            )}
          >
            <GaugeIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">Power Mode</div>
            <div className="truncate text-[10px] opacity-80 capitalize">
              {settings.powerMode}
            </div>
          </div>
        </button>
      </div>

      {/* Display Brightness & Sound Sliders (single line: icon + slider) */}
      <div className="flex flex-col gap-2.5 rounded-[16px] bg-black/6 p-3 dark:bg-white/8">
        {/* Display Brightness */}
        <div className="flex items-center gap-2.5">
          <SunIcon className="size-4 shrink-0 text-amber-400" />
          <Slider
            aria-label="Display Brightness"
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

        {/* Sound Volume */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Toggle Mute"
            onClick={() => updateSettings({ muted: !settings.muted })}
            className="flex shrink-0 items-center justify-center hover:opacity-80"
          >
            {settings.muted || settings.volume === 0 ? (
              <VolumeXIcon className="size-4 text-rose-400" />
            ) : (
              <Volume2Icon className="size-4 text-sky-400" />
            )}
          </button>
          <Slider
            aria-label="Sound Output"
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
        </div>
      </div>

      {/* Notifications Section */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <BellIcon className="size-3.5 text-mac-label-secondary" />
            <span className="text-[12px] font-semibold">Notifications</span>
            {notifications.length > 0 && (
              <span className="rounded-full bg-mac-accent/20 px-1.5 py-0.2 text-[10px] font-bold text-mac-accent">
                {notifications.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="h-5 px-2 text-[10px]"
                onClick={clearAllNotifications}
              >
                <Trash2Icon className="size-2.5" />
                Clear
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="h-5 px-2 text-[10px]"
              onClick={() =>
                pushNotification({
                  appName: "Piloti System",
                  summary: "Wayland Compositor Synced",
                  body: `Workspace ${settings.activeWorkspace} active · Volume ${settings.volume}%`,
                })
              }
            >
              <PlusIcon className="size-2.5" />
              Test
            </Button>
          </div>
        </div>

        <div className="flex max-h-[250px] flex-col gap-2 overflow-y-auto pr-0.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[14px] bg-black/4 py-8 text-center dark:bg-white/5">
              <BellIcon className="mb-1.5 size-6 text-mac-label-tertiary" />
              <div className="text-[12px] font-medium text-mac-label-secondary">
                No notifications
              </div>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.fromDomicile) {
                    try {
                      domicile.notifications.invoke(n.id, "default");
                    } catch {
                      // ignore
                    }
                  }
                }}
                className="group relative flex flex-col gap-1 rounded-[14px] bg-black/6 p-3 transition-colors hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/12"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-wide text-mac-accent uppercase">
                    {n.appName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-mac-label-tertiary">
                      {formatRelativeTime(n.time)}
                    </span>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(n.id);
                      }}
                      className="flex size-4 items-center justify-center rounded-full bg-black/10 text-mac-label-secondary opacity-70 transition-opacity hover:opacity-100 dark:bg-white/15"
                    >
                      <XIcon className="size-2.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[12.5px] font-semibold leading-snug">
                  {n.summary}
                </div>
                {n.body && (
                  <div className="text-[11.5px] leading-relaxed text-mac-label-secondary">
                    {n.body}
                  </div>
                )}
                {n.actions && n.actions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {n.actions.map((act) => (
                      <Button
                        key={act.key}
                        size="sm"
                        variant="secondary"
                        className="h-5 text-[10px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (act.key === "settings") {
                            setControlCenterOpen(false);
                            launchApp("settings");
                          } else if (n.fromDomicile) {
                            try {
                              domicile.notifications.invoke(n.id, act.key);
                            } catch {
                              // ignore
                            }
                          }
                        }}
                      >
                        {act.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

