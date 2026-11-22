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
  ChevronDownIcon,
  ChevronRightIcon,
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
  Window,
  WindowContent,
  WindowControls,
  WindowMain,
  WindowTitle,
  WindowTitlebar,
} from "@/components/ui/window";
import { AppSquircleIcon } from "./AppSymbol";
import { findMatchingWebApp } from "@/data/web-apps";
import { toggleWebAppInstall } from "@/lib/xdg/xdg-web-apps";
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
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { matchXdgEntryForWaylandWindow } from "xdg-desktop-entry";
import { _, getLocale } from "@/lib/core/i18n";
import { useWindowMenuState } from "@/lib/engine/app-bridge";
import { useAltKey } from "@/hooks/use-alt-key";
import {
  discoverRemoteGlobalMenu,
  type RemoteGlobalMenu,
  type RemoteMenuEntry,
} from "@/lib/xdg/xdg-app-menu";
import { cn } from "@/lib/core/utils";
import { collectMenuShortcuts, formatMenuShortcut } from "@/lib/shell/menu-shortcuts";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { buildAppHelpLinks } from "@/lib/shell/app-help-links";
import { captureLaunchOriginFromElement } from "@/lib/shell/launch-origin";
import { buildVfsEntryWebAppUrl, getVfsEntry } from "@/lib/engine-web/web-vfs";
import { ControlPanel } from "./ControlPanel";
import { Launcher } from "./Launcher";
import { PilotiLogo } from "./PilotiLogo";
import { usePlugins } from "@/context/PluginsContext";
import { SystemTrayItem } from "./SystemTray";

function MenuShortcutLabel({
  shortcut,
  model,
}: {
  shortcut: string;
  model: "mac" | "pc";
}) {
  return (
    <MenubarShortcut className={model === "pc" ? "tracking-normal" : undefined}>
      {formatMenuShortcut(shortcut, model)}
    </MenubarShortcut>
  );
}

function RemoteSubmenuGroup({
  entry,
  hasCheckable,
  computerModel,
}: {
  entry: Exclude<RemoteMenuEntry, { kind: "separator" }>;
  hasCheckable: boolean;
  computerModel: "mac" | "pc";
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div>
      <MenubarItem
        closeOnClick={false}
        disabled={!entry.enabled}
        className={cn("justify-between", hasCheckable && "pl-8")}
        onClick={(e) => {
          e.preventDefault();
          setExpanded((v) => !v);
        }}
      >
        <span>{entry.label}</span>
        {expanded ? (
          <ChevronDownIcon className="ml-2 size-3.5 opacity-70" />
        ) : (
          <ChevronRightIcon className="ml-2 size-3.5 opacity-70" />
        )}
      </MenubarItem>
      {expanded && entry.submenu && (
        <div className="my-0.5 ml-2.5 max-h-56 overflow-y-auto border-l border-adw-separator/60 pl-1">
          {renderRemoteMenuItems(entry.submenu, computerModel)}
        </div>
      )}
    </div>
  );
}

function renderRemoteMenuItems(
  entries: readonly RemoteMenuEntry[],
  computerModel: "mac" | "pc",
): React.ReactNode {
  const hasCheckable = entries.some(
    (e) => e.kind !== "separator" && e.checked !== undefined,
  );
  return entries.map((entry) => {
    if (entry.kind === "separator") {
      return <MenubarSeparator key={entry.id} />;
    }

    if (entry.submenu && entry.submenu.length > 0) {
      return (
        <RemoteSubmenuGroup
          key={entry.id}
          entry={entry}
          hasCheckable={hasCheckable}
          computerModel={computerModel}
        />
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
          {entry.shortcut && (
            <MenuShortcutLabel shortcut={entry.shortcut} model={computerModel} />
          )}
        </MenubarCheckboxItem>
      );
    }

    return (
      <MenubarItem
        key={entry.id}
        disabled={!entry.enabled}
        className={hasCheckable ? "pl-8" : undefined}
        onClick={() => void entry.activate?.()}
      >
        {entry.label}
        {entry.shortcut && (
          <MenuShortcutLabel shortcut={entry.shortcut} model={computerModel} />
        )}
      </MenubarItem>
    );
  });
}

