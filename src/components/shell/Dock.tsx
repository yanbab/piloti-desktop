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
import {
  getHostnameFallbackTitle,
  getWebAppFaviconUrl,
} from "@/data/web-apps";
import { useAltKey } from "@/hooks/use-alt-key";
import {
  emptyXdgTrash,
  inspectXdgTrash,
  resolveXdgTrashPaths,
} from "@/lib/xdg/xdg-trash";
import {
  emptyVfsTrash,
  listVfsDir,
  subscribeWebVfs,
  WEB_VFS_TRASH,
} from "@/lib/engine-web/web-vfs";
import {
  SIMULATED_USB_LABEL,
  SIMULATED_USB_PATH,
  unmountSimulatedUsb,
  useSimulatedUsbMounted,
} from "@/lib/engine-web/usb-drive";
import { _ } from "@/lib/core/i18n";
import { captureLaunchOriginFromElement } from "@/lib/shell/launch-origin";
import { cn } from "@/lib/core/utils";
import {
  setXdgAppUrgent,
  useXdgAppBadgeCounts,
  useXdgAppProgress,
  useXdgAppUrgent,
} from "@/lib/xdg/xdg-badge-count";
import {
  addDockFolder,
  dockFolderLabel,
  effectiveDockFolders,
  normalizeDockFolderPath,
  removeDockFolder,
  resolveDefaultDockFolders,
} from "@/lib/shell/dock-folders";
import { DockFolderStack } from "./DockFolderStack";
import { AppSquircleIcon } from "./AppSymbol";

