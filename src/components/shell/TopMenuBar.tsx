import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { CapturingKind } from "@domicile-desktop/sdk/portal";
import {
  BatteryChargingIcon,
  BellOffIcon,
  LayersIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  SquareIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import {
  Menubar,
  MenubarBadge,
  MenubarContent,
  MenubarExtra,
  MenubarExtras,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { cn } from "@/lib/utils";
import { PilotiLogo } from "./PilotiLogo";
import { TrayIndicatorButton } from "./TrayIndicatorButton";

export function TopMenuBar() {
  const domicile = useDomicile();
  const { settings, updateSettings } = useSettings();
  const {
    batteryInfo,
    notifications,
    lockSession,
    requestPowerAction,
    capturingSessions,
    stopCapturing,
    pauseRecording,
    resumeRecording,
    takeScreenshot,
    startScreenRecording,
  } = useSystemBackends();
  const {
    activeAppDef,
    windows,
    focusedWindow,
    focusedWindowId,
    focusWindow,
    closeWindow,
    toggleMinimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
    launchApp,
    handleMenuAction,
    setCommandPaletteOpen,
    controlCenterOpen,
    setControlCenterOpen,
    setAboutOpen,
    setOpenUrlOpen,
    openAltTab,
  } = useWindowManager();

  const trayItems = useWatch(domicile.tray, "change", () => domicile.tray.items) ?? [];

  const formatTime = React.useCallback(
    (date: Date) =>
      date.toLocaleTimeString("en-US", {
        hour12: !settings.clock24Hour,
        hour: settings.clock24Hour ? "2-digit" : "numeric",
        minute: "2-digit",
        ...(settings.clockShowSeconds ? { second: "2-digit" } : {}),
      }),
    [settings.clock24Hour, settings.clockShowSeconds]
  );

  const [formattedClock, setFormattedClock] = React.useState(() =>
    formatTime(new Date())
  );

  React.useEffect(() => {
    setFormattedClock(formatTime(new Date()));
    const interval = setInterval(() => {
      const next = formatTime(new Date());
      setFormattedClock((prev) => (prev === next ? prev : next));
    }, 1000);
    return () => clearInterval(interval);
  }, [formatTime]);

  return (
    <header className="relative z-[200] shrink-0">
      <Menubar className="h-[30px] border-b border-black/10 bg-white/55 px-2 text-mac-label backdrop-blur-2xl dark:border-white/10 dark:bg-black/35 dark:text-white">
        {/* System / Piloti Logo Menu */}
        <MenubarMenu>
          <MenubarTrigger
            aria-label="Piloti Menu"
            className="gap-1.5 px-2 font-semibold tracking-tight"
          >
            <PilotiLogo className="size-4.5" />
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setAboutOpen(true)}>
              About Piloti
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => launchApp("settings")}>
              Settings
              {notifications.length > 0 ? (
                <MenubarBadge>{notifications.length}</MenubarBadge>
              ) : (
                <MenubarShortcut>Alt+,</MenubarShortcut>
              )}
            </MenubarItem>
            <MenubarItem onClick={() => setCommandPaletteOpen(true)}>
              Applications
              <MenubarShortcut>Alt+Space</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={() => setOpenUrlOpen(true)}>
              Open URL
            </MenubarItem>
            <MenubarItem onClick={() => launchApp("console")}>
              Console / REPL
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              onClick={() =>
                updateSettings({
                  themeMode: settings.themeMode === "dark" ? "light" : "dark",
                })
              }
            >
              Toggle {settings.themeMode === "dark" ? "Light" : "Dark"} Appearance
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => lockSession()}>
              Lock Screen
              <MenubarShortcut>⌃⌘Q</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={() => window.location.reload()}>
              Reload Shell
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => requestPowerAction("logout")}>
              Log Out
            </MenubarItem>
            <MenubarItem onClick={() => requestPowerAction("restart")}>
              Restart
            </MenubarItem>
            <MenubarItem onClick={() => requestPowerAction("poweroff")}>
              Turn Off
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* Active Application Bold Menu */}
        <MenubarMenu>
          <MenubarTrigger app>{activeAppDef.shortName}</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setAboutOpen(true)}>
              About {activeAppDef.name}
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => launchApp("settings")}>
              Settings
              <MenubarShortcut>Alt+,</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              disabled={!focusedWindowId}
              onClick={() => focusedWindowId && toggleMinimizeWindow(focusedWindowId)}
            >
              Hide {activeAppDef.shortName}
              <MenubarShortcut>Alt+M</MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={!focusedWindowId}
              onClick={() => focusedWindowId && closeWindow(focusedWindowId)}
            >
              Quit {activeAppDef.shortName}
              <MenubarShortcut>Alt+W</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* Contextual App Menus */}
        {activeAppDef.menus.map((section) => (
          <MenubarMenu key={section.title}>
            <MenubarTrigger>{section.title}</MenubarTrigger>
            <MenubarContent>
              {section.items.map((item) => (
                <React.Fragment key={item.label}>
                  <MenubarItem onClick={() => handleMenuAction(item.actionId)}>
                    {item.label}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                  {item.separatorAfter && <MenubarSeparator />}
                </React.Fragment>
              ))}
            </MenubarContent>
          </MenubarMenu>
        ))}

        {/* Universal Window Menu */}
        <MenubarMenu>
          <MenubarTrigger>Window</MenubarTrigger>
          <MenubarContent>
            <MenubarItem
              disabled={!focusedWindowId}
              onClick={() => focusedWindowId && toggleMinimizeWindow(focusedWindowId)}
            >
              Minimize
              <MenubarShortcut>Alt+M</MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={!focusedWindowId}
              onClick={() => focusedWindowId && toggleMaximizeWindow(focusedWindowId)}
            >
              {focusedWindow?.maximized ? "Restore Window Size" : "Zoom / Maximize"}
              <MenubarShortcut>Alt+F</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              disabled={!focusedWindowId}
              onClick={() => focusedWindowId && tileWindow(focusedWindowId, "left")}
            >
              Tile Window to Left of Screen
              <MenubarShortcut>Alt+[</MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={!focusedWindowId}
              onClick={() => focusedWindowId && tileWindow(focusedWindowId, "right")}
            >
              Tile Window to Right of Screen
              <MenubarShortcut>Alt+]</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => openAltTab()}>
              Switch Windows (Alt+Tab)
              <MenubarShortcut>Alt+Tab</MenubarShortcut>
            </MenubarItem>
            {windows.length > 0 && (
              <>
                <MenubarSeparator />
                {windows.map((win) => (
                  <MenubarItem key={win.id} onClick={() => focusWindow(win.id)}>
                    <span className="truncate max-w-[180px]">{win.title}</span>
                    {win.id === focusedWindowId && <MenubarBadge>Active</MenubarBadge>}
                    {win.minimized && <MenubarBadge>Min</MenubarBadge>}
                  </MenubarItem>
                ))}
              </>
            )}
          </MenubarContent>
        </MenubarMenu>

        {/* Help Menu */}
        <MenubarMenu>
          <MenubarTrigger>Help</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setCommandPaletteOpen(true)}>
              Search Actions & Apps
              <MenubarShortcut>Alt+Space</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => void takeScreenshot()}>
              Take Screenshot
              <MenubarShortcut>Print</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={() => void startScreenRecording()}>
              Record Screen
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => launchApp("console")}>
              Piloti Console &amp; REPL
            </MenubarItem>
            <MenubarItem onClick={() => launchApp("settings", { payload: "about" })}>
              About Piloti &amp; Shortcuts
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* Center GNOME-style Workspace Switcher (full-height click targets) */}
        <div className="pointer-events-auto absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center md:flex">
          {Array.from(
            { length: settings.workspaceCount },
            (_, idx) => idx + 1
          ).map((ws) => {
            const active = settings.activeWorkspace === ws;
            const hasWins = windows.some((w) => w.workspace === ws);
            return (
              <button
                key={ws}
                type="button"
                aria-label={`Workspace ${ws}`}
                onClick={() => updateSettings({ activeWorkspace: ws })}
                className="group flex h-full cursor-default items-center justify-center px-[3.5px] outline-none"
              >
                <span
                  className={cn(
                    "h-[7px] rounded-full transition-all duration-200 motion-reduce:transition-none",
                    active
                      ? "w-[18px] bg-mac-label shadow-xs dark:bg-white"
                      : hasWins
                        ? "w-[7px] bg-mac-label/55 group-hover:bg-mac-label/80 dark:bg-white/55 dark:group-hover:bg-white/80"
                        : "w-[7px] bg-mac-label/28 group-hover:bg-mac-label/55 dark:bg-white/28 dark:group-hover:bg-white/55"
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Right Side: System Status Indicators & Quick Settings Trigger */}
        <MenubarExtras className="gap-0.5">
          {/* Active Screen Recording / Cast Sessions */}
          {capturingSessions.map((cap) => {
            const isRec = cap.kind === CapturingKind.Recording;
            const paused = isRec && cap.runningSinceMs === undefined;
            return (
              <div
                key={cap.id}
                className="mr-1 flex h-[20px] items-center gap-1 rounded-full bg-rose-500/85 px-2 text-[10.5px] font-semibold text-white"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                <span>{isRec ? (paused ? "Paused" : "REC") : "Sharing"}</span>
                {isRec && (
                  <button
                    type="button"
                    aria-label={paused ? "Resume Recording" : "Pause Recording"}
                    onClick={() =>
                      paused ? resumeRecording(cap.id) : pauseRecording(cap.id)
                    }
                    className="rounded-full p-0.5 hover:bg-white/20"
                  >
                    {paused ? (
                      <PlayIcon className="size-2.5" />
                    ) : (
                      <PauseIcon className="size-2.5" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Stop Capture"
                  onClick={() => stopCapturing(cap.id)}
                  className="rounded-full p-0.5 hover:bg-white/20"
                >
                  <SquareIcon className="size-2.5 fill-current" />
                </button>
              </div>
            );
          })}

          {/* Native Tray Icons from Domicile (with DBusMenu support) */}
          {trayItems.map((item) => (
            <TrayIndicatorButton key={item.id} item={item} />
          ))}

          {/* Alt+Tab Switcher Button */}
          <MenubarExtra
            title="Window Switcher (Alt+Tab)"
            onClick={() => openAltTab()}
            className="px-2"
          >
            <LayersIcon className="size-3.5 text-mac-label/85 dark:text-white/85" />
          </MenubarExtra>

          {/* Command Palette Trigger (icon only) */}
          <MenubarExtra
            title="Command Palette (Alt+Space)"
            onClick={() => setCommandPaletteOpen(true)}
            className="px-2"
          >
            <SearchIcon className="size-3.5 text-mac-label/90 dark:text-white/90" />
          </MenubarExtra>

          {/* Unified Status + Clock Trigger for Right-Side Notifications & Quick Settings Panel */}
          <button
            type="button"
            onClick={() => setControlCenterOpen((v) => !v)}
            data-control-center-trigger
            className={cn(
              "ml-1 flex h-[22px] items-center gap-2 rounded-full px-2.5 text-[12px] font-medium text-mac-label transition-colors outline-none dark:text-white",
              controlCenterOpen
                ? "bg-black/12 shadow-inner ring-1 ring-black/15 dark:bg-white/25 dark:ring-white/30"
                : "hover:bg-black/8 dark:hover:bg-white/15"
            )}
          >
            <span className="flex items-center gap-1.5 text-mac-label/90 dark:text-white/90">
              {settings.doNotDisturb && (
                <MoonIcon className="size-3.5 text-violet-600 dark:text-violet-300" />
              )}
              {settings.wifiEnabled ? (
                <WifiIcon className="size-3.5" />
              ) : (
                <WifiOffIcon className="size-3.5 text-mac-label/45 dark:text-white/45" />
              )}
              {settings.muted || settings.volume === 0 ? (
                <VolumeXIcon className="size-3.5 text-rose-600 dark:text-rose-300" />
              ) : (
                <Volume2Icon className="size-3.5" />
              )}
              {batteryInfo.present && (
                <span className="hidden items-center gap-0.5 text-[11px] tabular-nums lg:inline-flex">
                  <BatteryChargingIcon className="size-3.5" />
                  <span>{batteryInfo.percentage}%</span>
                </span>
              )}
            </span>

            <span className="flex items-center gap-1.5 tracking-tight tabular-nums">
              <span>{formattedClock}</span>
              {notifications.length > 0 && !settings.doNotDisturb && (
                <span className="flex size-2 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
              )}
              {settings.doNotDisturb && (
                <BellOffIcon className="size-3 text-mac-label/50 dark:text-white/50" />
              )}
            </span>
          </button>
        </MenubarExtras>
      </Menubar>
    </header>
  );
}