export function MenuBar() {
  const domicile = useDomicile();
  const { statusItems } = usePlugins();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
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
  const windowMenuState = useWindowMenuState(focusedWindowId);
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

  const localeTag = getLocale() === "fr" ? "fr-FR" : "en-US";

  const formatTime = React.useCallback(
    (date: Date) => {
      const dateParts: string[] = [];
      if (settings.clockShowDay) {
        const wd = date.toLocaleDateString(localeTag, { weekday: "short" });
        dateParts.push(wd.endsWith(".") ? wd : `${wd}.`);
      }
      if (settings.clockShowDate) {
        const mo = date
          .toLocaleDateString(localeTag, { month: "short" })
          .toLowerCase();
        const moClean = mo.endsWith(".") ? mo : `${mo}.`;
        dateParts.push(`${moClean} ${date.getDate()}`);
      }
      const timeStr = date.toLocaleTimeString(localeTag, {
        hour12: !settings.clock24Hour,
        hour: settings.clock24Hour ? "2-digit" : "numeric",
        minute: "2-digit",
      });
      return dateParts.length > 0
        ? `${dateParts.join(" ")},\u00A0 ${timeStr}`
        : timeStr;
    },
    [
      localeTag,
      settings.clock24Hour,
      settings.clockShowDate,
      settings.clockShowDay,
    ],
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

  const [appAboutOpen, setAppAboutOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const appDisplayName = _(activeAppDef.name);
  const helpLinks = React.useMemo(
    () => buildAppHelpLinks(activeAppDef.id === "desktop" ? "Piloti Desktop" : activeAppDef.name),
    [activeAppDef.id, activeAppDef.name],
  );
  const shortcutGroups = React.useMemo(
    () =>
      collectMenuShortcuts({
        menus: activeAppDef.menus,
        remoteSections: remoteMenu?.sections,
        remoteAppActions: remoteMenu?.appActions,
        extraGroups: [
          {
            title: "Window",
            entries: [
              { label: "Minimize", shortcut: "Alt+M" },
              { label: "Maximize", shortcut: "Alt+F" },
              { label: "Tile Left", shortcut: "Alt+[" },
              { label: "Tile Right", shortcut: "Alt+]" },
            ],
          },
        ],
      }),
    [activeAppDef.menus, remoteMenu],
  );
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
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [setControlPanelOpen, setLauncherOpen]);

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
      className="relative z-[200] flex h-[30px] w-full shrink-0 items-stretch justify-between gap-2 px-0 text-adw-body text-adw-label select-none dark:text-white"
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 adw-material-hud transition-opacity duration-200",
          overviewOpen && "opacity-0",
        )}
      />
      {/* Left: System, Active App & Application Menus */}
      <div className="flex h-full min-w-0 flex-1 items-stretch overflow-hidden">
        <Menubar modal={false}>
          {/* System / Piloti Logo Menu — flush to top-left screen corner for Fitt's law */}
          <MenubarMenu>
            <MenubarTrigger
              ref={pilotiTriggerRef}
              aria-label="Piloti Menu"
              className="gap-1.5 rounded-none rounded-r-md pl-2.5 pr-2 font-semibold tracking-tight"
            >
              <PilotiLogo className="size-4.5" />
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setAboutOpen(true)}>
                {_("About Computer")}
              </MenubarItem>
              <MenubarSeparator />
              {!isBrowserRuntime && (
                <MenubarItem onClick={() => openGnomeSettings()}>
                  {_("System Settings")}
                </MenubarItem>
              )}
              <MenubarItem
                onClick={(e) => {
                  captureLaunchOriginFromElement(e.currentTarget);
                  launchApp("settings");
                }}
              >
                {_("Desktop Settings")}
                <MenuShortcutLabel
                  shortcut="Alt+,"
                  model={settings.computerModel}
                />
              </MenubarItem>
              <MenubarItem
                onClick={(e) => {
                  captureLaunchOriginFromElement(e.currentTarget);
                  launchApp("app-store");
                }}
              >
                {_("App Store")}
              </MenubarItem>
              <MenubarItem
                onClick={(e) => {
                  if (altHeld) {
                    window.location.reload();
                  } else {
                    captureLaunchOriginFromElement(e.currentTarget);
                    launchApp("console");
                  }
                }}
              >
                {altHeld ? _("Reload Shell") : _("Desktop Console")}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={(e) => handlePowerMenuClick("restart", e)}>
                {altHeld ? _("Restart") : _("Restart…")}
              </MenubarItem>
              <MenubarItem onClick={(e) => handlePowerMenuClick("poweroff", e)}>
                {altHeld ? _("Turn Off") : _("Turn Off…")}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => lockSession()}>
                {_("Lock Screen")}
                <MenuShortcutLabel
                  shortcut="⌃⌘Q"
                  model={settings.computerModel}
                />
              </MenubarItem>
              <MenubarItem onClick={(e) => handlePowerMenuClick("logout", e)}>
                {altHeld ? _("Log Out") : _("Log Out…")}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Active Application Bold Menu */}
          <MenubarMenu>
            <MenubarTrigger app>
              <span className="max-w-[180px] truncate">
                {_(activeAppDef.shortName)}
              </span>
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                onClick={() => {
                  if (focusedWindowId) {
                    setAppAboutOpen(true);
                  } else {
                    setAboutOpen(true);
                  }
                }}
              >
                {_("About %s", _(activeAppDef.name))}
              </MenubarItem>
              {remoteMenu && remoteMenu.appActions.length > 0 && (
                <>
                  <MenubarSeparator />
                  {renderRemoteMenuItems(remoteMenu.appActions, settings.computerModel)}
                </>
              )}
              {!focusedWindowId && (
                <>
                  <MenubarSeparator />
                  <MenubarItem
                    onClick={(e) => {
                      captureLaunchOriginFromElement(e.currentTarget);
                      launchApp("settings");
                    }}
                  >
                    {_("Desktop Settings")}
                    <MenuShortcutLabel
                      shortcut="Alt+,"
                      model={settings.computerModel}
                    />
                  </MenubarItem>
                </>
              )}
              {focusedWindowId && (
                <>
                  <MenubarSeparator />
                  <MenubarItem
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("piloti:request-animated-close", {
                          detail: { windowId: focusedWindowId },
                        })
                      )
                    }
                  >
                    {_("Quit %s", _(activeAppDef.shortName))}
                    <MenuShortcutLabel
                      shortcut="Alt+W"
                      model={settings.computerModel}
                    />
                  </MenubarItem>
                </>
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
                  {renderRemoteMenuItems(section.items, settings.computerModel)}
                </MenubarContent>
              </MenubarMenu>
            ))
            : activeAppDef.menus
              .filter((section) => section.title !== "View")
              .map((section) => {
                const hasCheckable = section.items.some(
                  (i) =>
                    (windowMenuState[i.actionId]?.checked ?? i.checked) !==
                    undefined,
                );
                return (
                  <MenubarMenu key={section.title}>
                    <MenubarTrigger>{_(section.title)}</MenubarTrigger>
                    <MenubarContent>
                      {section.items.map((item) => {
                        const itemState = windowMenuState[item.actionId];
                        const checked = itemState?.checked ?? item.checked;
                        const disabled = itemState?.disabled ?? false;
                        return (
                          <React.Fragment key={item.actionId}>
                            {checked !== undefined ? (
                              <MenubarCheckboxItem
                                checked={checked}
                                disabled={disabled}
                                onClick={() => handleMenuAction(item.actionId)}
                              >
                                {_(item.label)}
                                {item.shortcut && (
                                  <MenuShortcutLabel
                                    shortcut={item.shortcut}
                                    model={settings.computerModel}
                                  />
                                )}
                              </MenubarCheckboxItem>
                            ) : (
                              <MenubarItem
                                disabled={disabled}
                                className={hasCheckable ? "pl-8" : undefined}
                                onClick={() => handleMenuAction(item.actionId)}
                              >
                                {_(item.label)}
                                {item.shortcut && (
                                  <MenuShortcutLabel
                                    shortcut={item.shortcut}
                                    model={settings.computerModel}
                                  />
                                )}
                              </MenubarItem>
                            )}
                            {item.separatorAfter && <MenubarSeparator />}
                          </React.Fragment>
                        );
                      })}
                    </MenubarContent>
                  </MenubarMenu>
                );
              })}

          {/* Edit Menu */}
          <MenubarMenu>
            <MenubarTrigger>{_("Edit")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => document.execCommand?.("undo")}>
                {_("Undo")}
                <MenuShortcutLabel
                  shortcut="Ctrl+Z"
                  model={settings.computerModel}
                />
              </MenubarItem>
              <MenubarItem onClick={() => document.execCommand?.("redo")}>
                {_("Redo")}
                <MenuShortcutLabel
                  shortcut="Ctrl+Shift+Z"
                  model={settings.computerModel}
                />
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => document.execCommand?.("cut")}>
                {_("Cut")}
                <MenuShortcutLabel
                  shortcut="Ctrl+X"
                  model={settings.computerModel}
                />
              </MenubarItem>
              <MenubarItem onClick={() => document.execCommand?.("copy")}>
                {_("Copy")}
                <MenuShortcutLabel
                  shortcut="Ctrl+C"
                  model={settings.computerModel}
                />
              </MenubarItem>
              <MenubarItem onClick={() => document.execCommand?.("paste")}>
                {_("Paste")}
                <MenuShortcutLabel
                  shortcut="Ctrl+V"
                  model={settings.computerModel}
                />
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* View Menu (always after Edit) */}
          {!(remoteMenu && remoteMenu.sections.length > 0) &&
            activeAppDef.menus
              .filter((section) => section.title === "View")
              .map((section) => {
                const visibleItems = section.items.filter(
                  (i) => i.actionId !== "shell:fullscreen" || isBrowserRuntime,
                );
                const hasCheckable = visibleItems.some(
                  (i) =>
                    (windowMenuState[i.actionId]?.checked ?? i.checked) !==
                    undefined,
                );
                return (
                  <MenubarMenu key={section.title}>
                    <MenubarTrigger>{_(section.title)}</MenubarTrigger>
                    <MenubarContent>
                      {visibleItems.map((item) => {
                        const itemState = windowMenuState[item.actionId];
                        const checked = itemState?.checked ?? item.checked;
                        const disabled = itemState?.disabled ?? false;
                        return (
                          <React.Fragment key={item.actionId}>
                            {checked !== undefined ? (
                              <MenubarCheckboxItem
                                checked={checked}
                                disabled={disabled}
                                onClick={() => handleMenuAction(item.actionId)}
                              >
                                {_(item.label)}
                                {item.shortcut && (
                                  <MenuShortcutLabel
                                    shortcut={item.shortcut}
                                    model={settings.computerModel}
                                  />
                                )}
                              </MenubarCheckboxItem>
                            ) : (
                              <MenubarItem
                                disabled={disabled}
                                className={hasCheckable ? "pl-8" : undefined}
                                onClick={() => handleMenuAction(item.actionId)}
                              >
                                {_(item.label)}
                                {item.shortcut && (
                                  <MenuShortcutLabel
                                    shortcut={item.shortcut}
                                    model={settings.computerModel}
                                  />
                                )}
                              </MenubarItem>
                            )}
                            {item.separatorAfter && <MenubarSeparator />}
                          </React.Fragment>
                        );
                      })}
                    </MenubarContent>
                  </MenubarMenu>
                );
              })}

          {/* Universal Window Menu (matches top-left WindowMenuButton + active app window list) */}
          {activeAppDef.id !== "desktop" && (
            <MenubarMenu>
              <MenubarTrigger>{_("Window")}</MenubarTrigger>
              <MenubarContent>
                <MenubarItem
                  disabled={!focusedWindowId}
                  onClick={() => focusedWindowId && toggleMinimizeWindow(focusedWindowId)}
                >
                  {_("Minimize")}
                  <MenuShortcutLabel
                    shortcut="Alt+M"
                    model={settings.computerModel}
                  />
                </MenubarItem>
                <MenubarItem
                  disabled={!focusedWindowId}
                  onClick={() => focusedWindowId && toggleMaximizeWindow(focusedWindowId)}
                >
                  {focusedWindow?.maximized ? _("Restore") : _("Maximize")}
                  <MenuShortcutLabel
                    shortcut="Alt+F"
                    model={settings.computerModel}
                  />
                </MenubarItem>
                <MenubarItem
                  disabled={!focusedWindowId}
                  onClick={() => focusedWindowId && tileWindow(focusedWindowId, "left")}
                >
                  {_("Tile Left")}
                  <MenuShortcutLabel
                    shortcut="Alt+["
                    model={settings.computerModel}
                  />
                </MenubarItem>
                <MenubarItem
                  disabled={!focusedWindowId}
                  onClick={() => focusedWindowId && tileWindow(focusedWindowId, "right")}
                >
                  {_("Tile Right")}
                  <MenuShortcutLabel
                    shortcut="Alt+]"
                    model={settings.computerModel}
                  />
                </MenubarItem>
                {focusedWindow?.browserUrl && (
                  <>
                    <MenubarSeparator />
                    <MenubarItem
                      onClick={() =>
                        toggleWebAppInstall({
                          domicile,
                          isBrowserRuntime,
                          installedWebApps: settings.installedWebApps ?? [],
                          pinnedAppIds: settings.pinnedAppIds,
                          updateSettings,
                          url: focusedWindow.browserUrl ?? "",
                          title: focusedWindow.title,
                          iconUrl: focusedWindow.iconUrl,
                        })
                      }
                    >
                      {findMatchingWebApp(
                        focusedWindow.browserUrl,
                        settings.installedWebApps ?? []
                      )
                        ? _("Remove Web App")
                        : _("Install Web App")}
                    </MenubarItem>
                  </>
                )}
                <MenubarSeparator />
                <MenubarItem
                  disabled={!focusedWindowId}
                  onClick={() =>
                    focusedWindowId &&
                    window.dispatchEvent(
                      new CustomEvent("piloti:request-animated-close", {
                        detail: { windowId: focusedWindowId },
                      })
                    )
                  }
                >
                  {_("Close")}
                  <MenuShortcutLabel
                    shortcut="Alt+W"
                    model={settings.computerModel}
                  />
                </MenubarItem>
                {(() => {
                  const appWindows = focusedWindowId
                    ? windows.filter((w) => w.appId === activeAppDef.id)
                    : [];
                  if (appWindows.length === 0) return null;
                  return (
                    <>
                      <MenubarSeparator />
                      {appWindows.map((win) => (
                        <MenubarItem key={win.id} onClick={() => focusWindow(win.id)}>
                          <span className="max-w-[180px] truncate">{win.title}</span>
                          {win.id === focusedWindowId && <MenubarBadge>{_("Active")}</MenubarBadge>}
                          {win.minimized && <MenubarBadge>{_("Min")}</MenubarBadge>}
                        </MenubarItem>
                      ))}
                    </>
                  );
                })()}
              </MenubarContent>
            </MenubarMenu>
          )}

          {/* Help Menu */}
          <MenubarMenu>
            <MenubarTrigger>{_("Help")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setShortcutsOpen(true)}>
                {_("Shortcuts…")}
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  openWebUrl(helpLinks.websiteUrl, { title: appDisplayName });
                }}
              >
                {_("%s website", appDisplayName)}
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  if (isBrowserRuntime) {
                    window.open(helpLinks.issueUrl, "_blank", "noopener,noreferrer");
                  } else {
                    openWebUrl(helpLinks.issueUrl, { title: _("Report Issue") });
                  }
                }}
              >
                {_("Report issue…")}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <ShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
          appName={appDisplayName}
          groups={shortcutGroups}
          model={settings.computerModel}
        />
      </div>

      {/* Center: Workspace Indicators (flush to top border & centered on screen for Fitt's law) */}
      <button
        type="button"
        data-menubar-nav="workspace"
        aria-label="Toggle Overview"
        title="Overview (Meta+↑ / F3)"
        aria-pressed={overviewOpen}
        onClick={() => toggleOverview()}
        className={cn(
          "hidden h-full shrink-0 cursor-default items-center gap-[5px] rounded-md px-2 outline-none transition-colors focus-visible:bg-black/10 dark:focus-visible:bg-white/12 md:flex",
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

      {/* Right: System Tray, Launcher & Control panel (flush to top-right screen corner) */}
      <div
        ref={rightClusterRef}
        className="flex h-full shrink-0 items-stretch justify-end gap-0.5 md:flex-1 [&_svg]:pointer-events-none [&_svg]:shrink-0"
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

        {statusItems.map((item) => (
          <button
            key={item.fullId}
            type="button"
            title={item.tooltip || item.label}
            onClick={() => {
              try {
                item.onClick?.();
              } catch (err) {
                console.error(`[Plugin:${item.pluginId}] status click error:`, err);
              }
            }}
            className="flex h-full shrink-0 cursor-default items-center rounded-md px-2 text-[12px] font-medium outline-none select-none hover:bg-black/8 active:bg-black/14 focus-visible:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/18 dark:focus-visible:bg-white/12"
          >
            {item.label}
          </button>
        ))}

        {(settings.enabledPluginIds ?? ["app-indicator"]).includes("app-indicator") &&
          trayItems.map((item) => (
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
            className="flex h-full shrink-0 cursor-default items-center rounded-md px-2 outline-none select-none active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12"
          >
            <SearchIcon className="size-4 text-adw-label/90 dark:text-white/90" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            anchor={rightClusterRef}
            align="end"
            alignOffset={-8}
            sideOffset={0}
            collisionAvoidance={{ side: "flip", align: "shift" }}
            className="w-[312px] max-w-[calc(100vw-16px)] overflow-hidden p-0"
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
            onWheel={(e) => {
              if (e.deltaY === 0) return;
              e.preventDefault();
              const step = e.deltaY < 0 ? 5 : -5;
              const next = Math.max(0, Math.min(100, settings.volume + step));
              updateSettings({ volume: next, muted: next === 0 });
            }}
            className="flex h-full shrink-0 cursor-default items-center gap-2 rounded-none rounded-l-md pl-2.5 pr-3 text-adw-body font-normal outline-none select-none active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12"
          >
            <span className="flex items-center gap-1.5 text-adw-label/90 dark:text-white/90">
              {settings.doNotDisturb ? (
                <BellOffIcon className="size-4 text-adw-label/45 dark:text-white/45" />
              ) : notifications.length > 0 ? (
                <BellIcon
                  className={cn(
                    "size-4",
                    notifications.some(
                      (n) => !n.read && n.urgency === "critical"
                    )
                      ? "text-rose-500"
                      : unreadNotificationCount > 0
                        ? "text-adw-accent"
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
                  {settings.showBatteryPercentage && (
                    <span>{batteryInfo.percentage}%</span>
                  )}
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
            sideOffset={0}
            className="w-[312px] max-w-[calc(100vw-16px)] rounded-adw-popover p-3 shadow-adw-popover"
          >
            {controlPanelOpen && <ControlPanel />}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* About Focused App Window */}
      {appAboutOpen && (
        <Window
          position={{
            x:
              typeof window !== "undefined"
                ? Math.max(24, Math.round((window.innerWidth - 300) / 2))
                : 240,
            y:
              typeof window !== "undefined"
                ? Math.max(48, Math.round((window.innerHeight - 260) / 2))
                : 140,
          }}
          size={{ width: 300, height: 260 }}
          draggable
          resizable={false}
          bounds="parent"
          onClose={() => setAppAboutOpen(false)}
          style={{ position: "fixed", top: 0, left: 0, zIndex: 420 }}
        >
          <WindowMain>
            <WindowTitlebar className="justify-between">
              <div className="w-7" />
              <WindowTitle>{_("About %s", _(activeAppDef.name))}</WindowTitle>
              <WindowControls side="right" />
            </WindowTitlebar>
            <WindowContent className="flex flex-col items-center justify-center gap-1.5 p-5 text-center">
              <div className="mx-auto mb-1 size-16">
                <AppSquircleIcon
                  iconName={activeAppDef.iconName}
                  iconUrl={activeAppDef.iconUrl}
                  gradient={activeAppDef.gradient}
                  squircle={false}
                  className="size-16"
                  glyphClassName="size-9"
                />
              </div>
              <h2 className="text-[18px] font-bold tracking-tight text-adw-label">
                {_(activeAppDef.name)}
              </h2>
              <p className="text-[12px] text-adw-label-secondary">
                {_(activeAppDef.description)}
              </p>
              <span className="mt-1 rounded-full bg-black/6 px-2.5 py-0.5 text-[11px] font-medium text-adw-label-secondary dark:bg-white/10">
                Version 0.4.0
              </span>
            </WindowContent>
          </WindowMain>
        </Window>
      )}
    </header>
  );
}