export function Dock() {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const {
    installedXdgApps,
    getAppIconUrl,
    appGridIsSymbolic,
    dockIconsReady,
    xdgUserDirs,
  } = useApps();
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

  const [openStack, setOpenStack] = React.useState<{
    path: string;
    anchor: DOMRect;
  } | null>(null);
  const dockFolders = React.useMemo(
    () =>
      effectiveDockFolders(
        settings.dockFolders,
        resolveDefaultDockFolders(xdgUserDirs, isBrowserRuntime)
      ),
    [settings.dockFolders, xdgUserDirs, isBrowserRuntime]
  );
  const dockFoldersRef = React.useRef(dockFolders);
  dockFoldersRef.current = dockFolders;
  const addFolderToDock = React.useCallback(
    (path: string) => {
      updateSettings({ dockFolders: addDockFolder(dockFoldersRef.current, path) });
    },
    [updateSettings]
  );
  const removeFolderFromDock = React.useCallback(
    (path: string) => {
      setOpenStack((cur) => (cur?.path === path ? null : cur));
      updateSettings({
        dockFolders: removeDockFolder(dockFoldersRef.current, path),
      });
    },
    [updateSettings]
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
      setDropTargetAppId(
        hoveredId === "text-editor" ||
          hoveredId === "image-viewer" ||
          hoveredId === "nautilus"
          ? hoveredId
          : null
      );
    };

    const handleFileDrop = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          appId?: string;
          item?: { kind?: string; path?: string; name?: string };
          items?: Array<{ kind?: string; path?: string; name?: string }>;
        }>
      ).detail;
      setDropTargetAppId(null);
      const droppedItems = detail?.items?.length
        ? detail.items
        : detail?.item
          ? [detail.item]
          : [];
      for (const item of droppedItems) {
        if (!item.path) continue;
        if (detail?.appId === "text-editor" && item.kind === "file") {
          launchApp("text-editor", { payload: item.path });
        } else if (
          detail?.appId === "image-viewer" &&
          item.kind === "file" &&
          /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(item.name ?? item.path)
        ) {
          launchApp("image-viewer", { payload: item.path });
        } else if (detail?.appId === "nautilus" && item.kind === "directory") {
          launchApp("nautilus", { payload: item.path, forceNew: true });
        } else if (detail?.appId === "__dock__" && item.kind === "directory") {
          addFolderToDock(item.path);
        }
      }
    };

    window.addEventListener("residence:file-drag", handleFileDrag);
    window.addEventListener("residence:file-drop-dock", handleFileDrop);
    return () => {
      window.removeEventListener("residence:file-drag", handleFileDrag);
      window.removeEventListener("residence:file-drop-dock", handleFileDrop);
    };
  }, [addFolderToDock, launchApp]);
  const [contextTarget, setContextTarget] = React.useState<
    { kind: "dock" } | { kind: "trash" } | { kind: "usb" } | { kind: "app"; appId: string } | { kind: "folder"; path: string }
  >({ kind: "dock" });
  const usbMounted = useSimulatedUsbMounted();
  const xdgBadgeCounts = useXdgAppBadgeCounts();
  const xdgProgress = useXdgAppProgress();
  const xdgUrgent = useXdgAppUrgent();
  const [usbRenderMounted, setUsbRenderMounted] = React.useState(usbMounted);
  const [usbAnimState, setUsbAnimState] = React.useState<
    "entering" | "idle" | "exiting"
  >("idle");
  const [usbPlayNonce, setUsbPlayNonce] = React.useState(0);
  const prevUsbMountedRef = React.useRef(usbMounted);

  React.useEffect(() => {
    if (prevUsbMountedRef.current === usbMounted) return;
    prevUsbMountedRef.current = usbMounted;
    let timer = 0;
    let raf = 0;
    if (usbMounted) {
      setUsbRenderMounted(true);
      setUsbAnimState("entering");
      setUsbPlayNonce((n) => n + 1);
      raf = window.requestAnimationFrame(() => {
        setUsbAnimState("idle");
      });
    } else {
      setUsbAnimState("exiting");
      setUsbPlayNonce((n) => n + 1);
      timer = window.setTimeout(() => {
        setUsbRenderMounted(false);
        setUsbAnimState("idle");
      }, 480);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [usbMounted]);
  const didReorderRef = React.useRef(false);
  const dockTilesRef = React.useRef<Map<string, HTMLElement>>(new Map());
  const dockPosition = settings.dockPosition ?? "bottom";
  const isVerticalDock = dockPosition === "left" || dockPosition === "right";
  const effectivePinnedIds = dragPinnedOrder ?? settings.pinnedAppIds;
  const [viewportSize, setViewportSize] = React.useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));
  React.useEffect(() => {
    const onResize = () =>
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const totalSlots = Math.max(1, effectivePinnedIds.length + dockFolders.length + 3);
  const availableSpan = isVerticalDock
    ? viewportSize.height - 96
    : viewportSize.width - 48;
  const maxDockSizeForSpace = Math.max(
    18,
    Math.min(96, Math.floor(availableSpan / totalSlots) - 10),
  );
  const activeDockSize = Math.min(
    96,
    Math.max(18, dragDockSize ?? settings.dockSize),
    maxDockSizeForSpace,
  );
  const trashPaths = React.useMemo(() => resolveXdgTrashPaths(), []);

  const refreshTrashStatus = React.useCallback(async () => {
    if (isBrowserRuntime) {
      const items = listVfsDir(WEB_VFS_TRASH);
      setTrashEmpty(items.length === 0);
      return;
    }
    const status = await inspectXdgTrash(domicile.files, ".local/share/Trash/files");
    setTrashEmpty(status.empty);
  }, [domicile.files, isBrowserRuntime]);

  React.useEffect(() => {
    void refreshTrashStatus();
    if (isBrowserRuntime) {
      return subscribeWebVfs(
        () => {
          void refreshTrashStatus();
        },
        { path: WEB_VFS_TRASH, mode: "children" },
      );
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

      const webMatch = (settings.installedWebApps ?? []).find(
        (a) => a.id === appId
      );
      if (webMatch) {
        return {
          id: webMatch.id,
          name: webMatch.title,
          shortName: webMatch.title,
          description: webMatch.url,
          category: "Utilities",
          iconName: "globe",
          iconUrl: webMatch.iconUrl || getWebAppFaviconUrl(webMatch.url),
          isWebApp: true,
          gradient: "from-cyan-400 via-blue-500 to-indigo-600",
          pinnedByDefault: false,
          defaultSize: { width: 1040, height: 720 },
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

      if (appId.startsWith("webview:")) {
        const rawUrl = appId.slice("webview:".length);
        const title = getHostnameFallbackTitle(rawUrl) || "Web View";
        return {
          id: appId,
          name: title,
          shortName: title,
          description: rawUrl,
          category: "Utilities",
          iconName: "globe",
          iconUrl: getWebAppFaviconUrl(rawUrl),
          isWebApp: true,
          gradient: "from-cyan-400 via-blue-500 to-indigo-600",
          pinnedByDefault: false,
          defaultSize: { width: 1040, height: 720 },
          menus: [],
        };
      }

      return null;
    },
    [getAppIconUrl, installedXdgApps, settings.installedWebApps, windows]
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

  const focusedAppId = windows.find((w) => w.id === focusedWindowId)?.appId;
  React.useEffect(() => {
    if (focusedAppId && xdgUrgent[focusedAppId.toLowerCase()]) {
      setXdgAppUrgent(focusedAppId, false);
    }
  }, [focusedAppId, xdgUrgent]);

  const [launchNonces, setLaunchNonces] = React.useState<Record<string, number>>({});
  const handleDockAppClick = (appId: string) => {
    setXdgAppUrgent(appId, false);
    const appWins = windows.filter((w) => w.appId === appId);
    if (appWins.length === 0) {
      setLaunchNonces((prev) => ({ ...prev, [appId]: (prev[appId] ?? 0) + 1 }));
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
    const orderedWins = [...appWins].sort((a, b) => a.zIndex - b.zIndex);
    const visibleWins = orderedWins.filter((w) => !w.minimized);
    if (visibleWins.length === 0) {
      for (const win of orderedWins) {
        focusWindow(win.id);
      }
    } else if (visibleWins.some((w) => w.id === focusedWindowId)) {
      for (const win of visibleWins) {
        toggleMinimizeWindow(win.id);
      }
    } else {
      for (const win of orderedWins) {
        focusWindow(win.id);
      }
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

  const handleOpenTrash = () => {
    launchApp("nautilus", {
      payload: isBrowserRuntime ? WEB_VFS_TRASH : "trash:///",
    });
  };

  const handleOpenUsb = () => {
    launchApp("nautilus", {
      payload: SIMULATED_USB_PATH,
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
    } else if (raw === "usb") {
      setContextTarget({ kind: "usb" });
    } else if (raw?.startsWith("folder:")) {
      setContextTarget({ kind: "folder", path: raw.slice(7) });
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
              data-dock-app-id="__dock__"
            />
          }
        >
          {/* Launcher Quick Tile (3x3 App Grid from XDG Icon Theme) */}
          <DockItem
            label={_("Launcher (Alt+Space)")}
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
                    className={`pointer-events-none size-full shrink-0 object-contain select-none ${appGridIsSymbolic ? "opacity-90 dark:invert" : ""
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
            const readyWins = appWins.filter((w) => w.ready !== false);
            const hasUnreadyWin = appWins.some((w) => w.ready === false);
            const isRunning = readyWins.length > 0;
            const isLaunching = launchingApps.includes(app.id) || hasUnreadyWin;
            const isPinned = settings.pinnedAppIds.includes(app.id);

            return (
              <DockItem
                key={app.id}
                label={_(app.name)}
                running={isRunning}
                runningCount={readyWins.length}
                launching={isLaunching}
                urgent={Boolean(
                  xdgUrgent[app.id.toLowerCase()] ||
                    (app.command && xdgUrgent[app.command.toLowerCase()])
                )}
                progress={(() => {
                  const key = app.id.toLowerCase();
                  if (key in xdgProgress) return xdgProgress[key];
                  const cmd = app.command?.toLowerCase();
                  if (cmd && cmd in xdgProgress) return xdgProgress[cmd];
                  return undefined;
                })()}
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
                  onAuxClick: (e) => {
                    if (e.button === 1 && isRunning) {
                      e.preventDefault();
                      e.stopPropagation();
                      const targetWin =
                        appWins.find((w) => w.id === focusedWindowId) ??
                        appWins[appWins.length - 1];
                      if (targetWin) closeWindow(targetWin.id);
                    }
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
                onClick={(e) => {
                  captureLaunchOriginFromElement(e.currentTarget);
                  handleDockAppClick(app.id);
                }}
              >
                <div className="relative size-full">
                  <AppSquircleIcon
                    iconName={app.iconName}
                    iconUrl={app.iconUrl ?? getAppIconUrl(app.id)}
                    fallbackIconUrl={
                      app.isWebApp ? getAppIconUrl("browser") : undefined
                    }
                    squircle={app.isWebApp}
                    gradient={app.gradient}
                    playNonce={launchNonces[app.id]}
                    className="size-full"
                    glyphClassName="size-[56%]"
                  />
                  {(() => {
                    const badge =
                      xdgBadgeCounts[app.id.toLowerCase()] ??
                      (app.command
                        ? xdgBadgeCounts[app.command.toLowerCase()]
                        : undefined);
                    if (!badge || !badge.visible || badge.count <= 0) return null;
                    return (
                      <span
                        aria-label={`${badge.count} updates`}
                        className="pointer-events-none absolute -top-1 -right-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold text-white shadow-sm ring-1 ring-black/15 tabular-nums"
                      >
                        {badge.count > 99 ? "99+" : badge.count}
                      </span>
                    );
                  })()}
                </div>
              </DockItem>
            );
          })}

          {/* Trash Separator (drag up/down to resize Dock) & XDG Trash Icon */}
          <DockSeparator
            resizable
            resizeSize={activeDockSize}
            minSize={18}
            maxSize={maxDockSizeForSpace}
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

          {dockFolders.map((folderPath) => {
            const label = dockFolderLabel(folderPath);
            const stackOpen = openStack?.path === folderPath;
            const folderKey = `folder:${folderPath}`;
            const progressKey = folderKey.toLowerCase();
            return (
              <DockItem
                key={folderKey}
                label={stackOpen ? undefined : label}
                tileProps={{
                  "data-dock-context": folderKey,
                  "data-dock-folder-path": folderPath,
                  "data-vfs-drop-path": folderPath,
                }}
                progress={
                  progressKey in xdgProgress ? xdgProgress[progressKey] : undefined
                }
                urgent={Boolean(xdgUrgent[progressKey])}
                onClick={(e) => {
                  const tile = e.currentTarget.parentElement ?? e.currentTarget;
                  setXdgAppUrgent(folderKey, false);
                  setOpenStack(
                    stackOpen
                      ? null
                      : { path: folderPath, anchor: tile.getBoundingClientRect() }
                  );
                }}
              >
                <AppSquircleIcon
                  iconUrl={getAppIconUrl("folder")}
                  iconName="folder"
                  open={stackOpen}
                  className="size-full"
                />
              </DockItem>
            );
          })}

          {usbRenderMounted && (
            <DockItem
              label={SIMULATED_USB_LABEL}
              tileProps={{
                "data-dock-context": "usb",
                "data-vfs-drop-path": SIMULATED_USB_PATH,
                className: cn(
                  "transition-all duration-300 ease-out",
                  usbAnimState === "entering" && "scale-75 opacity-0",
                  usbAnimState === "idle" && "scale-100 opacity-100",
                  usbAnimState === "exiting" && "scale-75 -translate-y-1 opacity-0"
                ),
              }}
              onClick={(e) => {
                captureLaunchOriginFromElement(e.currentTarget);
                handleOpenUsb();
              }}
            >
              <AppSquircleIcon
                iconUrl={getAppIconUrl("__usb_drive__")}
                animateOnHover
                playNonce={usbPlayNonce}
                className="size-full"
              />
            </DockItem>
          )}

          <DockItem
            label={_("Trash")}
            tileProps={{
              "data-dock-context": "trash",
              "data-vfs-drop-path": WEB_VFS_TRASH,
            }}
            onClick={(e) => {
              captureLaunchOriginFromElement(e.currentTarget);
              handleOpenTrash();
            }}
          >
            <AppSquircleIcon
              iconUrl={getAppIconUrl(
                trashEmpty ? "__user_trash__" : "__user_trash_full__"
              )}
              open={false}
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
          {contextTarget.kind === "folder" ? (
            <>
              <ContextMenuItem
                onClick={() =>
                  launchApp("nautilus", {
                    payload: contextTarget.path,
                    forceNew: true,
                  })
                }
              >
                {_("Open in Folders")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => removeFolderFromDock(contextTarget.path)}
              >
                {_("Remove from Dock")}
              </ContextMenuItem>
            </>
          ) : contextApp ? (
            <>
              <ContextMenuItem onClick={() => handleDockAppClick(contextApp.id)}>
                {contextAppRunning
                  ? _("Show %s", _(contextApp.shortName))
                  : _("Open %s", _(contextApp.shortName))}
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
                {_("New Window")}
              </ContextMenuItem>
              {!contextApp.id.startsWith("webview:") && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => togglePinApp(contextApp.id)}>
                    {contextAppPinned ? _("Remove from Dock") : _("Keep in Dock")}
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
                      ? _("Restore All")
                      : _("Minimize")}
                  </ContextMenuItem>
                  {altPressed ? (
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => forceQuitApp(contextApp.id)}
                    >
                      {_("Force Quit %s", _(contextApp.shortName))}
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem
                      onClick={() => {
                        for (const w of contextAppWins) {
                          closeWindow(w.id);
                        }
                      }}
                    >
                      {_("Quit %s", _(contextApp.shortName))}
                    </ContextMenuItem>
                  )}
                </>
              )}
            </>
          ) : contextTarget.kind === "trash" ? (
            <>
              <ContextMenuItem onClick={handleOpenTrash}>
                {_("Open Trash")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={trashEmpty}
                onClick={() => void handleEmptyTrash()}
              >
                {_("Empty Trash")}
              </ContextMenuItem>
            </>
          ) : contextTarget.kind === "usb" ? (
            <>
              <ContextMenuItem onClick={handleOpenUsb}>
                {_("Open USB Drive")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={unmountSimulatedUsb}>
                {_("Eject")}
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuCheckboxItem
                checked={settings.dockAutoHide}
                closeOnClick
                onClick={() =>
                  updateSettings({ dockAutoHide: !settings.dockAutoHide })
                }
              >
                {_("Hide")}
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                checked={settings.dockMagnification}
                closeOnClick
                onClick={() =>
                  updateSettings({
                    dockMagnification: !settings.dockMagnification,
                  })
                }
              >
                {_("Zoom")}
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                inset
                onClick={() => launchApp("settings", { payload: "dock" })}
              >
                {_("Dock Settings…")}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {openStack && (
        <DockFolderStack
          path={openStack.path}
          anchor={openStack.anchor}
          dockPosition={dockPosition}
          onClose={() => setOpenStack(null)}
        />
      )}
    </div>
  );
}
