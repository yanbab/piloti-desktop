import * as React from "react";
import { SparklesIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dock, DockIcon, DockItem, DockSeparator } from "@/components/ui/dock";
import {
  useApps,
  useSettings,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { APP_CATALOG, type AppDefinition } from "@/data/catalog";
import { AppSquircleIcon } from "./AppSymbol";

export function DesktopDock() {
  const { settings, updateSettings } = useSettings();
  const { installedXdgApps, getAppIconUrl } = useApps();
  const {
    windows,
    focusedWindowId,
    launchApp,
    launchXdgApp,
    focusWindow,
    closeWindow,
    toggleMinimizeWindow,
    setCommandPaletteOpen,
    setOpenUrlOpen,
    registerDockRef,
  } = useWindowManager();

  // Build list of Dock apps: pinned apps + any currently running apps not in pinned list
  const dockApps = React.useMemo<AppDefinition[]>(() => {
    const pinnedDefs = settings.pinnedAppIds
      .map((id) => APP_CATALOG.find((a) => a.id === id))
      .filter((a): a is AppDefinition => Boolean(a));

    const pinnedSet = new Set(pinnedDefs.map((a) => a.id));
    const runningExtras: AppDefinition[] = [];

    for (const win of windows) {
      if (!pinnedSet.has(win.appId)) {
        pinnedSet.add(win.appId);
        const existingDef = APP_CATALOG.find((a) => a.id === win.appId);
        const xdgDef = installedXdgApps.find(
          (e) => e.appId === win.appId || e.desktopId === win.appId
        );
        runningExtras.push(
          existingDef ?? {
            id: win.appId,
            name: xdgDef?.name ?? win.title,
            shortName: xdgDef?.name ?? win.title,
            description: xdgDef?.comment ?? "Running Application",
            category: "Utilities",
            iconName: (win.iconName as AppDefinition["iconName"]) || "sparkles",
            iconUrl: win.iconUrl ?? xdgDef?.iconUrl ?? getAppIconUrl(win.appId),
            gradient: win.gradient || "from-violet-500 to-indigo-600",
            pinnedByDefault: false,
            defaultSize: { width: 720, height: 480 },
            menus: [],
          }
        );
      }
    }

    return [...pinnedDefs, ...runningExtras];
  }, [settings.pinnedAppIds, windows, installedXdgApps, getAppIconUrl]);

  const minimizedWindows = React.useMemo(
    () => windows.filter((w) => w.minimized),
    [windows]
  );

  const handleDockAppClick = (appId: string) => {
    const appWins = windows.filter((w) => w.appId === appId);
    if (appWins.length === 0) {
      const xdgEntry = installedXdgApps.find(
        (e) => e.appId === appId || e.desktopId === appId
      );
      if (xdgEntry) {
        launchXdgApp(xdgEntry);
      } else {
        launchApp(appId);
      }
      return;
    }
    const topWin = [...appWins].sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topWin.minimized) {
      focusWindow(topWin.id);
    } else if (topWin.id === focusedWindowId) {
      toggleMinimizeWindow(topWin.id);
    } else {
      focusWindow(topWin.id);
    }
  };

  const togglePinApp = (appId: string) => {
    const isPinned = settings.pinnedAppIds.includes(appId);
    updateSettings({
      pinnedAppIds: isPinned
        ? settings.pinnedAppIds.filter((id) => id !== appId)
        : [...settings.pinnedAppIds, appId],
    });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-[100] flex flex-col items-center">
      <Dock
        size={settings.dockSize}
        magnification={
          settings.dockMagnification ? settings.dockMagnificationSize : undefined
        }
        autoHide={settings.dockAutoHide}
        className="pointer-events-auto"
      >
        {/* App Launcher / Command Palette Quick Tile */}
        <DockItem
          label="Applications & Command Palette (Alt+Space)"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <DockIcon className="bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 text-white">
            <SparklesIcon strokeWidth={2} />
          </DockIcon>
        </DockItem>

        {/* Pinned & Running Applications */}
        {dockApps.map((app) => {
          const appWins = windows.filter((w) => w.appId === app.id);
          const isRunning = appWins.length > 0;
          const isPinned = settings.pinnedAppIds.includes(app.id);

          return (
            <ContextMenu key={app.id}>
              <ContextMenuTrigger className="contents">
                <div
                  ref={(node) => registerDockRef(app.id, node)}
                  className="contents"
                >
                  <DockItem
                    label={app.name}
                    running={isRunning}
                    badge={appWins.length > 1 ? appWins.length : undefined}
                    onClick={() => handleDockAppClick(app.id)}
                  >
                    <AppSquircleIcon
                      iconName={app.iconName}
                      iconUrl={app.iconUrl ?? getAppIconUrl(app.id)}
                      gradient={app.gradient}
                      className="size-[80.5%]"
                      glyphClassName="size-[56%]"
                    />
                  </DockItem>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                <ContextMenuItem onClick={() => handleDockAppClick(app.id)}>
                  {isRunning ? `Show ${app.shortName}` : `Open ${app.shortName}`}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    app.id.startsWith("webview:")
                      ? setOpenUrlOpen(true)
                      : launchApp(app.id, { forceNew: true })
                  }
                >
                  New Window
                </ContextMenuItem>
                {!app.id.startsWith("webview:") && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => togglePinApp(app.id)}>
                      {isPinned ? "Remove from Dock" : "Keep in Dock"}
                    </ContextMenuItem>
                  </>
                )}
                {isRunning && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        for (const w of appWins) {
                          toggleMinimizeWindow(w.id);
                        }
                      }}
                    >
                      {appWins.every((w) => w.minimized)
                        ? "Restore All"
                        : "Minimize"}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        for (const w of appWins) {
                          closeWindow(w.id);
                        }
                      }}
                    >
                      Quit {app.shortName}
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {/* Minimized Windows */}
        {minimizedWindows.length > 0 && <DockSeparator />}

        {minimizedWindows.map((minWin) => (
          <DockItem
            key={minWin.id}
            label={`Restore "${minWin.title}"`}
            badge="Min"
            onClick={() => focusWindow(minWin.id)}
          >
            <DockIcon className="bg-gradient-to-b from-zinc-700 to-zinc-900 ring-1 ring-white/20">
              <AppSquircleIcon
                iconName={minWin.iconName}
                iconUrl={minWin.iconUrl ?? getAppIconUrl(minWin.appId)}
                gradient={minWin.gradient}
                className="size-[72%] rounded-[18%]"
                glyphClassName="size-4"
              />
            </DockIcon>
          </DockItem>
        ))}
      </Dock>
    </div>
  );
}
