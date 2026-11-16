import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dock as DockSurface,
  DockItem,
  DockSeparator,
} from "@/components/ui/dock";
import {
  resolveXdgVisualStyle,
  useApps,
} from "@/context/AppsContext";
import {
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { APP_CATALOG, type AppDefinition } from "@/data/catalog";
import { useAltKey } from "@/hooks/use-alt-key";
import {
  emptyXdgTrash,
  inspectXdgTrash,
  resolveXdgTrashPaths,
} from "@/lib/xdg-trash";
import {
  emptyVfsTrash,
  listVfsDir,
  subscribeWebVfs,
  WEB_VFS_TRASH,
} from "@/lib/web-vfs";
import { cn } from "@/lib/utils";
import { AppSquircleIcon } from "./AppSymbol";

export function Dock() {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const { installedXdgApps, getAppIconUrl, appGridIsSymbolic, dockIconsReady } =
    useApps();
  const {
    windows,
    focusedWindowId,
    launchingApps,
    launchApp,
    launchXdgApp,
    focusWindow,
    closeWindow,
    forceQuitApp,
    toggleMinimizeWindow,
    setLauncherOpen,
    registerDockRef,
  } = useWindowManager();
  const altPressed = useAltKey();

  const [trashEmpty, setTrashEmpty] = React.useState(true);
  const [trashCount, setTrashCount] = React.useState(0);
  const [entered, setEntered] = React.useState(false);

  React.useEffect(() => {
    if (!dockIconsReady || entered) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [dockIconsReady, entered]);
  const [dragDockSize, setDragDockSize] = React.useState<number | null>(null);
  const [resizingDock, setResizingDock] = React.useState(false);
  const [dragPinnedOrder, setDragPinnedOrder] = React.useState<string[] | null>(
    null
  );
  const [draggingAppId, setDraggingAppId] = React.useState<string | null>(null);
  const [dropTargetAppId, setDropTargetAppId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    const handleFileDrag = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          active: boolean;
          item?: { kind?: string };
          clientX?: number;
          clientY?: number;
        }>
      ).detail;
      if (
        !detail?.active ||
        detail.item?.kind !== "file" ||
        detail.clientX === undefined ||
        detail.clientY === undefined
      ) {
        setDropTargetAppId(null);
        return;
      }
      const hits = document.elementsFromPoint(detail.clientX, detail.clientY);
      const dockEl = hits.find((el) => el.hasAttribute("data-dock-app-id"));
      const hoveredId = dockEl?.getAttribute("data-dock-app-id") ?? null;
      setDropTargetAppId(hoveredId === "text-editor" ? hoveredId : null);
    };

    const handleFileDrop = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          appId?: string;
          item?: { kind?: string; path?: string };
        }>
      ).detail;
      setDropTargetAppId(null);
      if (
        detail?.appId === "text-editor" &&
        detail.item?.kind === "file" &&
        detail.item.path
      ) {
        launchApp("text-editor", { payload: detail.item.path });
      }
    };

    window.addEventListener("residence:file-drag", handleFileDrag);
    window.addEventListener("residence:file-drop-dock", handleFileDrop);
    return () => {
      window.removeEventListener("residence:file-drag", handleFileDrag);
      window.removeEventListener("residence:file-drop-dock", handleFileDrop);
    };
  }, [launchApp]);
  const [contextTarget, setContextTarget] = React.useState<
    { kind: "dock" } | { kind: "trash" } | { kind: "app"; appId: string }
  >({ kind: "dock" });
  const didReorderRef = React.useRef(false);
  const dockTilesRef = React.useRef<Map<string, HTMLElement>>(new Map());
  const activeDockSize = dragDockSize ?? settings.dockSize;
  const dockPosition = settings.dockPosition ?? "bottom";
  const isVerticalDock = dockPosition === "left" || dockPosition === "right";
  const effectivePinnedIds = dragPinnedOrder ?? settings.pinnedAppIds;
  const trashPaths = React.useMemo(() => resolveXdgTrashPaths(), []);

  const refreshTrashStatus = React.useCallback(async () => {
    if (isBrowserRuntime) {
      const items = listVfsDir(WEB_VFS_TRASH);
      setTrashEmpty(items.length === 0);
      setTrashCount(items.length);
      return;
    }
    const status = await inspectXdgTrash(domicile.files, ".local/share/Trash/files");
    setTrashEmpty(status.empty);
    setTrashCount(status.itemCount);
  }, [domicile.files, isBrowserRuntime]);

  React.useEffect(() => {
    void refreshTrashStatus();
    if (isBrowserRuntime) {
      return subscribeWebVfs(() => {
        void refreshTrashStatus();
      });
    }
    let active = true;
    const onFocus = () => {
      if (active) void refreshTrashStatus();
    };
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => {
      if (active) void refreshTrashStatus();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [isBrowserRuntime, refreshTrashStatus]);

  const resolveAppDefinition = React.useCallback(
    (appId: string): AppDefinition | null => {
      const catalogMatch = APP_CATALOG.find((a) => a.id === appId);
      if (catalogMatch) return catalogMatch;

      const xdgMatch = installedXdgApps.find(
        (e) =>
          e.appId === appId ||
          e.desktopId === appId ||
          e.appId.toLowerCase() === appId.toLowerCase()
      );
      if (xdgMatch) {
        const visual = resolveXdgVisualStyle(xdgMatch);
        return {
          id: xdgMatch.appId,
          name: xdgMatch.name,
          shortName: xdgMatch.name,
          description: xdgMatch.comment ?? "Installed Application",
          category: "Utilities",
          iconName:
            visual.iconName === "notes" ? "file-text" : visual.iconName,
          iconUrl: xdgMatch.iconUrl ?? getAppIconUrl(xdgMatch.appId),
          gradient: visual.gradient,
          pinnedByDefault: false,
          defaultSize: { width: 740, height: 480 },
          menus: [],
        };
      }

      const winMatch = windows.find((w) => w.appId === appId);
      if (winMatch) {
        const isWebApp = Boolean(winMatch.browserWindowId);
        return {
          id: winMatch.appId,
          name: winMatch.title,
          shortName: winMatch.title,
          description: "Running Application",
          category: "Utilities",
          iconName: (winMatch.iconName as AppDefinition["iconName"]) || "sparkles",
          iconUrl:
            winMatch.iconUrl ??
            (isWebApp ? undefined : getAppIconUrl(winMatch.appId)),
          isWebApp,
          gradient: winMatch.gradient || "from-violet-500 to-indigo-600",
          pinnedByDefault: false,
          defaultSize: { width: 720, height: 480 },
          menus: [],
        };
      }

      return null;
    },
    [getAppIconUrl, installedXdgApps, windows]
  );

  const firstSeenOrderRef = React.useRef<Map<string, number>>(new Map());
  const nextSeenCounterRef = React.useRef(0);

  // Build list of Dock apps: pinned apps + launching apps + running apps
  const dockApps = React.useMemo<AppDefinition[]>(() => {
    const pinnedDefs = effectivePinnedIds
      .filter((id) => !isBrowserRuntime || id !== "browser")
      .map((id) => resolveAppDefinition(id))
      .filter((a): a is AppDefinition => Boolean(a));

    const seenSet = new Set(pinnedDefs.map((a) => a.id));
    const extras: AppDefinition[] = [];

    for (const appId of launchingApps) {
      if (!seenSet.has(appId)) {
        const def = resolveAppDefinition(appId);
        if (def) {
          seenSet.add(def.id);
          extras.push(def);
        }
      }
    }

    for (const win of windows) {
      if (!seenSet.has(win.appId)) {
        seenSet.add(win.appId);
        const def = resolveAppDefinition(win.appId);
        if (def) {
          extras.push(def);
        }
      }
    }

    const orderMap = firstSeenOrderRef.current;
    const activeExtraIds = new Set(extras.map((a) => a.id));
    for (const key of Array.from(orderMap.keys())) {
      if (!activeExtraIds.has(key)) {
        orderMap.delete(key);
      }
    }
    for (const app of extras) {
      if (!orderMap.has(app.id)) {
        orderMap.set(app.id, nextSeenCounterRef.current++);
      }
    }
    extras.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
    );

    return [...pinnedDefs, ...extras];
  }, [effectivePinnedIds, isBrowserRuntime, launchingApps, resolveAppDefinition, windows]);

  const startPinnedReorder = (
    appId: string,
    event: React.PointerEvent<HTMLElement>
  ) => {
    if (event.button !== 0 || !settings.pinnedAppIds.includes(appId)) return;
    const startCoord = isVerticalDock ? event.clientY : event.clientX;
    let engaged = false;
    let latestOrder = [...settings.pinnedAppIds];

    const onMove = (moveEvent: PointerEvent) => {
      const pointerCoord = isVerticalDock ? moveEvent.clientY : moveEvent.clientX;
      if (!engaged) {
        if (Math.abs(pointerCoord - startCoord) < 6) return;
        engaged = true;
        didReorderRef.current = true;
        setDraggingAppId(appId);
        setDragPinnedOrder(latestOrder);
      }

      const slots: { id: string; mid: number }[] = [];
      for (const id of latestOrder) {
        const tileEl = dockTilesRef.current.get(id);
        if (!tileEl) continue;
        const rect = tileEl.getBoundingClientRect();
        if (rect.width <= 0) continue;
        slots.push({
          id,
          mid: isVerticalDock
            ? rect.top + rect.height / 2
            : rect.left + rect.width / 2,
        });
      }
      if (slots.length < 2) return;

      const others = slots.filter((s) => s.id !== appId);
      let targetIdx = others.length;
      for (let i = 0; i < others.length; i++) {
        if (pointerCoord < others[i].mid) {
          targetIdx = i;
          break;
        }
      }

      const nextOrder = others.map((s) => s.id);
      nextOrder.splice(targetIdx, 0, appId);
      if (nextOrder.some((id, idx) => id !== latestOrder[idx])) {
        latestOrder = nextOrder;
        setDragPinnedOrder(nextOrder);
      }
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };

    const onEnd = () => {
      cleanup();
      if (engaged) {
        setDraggingAppId(null);
        setDragPinnedOrder(null);
        updateSettings({ pinnedAppIds: latestOrder });
        requestAnimationFrame(() => {
          didReorderRef.current = false;
        });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

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
    const visibleWins = appWins
      .filter((w) => !w.minimized)
      .sort((a, b) => b.zIndex - a.zIndex);
    if (visibleWins.length === 0) {
      const topMinimized = [...appWins].sort((a, b) => b.zIndex - a.zIndex)[0];
      focusWindow(topMinimized.id);
    } else if (visibleWins[0].id === focusedWindowId) {
      toggleMinimizeWindow(visibleWins[0].id);
    } else {
      focusWindow(visibleWins[0].id);
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

  const handleTrashInfo = () => {
    if (isBrowserRuntime) {
      launchApp("nautilus", { payload: WEB_VFS_TRASH });
      return;
    }
    pushNotification({
      appName: "Trash",
      summary: trashEmpty ? "Trash is Empty" : `Trash (${trashCount} items)`,
      body: trashEmpty
        ? "No deleted files in ~/.local/share/Trash."
        : "Right-click Trash and choose Empty Trash to permanently delete items.",
    });
  };

  const handleEmptyTrash = async () => {
    if (isBrowserRuntime) {
      emptyVfsTrash();
      await refreshTrashStatus();
      return;
    }
    await emptyXdgTrash(domicile.processes, trashPaths);
    await refreshTrashStatus();
  };

  const contextApp =
    contextTarget.kind === "app"
      ? dockApps.find((a) => a.id === contextTarget.appId)
      : undefined;
  const contextAppWins = contextApp
    ? windows.filter((w) => w.appId === contextApp.id)
    : [];
  const contextAppRunning = contextAppWins.length > 0;
  const contextAppPinned = contextApp
    ? settings.pinnedAppIds.includes(contextApp.id)
    : false;

  const handleDockContextCapture = (e: React.MouseEvent) => {
    const raw = (e.target as HTMLElement | null)
      ?.closest<HTMLElement>("[data-dock-context]")
      ?.getAttribute("data-dock-context");
    if (raw === "trash") {
      setContextTarget({ kind: "trash" });
    } else if (raw?.startsWith("app:")) {
      setContextTarget({ kind: "app", appId: raw.slice(4) });
    } else {
      setContextTarget({ kind: "dock" });
    }
  };

  const dockWrapperClass =
    dockPosition === "left"
      ? "pointer-events-none fixed inset-y-0 left-0 z-[100] flex flex-row items-center"
      : dockPosition === "right"
        ? "pointer-events-none fixed inset-y-0 right-0 z-[100] flex flex-row-reverse items-center"
        : "pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center";

  return (
    <div className={dockWrapperClass}>
      <ContextMenu>
        <ContextMenuTrigger
          onContextMenuCapture={handleDockContextCapture}
          render={
            <DockSurface
              size={activeDockSize}
              position={dockPosition}
              magnification={
                settings.dockMagnification && !resizingDock && !draggingAppId
                  ? Math.max(settings.dockMagnificationSize, activeDockSize + 12)
                  : undefined
              }
              autoHide={settings.dockAutoHide}
              hidden={!entered}
              resizing={resizingDock || draggingAppId !== null}
              className="pointer-events-auto"
            />
          }
        >
          {/* Launcher Quick Tile (3x3 App Grid from XDG Icon Theme) */}
          <DockItem
            label="Launcher (Alt+Space)"
            onClick={() => setLauncherOpen(true)}
          >
            {(() => {
              const appGridIconUrl = getAppIconUrl("__app_grid__");
              if (appGridIconUrl) {
                return (
                  <img
                    src={appGridIconUrl}
                    alt=""
                    draggable={false}
                    className={`pointer-events-none size-full shrink-0 object-contain select-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.28)] ${appGridIsSymbolic ? "opacity-90 dark:invert" : ""
                      }`}
                  />
                );
              }
              return (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="size-full text-adw-label opacity-85"
                >
                  <rect x="3" y="3" width="4.5" height="4.5" rx="1.2" />
                  <rect x="9.75" y="3" width="4.5" height="4.5" rx="1.2" />
                  <rect x="16.5" y="3" width="4.5" height="4.5" rx="1.2" />
                  <rect x="3" y="9.75" width="4.5" height="4.5" rx="1.2" />
                  <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1.2" />
                  <rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1.2" />
                  <rect x="3" y="16.5" width="4.5" height="4.5" rx="1.2" />
                  <rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1.2" />
                  <rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1.2" />
                </svg>
              );
            })()}
          </DockItem>

          {/* Pinned, Launching & Running Applications */}
          {dockApps.map((app) => {
            const appWins = windows.filter((w) => w.appId === app.id);
            const isRunning = appWins.length > 0;
            const isLaunching = !isRunning && launchingApps.includes(app.id);
            const isPinned = settings.pinnedAppIds.includes(app.id);

            return (
              <DockItem
                key={app.id}
                label={app.name}
                running={isRunning}
                runningCount={appWins.length}
                launching={isLaunching}
                tileRef={(node) => {
                  registerDockRef(app.id, node);
                  if (node) {
                    dockTilesRef.current.set(app.id, node);
                  } else {
                    dockTilesRef.current.delete(app.id);
                  }
                }}
                tileProps={{
                  "data-dock-context": `app:${app.id}`,
                  "data-dock-pinned-id": isPinned ? app.id : undefined,
                  "data-dock-app-id": app.id,
                  onPointerDown: (e) => {
                    if (isPinned) startPinnedReorder(app.id, e);
                  },
                  onClickCapture: (e) => {
                    if (didReorderRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  },
                }}
                className={
                  draggingAppId === app.id
                    ? "z-10 scale-105 opacity-75"
                    : dropTargetAppId === app.id
                      ? "scale-110 rounded-xl bg-adw-accent/20 ring-2 ring-adw-accent/80 transition-transform"
                      : undefined
                }
                onClick={() => handleDockAppClick(app.id)}
              >
                <AppSquircleIcon
                  iconName={app.iconName}
                  iconUrl={app.iconUrl ?? getAppIconUrl(app.id)}
                  fallbackIconUrl={
                    app.isWebApp ? getAppIconUrl("browser") : undefined
                  }
                  squircle={app.isWebApp}
                  gradient={app.gradient}
                  className="size-full"
                  glyphClassName="size-[56%]"
                />
              </DockItem>
            );
          })}

          {/* Trash Separator (drag up/down to resize Dock) & XDG Trash Icon */}
          <DockSeparator
            resizable
            resizeSize={activeDockSize}
            minSize={24}
            maxSize={72}
            onResizingChange={(dragging) => {
              setResizingDock(dragging);
              if (!dragging) setDragDockSize(null);
            }}
            onResize={(next) => setDragDockSize(next)}
            onResizeCommit={(finalSize) => {
              setDragDockSize(null);
              updateSettings({ dockSize: finalSize });
            }}
          />

          <DockItem
            label={trashEmpty ? "Trash (Empty)" : `Trash (${trashCount})`}
            tileProps={{
              "data-dock-context": "trash",
              "data-vfs-drop-path": WEB_VFS_TRASH,
            }}
            onClick={handleTrashInfo}
          >
            <AppSquircleIcon
              iconUrl={getAppIconUrl(
                trashEmpty ? "__user_trash__" : "__user_trash_full__"
              )}
              className="size-full"
            />
          </DockItem>
        </ContextMenuTrigger>

        <ContextMenuContent
          className={cn(
            "w-max",
            contextApp
              ? "min-w-52"
              : contextTarget.kind === "trash"
                ? "min-w-48"
                : "min-w-56"
          )}
        >
          {contextApp ? (
            <>
              <ContextMenuItem onClick={() => handleDockAppClick(contextApp.id)}>
                {contextAppRunning
                  ? `Show ${contextApp.shortName}`
                  : `Open ${contextApp.shortName}`}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  if (contextApp.id.startsWith("webview:")) {
                    setLauncherOpen(true);
                    return;
                  }
                  const xdgEntry = installedXdgApps.find(
                    (e) =>
                      e.appId === contextApp.id || e.desktopId === contextApp.id
                  );
                  if (xdgEntry) {
                    launchXdgApp(xdgEntry);
                  } else {
                    launchApp(contextApp.id, { forceNew: true });
                  }
                }}
              >
                New Window
              </ContextMenuItem>
              {!contextApp.id.startsWith("webview:") && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => togglePinApp(contextApp.id)}>
                    {contextAppPinned ? "Remove from Dock" : "Keep in Dock"}
                  </ContextMenuItem>
                </>
              )}
              {contextAppRunning && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      for (const w of contextAppWins) {
                        toggleMinimizeWindow(w.id);
                      }
                    }}
                  >
                    {contextAppWins.every((w) => w.minimized)
                      ? "Restore All"
                      : "Minimize"}
                  </ContextMenuItem>
                  {altPressed ? (
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => forceQuitApp(contextApp.id)}
                    >
                      Force Quit {contextApp.shortName}
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem
                      onClick={() => {
                        for (const w of contextAppWins) {
                          closeWindow(w.id);
                        }
                      }}
                    >
                      Quit {contextApp.shortName}
                    </ContextMenuItem>
                  )}
                </>
              )}
            </>
          ) : contextTarget.kind === "trash" ? (
            <ContextMenuItem
              disabled={trashEmpty}
              variant={altPressed ? "destructive" : "default"}
              onClick={() => void handleEmptyTrash()}
            >
              Empty Trash
            </ContextMenuItem>
          ) : (
            <>
              <ContextMenuCheckboxItem
                checked={settings.dockAutoHide}
                onClick={() =>
                  updateSettings({ dockAutoHide: !settings.dockAutoHide })
                }
              >
                Hide
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                checked={settings.dockMagnification}
                onClick={() =>
                  updateSettings({
                    dockMagnification: !settings.dockMagnification,
                  })
                }
              >
                Zoom
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                inset
                onClick={() => launchApp("settings", { payload: "dock" })}
              >
                Dock Settings…
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
