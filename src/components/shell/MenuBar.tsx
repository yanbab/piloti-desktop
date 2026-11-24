import * as React from "react";
import { emitShellEvent, onShellEvent } from "@/lib/shell/shell-events";
import { countRender } from "@/lib/core/render-stats";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { useCaptureActivity } from "@/lib/shell/capture-activity";
import { CapturingKind } from "@domicile-desktop/sdk/portal";
import {
  BatteryChargingIcon,
  BatteryIcon,
  BatteryLowIcon,
  BellIcon,
  BellOffIcon,
  BluetoothIcon,
  BluetoothOffIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LayersIcon,
  LeafIcon,
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
  useChromeSettings,
  useSystemBackends,
  useWindowActions,
  useWindowManagerSelector,
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
import type { WindowsContextValue } from "@/context/WindowsContext";
import { selectionEqual } from "@/context/windows/window-manager-store";
import { HelpMenuSearch } from "./HelpMenuSearch";
import {
  cleanMenuLabel,
  collectRemoteMenuCommands,
  type MenuCommand,
} from "@/lib/shell/menu-commands";
import { buildAppHelpLinks } from "@/lib/shell/app-help-links";
import { captureLaunchOriginFromElement } from "@/lib/shell/launch-origin";
import { buildVfsEntryWebAppUrl, getVfsEntry } from "@/lib/engine-web/web-vfs";
import { ControlPanel, FloatingNotifications } from "./ControlPanel";
import { KeyboardLayoutSwitcher } from "./KeyboardLayoutSwitcher";
import { Launcher } from "./Launcher";
import { PilotiLogo } from "./PilotiLogo";
import { usePlugins } from "@/context/PluginsContext";
import { SystemTrayItem } from "./SystemTray";
import { AppMenuItems, MenuShortcutLabel } from "./AppMenuItems";

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

function selectMenuBarState(wm: WindowsContextValue) {
  const fw = wm.focusedWindow;
  return {
    activeAppDef: wm.activeAppDef,
    activeAppKey: JSON.stringify({
      id: wm.activeAppDef.id,
      name: wm.activeAppDef.name,
      shortName: wm.activeAppDef.shortName,
      menus: wm.activeAppDef.menus,
    }),
    windows: wm.windows.map((w) => ({
      id: w.id,
      appId: w.appId,
      title: w.title,
      minimized: w.minimized,
      workspace: w.workspace,
    })),
    focusedWindow: fw
      ? {
          id: fw.id,
          appId: fw.appId,
          title: fw.title,
          maximized: fw.maximized,
          browserUrl: fw.browserUrl,
          iconUrl: fw.iconUrl,
          waylandAppId: fw.waylandAppId,
        }
      : undefined,
    focusedWindowId: wm.focusedWindowId,
    launcherOpen: wm.launcherOpen,
    controlPanelOpen: wm.controlPanelOpen,
    overviewOpen: wm.overviewOpen,
  };
}

type MenuBarState = ReturnType<typeof selectMenuBarState>;

/** `activeAppDef` is rebuilt with fresh arrays on window changes; compare it by content. */
function menuBarStateEqual(a: MenuBarState, b: MenuBarState): boolean {
  if (a.activeAppKey !== b.activeAppKey) return false;
  return selectionEqual(
    { ...a, activeAppDef: null },
    { ...b, activeAppDef: null },
  );
}

export const MenuBar = React.memo(function MenuBar() {
  countRender("MenuBar");
  const domicile = useDomicile();
  const captureActivity = useCaptureActivity();
  const { statusItems } = usePlugins();
  const { isBrowserRuntime, settings, updateSettings } = useChromeSettings();
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
  // Narrow slice: window drags/resizes don't change any of these fields.
  const {
    activeAppDef,
    windows,
    focusedWindow,
    focusedWindowId,
    launcherOpen,
    controlPanelOpen,
    overviewOpen,
  } = useWindowManagerSelector(selectMenuBarState, menuBarStateEqual);
  const {
    focusWindow,
    closeWindow,
    toggleMinimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
    launchApp,
    openGnomeSettings,
    openWebUrl,
    handleMenuAction,
    setLauncherOpen,
    setControlPanelOpen,
    setAboutOpen,
    openAltTab,
    toggleOverview,
  } = useWindowActions();

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
        ...(settings.clockShowSeconds ? { second: "2-digit" as const } : {}),
      });
      return dateParts.length > 0
        ? `${dateParts.join(" ")},\u00A0 ${timeStr}`
        : timeStr;
    },
    [
      localeTag,
      settings.clock24Hour,
      settings.clockShowSeconds,
      settings.clockShowDate,
      settings.clockShowDay,
    ],
  );

  const [formattedClock, setFormattedClock] = React.useState(() =>
    formatTime(new Date())
  );

  React.useEffect(() => {
    // The label has minute precision: wake once per minute, aligned to :00.
    setFormattedClock(formatTime(new Date()));
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const msToNextMinute = settings.clockShowSeconds
        ? 1000 - now.getMilliseconds() + 20
        : 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50;
      timer = setTimeout(() => {
        const next = formatTime(new Date());
        setFormattedClock((prev) => (prev === next ? prev : next));
        schedule();
      }, msToNextMinute);
    };
    schedule();
    // Resync after sleep/resume or a hidden tab (timers drift or pause).
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      setFormattedClock(formatTime(new Date()));
      schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [formatTime, settings.clockShowSeconds]);

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
  const [helpMenuOpen, setHelpMenuOpen] = React.useState(false);
  const helpSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const hasRemoteSections = Boolean(remoteMenu && remoteMenu.sections.length > 0);

  // Every runnable menu item, for Help ▸ search (Cmd+K).
  const menuCommands = React.useMemo<MenuCommand[]>(() => {
    const out: MenuCommand[] = [];
    const add = (path: string[], label: string, run: () => void, extra?: Partial<MenuCommand>) =>
      out.push({ id: `${path.join("/")}:${label}`, label, path, run, ...extra });
    const appName = _(activeAppDef.shortName);

    if (remoteMenu) {
      collectRemoteMenuCommands(remoteMenu.appActions, [appName], out);
      remoteMenu.sections.forEach((section) =>
        collectRemoteMenuCommands(section.items, [cleanMenuLabel(section.title)], out),
      );
    }
    if (!hasRemoteSections) {
      for (const section of activeAppDef.menus) {
        for (const item of section.items) {
          if (item.actionId === "shell:fullscreen" && !isBrowserRuntime) continue;
          const state = windowMenuState[item.actionId];
          add([_(section.title)], _(item.label), () => handleMenuAction(item.actionId), {
            id: `app:${item.actionId}`,
            shortcut: item.shortcut,
            checked: state?.checked ?? item.checked,
            disabled: state?.disabled ?? false,
          });
        }
      }
      if (focusedWindowId) {
        add([_("File")], _("Print…"), () => {
          emitShellEvent("piloti:print-focused");
          handleMenuAction("file:print");
        }, { shortcut: "Ctrl+P" });
      }
    }

    const edit = _("Edit");
    add([edit], _("Undo"), () => document.execCommand?.("undo"), { shortcut: "Ctrl+Z" });
    add([edit], _("Redo"), () => document.execCommand?.("redo"), { shortcut: "Ctrl+Shift+Z" });
    add([edit], _("Cut"), () => document.execCommand?.("cut"), { shortcut: "Ctrl+X" });
    add([edit], _("Copy"), () => document.execCommand?.("copy"), { shortcut: "Ctrl+C" });
    add([edit], _("Paste"), () => document.execCommand?.("paste"), { shortcut: "Ctrl+V" });

    if (focusedWindowId) {
      const win = _("Window");
      const id = focusedWindowId;
      add([win], _("Minimize"), () => toggleMinimizeWindow(id), { shortcut: "Alt+M" });
      add([win], focusedWindow?.maximized ? _("Restore") : _("Maximize"), () => toggleMaximizeWindow(id), { shortcut: "Alt+F" });
      add([win], _("Tile Left"), () => tileWindow(id, "left"), { shortcut: "Alt+[" });
      add([win], _("Tile Right"), () => tileWindow(id, "right"), { shortcut: "Alt+]" });
      add([win], _("Close"), () =>
        emitShellEvent("piloti:request-animated-close", { windowId: id }),
        { shortcut: "Alt+W" });
    }

    const piloti = "Piloti";
    add([piloti], _("About Computer"), () => setAboutOpen(true));
    add([piloti], _("Desktop Settings"), () => launchApp("settings"), { shortcut: "Alt+," });
    add([piloti], _("App Store"), () => launchApp("app-store"));
    add([piloti], _("Desktop Console"), () => launchApp("console"));
    add([piloti], _("Lock Screen"), () => lockSession(), { shortcut: "⌃⌘Q" });
    add([piloti], _("Restart…"), () => requestPowerAction("restart"));
    add([piloti], _("Turn Off…"), () => requestPowerAction("poweroff"));
    add([piloti], _("Log Out…"), () => requestPowerAction("logout"));

    const help = _("Help");
    add([help], _("Shortcuts…"), () => setShortcutsOpen(true));
    add([help], _("About %s", _(activeAppDef.name)), () => setAppAboutOpen(true));
    return out;
  }, [
    activeAppDef.menus,
    activeAppDef.name,
    activeAppDef.shortName,
    focusedWindow?.maximized,
    focusedWindowId,
    handleMenuAction,
    hasRemoteSections,
    isBrowserRuntime,
    launchApp,
    lockSession,
    remoteMenu,
    requestPowerAction,
    setAboutOpen,
    tileWindow,
    toggleMaximizeWindow,
    toggleMinimizeWindow,
    windowMenuState,
  ]);

  React.useEffect(() => {
    const onOpenHud = () => {
      setLauncherOpen(false);
      setControlPanelOpen(false);
      setHelpMenuOpen(true);
      requestAnimationFrame(() => helpSearchInputRef.current?.focus());
    };
    return onShellEvent("piloti:open-command-hud", onOpenHud);
  }, [setControlPanelOpen, setLauncherOpen]);

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

  React.useEffect(() => {
    const onDismissPopups = () => {
      setLauncherOpen(false);
      setControlPanelOpen(false);
      setShortcutsOpen(false);
      setAppAboutOpen(false);
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    };
    const offDismissPopups = onShellEvent("piloti:dismiss-popups", onDismissPopups);
    return () => {
      offDismissPopups();
    };
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
        {/* Menus that don't fit wrap onto a hidden second row: they disappear
            whole (last ones first) instead of being cut mid-word. */}
        <Menubar modal={false} className="min-w-0 flex-1 flex-wrap content-start overflow-hidden">
          {/* System / Piloti Logo Menu — flush to top-left screen corner for Fitt's law */}
          <MenubarMenu>
            <MenubarTrigger
              ref={pilotiTriggerRef}
              aria-label="Piloti Menu"
              className="gap-1.5 rounded-none rounded-r-adw-control pl-2.5 pr-2 font-semibold tracking-tight"
            >
              <PilotiLogo className="size-4.5" />
            </MenubarTrigger>
            <MenubarContent alignOffset={6}>
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
              <MenubarItem onClick={() => setAppAboutOpen(true)}>
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
                      emitShellEvent("piloti:request-animated-close", { windowId: focusedWindowId })
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
                return (
                  <MenubarMenu key={section.title}>
                    <MenubarTrigger>{_(section.title)}</MenubarTrigger>
                    <MenubarContent>
                      <AppMenuItems
                        items={section.items}
                        menuState={windowMenuState}
                        onAction={handleMenuAction}
                        computerModel={settings.computerModel}
                      />
                      {section.title === "File" &&
                        !section.items.some((i) => i.actionId === "file:print") && (
                          <>
                            <MenubarSeparator />
                            <MenubarItem
                              onClick={() => {
                                emitShellEvent("piloti:print-focused");
                                handleMenuAction("file:print");
                              }}
                            >
                              {_("Print…")}
                              <MenuShortcutLabel
                                shortcut="Ctrl+P"
                                model={settings.computerModel}
                              />
                            </MenubarItem>
                          </>
                        )}
                    </MenubarContent>
                  </MenubarMenu>
                );
              })}

          {!(remoteMenu && remoteMenu.sections.length > 0) &&
            focusedWindowId &&
            !activeAppDef.menus.some((section) => section.title === "File") && (
              <MenubarMenu>
                <MenubarTrigger>{_("File")}</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem
                    onClick={() => {
                      emitShellEvent("piloti:print-focused");
                      handleMenuAction("file:print");
                    }}
                  >
                    {_("Print…")}
                    <MenuShortcutLabel
                      shortcut="Ctrl+P"
                      model={settings.computerModel}
                    />
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            )}

          {/* Edit Menu (generic one only when the app has no Edit menu of its own) */}
          {(hasRemoteSections || !activeAppDef.menus.some((m) => m.title === "Edit")) && (
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
          )}

          {/* View Menu (always after Edit) */}
          {!(remoteMenu && remoteMenu.sections.length > 0) &&
            activeAppDef.menus
              .filter((section) => section.title === "View")
              .map((section) => {
                const visibleItems = section.items.filter(
                  (i) => i.actionId !== "shell:fullscreen" || isBrowserRuntime,
                );
                return (
                  <MenubarMenu key={section.title}>
                    <MenubarTrigger>{_(section.title)}</MenubarTrigger>
                    <MenubarContent>
                      <AppMenuItems
                        items={visibleItems}
                        menuState={windowMenuState}
                        onAction={handleMenuAction}
                        computerModel={settings.computerModel}
                      />
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
                    emitShellEvent("piloti:request-animated-close", { windowId: focusedWindowId })
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
          <MenubarMenu open={helpMenuOpen} onOpenChange={setHelpMenuOpen}>
            <MenubarTrigger>{_("Help")}</MenubarTrigger>
            <MenubarContent className="w-[22rem]" initialFocus={helpSearchInputRef}>
              <HelpMenuSearch
                commands={menuCommands}
                model={settings.computerModel}
                inputRef={helpSearchInputRef}
                onRun={(command) => {
                  setHelpMenuOpen(false);
                  // Let the menu close (and focus return) before running the command.
                  requestAnimationFrame(() => command.run());
                }}
              />
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

      {/* Center: Workspace Indicators or Touch Window Switcher */}
      <button
        type="button"
        data-menubar-nav="workspace"
        aria-label="Toggle Overview"
        title="Overview (Meta+↑ / F3)"
        aria-pressed={overviewOpen}
        onClick={() => toggleOverview()}
        className={cn(
          // Always visible: the menus give way first.
          "flex h-full shrink-0 cursor-default items-center gap-[5px] rounded-adw-control px-2 outline-none transition-colors focus-visible:bg-black/10 dark:focus-visible:bg-white/12",
          overviewOpen
            ? "bg-black/8 dark:bg-white/12"
            : "hover-fill:bg-black/8 dark:hover-fill:bg-white/12"
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
        {captureActivity && (
          <span
            role="img"
            aria-label={captureActivity === "camera" ? _("Camera in use") : _("Microphone in use")}
            title={captureActivity === "camera" ? _("Camera in use") : _("Microphone in use")}
            className={cn(
              "mr-1 flex h-full shrink-0 items-center px-1",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                captureActivity === "camera" ? "bg-red-500" : "bg-orange-500",
              )}
            />
          </span>
        )}
        {capturingSessions.map((cap) => {
          const isRec = cap.kind === CapturingKind.Recording;
          const paused = isRec && cap.runningSinceMs === undefined;
          return (
            <div
              key={cap.id}
              className="mr-1 flex h-[22px] shrink-0 items-center gap-1 rounded-full bg-rose-500/85 px-2 text-adw-footnote font-semibold text-white"
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
                  className="rounded-full p-0.5 hover-fill:bg-white/20"
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
                className="rounded-full p-0.5 hover-fill:bg-white/20"
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
            className="flex h-full shrink-0 cursor-default items-center rounded-adw-control px-2 text-adw-callout font-medium outline-none select-none hover-fill:bg-black/8 active:bg-black/14 focus-visible:bg-black/10 dark:hover-fill:bg-white/10 dark:active:bg-white/18 dark:focus-visible:bg-white/12"
          >
            {item.label}
          </button>
        ))}

        {(settings.enabledPluginIds ?? ["app-indicator"]).includes("app-indicator") &&
          trayItems.map((item) => (
            <SystemTrayItem key={item.id} item={item} />
          ))}

        {/* Keyboard Layout Switcher (shown when > 1 layout is available) */}
        <KeyboardLayoutSwitcher sideOffset={0} />

        {/* Launcher Trigger & Popover */}
          <DropdownMenu
            modal={false}
            open={launcherOpen}
            onOpenChange={(open, details) => {
              // Launcher toggles elsewhere (dock tile) handle their own click:
              // pressing them must not first close the launcher as an
              // outside press, then reopen it.
              // (outside press: the event target; focus moving there: the
              // related target).
              const event = details?.event as FocusEvent | undefined;
              const isToggle = (node: EventTarget | null | undefined) =>
                node instanceof Element &&
                Boolean(node.closest("[data-launcher-toggle]"));
              if (!open && (isToggle(event?.target) || isToggle(event?.relatedTarget))) {
                return;
              }
              setLauncherOpen(open);
              if (open) setControlPanelOpen(false);
            }}
          >
            <DropdownMenuTrigger
              data-menubar-nav="launcher"
              aria-label="Launcher (Alt+Space)"
              className="flex h-full shrink-0 cursor-default items-center rounded-adw-control px-2 outline-none select-none active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12"
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
              className="flex h-full shrink-0 cursor-default items-center gap-2 rounded-none rounded-l-adw-control pl-2.5 pr-3 text-adw-body font-normal outline-none select-none active:bg-black/14 data-popup-open:bg-black/12 focus-visible:bg-black/10 dark:active:bg-white/18 dark:data-popup-open:bg-white/15 dark:focus-visible:bg-white/12"
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
                {settings.bluetoothEnabled ? (
                  <BluetoothIcon className="size-4" />
                ) : (
                  <BluetoothOffIcon className="size-4 text-adw-label/45 dark:text-white/45" />
                )}
                {settings.muted || settings.volume === 0 ? (
                  <VolumeXIcon className="size-4 text-adw-label/60 dark:text-white/60" />
                ) : (
                  <Volume2Icon className="size-4" />
                )}
                {settings.powerMode === "power-saver" && (
                  <LeafIcon
                    className="size-4"
                    aria-label={_("Power Saver")}
                  />
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
              // Built once, then shown and hidden.
              keepMounted
              align="end"
              sideOffset={0}
              // The scroll container is padded so the panel and notification
              // shadows (same as menus) are not clipped by its overflow.
              className="-mr-1 w-[348px] max-w-[calc(100vw-8px)] overflow-x-hidden overflow-y-auto rounded-none border-0 bg-transparent! pt-0 pr-3 pb-8 pl-6 shadow-none! [backdrop-filter:none]! [-webkit-backdrop-filter:none]!"
            >
              <div className="rounded-adw-popover p-3 shadow-adw-popover adw-material-menu">
                <ControlPanel open={controlPanelOpen} />
              </div>
              <FloatingNotifications open={controlPanelOpen} />
            </DropdownMenuContent>
          </DropdownMenu>
      </div>

      {/* About Focused App Window */}
      {appAboutOpen && (
        <Window
          defaultPosition={{
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
              <p className="text-adw-callout text-adw-label-secondary">
                {_(activeAppDef.description)}
              </p>
              <span className="mt-1 rounded-full bg-black/6 px-2.5 py-0.5 text-adw-subheadline font-medium text-adw-label-secondary dark:bg-white/10">
                Version 0.4.0
              </span>
            </WindowContent>
          </WindowMain>
        </Window>
      )}
    </header>
  );
});

