import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { CapturingKind } from "@domicile-desktop/sdk/portal";
import {
  BatteryChargingIcon,
  BatteryIcon,
  BatteryLowIcon,
  BellIcon,
  BellOffIcon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarBadge,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { matchXdgEntryForWaylandWindow } from "xdg-desktop-entry";
import { useAltKey } from "@/hooks/use-alt-key";
import {
  discoverRemoteGlobalMenu,
  type RemoteGlobalMenu,
  type RemoteMenuEntry,
} from "@/lib/xdg-app-menu";
import { cn } from "@/lib/utils";
import { buildVfsEntryWebAppUrl, getVfsEntry } from "@/lib/web-vfs";
import { ControlPanel } from "./ControlPanel";
import { Launcher } from "./Launcher";
import { PilotiLogo } from "./PilotiLogo";
import { SystemTrayItem } from "./SystemTray";

function renderRemoteMenuItems(entries: readonly RemoteMenuEntry[]): React.ReactNode {
  return entries.map((entry) => {
    if (entry.kind === "separator") {
      return <MenubarSeparator key={entry.id} />;
    }

    if (entry.submenu && entry.submenu.length > 0) {
      return (
        <MenubarSub key={entry.id}>
          <MenubarSubTrigger disabled={!entry.enabled}>
            {entry.label}
          </MenubarSubTrigger>
          <MenubarSubContent>
            {renderRemoteMenuItems(entry.submenu)}
          </MenubarSubContent>
        </MenubarSub>
      );
    }

    if (entry.checked !== undefined) {
      return (
        <MenubarCheckboxItem
          key={entry.id}
          disabled={!entry.enabled}
          checked={entry.checked}
          onClick={() => void entry.activate?.()}
        >
          {entry.label}
          {entry.shortcut && <MenubarShortcut>{entry.shortcut}</MenubarShortcut>}
        </MenubarCheckboxItem>
      );
    }

    return (
      <MenubarItem
        key={entry.id}
        disabled={!entry.enabled}
        onClick={() => void entry.activate?.()}
      >
        {entry.label}
        {entry.shortcut && <MenubarShortcut>{entry.shortcut}</MenubarShortcut>}
      </MenubarItem>
    );
  });
}

export function MenuBar() {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings } = useSettings();
  const { installedXdgApps, launchXdgEntry } = useApps();
  const {
    batteryInfo,
    notifications,
    unreadNotificationCount,
    lockSession,
    requestPowerAction,
    executePowerAction,
    capturingSessions,
    stopCapturing,
    pauseRecording,
    resumeRecording,
    takeScreenshot,
    startScreenRecording,
  } = useSystemBackends();
  const altHeld = useAltKey();
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
    openGnomeSettings,
    openWebUrl,
    handleMenuAction,
    launcherOpen,
    setLauncherOpen,
    controlPanelOpen,
    setControlPanelOpen,
    setAboutOpen,
    openAltTab,
    overviewOpen,
    toggleOverview,
  } = useWindowManager();

  const trayItems = useWatch(domicile.tray, "change", () => domicile.tray.items) ?? [];
  const waylandClients =
    useWatch(domicile.windows, "change", () => domicile.windows.list) ?? [];
  const [remoteMenu, setRemoteMenu] = React.useState<RemoteGlobalMenu | null>(
    null
  );

  const focusedWaylandClient = React.useMemo(
    () =>
      focusedWindow?.waylandAppId
        ? waylandClients.find((w) => w.appId === focusedWindow.waylandAppId)
        : undefined,
    [focusedWindow?.waylandAppId, waylandClients]
  );

  const focusedDesktopEntry = React.useMemo(() => {
    const targetId =
      focusedWaylandClient?.desktopId ?? focusedWindow?.appId ?? "";
    if (!targetId) return undefined;
    return matchXdgEntryForWaylandWindow(installedXdgApps, targetId);
  }, [focusedWaylandClient?.desktopId, focusedWindow?.appId, installedXdgApps]);

  React.useEffect(() => {
    if (!focusedWindow?.waylandAppId || isBrowserRuntime) {
      setRemoteMenu(null);
      return;
    }

    let cancelled = false;
    let cleanupFn: (() => void) | undefined;

    void discoverRemoteGlobalMenu(
      domicile,
      {
        desktopId: focusedWaylandClient?.desktopId ?? focusedWindow.appId,
        pid: focusedWaylandClient?.pid,
        desktopEntry: focusedDesktopEntry,
        onDesktopAction: (actionId) => {
          if (focusedDesktopEntry) launchXdgEntry(focusedDesktopEntry, actionId);
        },
        onUpdate: (menu) => {
          if (!cancelled) setRemoteMenu(menu);
        },
      },
      () => cancelled
    ).then((stop) => {
      if (cancelled) {
        stop();
      } else {
        cleanupFn = stop;
      }
    });

    return () => {
      cancelled = true;
      cleanupFn?.();
      setRemoteMenu(null);
    };
  }, [
    domicile,
    focusedDesktopEntry,
    focusedWaylandClient?.desktopId,
    focusedWaylandClient?.pid,
    focusedWindow?.appId,
    focusedWindow?.waylandAppId,
    isBrowserRuntime,
    launchXdgEntry,
  ]);

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

  const headerRef = React.useRef<HTMLElement | null>(null);
  const pilotiTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const controlPanelPopupRef = React.useRef<HTMLDivElement | null>(null);
  const rightClusterRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setLauncherOpen(false);
        setControlPanelOpen(false);
        requestAnimationFrame(() => {
          pilotiTriggerRef.current?.focus();
          if (pilotiTriggerRef.current?.getAttribute("aria-expanded") !== "true") {
            pilotiTriggerRef.current?.click();
          }
        });
        return;
      }

      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const header = headerRef.current;
      if (!header) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        ((target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
          (target as HTMLInputElement).value.length > 0)
      ) {
        return;
      }
      if (target?.closest('[role="slider"]')) {
        return;
      }

      const allNavItems = Array.from(
        header.querySelectorAll<HTMLElement>(
          '[role="menubar"] > [role="menuitem"], [data-menubar-nav]'
        )
      ).filter((el) => el.offsetParent !== null);
      if (allNavItems.length === 0) return;

      const openMenubarTrigger = allNavItems.find(
        (el) =>
          el.getAttribute("role") === "menuitem" &&
          el.getAttribute("aria-expanded") === "true"
      );
      const wasOpen =
        launcherOpen || controlPanelOpen || Boolean(openMenubarTrigger);

      // When a menu or panel is open, cycle directly across menus and panels
      // (skipping the non-panel workspace Overview toggle button).
      const navItems = wasOpen
        ? allNavItems.filter((el) => el.dataset.menubarNav !== "workspace")
        : allNavItems;
      if (navItems.length === 0) return;

      const menubarItems = navItems.filter(
        (el) => el.getAttribute("role") === "menuitem"
      );
      const openMenubarIdx = openMenubarTrigger
        ? navItems.indexOf(openMenubarTrigger)
        : -1;
      const active = document.activeElement as HTMLElement | null;

      // Let Base UI handle submenu open (ArrowRight on sub-trigger) / close (ArrowLeft inside sub-content)
      if (
        openMenubarIdx !== -1 &&
        active &&
        ((e.key === "ArrowRight" &&
          active.getAttribute("aria-haspopup") === "menu" &&
          !active.closest('[role="menubar"]')) ||
          (e.key === "ArrowLeft" &&
            Boolean(active.closest('[data-slot="menubar-sub-content"]'))))
      ) {
        return;
      }

      let idx = -1;
      if (launcherOpen) {
        idx = navItems.findIndex((el) => el.dataset.menubarNav === "launcher");
      } else if (controlPanelOpen) {
        idx = navItems.findIndex(
          (el) => el.dataset.menubarNav === "control-panel"
        );
      } else if (openMenubarIdx !== -1) {
        idx = openMenubarIdx;
      } else {
        idx = navItems.findIndex((el) => el === active || el.contains(active));
      }
      if (idx === -1) return;

      const currentEl = navItems[idx];
      const inMenubar = currentEl?.getAttribute("role") === "menuitem";
      const isFirstMenubar = inMenubar && currentEl === menubarItems[0];
      const isLastMenubar =
        inMenubar && currentEl === menubarItems[menubarItems.length - 1];

      // Let Base UI handle intra-menubar Left/Right except at the outer edges
      if (
        inMenubar &&
        !(
          (e.key === "ArrowLeft" && isFirstMenubar) ||
          (e.key === "ArrowRight" && isLastMenubar)
        )
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextEl =
        navItems[(idx + delta + navItems.length) % navItems.length];
      if (!nextEl) return;

      if (openMenubarIdx !== -1) {
        navItems[openMenubarIdx].click();
      }
      if (launcherOpen) setLauncherOpen(false);
      if (controlPanelOpen) setControlPanelOpen(false);

      const navKind = nextEl.dataset.menubarNav;
      if (navKind === "launcher") {
        setLauncherOpen(true);
      } else if (navKind === "control-panel") {
        setControlPanelOpen(true);
      } else if (navKind === "workspace") {
        requestAnimationFrame(() => nextEl.focus());
      } else {
        requestAnimationFrame(() => {
          nextEl.focus();
          if (wasOpen && nextEl.getAttribute("aria-expanded") !== "true") {
            nextEl.click();
          }
        });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    controlPanelOpen,
    launcherOpen,
    setControlPanelOpen,
    setLauncherOpen,
  ]);

  const handlePowerMenuClick = (
    action: "logout" | "restart" | "poweroff",
    event: React.MouseEvent
  ) => {
    if (event.altKey || altHeld) {
      void executePowerAction(action);
    } else {
      requestPowerAction(action);
    }
  };

  return (
    <header
      ref={headerRef}
      className="z-[200] flex h-[30px] w-full shrink-0 items-center justify-between gap-2 border-b border-black/10 bg-[#ececef] px-2 text-adw-body text-adw-label select-none dark:border-white/10 dark:bg-[#1c1c20] dark:text-white"
    >
      {/* Left: System, Active App & Application Menus */}
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        <Menubar modal={false}>
          {/* System / Piloti Logo Menu */}
          <MenubarMenu>
            <MenubarTrigger
              ref={pilotiTriggerRef}
              aria-label="Piloti Menu"
              className="gap-1.5 px-2 font-semibold tracking-tight"
            >
              <PilotiLogo className="size-4.5" />
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setAboutOpen(true)}>
                About Computer
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => launchApp("settings")}>
                Desktop Settings
                {notifications.length > 0 ? (
                  <MenubarBadge>{notifications.length}</MenubarBadge>
                ) : (
                  <MenubarShortcut>Alt+,</MenubarShortcut>
                )}
              </MenubarItem>
              <MenubarItem onClick={() => openGnomeSettings()}>
                System Settings
              </MenubarItem>
              <MenubarItem onClick={() => launchApp("app-store")}>
                Application Store
              </MenubarItem>
              <MenubarItem onClick={() => launchApp("console")}>
                DevTools
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => lockSession()}>
                Lock Screen
                <MenubarShortcut>⌃⌘Q</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={(e) => handlePowerMenuClick("logout", e)}>
                {altHeld ? "Log Out" : "Log Out…"}
              </MenubarItem>
              <MenubarItem onClick={(e) => handlePowerMenuClick("restart", e)}>
                {altHeld ? "Restart" : "Restart…"}
              </MenubarItem>
              <MenubarItem onClick={(e) => handlePowerMenuClick("poweroff", e)}>
                {altHeld ? "Turn Off" : "Turn Off…"}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Active Application Bold Menu */}
          <MenubarMenu>
            <MenubarTrigger app>
              <span className="max-w-[180px] truncate">
                {activeAppDef.shortName}
              </span>
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setAboutOpen(true)}>
                About {activeAppDef.name}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => launchApp("settings")}>
                Desktop Settings
                <MenubarShortcut>Alt+,</MenubarShortcut>
              </MenubarItem>
              {remoteMenu && remoteMenu.appActions.length > 0 && (
                <>
                  <MenubarSeparator />
                  {renderRemoteMenuItems(remoteMenu.appActions)}
                </>
              )}
              <MenubarSeparator />
              {focusedWindowId ? (
                <MenubarItem
                  onClick={() => closeWindow(focusedWindowId)}
                >
                  Quit {activeAppDef.shortName}
                  <MenubarShortcut>Alt+W</MenubarShortcut>
                </MenubarItem>
              ) : (
                <MenubarItem onClick={() => window.location.reload()}>
                  Restart Desktop
                </MenubarItem>
              )}
            </MenubarContent>
          </MenubarMenu>

          {/* Contextual App Menus (live XDG/D-Bus menus when exported, else catalog fallback) */}
          {remoteMenu && remoteMenu.sections.length > 0
            ? remoteMenu.sections.map((section, idx) => (
                <MenubarMenu
                  key={`remote-${idx}-${section.title}`}
                  onOpenChange={(open) => {
                    if (open) remoteMenu.aboutToShowSection?.(idx);
                  }}
                >
                  <MenubarTrigger>{section.title}</MenubarTrigger>
                  <MenubarContent>
                    {renderRemoteMenuItems(section.items)}
                  </MenubarContent>
                </MenubarMenu>
              ))
            : activeAppDef.menus.map((section) => (
                <MenubarMenu key={section.title}>
                  <MenubarTrigger>{section.title}</MenubarTrigger>
                  <MenubarContent>
                    {section.items.map((item) => (
                      <React.Fragment key={item.label}>
                        <MenubarItem onClick={() => handleMenuAction(item.actionId)}>
                          {item.label}
                          {item.shortcut && (
                            <MenubarShortcut>{item.shortcut}</MenubarShortcut>
                          )}
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
              <MenubarItem onClick={() => toggleOverview()}>
                Overview
                <MenubarShortcut>Meta+↑</MenubarShortcut>
              </MenubarItem>
              {windows.length > 0 && (
                <>
                  <MenubarSeparator />
                  {windows.map((win) => (
                    <MenubarItem key={win.id} onClick={() => focusWindow(win.id)}>
                      <span className="max-w-[180px] truncate">{win.title}</span>
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
              <MenubarItem
                onClick={() => {
                  const welcomeEntry = getVfsEntry(
                    "/home/user/Desktop/Welcome.html"
                  );
                  const url = welcomeEntry
                    ? buildVfsEntryWebAppUrl(welcomeEntry)
                    : null;
                  if (url) {
                    openWebUrl(`${url}#shortcuts`, { title: "Welcome.html" });
                  } else {
                    openWebUrl(
                      "https://yanbab.github.io/piloti-desktop/WELCOME.html#shortcuts",
                      { title: "Shortcuts" }
                    );
                  }
                }}
              >
                Shortcuts
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  const issueUrl =
                    "https://github.com/yanbab/piloti-desktop/issues/new";
                  if (isBrowserRuntime) {
                    window.open(issueUrl, "_blank", "noopener,noreferrer");
                  } else {
                    openWebUrl(issueUrl, { title: "Report Issue" });
                  }
                }}
              >
                Report Issue…
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* Center: Workspace Indicators (click pill to toggle Overview) */}
      <button
        type="button"
        data-menubar-nav="workspace"
        aria-label="Toggle Overview"
        title="Overview (Meta+↑ / F3)"
        aria-pressed={overviewOpen}
        onClick={() => toggleOverview()}
        className={cn(
          "hidden h-[22px] shrink-0 cursor-default items-center gap-[5px] rounded-full px-2 outline-none transition-colors focus-visible:bg-black/10 dark:focus-visible:bg-white/12 md:flex",
          overviewOpen
            ? "bg-black/8 dark:bg-white/12"
            : "hover:bg-black/8 dark:hover:bg-white/12"
        )}
      >
        {Array.from(
          { length: settings.workspaceCount },
          (_, idx) => idx + 1
        ).map((ws) => {
          const active = settings.activeWorkspace === ws;
          const hasWins = windows.some((w) => w.workspace === ws);
          return (
            <span
              key={ws}
              className={cn(
                "h-[6px] rounded-full transition-all duration-200 motion-reduce:transition-none",
                active
                  ? "w-[12px] bg-adw-label shadow-xs dark:bg-white"
                  : hasWins
                    ? "w-[6px] bg-adw-label/55 dark:bg-white/55"
                    : "w-[6px] bg-adw-label/28 dark:bg-white/28"
              )}
            />
          );
        })}
      </button>

      {/* Right: System Tray, Launcher & Control panel */}
      <div
        ref={rightClusterRef}
        className="flex shrink-0 items-center justify-end gap-0.5 md:flex-1 [&_svg]:pointer-events-none [&_svg]:shrink-0"
      >
        {capturingSessions.map((cap) => {
          const isRec = cap.kind === CapturingKind.Recording;
          const paused = isRec && cap.runningSinceMs === undefined;
          return (
            <div
              key={cap.id}
              className="mr-1 flex h-[22px] shrink-0 items-center gap-1 rounded-full bg-rose-500/85 px-2 text-[10.5px] font-semibold text-white"
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

        {trayItems.map((item) => (
          <SystemTrayItem key={item.id} item={item} />
        ))}

        {/* Launcher Trigger & Popover */}
        <DropdownMenu
          modal={false}
          open={launcherOpen}
          onOpenChange={(open) => {
            setLauncherOpen(open);
            if (open) setControlPanelOpen(false);
          }}
        >
          <DropdownMenuTrigger
            data-menubar-nav="launcher"
            aria-label="Launcher (Alt+Space)"
            className="flex h-[22px] shrink-0 cursor-default items-center rounded-full px-2 outline-none select-none active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12"
          >
            <SearchIcon className="size-4 text-adw-label/90 dark:text-white/90" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            anchor={rightClusterRef}
            align="end"
            sideOffset={6}
            className="w-[340px] max-w-[calc(100vw-16px)] overflow-hidden p-0"
          >
            {launcherOpen && <Launcher />}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Control panel & Clock Trigger */}
        <DropdownMenu
          modal={false}
          open={controlPanelOpen}
          onOpenChange={(open) => {
            setControlPanelOpen(open);
            if (open) setLauncherOpen(false);
          }}
        >
          <DropdownMenuTrigger
            data-menubar-nav="control-panel"
            aria-label="Control panel and Notifications"
            data-control-panel-trigger
            className="flex h-[22px] shrink-0 cursor-default items-center gap-2 rounded-full px-2.5 text-adw-body font-normal outline-none select-none active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12"
          >
            <span className="flex items-center gap-1.5 text-adw-label/90 dark:text-white/90">
              {settings.doNotDisturb ? (
                <BellOffIcon className="size-4 text-adw-label/45 dark:text-white/45" />
              ) : unreadNotificationCount > 0 ? (
                <BellIcon
                  className={cn(
                    "size-4",
                    notifications.some(
                      (n) => !n.read && n.urgency === "critical"
                    )
                      ? "text-rose-500"
                      : "text-adw-label/90 dark:text-white/90"
                  )}
                />
              ) : null}
              {settings.wifiEnabled ? (
                <WifiIcon className="size-4" />
              ) : (
                <WifiOffIcon className="size-4 text-adw-label/45 dark:text-white/45" />
              )}
              {settings.muted || settings.volume === 0 ? (
                <VolumeXIcon className="size-4 text-adw-label/60 dark:text-white/60" />
              ) : (
                <Volume2Icon className="size-4" />
              )}
              {batteryInfo.present && (
                <span className="inline-flex items-center gap-1 text-adw-body tabular-nums">
                  {batteryInfo.charging ? (
                    <BatteryChargingIcon className="size-4" />
                  ) : batteryInfo.percentage <= 20 ? (
                    <BatteryLowIcon className="size-4 text-amber-500" />
                  ) : (
                    <BatteryIcon className="size-4" />
                  )}
                  <span>{batteryInfo.percentage}%</span>
                </span>
              )}
            </span>

            <span className="flex items-center tracking-tight tabular-nums whitespace-nowrap">
              {formattedClock}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            ref={controlPanelPopupRef}
            tabIndex={-1}
            initialFocus={controlPanelPopupRef}
            align="end"
            sideOffset={6}
            className="w-[360px] max-w-[calc(100vw-16px)] rounded-adw-popover p-3.5 shadow-adw-popover"
          >
            {controlPanelOpen && <ControlPanel />}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

