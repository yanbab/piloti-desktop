import * as React from "react";
import { useDisplays } from "@domicile-desktop/react/displays";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { AppReuse } from "@domicile-desktop/sdk/desktop/browser";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { useFocusedWindow, useWindows } from "@domicile-desktop/react/windows";
import {
  type WindowRequest,
  WindowRequestKind,
  WindowState,
} from "@domicile-desktop/sdk/window-state";
import {
  APP_CATALOG,
  type AppDefinition,
  type BuiltinAppId,
} from "@/data/catalog";
import {
  canonicalizeWebUrl,
  findMatchingWebApp,
  getWebAppFaviconUrl,
  resolveWebAppTitle,
} from "@/data/web-apps";
import {
  DOCUMENT_SCOPED_APP_IDS,
  lookupSpatialWindowBounds,
  resolveSpatialBoundsKey,
} from "@/lib/shell/spatial-window-bounds";
import {
  type GnomeSettingsPanel,
  launchDesktopCommand,
  openGnomeControlCenter,
} from "@/lib/engine-native";
import {
  matchXdgEntryForWaylandWindow,
  resolveWaylandClientFrame,
  type XdgDesktopEntry,
} from "xdg-desktop-entry";
import {
  clearXdgSession,
  loadXdgSession,
  saveXdgSession,
  serializeWindowToXdgSession,
  type XdgSessionWindow,
} from "@/lib/xdg/xdg-session-management";
import {
  clampWindowBounds,
  clampWorkspace,
  resolveWaylandOuterConstraints,
} from "@/lib/shell/window-bounds";
import {
  buildVfsEntryWebAppUrl,
  getVfsEntry,
  isImageVfsFile,
  isTextEditableVfsFile,
} from "@/lib/engine-web/web-vfs";
import { type AppsContextValue, matchAppFromWayland } from "./AppsContext";
import { type SettingsContextValue } from "./SettingsContext";
import { type SystemBackendsContextValue } from "./SystemBackendsContext";
import { useGlobalAppMenu } from "./windows/useGlobalAppMenu";
import { useGlobalShortcuts } from "./windows/useGlobalShortcuts";

export interface DesktopWindowInstance {
  id: string;
  appId: string;
  title: string;
  iconName: string;
  iconUrl?: string;
  gradient: string;
  builtinComponent?: BuiltinAppId;
  waylandAppId?: string;
  waylandDesktopId?: string;
  browserWindowId?: string;
  browserUrl?: string;
  browserIsApp?: boolean;
  clientFrame?: boolean;
  cursor?: string;
  syncedFrame?: number;
  tiled?: "left" | "right" | null;
  workspace: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize?: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
  fullscreen?: boolean;
  pinned?: boolean;
  ready?: boolean;
  zIndex: number;
  payload?: string;
}

export interface ResolvedPopupWindow {
  appId: string;
  parentToplevelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frame: number;
  cursor?: string;
  zIndex: number;
}

export interface WindowsContextValue {
  windows: DesktopWindowInstance[];
  workspaceWindows: DesktopWindowInstance[];
  waylandPopups: ResolvedPopupWindow[];
  focusedWindowId: string | null;
  focusedWindow: DesktopWindowInstance | undefined;
  clearFocusedWindow: () => void;
  activeAppDef: AppDefinition;
  mruWindows: DesktopWindowInstance[];
  launchingApps: string[];
  markWindowReady: (windowId: string) => void;
  launchApp: (
    appId: string,
    options?: { payload?: string; forceNew?: boolean; forceCsd?: boolean }
  ) => void;
  launchXdgApp: (entry: XdgDesktopEntry, actionId?: string) => void;
  openGnomeSettings: (panel?: GnomeSettingsPanel | (string & {})) => void;
  openWebUrl: (
    rawUrl: string,
    options?: { asApp?: boolean; appId?: string; title?: string }
  ) => void;
  setBrowserFavicon: (browserWindowId: string, favicon: string) => void;
  setBrowserTitle: (browserWindowId: string, title: string) => void;
  focusWindow: (windowId: string) => void;
  closeWindow: (windowId: string) => void;
  forceQuitApp: (appId: string) => void;
  toggleMinimizeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  toggleMaximizeWindow: (windowId: string) => void;
  tileWindow: (windowId: string, side: "left" | "right" | "full") => void;
  updateWindowGeometry: (
    windowId: string,
    patch: {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
    }
  ) => void;
  handleMenuAction: (actionId: string) => void;
  launcherOpen: boolean;
  setLauncherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  controlPanelOpen: boolean;
  setControlPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aboutOpen: boolean;
  setAboutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  altTabOpen: boolean;
  altTabIndex: number;
  setAltTabIndex: React.Dispatch<React.SetStateAction<number>>;
  openAltTab: () => void;
  cycleAltTab: (delta: number) => void;
  commitAltTab: (explicitWindowId?: string) => void;
  closeAltTab: () => void;
  overviewOpen: boolean;
  setOverviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleOverview: () => void;
  moveWindowToWorkspace: (windowId: string, workspace: number) => void;
  removeWorkspace: (workspace: number) => void;
  registerDockRef: (appId: string, node: HTMLElement | null) => void;
  getDockRef: (appId: string) => React.RefObject<Element | null>;
  subscribeClientWindowRequest: (
    listener: (req: WindowRequest) => void
  ) => () => void;
}

export type WindowActionsValue = Pick<
  WindowsContextValue,
  | "launchApp"
  | "launchXdgApp"
  | "markWindowReady"
  | "openGnomeSettings"
  | "openWebUrl"
  | "focusWindow"
  | "closeWindow"
  | "forceQuitApp"
  | "toggleMinimizeWindow"
  | "minimizeWindow"
  | "toggleMaximizeWindow"
  | "tileWindow"
  | "updateWindowGeometry"
  | "handleMenuAction"
  | "setLauncherOpen"
  | "setControlPanelOpen"
  | "setAboutOpen"
  | "setOverviewOpen"
  | "toggleOverview"
  | "moveWindowToWorkspace"
  | "removeWorkspace"
>;

export const WindowsContext = React.createContext<WindowsContextValue | null>(null);
export const WindowActionsContext =
  React.createContext<WindowActionsValue | null>(null);

let nextZIndex = 20;
let nextShellWinCounter = 1;

interface ExternalWindowMeta {
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
  fullscreen?: boolean;
  pinned?: boolean;
  tiled?: "left" | "right" | null;
  zIndex: number;
  workspace: number;
}

/**
 * Normalizes a user-typed URL or host into a navigable URL string.
 */
export function normalizeWebUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

function patchExternalMeta(
  setMeta: React.Dispatch<
    React.SetStateAction<Record<string, ExternalWindowMeta>>
  >,
  rawId: string,
  updater: (cur: ExternalWindowMeta) => ExternalWindowMeta
) {
  setMeta((prev) => {
    const cur = prev[rawId];
    if (!cur) return prev;
    return { ...prev, [rawId]: updater(cur) };
  });
}

function computeCenteredOrCascadedPosition(
  existingPositions: Array<{ x: number; y: number }>,
  size: { width: number; height: number },
  screenWidth: number,
  screenHeight: number,
  rememberedPosition?: { x: number; y: number }
): { x: number; y: number } {
  if (existingPositions.length > 0) {
    const last = existingPositions[existingPositions.length - 1];
    return { x: last.x + 24, y: last.y + 24 };
  }
  if (rememberedPosition) {
    return rememberedPosition;
  }
  return {
    x: Math.max(0, Math.round((screenWidth - size.width) / 2)),
    y: Math.max(0, Math.round((screenHeight - 30 - size.height) / 2)),
  };
}

export function useWindowsValue(
  settingsCtx: SettingsContextValue,
  backendsCtx: SystemBackendsContextValue,
  appsCtx: AppsContextValue
): WindowsContextValue {
  const domicile = useDomicile();
  const displays = useDisplays();
  const waylandWindows = useWindows();
  const waylandFocused = useFocusedWindow();
  const browserWindows =
    useWatch(domicile.browser, "change", () => domicile.browser.windows) ?? [];

  const { isBrowserRuntime, settings, updateSettings } = settingsCtx;
  const { gnomeCapabilities, takeScreenshot } = backendsCtx;
  const {
    installedXdgApps,
    getAppIconUrl,
    ensureWaylandIcons,
    launchXdgEntry,
  } = appsCtx;

  const primaryDisplay = displays?.[0];
  const primaryMonitorName = primaryDisplay?.name ?? "primary";
  const screenWidth =
    primaryDisplay?.width ??
    (typeof window !== "undefined" ? window.innerWidth : 1440);
  const screenHeight =
    primaryDisplay?.height ??
    (typeof window !== "undefined" ? window.innerHeight : 900);

  const pendingSessionRestoreRef = React.useRef<Map<string, XdgSessionWindow>>(
    new Map()
  );
  const sessionHydratedRef = React.useRef(false);
  const clientWindowRequestListenersRef = React.useRef(
    new Set<(req: WindowRequest) => void>()
  );
  const subscribeClientWindowRequest = React.useCallback(
    (listener: (req: WindowRequest) => void) => {
      clientWindowRequestListenersRef.current.add(listener);
      return () => {
        clientWindowRequestListenersRef.current.delete(listener);
      };
    },
    []
  );

  const pendingWebTitlesRef = React.useRef<Map<string, string>>(new Map());
  const [launcherOpen, setLauncherOpen] = React.useState(false);

  React.useEffect(() => {
    const onOpenLauncher = () => setLauncherOpen(true);
    window.addEventListener("piloti:open-launcher", onOpenLauncher);
    return () =>
      window.removeEventListener("piloti:open-launcher", onOpenLauncher);
  }, []);
  const [controlPanelOpen, setControlPanelOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [overviewOpen, setOverviewOpen] = React.useState(false);
  const [altTabState, setAltTabState] = React.useState<{
    open: boolean;
    index: number;
  }>({ open: false, index: 0 });
  const altTabOpen = altTabState.open;
  const altTabIndex = altTabState.index;

  const clearLaunchOverlays = React.useCallback(() => {
    setOverviewOpen(false);
    setLauncherOpen(false);
    setControlPanelOpen(false);
    setAltTabState((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  // Restore built-in shell windows from xdg-session-management-v1 (or default Browser Dev Mode window on first run)
  const [shellWindows, setShellWindows] = React.useState<
    DesktopWindowInstance[]
  >(() => {
    if (!settings.restoreWindowsOnLogin) {
      clearXdgSession();
    } else {
      const savedSession = loadXdgSession();
      if (savedSession !== null) {
        const restoredShell: DesktopWindowInstance[] = [];
        for (const rec of savedSession) {
          const def = APP_CATALOG.find((a) => a.id === rec.id);
          if (def?.builtinComponent) {
            const count = ++nextShellWinCounter;
            const minSize = def.minSize ?? { width: 320, height: 240 };
            const clamped = clampWindowBounds(
              { x: rec.x, y: rec.y },
              { width: rec.width, height: rec.height },
              screenWidth,
              screenHeight,
              { minWidth: minSize.width, minHeight: minSize.height }
            );
            restoredShell.push({
              id: `shell:${rec.id}-${count}`,
              appId: rec.id,
              title: rec.title || def.name,
              iconName: def.iconName,
              gradient: def.gradient,
              builtinComponent: def.builtinComponent,
              clientFrame: def.builtinComponent !== "terminal",
              workspace: clampWorkspace(rec.workspace, settings.workspaceCount),
              position: clamped.position,
              size: clamped.size,
              minSize,
              minimized: false,
              maximized: rec.maximized,
              fullscreen: rec.fullscreen,
              pinned: rec.pinned,
              zIndex: ++nextZIndex,
              payload: rec.payload,
            });
          } else {
            pendingSessionRestoreRef.current.set(rec.id, rec);
          }
        }
        return restoredShell;
      }
    }

    if (typeof window !== "undefined" && window.__PILOTI_BROWSER_HOST__) {
      const settingsDef = APP_CATALOG.find((a) => a.id === "settings")!;
      const minSize = settingsDef.minSize ?? { width: 620, height: 400 };
      const saved = settings.savedWindowBounds?.settings;
      const clamped = clampWindowBounds(
        saved?.position ?? {
          x: Math.max(80, Math.round(screenWidth * 0.22)),
          y: Math.max(48, Math.round(screenHeight * 0.1)),
        },
        saved?.size ?? { width: 820, height: 540 },
        screenWidth,
        screenHeight,
        { minWidth: minSize.width, minHeight: minSize.height }
      );
      return [
        {
          id: "shell:settings-1",
          appId: "settings",
          title: "Desktop Settings",
          iconName: settingsDef.iconName,
          gradient: settingsDef.gradient,
          builtinComponent: "settings",
          clientFrame: true,
          workspace: saved?.workspace ?? 1,
          position: clamped.position,
          size: clamped.size,
          minSize,
          minimized: false,
          maximized: saved?.maximized ?? false,
          zIndex: ++nextZIndex,
          payload: "appearance",
        },
      ];
    }
    return [];
  });

  // Restore external (webview / Wayland) windows queued from xdg-session-management-v1
  React.useEffect(() => {
    if (sessionHydratedRef.current) return;
    sessionHydratedRef.current = true;
    if (!settings.restoreWindowsOnLogin) {
      pendingSessionRestoreRef.current.clear();
      return;
    }

    for (const rec of pendingSessionRestoreRef.current.values()) {
      if (rec.id.startsWith("web:")) {
        const url = rec.id.slice(4);
        if (url) domicile.browser.open(url);
      } else if (!isBrowserRuntime) {
        const def = APP_CATALOG.find((a) => a.id === rec.id);
        launchDesktopCommand(domicile, def?.linuxCommand ?? [rec.id]);
      }
    }
  }, [domicile, isBrowserRuntime, settings.restoreWindowsOnLogin]);

  const [waylandMeta, setWaylandMeta] = React.useState<
    Record<string, ExternalWindowMeta>
  >({});

  const [browserMeta, setBrowserMeta] = React.useState<
    Record<string, ExternalWindowMeta>
  >({});

function upsertBrowserRecord(
  prev: Record<string, string>,
  browserWindowId: string,
  value: string
): Record<string, string> {
  if (!value) {
    if (!(browserWindowId in prev)) return prev;
    const next = { ...prev };
    delete next[browserWindowId];
    return next;
  }
  if (prev[browserWindowId] === value) return prev;
  return { ...prev, [browserWindowId]: value };
}

function pruneBrowserRecord(
  prev: Record<string, string>,
  activeIds: Set<string>
): Record<string, string> {
  let changed = false;
  const next: Record<string, string> = {};
  for (const [id, val] of Object.entries(prev)) {
    if (activeIds.has(id)) next[id] = val;
    else changed = true;
  }
  return changed ? next : prev;
}

  const [browserFavicons, setBrowserFavicons] = React.useState<
    Record<string, string>
  >({});
  const [browserTitles, setBrowserTitles] = React.useState<
    Record<string, string>
  >({});

  const setBrowserFavicon = React.useCallback(
    (browserWindowId: string, favicon: string) => {
      setBrowserFavicons((prev) =>
        upsertBrowserRecord(prev, browserWindowId, favicon)
      );
    },
    []
  );

  const setBrowserTitle = React.useCallback(
    (browserWindowId: string, title: string) => {
      setBrowserTitles((prev) =>
        upsertBrowserRecord(prev, browserWindowId, title.trim())
      );
    },
    []
  );

  const [unreadyWindowIds, setUnreadyWindowIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const readyTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const markWindowReady = React.useCallback((windowId: string) => {
    const timer = readyTimersRef.current.get(windowId);
    if (timer) {
      clearTimeout(timer);
      readyTimersRef.current.delete(windowId);
    }
    setUnreadyWindowIds((prev) => {
      if (!prev.has(windowId)) return prev;
      const next = new Set(prev);
      next.delete(windowId);
      return next;
    });
  }, []);

  const markWindowUnready = React.useCallback(
    (windowId: string, timeoutMs = 2500) => {
      setUnreadyWindowIds((prev) => {
        if (prev.has(windowId)) return prev;
        const next = new Set(prev);
        next.add(windowId);
        return next;
      });
      const existingTimer = readyTimersRef.current.get(windowId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        readyTimersRef.current.delete(windowId);
        markWindowReady(windowId);
      }, timeoutMs);
      readyTimersRef.current.set(windowId, timer);
    },
    [markWindowReady]
  );

  // Sync Domicile `<webview>` browser windows
  const knownBrowserIdsRef = React.useRef<Set<string>>(new Set());

  React.useLayoutEffect(() => {
    const activeIds = new Set(browserWindows.map((bw) => bw.id));
    const newEntries = new Map<string, ExternalWindowMeta>();
    let newlyFocused: {
      id: string;
      workspace: number;
      pinned: boolean;
    } | null = null;

    for (const [idx, bw] of browserWindows.entries()) {
      if (!knownBrowserIdsRef.current.has(bw.id)) {
        markWindowUnready(`browser:${bw.id}`, 180);
        const sessionKey = bw.url ? `web:${bw.url}` : undefined;
        const restored = sessionKey
          ? pendingSessionRestoreRef.current.get(sessionKey)
          : undefined;
        if (sessionKey && restored) {
          pendingSessionRestoreRef.current.delete(sessionKey);
        }
        const remembered = lookupSpatialWindowBounds(settings.savedWindowBounds, {
          appId: bw.appId || "webview",
          browserUrl: bw.url,
        });
        const defaultW =
          restored?.width ??
          remembered?.size.width ??
          (bw.width > 200
            ? bw.width
            : Math.min(720, Math.max(520, screenWidth - 220)));
        const defaultH =
          restored?.height ??
          remembered?.size.height ??
          (bw.height > 150
            ? bw.height
            : Math.min(520, Math.max(380, screenHeight - 180)));
        const sameAppPositions: Array<{ x: number; y: number }> = [];
        for (const prevBw of browserWindows) {
          if (prevBw.id === bw.id) continue;
          const prevKey = prevBw.appId || prevBw.url;
          const curKey = bw.appId || bw.url;
          if (prevKey !== curKey) continue;
          const existingMeta =
            newEntries.get(prevBw.id) ?? browserMeta[prevBw.id];
          if (existingMeta && !existingMeta.minimized) {
            sameAppPositions.push(existingMeta.position);
          }
        }
        const clamped = clampWindowBounds(
          restored
            ? { x: restored.x, y: restored.y }
            : computeCenteredOrCascadedPosition(
                sameAppPositions,
                { width: defaultW, height: defaultH },
                screenWidth,
                screenHeight,
                remembered?.position
              ),
          { width: defaultW, height: defaultH },
          screenWidth,
          screenHeight,
          { minWidth: 420, minHeight: 300 }
        );
        const workspace = restored
          ? clampWorkspace(restored.workspace, settings.workspaceCount)
          : remembered?.workspace !== undefined
            ? clampWorkspace(remembered.workspace, settings.workspaceCount)
            : clampWorkspace(settings.activeWorkspace, settings.workspaceCount);
        const pinned = restored?.pinned ?? false;
        newEntries.set(bw.id, {
          position: clamped.position,
          size: clamped.size,
          minimized: false,
          maximized: restored?.maximized ?? remembered?.maximized ?? false,
          fullscreen: restored?.fullscreen ?? false,
          pinned,
          tiled: null,
          zIndex: ++nextZIndex,
          workspace,
        });
        newlyFocused = {
          id: `browser:${bw.id}`,
          workspace,
          pinned,
        };
      }
    }
    knownBrowserIdsRef.current = activeIds;

    setBrowserFavicons((prev) => pruneBrowserRecord(prev, activeIds));
    setBrowserTitles((prev) => pruneBrowserRecord(prev, activeIds));

    setBrowserMeta((prev) => {
      let changed = false;
      const next: Record<string, ExternalWindowMeta> = {};
      for (const [id, meta] of Object.entries(prev)) {
        if (activeIds.has(id)) next[id] = meta;
        else changed = true;
      }
      for (const [id, entry] of newEntries) {
        if (!next[id]) {
          next[id] = entry;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    if (newlyFocused) {
      const target = newlyFocused;
      clearLaunchOverlays();
      if (!target.pinned && target.workspace !== settings.activeWorkspace) {
        updateSettings({ activeWorkspace: target.workspace });
      }
      setFocusedWindowId(target.id);
      setMruIds((prev) => [target.id, ...prev.filter((id) => id !== target.id)]);
      domicile.windows.focusShell();
    }
  }, [
    browserWindows,
    clearLaunchOverlays,
    domicile.windows,
    markWindowUnready,
    screenHeight,
    screenWidth,
    settings.activeWorkspace,
    settings.savedWindowBounds,
    settings.workspaceCount,
    updateSettings,
  ]);

  // Sync new Wayland windows and restore remembered geometry per desktopId
  const knownWaylandIdsRef = React.useRef<Set<string>>(new Set());

  React.useLayoutEffect(() => {
    const toplevels = waylandWindows.filter((w) => w.parent === undefined);
    const idsToResolve: string[] = [];
    const currentIds = new Set(toplevels.map((w) => w.appId));
    const newEntries = new Map<string, ExternalWindowMeta>();
    let newlyMapped: {
      appId: string;
      workspace: number;
      pinned: boolean;
    } | null = null;

    for (const [idx, w] of toplevels.entries()) {
      if (w.desktopId) idsToResolve.push(w.desktopId);
      if (!knownWaylandIdsRef.current.has(w.appId)) {
        const shortId = w.desktopId.replace(/\.desktop$/i, "");
        const restored =
          pendingSessionRestoreRef.current.get(w.desktopId) ??
          pendingSessionRestoreRef.current.get(shortId);
        if (restored) {
          pendingSessionRestoreRef.current.delete(w.desktopId);
          pendingSessionRestoreRef.current.delete(shortId);
        }
        const remembered = w.dialog
          ? undefined
          : lookupSpatialWindowBounds(settings.savedWindowBounds, {
              appId: shortId || w.appId,
              desktopId: w.desktopId,
              shortId,
            });
        const matched = matchAppFromWayland(w.desktopId, w.title);
        const xdgMatch = matchXdgEntryForWaylandWindow(
          installedXdgApps,
          w.desktopId
        );
        const isCsdWindow =
          settings.windowDecorationMode === "csd" ||
          (settings.windowDecorationMode === "auto" &&
            resolveWaylandClientFrame(w, xdgMatch));
        const constraints = resolveWaylandOuterConstraints(w, isCsdWindow, {
          width: 640,
          height: 440,
        });
        const rawSize = restored
          ? { width: restored.width, height: restored.height }
          : remembered?.size ?? constraints.defaultSize;
        const parentMeta = w.transientFor
          ? (newEntries.get(w.transientFor) ?? waylandMeta[w.transientFor])
          : undefined;
        const sameAppPositions: Array<{ x: number; y: number }> = [];
        for (const prevW of toplevels) {
          if (prevW.appId === w.appId) continue;
          if ((prevW.desktopId || prevW.appId) !== (w.desktopId || w.appId)) {
            continue;
          }
          const existingMeta =
            newEntries.get(prevW.appId) ?? waylandMeta[prevW.appId];
          if (existingMeta && !existingMeta.minimized) {
            sameAppPositions.push(existingMeta.position);
          }
        }
        const rawPos = restored
          ? { x: restored.x, y: restored.y }
          : parentMeta
            ? {
                x: Math.round(
                  parentMeta.position.x +
                    (parentMeta.size.width - rawSize.width) / 2
                ),
                y: Math.round(
                  parentMeta.position.y +
                    (parentMeta.size.height - rawSize.height) / 2
                ),
              }
            : computeCenteredOrCascadedPosition(
                sameAppPositions,
                rawSize,
                screenWidth,
                screenHeight,
                remembered?.position
              );
        const clamped = clampWindowBounds(
          rawPos,
          rawSize,
          screenWidth,
          screenHeight,
          {
            minWidth: constraints.minSize.width,
            minHeight: constraints.minSize.height,
            maxWidth: constraints.maxWidth,
            maxHeight: constraints.maxHeight,
          }
        );
        const workspace = restored
          ? clampWorkspace(restored.workspace, settings.workspaceCount)
          : remembered?.workspace !== undefined
            ? clampWorkspace(remembered.workspace, settings.workspaceCount)
            : clampWorkspace(settings.activeWorkspace, settings.workspaceCount);
        const pinned = restored?.pinned ?? false;

        newEntries.set(w.appId, {
          position: clamped.position,
          size: clamped.size,
          minimized: false,
          maximized: restored?.maximized ?? remembered?.maximized ?? false,
          fullscreen: restored?.fullscreen ?? false,
          pinned,
          tiled: null,
          zIndex: ++nextZIndex,
          workspace,
        });
        newlyMapped = {
          appId: w.appId,
          workspace,
          pinned,
        };
      }
    }
    knownWaylandIdsRef.current = currentIds;

    setWaylandMeta((prev) => {
      let changed = false;
      const next: Record<string, ExternalWindowMeta> = {};
      for (const [id, meta] of Object.entries(prev)) {
        if (currentIds.has(id)) next[id] = meta;
        else changed = true;
      }
      for (const [id, entry] of newEntries) {
        if (!next[id]) {
          next[id] = entry;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    if (idsToResolve.length > 0) {
      ensureWaylandIcons(idsToResolve);
    }

    if (newlyMapped) {
      const target = newlyMapped;
      const wid = `wayland:${target.appId}`;
      clearLaunchOverlays();
      if (!target.pinned && target.workspace !== settings.activeWorkspace) {
        updateSettings({ activeWorkspace: target.workspace });
      }
      setFocusedWindowId(wid);
      setMruIds((prev) => [wid, ...prev.filter((id) => id !== wid)]);
      const frame = requestAnimationFrame(() => {
        domicile.windows.focus(target.appId);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [
    clearLaunchOverlays,
    domicile.windows,
    ensureWaylandIcons,
    screenHeight,
    screenWidth,
    settings.activeWorkspace,
    settings.savedWindowBounds,
    settings.workspaceCount,
    updateSettings,
    waylandWindows,
  ]);

  // Listen to Wayland client window requests (Maximize / Fullscreen)
  React.useEffect(() => {
    let cancelled = false;
    let stopListening: (() => void) | undefined;

    (async () => {
      try {
        const res = await domicile.windows.requests();
        const listening = res.match({
          Ok: (v) => v,
          Err: (err) => {
            console.warn("[Piloti] windowRequests subscribe Err", err);
            return undefined;
          },
        });
        if (cancelled || !listening) return;
        stopListening = () => listening.stop();
        const reader = listening.items.getReader();

        while (!cancelled) {
          const { done, value: req } = await reader.read();
          if (done || !req || cancelled) break;
          console.info(
            "[Piloti] windowRequest",
            WindowRequestKind[req.kind] ?? req.kind,
            req
          );
          if (
            req.kind === WindowRequestKind.Maximize ||
            req.kind === WindowRequestKind.Fullscreen
          ) {
            setWaylandMeta((prev) => {
              const cur = prev[req.appId];
              if (!cur) return prev;
              return {
                ...prev,
                [req.appId]: {
                  ...cur,
                  maximized: true,
                  minimized: false,
                  zIndex: ++nextZIndex,
                },
              };
            });
          } else if (
            req.kind === WindowRequestKind.Unmaximize
          ) {
            setWaylandMeta((prev) => {
              const cur = prev[req.appId];
              if (!cur) return prev;
              return {
                ...prev,
                [req.appId]: {
                  ...cur,
                  maximized: false,
                  zIndex: ++nextZIndex,
                },
              };
            });
          } else if ((req as { kind: number }).kind === 4) {
            setWaylandMeta((prev) => {
              const cur = prev[req.appId];
              if (!cur) return prev;
              return {
                ...prev,
                [req.appId]: {
                  ...cur,
                  minimized: true,
                },
              };
            });
          } else if (
            (req as { kind: number }).kind === 5 ||
            (req as { kind: number }).kind === 6 ||
            req.kind === WindowRequestKind.Unfullscreen
          ) {
            for (const listener of clientWindowRequestListenersRef.current) {
              listener(req);
            }
          }
        }
      } catch (err) {
        console.warn("[Piloti] windowRequests stream error", err);
      }
    })();

    return () => {
      cancelled = true;
      stopListening?.();
    };
  }, [domicile.windows]);

  // Synchronize xdg_toplevel Tiled states so GTK4/Libadwaita CSD apps drop internal shadow margins
  React.useEffect(() => {
    const toplevels = waylandWindows.filter((w) => w.parent === undefined);
    for (const w of toplevels) {
      const meta = waylandMeta[w.appId];
      const states: WindowState[] = [
        WindowState.TiledLeft,
        WindowState.TiledRight,
        WindowState.TiledTop,
        WindowState.TiledBottom,
      ];
      if (meta?.maximized) {
        states.unshift(WindowState.Maximized);
      }
      try {
        domicile.windows.setStates(w.appId, states);
      } catch {
        // ignore
      }
    }
  }, [domicile.windows, waylandMeta, waylandWindows]);

  const syncedParentFrames = React.useMemo(() => {
    const byId = new Map(waylandWindows.map((w) => [w.appId, w]));
    const frames = new Map<string, number>();
    for (const w of waylandWindows) {
      if (w.parent === undefined) continue;
      let cur = byId.get(w.parent);
      while (cur) {
        frames.set(cur.appId, cur.frame);
        cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined;
      }
    }
    return frames;
  }, [waylandWindows]);

  const combinedWindows = React.useMemo<DesktopWindowInstance[]>(() => {
    const resolvedShellWindows = shellWindows.map((sw) => ({
      ...sw,
      iconUrl: sw.iconUrl ?? getAppIconUrl(sw.appId),
      ready: !unreadyWindowIds.has(sw.id),
    }));

    const toplevels = waylandWindows
      .filter((w) => w.parent === undefined)
      .flatMap((w): DesktopWindowInstance[] => {
        const meta = waylandMeta[w.appId];
        if (!meta) return [];
        const matched = matchAppFromWayland(w.desktopId, w.title);
        const xdgMatch = matchXdgEntryForWaylandWindow(
          installedXdgApps,
          w.desktopId
        );
        const resolvedIconUrl =
          xdgMatch?.iconUrl ??
          getAppIconUrl(w.desktopId) ??
          getAppIconUrl(w.appId) ??
          getAppIconUrl(matched.id);
        const clientFrame = resolveWaylandClientFrame(w, xdgMatch);
        const isCsdWindow =
          settings.windowDecorationMode === "csd" ||
          (settings.windowDecorationMode === "auto" && clientFrame);
        const constraints = resolveWaylandOuterConstraints(w, isCsdWindow);
        return [{
          id: `wayland:${w.appId}`,
          appId: xdgMatch?.appId ?? matched.id,
          title: w.title || xdgMatch?.name || matched.name || w.appId,
          iconName: matched.iconName,
          iconUrl: resolvedIconUrl,
          gradient: matched.gradient,
          waylandAppId: w.appId,
          waylandDesktopId: w.desktopId,
          clientFrame,
          cursor: w.cursor,
          syncedFrame: syncedParentFrames.get(w.appId),
          tiled: meta.tiled ?? null,
          workspace: meta.workspace,
          position: meta.position,
          size: meta.size,
          minSize: {
            width: w.minWidth ? constraints.minSize.width : (matched.minSize?.width ?? constraints.minSize.width),
            height: w.minHeight ? constraints.minSize.height : (matched.minSize?.height ?? constraints.minSize.height),
          },
          maxSize:
            constraints.maxWidth || constraints.maxHeight
              ? {
                  width: constraints.maxWidth ?? screenWidth,
                  height: constraints.maxHeight ?? screenHeight,
                }
              : undefined,
          minimized: meta.minimized,
          maximized: meta.maximized,
          fullscreen: meta.fullscreen,
          pinned: meta.pinned,
          ready: !unreadyWindowIds.has(`wayland:${w.appId}`),
          zIndex: meta.zIndex,
        }];
      });

    const resolvedBrowserWindows = browserWindows.flatMap((bw): DesktopWindowInstance[] => {
      const meta = browserMeta[bw.id];
      if (!meta) return [];
      const webAppMatch = findMatchingWebApp(bw.url, settings.installedWebApps);
      const pendingTitle =
        pendingWebTitlesRef.current.get(bw.appId) ??
        pendingWebTitlesRef.current.get(bw.url);
      const resolvedTitle =
        pendingTitle ??
        resolveWebAppTitle({
          rawUrl: bw.url,
          liveTitle: browserTitles[bw.id],
          hostTitle: bw.title,
          installedApps: settings.installedWebApps,
        });
      return [{
        id: `browser:${bw.id}`,
        appId: bw.appId || webAppMatch?.id || `webview:${bw.id}`,
        title: resolvedTitle,
        iconName: "globe",
        iconUrl:
          browserFavicons[bw.id] ||
          webAppMatch?.iconUrl ||
          getWebAppFaviconUrl(bw.url),
        gradient: "from-cyan-400 via-blue-500 to-indigo-600",
        browserWindowId: bw.id,
        browserUrl: bw.url,
        browserIsApp: bw.isApp,
        clientFrame: true,
        workspace: meta.workspace,
        position: meta.position,
        size: meta.size,
        minSize: { width: 420, height: 300 },
        minimized: meta.minimized,
        maximized: meta.maximized,
        fullscreen: meta.fullscreen,
        pinned: meta.pinned,
        tiled: meta.tiled ?? null,
        ready: !unreadyWindowIds.has(`browser:${bw.id}`),
        zIndex: meta.zIndex,
      }];
    });

    // Keep stable insertion order in DOM so zIndex CSS handles stacking without
    // moving <iframe> nodes via insertBefore (which reloads iframes on focus).
    return [...resolvedShellWindows, ...resolvedBrowserWindows, ...toplevels];
  }, [
    shellWindows,
    browserWindows,
    browserFavicons,
    browserTitles,
    browserMeta,
    waylandWindows,
    waylandMeta,
    syncedParentFrames,
    installedXdgApps,
    getAppIconUrl,
    unreadyWindowIds,
    screenWidth,
    screenHeight,
    settings.activeWorkspace,
    settings.installedWebApps,
    settings.workspaceCount,
  ]);

  const waylandPopups = React.useMemo<ResolvedPopupWindow[]>(() => {
    const byId = new Map(waylandWindows.map((w) => [w.appId, w]));
    const resolved: ResolvedPopupWindow[] = [];

    for (const w of waylandWindows) {
      if (w.parent === undefined) continue;
      let offsetX = w.x ?? 0;
      let offsetY = w.y ?? 0;
      let ancestor = byId.get(w.parent);
      let rootToplevel = ancestor;

      while (ancestor && ancestor.parent !== undefined) {
        offsetX += ancestor.x ?? 0;
        offsetY += ancestor.y ?? 0;
        ancestor = byId.get(ancestor.parent);
        if (ancestor && ancestor.parent === undefined) {
          rootToplevel = ancestor;
        }
      }

      if (!rootToplevel) continue;
      const parentWin = combinedWindows.find(
        (cw) => cw.waylandAppId === rootToplevel.appId
      );
      if (
        !parentWin ||
        parentWin.minimized ||
        parentWin.workspace !== settings.activeWorkspace
      ) {
        continue;
      }

      const isCsd =
        settings.windowDecorationMode === "csd" ||
        (settings.windowDecorationMode === "auto" &&
          Boolean(parentWin.clientFrame));
      const titlebarHeight = isCsd ? 0 : 46;
      const basePos = parentWin.maximized
        ? { x: 0, y: 0 }
        : parentWin.position;

      resolved.push({
        appId: w.appId,
        parentToplevelId: parentWin.id,
        x: basePos.x + offsetX,
        y: basePos.y + titlebarHeight + offsetY,
        width: w.width ?? 220,
        height: w.height ?? 180,
        frame: syncedParentFrames.get(w.appId) ?? w.frame,
        cursor: w.cursor,
        zIndex: parentWin.zIndex + 2,
      });
    }

    return resolved;
  }, [
    waylandWindows,
    combinedWindows,
    settings.activeWorkspace,
    settings.windowDecorationMode,
    syncedParentFrames,
  ]);

  const [focusedWindowId, setFocusedWindowId] = React.useState<string | null>(
    () =>
      typeof window !== "undefined" && window.__PILOTI_BROWSER_HOST__
        ? "shell:settings-1"
        : null
  );
  const [mruIds, setMruIds] = React.useState<string[]>(() =>
    typeof window !== "undefined" && window.__PILOTI_BROWSER_HOST__
      ? ["shell:settings-1"]
      : []
  );

  React.useEffect(() => {
    if (waylandFocused) {
      const wid = `wayland:${waylandFocused}`;
      setFocusedWindowId(wid);
      setMruIds((prev) => [wid, ...prev.filter((id) => id !== wid)]);
    }
  }, [waylandFocused]);

  React.useEffect(() => {
    if (
      focusedWindowId &&
      !combinedWindows.some((w) => w.id === focusedWindowId && !w.minimized)
    ) {
      const topVisible = [...combinedWindows]
        .filter((w) => !w.minimized && w.workspace === settings.activeWorkspace)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      setFocusedWindowId(topVisible?.id ?? null);
    }
  }, [combinedWindows, focusedWindowId, settings.activeWorkspace]);

  const clearFocusedWindow = React.useCallback(() => {
    setFocusedWindowId(null);
    domicile.windows.focusShell();
  }, [domicile.windows]);

  const focusWindow = React.useCallback(
    (windowId: string) => {
      const newZ = ++nextZIndex;
      clearLaunchOverlays();
      setFocusedWindowId(windowId);
      setMruIds((prev) => [windowId, ...prev.filter((id) => id !== windowId)]);

      const existing = combinedWindows.find((w) => w.id === windowId);
      const targetWorkspace = existing
        ? clampWorkspace(existing.workspace, settings.workspaceCount)
        : undefined;
      if (
        existing &&
        targetWorkspace !== undefined &&
        !existing.pinned &&
        targetWorkspace !== settings.activeWorkspace
      ) {
        updateSettings({ activeWorkspace: targetWorkspace });
      }

      const clampForWindow = (
        pos: { x: number; y: number },
        sz: { width: number; height: number },
        maximized?: boolean,
        fullscreen?: boolean,
        minSize?: { width?: number; height?: number }
      ) =>
        !maximized && !fullscreen
          ? clampWindowBounds(pos, sz, screenWidth, screenHeight, {
              minWidth: minSize?.width,
              minHeight: minSize?.height,
            })
          : null;

      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => {
          const clamped = clampForWindow(
            cur.position,
            cur.size,
            cur.maximized,
            cur.fullscreen,
            existing?.minSize
          );
          return {
            ...cur,
            ...(clamped
              ? { position: clamped.position, size: clamped.size }
              : {}),
            workspace: clampWorkspace(cur.workspace, settings.workspaceCount),
            minimized: false,
            zIndex: newZ,
          };
        });
        domicile.windows.focus(rawId);
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        patchExternalMeta(setBrowserMeta, rawId, (cur) => {
          const clamped = clampForWindow(
            cur.position,
            cur.size,
            cur.maximized,
            cur.fullscreen,
            existing?.minSize
          );
          return {
            ...cur,
            ...(clamped
              ? { position: clamped.position, size: clamped.size }
              : {}),
            workspace: clampWorkspace(cur.workspace, settings.workspaceCount),
            minimized: false,
            zIndex: newZ,
          };
        });
        domicile.windows.focusShell();
      } else {
        setShellWindows((prev) =>
          prev.map((w) => {
            if (w.id !== windowId) return w;
            const clamped = clampForWindow(
              w.position,
              w.size,
              w.maximized,
              w.fullscreen,
              w.minSize
            );
            return {
              ...w,
              ...(clamped
                ? {
                    position: clamped.position,
                    size: clamped.size,
                  }
                : {}),
              workspace: clampWorkspace(w.workspace, settings.workspaceCount),
              minimized: false,
              zIndex: newZ,
            };
          })
        );
        domicile.windows.focusShell();
      }
    },
    [
      clearLaunchOverlays,
      combinedWindows,
      domicile.windows,
      screenHeight,
      screenWidth,
      settings.activeWorkspace,
      settings.workspaceCount,
      updateSettings,
    ]
  );

  const focusWindowRef = React.useRef(focusWindow);
  focusWindowRef.current = focusWindow;

  React.useEffect(() => {
    return domicile.windows.on("focusrequest", (appId) => {
      const byId = new Map(domicile.windows.list.map((w) => [w.appId, w]));
      let cur = byId.get(appId);
      while (cur?.parent !== undefined) {
        cur = byId.get(cur.parent);
      }
      const rootAppId = cur?.appId ?? appId;
      focusWindowRef.current(`wayland:${rootAppId}`);
    });
  }, [domicile.windows]);

  const closeWindow = React.useCallback(
    (windowId: string) => {
      console.info("[Piloti] closeWindow", windowId);
      markWindowReady(windowId);
      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        domicile.windows.close(rawId);
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        domicile.browser.close(rawId);
      } else {
        setShellWindows((prev) => prev.filter((w) => w.id !== windowId));
      }
      setMruIds((prev) => prev.filter((id) => id !== windowId));
    },
    [domicile.browser, domicile.windows, markWindowReady]
  );

  const minimizeWindow = React.useCallback(
    (windowId: string) => {
      console.info("[Piloti] minimizeWindow", windowId);
      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => ({
          ...cur,
          minimized: true,
        }));
        domicile.windows.setBounds(rawId, { x: 0, y: 0, width: 0, height: 0 });
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        patchExternalMeta(setBrowserMeta, rawId, (cur) => ({
          ...cur,
          minimized: true,
        }));
      } else {
        setShellWindows((prev) =>
          prev.map((w) => (w.id === windowId ? { ...w, minimized: true } : w))
        );
      }
    },
    [domicile.windows]
  );

  const toggleMinimizeWindow = React.useCallback(
    (windowId: string) => {
      const target = combinedWindows.find((w) => w.id === windowId);
      if (!target) return;
      if (target.minimized) {
        focusWindow(windowId);
      } else {
        minimizeWindow(windowId);
      }
    },
    [combinedWindows, focusWindow, minimizeWindow]
  );

  const toggleMaximizeWindow = React.useCallback(
    (windowId: string) => {
      console.info("[Piloti] toggleMaximizeWindow", windowId);
      const targetWin = combinedWindows.find((w) => w.id === windowId);
      if (targetWin?.appId === "calculator") {
        return;
      }
      if (targetWin) {
        const key = resolveSpatialBoundsKey({
          appId: targetWin.appId,
          payload: targetWin.payload,
          browserUrl: targetWin.browserUrl,
          desktopId: targetWin.waylandDesktopId,
        });
        updateSettings({
          savedWindowBounds: {
            ...settings.savedWindowBounds,
            [key]: {
              position: targetWin.position,
              size: targetWin.size,
              workspace: targetWin.workspace,
              maximized: !targetWin.maximized,
              monitor: primaryMonitorName,
            },
          },
        });
      }
      const newZ = ++nextZIndex;
      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => ({
          ...cur,
          maximized: !cur.maximized,
          minimized: false,
          zIndex: newZ,
        }));
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        patchExternalMeta(setBrowserMeta, rawId, (cur) => ({
          ...cur,
          maximized: !cur.maximized,
          minimized: false,
          zIndex: newZ,
        }));
      } else {
        setShellWindows((prev) =>
          prev.map((w) =>
            w.id === windowId
              ? { ...w, maximized: !w.maximized, minimized: false, zIndex: newZ }
              : w
          )
        );
      }
      setFocusedWindowId(windowId);
    },
    [combinedWindows, primaryMonitorName, settings.savedWindowBounds, updateSettings]
  );

  const geometryLogRef = React.useRef<
    Map<
      string,
      {
        timer: ReturnType<typeof setTimeout>;
        label: string;
        position?: { x: number; y: number };
        size?: { width: number; height: number };
      }
    >
  >(new Map());

  React.useEffect(() => {
    const timers = geometryLogRef.current;
    return () => {
      for (const entry of timers.values()) {
        clearTimeout(entry.timer);
      }
      timers.clear();
    };
  }, []);

  const updateWindowGeometry = React.useCallback(
    (
      windowId: string,
      patch: {
        position?: { x: number; y: number };
        size?: { width: number; height: number };
      }
    ) => {
      const targetWin = combinedWindows.find((w) => w.id === windowId);
      const untileRestoredSize =
        patch.position && !patch.size && targetWin?.tiled
          ? preTileSizesRef.current.get(windowId)
          : undefined;
      if (untileRestoredSize) {
        preTileSizesRef.current.delete(windowId);
      }
      const effectiveSizePatch = patch.size ?? untileRestoredSize;
      const winWidth = effectiveSizePatch?.width ?? targetWin?.size.width ?? 240;
      const maxY = Math.max(0, screenHeight - 30 - 48);
      const minX = -Math.max(0, winWidth - 80);
      const maxX = Math.max(0, screenWidth - 80);
      const clampedPosition = patch.position
        ? {
          x: Math.min(maxX, Math.max(minX, Math.round(patch.position.x))),
          y: Math.min(maxY, Math.max(0, Math.round(patch.position.y))),
        }
        : undefined;
      const roundedSize = effectiveSizePatch
        ? {
          width: Math.round(effectiveSizePatch.width),
          height: Math.round(effectiveSizePatch.height),
        }
        : undefined;

      if (targetWin) {
        const nextPos = clampedPosition ?? targetWin.position;
        const nextSize = effectiveSizePatch ?? targetWin.size;
        const key = resolveSpatialBoundsKey({
          appId: targetWin.appId,
          payload: targetWin.payload,
          browserUrl: targetWin.browserUrl,
          desktopId: targetWin.waylandDesktopId,
        });
        updateSettings({
          savedWindowBounds: {
            ...settings.savedWindowBounds,
            [key]: {
              position: nextPos,
              size: nextSize,
              workspace: targetWin.workspace,
              maximized: targetWin.maximized,
              monitor: primaryMonitorName,
            },
          },
        });
      }

      if (clampedPosition || roundedSize) {
        const label = targetWin?.appId || windowId;
        const existing = geometryLogRef.current.get(windowId);
        if (existing) {
          clearTimeout(existing.timer);
        }
        const nextPosition = clampedPosition ?? existing?.position;
        const nextSize = roundedSize ?? existing?.size;
        const timer = setTimeout(() => {
          const entry = geometryLogRef.current.get(windowId);
          if (!entry) return;
          geometryLogRef.current.delete(windowId);
          if (entry.position) {
            console.info(
              `[Piloti] moved ${entry.label} to ${entry.position.x}x${entry.position.y}`
            );
          }
          if (entry.size) {
            console.info(
              `[Piloti] resized ${entry.label} to ${entry.size.width}x${entry.size.height}`
            );
          }
        }, 300);
        geometryLogRef.current.set(windowId, {
          timer,
          label,
          position: nextPosition,
          size: nextSize,
        });
      }

      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => ({
          ...cur,
          position: clampedPosition ?? cur.position,
          size: effectiveSizePatch ?? cur.size,
          tiled: clampedPosition ? null : cur.tiled,
        }));
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        patchExternalMeta(setBrowserMeta, rawId, (cur) => ({
          ...cur,
          position: clampedPosition ?? cur.position,
          size: effectiveSizePatch ?? cur.size,
          tiled: clampedPosition ? null : cur.tiled,
        }));
      } else {
        setShellWindows((prev) =>
          prev.map((w) =>
            w.id === windowId
              ? {
                ...w,
                position: clampedPosition ?? w.position,
                size: effectiveSizePatch ?? w.size,
                tiled: clampedPosition ? null : w.tiled,
              }
              : w
          )
        );
      }
    },
    [
      combinedWindows,
      primaryMonitorName,
      screenHeight,
      screenWidth,
      settings.savedWindowBounds,
      updateSettings,
    ]
  );

  const preTileSizesRef = React.useRef<
    Map<string, { width: number; height: number }>
  >(new Map());

  const tileWindow = React.useCallback(
    (windowId: string, side: "left" | "right" | "full") => {
      console.info("[Piloti] tileWindow", windowId, side);
      const existingWin = combinedWindows.find((w) => w.id === windowId);
      if (existingWin?.appId === "calculator") {
        return;
      }
      if (side === "full") {
        toggleMaximizeWindow(windowId);
        return;
      }
      if (existingWin && !existingWin.tiled) {
        preTileSizesRef.current.set(windowId, existingWin.size);
      }
      const menubarHeight = 30;
      const topInset = 6;
      const dockPos = settings.dockPosition ?? "bottom";
      const dockClearance = settings.dockAutoHide ? 8 : settings.dockSize + 24;
      const bottomInset = dockPos === "bottom" ? dockClearance + 6 : 8;
      const leftInset = dockPos === "left" ? dockClearance + 8 : 8;
      const rightInset = dockPos === "right" ? dockClearance + 8 : 8;
      const usableHeight = Math.max(
        300,
        screenHeight - menubarHeight - topInset - bottomInset
      );
      const usableWidth = Math.max(400, screenWidth - leftInset - rightInset);
      const halfWidth = Math.floor((usableWidth - 8) / 2);
      const pos = {
        x: side === "left" ? leftInset : leftInset + halfWidth + 8,
        y: topInset,
      };
      const sz = { width: halfWidth, height: usableHeight };

      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => ({
          ...cur,
          maximized: false,
          minimized: false,
          tiled: side,
          position: pos,
          size: sz,
          zIndex: ++nextZIndex,
        }));
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        patchExternalMeta(setBrowserMeta, rawId, (cur) => ({
          ...cur,
          maximized: false,
          minimized: false,
          tiled: side,
          position: pos,
          size: sz,
          zIndex: ++nextZIndex,
        }));
      } else {
        setShellWindows((prev) =>
          prev.map((w) =>
            w.id === windowId
              ? {
                ...w,
                maximized: false,
                minimized: false,
                tiled: side,
                position: pos,
                size: sz,
                zIndex: ++nextZIndex,
              }
              : w
          )
        );
      }
      clearLaunchOverlays();
      setFocusedWindowId(windowId);
      setMruIds((prev) => [windowId, ...prev.filter((id) => id !== windowId)]);
      if (windowId.startsWith("wayland:")) {
        domicile.windows.focus(windowId.slice("wayland:".length));
      } else {
        domicile.windows.focusShell();
      }
    },
    [
      clearLaunchOverlays,
      combinedWindows,
      domicile.windows,
      screenHeight,
      screenWidth,
      settings.dockAutoHide,
      settings.dockPosition,
      settings.dockSize,
      toggleMaximizeWindow,
    ]
  );

  const [launchingApps, setLaunchingApps] = React.useState<string[]>([]);
  const launchingTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const launchingStartedAtRef = React.useRef<Map<string, number>>(new Map());
  const launchingClearTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const beginStartupNotification = React.useCallback((appId: string) => {
    launchingStartedAtRef.current.set(appId, Date.now());
    const pendingClear = launchingClearTimersRef.current.get(appId);
    if (pendingClear) {
      clearTimeout(pendingClear);
      launchingClearTimersRef.current.delete(appId);
    }
    setLaunchingApps((prev) => (prev.includes(appId) ? prev : [...prev, appId]));
    const existingTimer = launchingTimersRef.current.get(appId);
    if (existingTimer) clearTimeout(existingTimer);
    // Per XDG Startup Notification Spec, clear launching state after timeout if no window maps
    const timer = setTimeout(() => {
      launchingTimersRef.current.delete(appId);
      launchingStartedAtRef.current.delete(appId);
      setLaunchingApps((prev) => prev.filter((id) => id !== appId));
    }, 15000);
    launchingTimersRef.current.set(appId, timer);
  }, []);

  // Clear XDG Startup Notification launching state when a matching ready window appears
  // (after a brief minimum bounce so Dock feedback is visible for fast built-in apps).
  React.useEffect(() => {
    if (launchingApps.length === 0) return;
    const readyWindows = combinedWindows.filter((w) => w.ready !== false);
    const runningIds = new Set(
      readyWindows.flatMap((w) => [
        w.appId.toLowerCase(),
        (w.waylandAppId ?? "").toLowerCase(),
      ])
    );
    const readyWebCanonicals = new Set(
      readyWindows
        .map((w) => canonicalizeWebUrl(w.browserUrl))
        .filter((u): u is string => Boolean(u))
    );
    const completed = launchingApps.filter((id) => {
      const lower = id.toLowerCase();
      const base = lower.replace(/\.desktop$/, "");
      if (runningIds.has(lower) || runningIds.has(base)) return true;
      if (id.startsWith("webview:")) {
        const canonical = canonicalizeWebUrl(id.slice("webview:".length));
        if (canonical && readyWebCanonicals.has(canonical)) return true;
      }
      return false;
    });
    if (completed.length > 0) {
      const immediate: string[] = [];
      for (const id of completed) {
        const timer = launchingTimersRef.current.get(id);
        if (timer) {
          clearTimeout(timer);
          launchingTimersRef.current.delete(id);
        }
        const startedAt = launchingStartedAtRef.current.get(id) ?? 0;
        const remaining = 700 - (Date.now() - startedAt);
        if (remaining <= 0) {
          launchingStartedAtRef.current.delete(id);
          immediate.push(id);
        } else if (!launchingClearTimersRef.current.has(id)) {
          const clearTimer = setTimeout(() => {
            launchingClearTimersRef.current.delete(id);
            launchingStartedAtRef.current.delete(id);
            setLaunchingApps((prev) => prev.filter((item) => item !== id));
          }, remaining);
          launchingClearTimersRef.current.set(id, clearTimer);
        }
      }
      if (immediate.length > 0) {
        setLaunchingApps((prev) => prev.filter((id) => !immediate.includes(id)));
      }
    }
  }, [combinedWindows, launchingApps]);

  React.useEffect(() => {
    const timers = launchingTimersRef.current;
    const clearTimers = launchingClearTimersRef.current;
    const readyTimers = readyTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const timer of clearTimers.values()) clearTimeout(timer);
      clearTimers.clear();
      for (const timer of readyTimers.values()) clearTimeout(timer);
      readyTimers.clear();
    };
  }, []);

  const forceQuitApp = React.useCallback(
    (appId: string) => {
      console.info("[Piloti] forceQuitApp", appId);
      const appWins = combinedWindows.filter((w) => w.appId === appId);
      for (const win of appWins) {
        if (win.id.startsWith("wayland:")) {
          const rawId = win.waylandAppId ?? win.id.slice("wayland:".length);
          domicile.windows.close(rawId);
          if (!isBrowserRuntime) {
            // Best-effort forceful termination for hung Wayland clients
            const procName = (win.waylandAppId || appId)
              .replace(/\.desktop$/, "")
              .split(".")
              .pop();
            if (procName) {
              domicile.processes.run(["pkill", "-KILL", "-i", procName]).catch(() => { });
            }
          }
        } else {
          closeWindow(win.id);
        }
      }
      setLaunchingApps((prev) => prev.filter((id) => id !== appId));
    },
    [closeWindow, combinedWindows, domicile.processes, domicile.windows, isBrowserRuntime]
  );

  const combinedWindowsRef = React.useRef<DesktopWindowInstance[]>(combinedWindows);
  combinedWindowsRef.current = combinedWindows;
  const recentLaunchGuardRef = React.useRef<Map<string, number>>(new Map());

  const launchApp = React.useCallback(
    (
      appId: string,
      options?: { payload?: string; forceNew?: boolean; forceCsd?: boolean }
    ) => {
      clearLaunchOverlays();
      console.info("[Piloti] launchApp", appId, options ?? {});
      const def = APP_CATALOG.find((a) => a.id === appId);

      // Focus existing window unless forceNew (for document-scoped apps with a payload, only reuse matching document/folder)
      if (!options?.forceNew) {
        const lowerAppId = appId.toLowerCase();
        const existing = combinedWindowsRef.current.find((w) => {
          const idMatches =
            w.appId === appId ||
            w.appId.toLowerCase() === lowerAppId ||
            w.waylandDesktopId?.toLowerCase() === lowerAppId ||
            w.waylandDesktopId?.replace(/\.desktop$/i, "").toLowerCase() === lowerAppId;
          return DOCUMENT_SCOPED_APP_IDS.has(appId) && options?.payload
            ? idMatches && w.payload === options.payload
            : idMatches;
        });
        if (existing) {
          if (
            (options?.payload || options?.forceCsd !== undefined) &&
            !existing.id.startsWith("wayland:")
          ) {
            setShellWindows((prev) =>
              prev.map((w) =>
                w.id === existing.id
                  ? {
                    ...w,
                    payload: options.payload ?? w.payload,
                    clientFrame: options.forceCsd ?? w.clientFrame,
                  }
                  : w
              )
            );
          }
          focusWindow(existing.id);
          return;
        }
      }

      if (appId === "nautilus" && options?.payload && options?.forceNew) {
        const sameFolderWin = combinedWindows.find(
          (w) => w.appId === "nautilus" && w.payload === options.payload,
        );
        if (sameFolderWin) {
          focusWindow(sameFolderWin.id);
          return;
        }
      }

      // Built-in shell windows (`settings`, `console`, `files`, `terminal`, `text-editor`, `app-store`, `calculator`, `image-viewer`)
      const builtinKind: BuiltinAppId | undefined =
        def?.builtinComponent ??
        (appId === "settings" || appId === "console"
          ? (appId as BuiltinAppId)
          : appId === "nautilus"
            ? "files"
            : appId === "terminal"
              ? "terminal"
              : undefined);
      if (builtinKind) {
        const builtinDef =
          def ?? APP_CATALOG.find((a) => a.id === builtinKind) ?? APP_CATALOG[0];
        const count = ++nextShellWinCounter;
        const resolvedAppId = def?.id ?? builtinKind;
        const newWinId = `shell:${builtinKind}-${count}`;
        const remembered = lookupSpatialWindowBounds(settings.savedWindowBounds, {
          appId: resolvedAppId,
          payload: options?.payload,
        });
        const minSize = builtinDef.minSize ?? {
          width: Math.min(360, builtinDef.defaultSize.width),
          height: Math.min(260, builtinDef.defaultSize.height),
        };
        const width =
          remembered?.size.width ??
          Math.min(builtinDef.defaultSize.width, screenWidth - 48);
        const height =
          remembered?.size.height ??
          Math.min(builtinDef.defaultSize.height, screenHeight - 120);
        const sameAppPositions = shellWindows
          .filter((w) => w.appId === resolvedAppId && !w.minimized)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((w) => w.position);
        const clamped = clampWindowBounds(
          computeCenteredOrCascadedPosition(
            sameAppPositions,
            { width, height },
            screenWidth,
            screenHeight,
            remembered?.position
          ),
          { width, height },
          screenWidth,
          screenHeight,
          { minWidth: minSize.width, minHeight: minSize.height }
        );
        const targetWorkspace =
          remembered?.workspace !== undefined
            ? clampWorkspace(remembered.workspace, settings.workspaceCount)
            : clampWorkspace(settings.activeWorkspace, settings.workspaceCount);
        const newWin: DesktopWindowInstance = {
          id: newWinId,
          appId: resolvedAppId,
          title:
            (builtinKind === "text-editor" || builtinKind === "image-viewer") &&
            options?.payload
              ? options.payload.split("/").pop() || builtinDef.name
              : builtinDef.name,
          iconName: builtinDef.iconName,
          gradient: builtinDef.gradient,
          builtinComponent: builtinKind,
          clientFrame:
            options?.forceCsd ?? builtinKind !== "terminal",
          workspace: targetWorkspace,
          position: clamped.position,
          size: clamped.size,
          minSize,
          minimized: false,
          maximized: remembered?.maximized ?? false,
          zIndex: ++nextZIndex,
          payload: options?.payload,
        };
        beginStartupNotification(resolvedAppId);
        if (targetWorkspace !== settings.activeWorkspace) {
          updateSettings({ activeWorkspace: targetWorkspace });
        }
        combinedWindowsRef.current = [...combinedWindowsRef.current, newWin];
        setShellWindows((prev) => {
          if (
            !options?.forceNew &&
            prev.some((w) => w.appId === resolvedAppId && (!DOCUMENT_SCOPED_APP_IDS.has(appId) || !options?.payload || w.payload === options.payload))
          ) {
            return prev;
          }
          return [...prev, newWin];
        });
        setFocusedWindowId(newWin.id);
        setMruIds((prev) => [newWin.id, ...prev]);
        domicile.windows.focusShell();
        return;
      }

      // All other applications run as native Wayland / Linux processes (with XDG Startup Notification)
      if (!options?.forceNew) {
        const now = Date.now();
        const launchKey = `${appId.toLowerCase()}::${options?.payload ?? ""}`;
        const lastAt = recentLaunchGuardRef.current.get(launchKey) ?? 0;
        if (now - lastAt < 500) {
          return;
        }
        recentLaunchGuardRef.current.set(launchKey, now);
      }
      beginStartupNotification(appId);
      if (def?.linuxCommand) {
        launchDesktopCommand(domicile, def.linuxCommand);
        return;
      }
      const lowerAppId = appId.toLowerCase();
      const matchedXdg = installedXdgApps.find(
        (entry) =>
          entry.appId.toLowerCase() === lowerAppId ||
          entry.desktopId.toLowerCase() === lowerAppId ||
          entry.desktopId.toLowerCase() === `${lowerAppId}.desktop`
      );
      if (matchedXdg && matchedXdg.execArgv.length > 0) {
        launchDesktopCommand(domicile, matchedXdg.execArgv);
        return;
      }
      // Reverse-DNS IDs (e.g. `org.gnome.Calculator`, `com.github.tchx84.Flatseal`)
      // launch via `flatpak run <appId>` when not already matched to an XDG entry.
      if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+$/.test(appId)) {
        launchDesktopCommand(domicile, ["flatpak", "run", appId]);
        return;
      }
      launchDesktopCommand(domicile, [appId]);
    },
    [
      beginStartupNotification,
      clearLaunchOverlays,
      combinedWindows,
      domicile,
      focusWindow,
      gnomeCapabilities.gnomeControlCenter,
      installedXdgApps,
      isBrowserRuntime,
      markWindowUnready,
      screenHeight,
      screenWidth,
      settings.activeWorkspace,
      settings.hiddenGnomePanels,
      settings.preferGnomeControlCenter,
      settings.savedWindowBounds,
      settings.workspaceCount,
      shellWindows,
      updateSettings,
    ]
  );

  const openGnomeSettings = React.useCallback(
    (panel?: GnomeSettingsPanel | (string & {})) => {
      if (isBrowserRuntime) {
        const reverseMap: Record<string, string> = {
          wifi: "network",
          network: "network",
          bluetooth: "network",
          sound: "sound",
          display: "displays",
          background: "wallpaper",
          appearance: "appearance",
          notifications: "notifications",
          system: "about",
        };
        launchApp("settings", {
          payload: panel ? reverseMap[panel] : undefined,
          forceCsd: true,
        });
        return;
      }
      openGnomeControlCenter(domicile, panel, settings.hiddenGnomePanels);
    },
    [domicile, isBrowserRuntime, launchApp, settings.hiddenGnomePanels]
  );

  const openWebUrl = React.useCallback(
    (
      rawUrl: string,
      options?: { asApp?: boolean; appId?: string; title?: string }
    ) => {
      const normalized = normalizeWebUrl(rawUrl);
      if (!normalized) return;
      clearLaunchOverlays();
      const matchedWebApp = findMatchingWebApp(
        normalized,
        settings.installedWebApps
      );
      const resolvedAppId = options?.appId ?? matchedWebApp?.id;
      const resolvedTitle = options?.title ?? matchedWebApp?.title;
      const canonical = canonicalizeWebUrl(normalized);
      if (canonical) {
        const existing = combinedWindows.find(
          (w) =>
            w.browserUrl &&
            canonicalizeWebUrl(w.browserUrl) === canonical &&
            (!resolvedAppId || w.appId === resolvedAppId)
        );
        if (existing) {
          focusWindow(existing.id);
          return;
        }
      }
      console.info("[Piloti] openWebUrl", normalized);
      beginStartupNotification(
        resolvedAppId ?? (canonical ? `webview:${canonical}` : "browser")
      );
      if (resolvedTitle) {
        pendingWebTitlesRef.current.set(
          resolvedAppId ?? normalized,
          resolvedTitle
        );
        pendingWebTitlesRef.current.set(normalized, resolvedTitle);
      }
      if (options?.asApp) {
        domicile.browser.openApp(normalized, {
          id: resolvedAppId ?? normalized,
          reuse: AppReuse.Focus,
        });
      } else {
        domicile.browser.open(normalized);
      }
    },
    [
      beginStartupNotification,
      clearLaunchOverlays,
      combinedWindows,
      domicile.browser,
      focusWindow,
      settings.installedWebApps,
    ]
  );

  const launchXdgApp = React.useCallback(
    (entry: XdgDesktopEntry, actionId?: string) => {
      clearLaunchOverlays();
      console.info("[Piloti] launchXdgApp", entry.desktopId, actionId ?? null);
      const execCmd = entry.execArgv[0];
      if (execCmd === "piloti-webapp" && entry.execArgv[1]) {
        openWebUrl(entry.execArgv[1], {
          asApp: true,
          title: entry.name,
        });
        return;
      }
      const builtinExecMap: Record<string, string> = {
        "piloti-files": "nautilus",
        "piloti-shell": "terminal",
        "piloti-terminal": "terminal",
        "piloti-notepad": "text-editor",
        "piloti-calculator": "calculator",
        "piloti-image-viewer": "image-viewer",
        "piloti-login": "login-screen",
        "piloti-applications": "app-store",
        "piloti-app-store": "app-store",
        "piloti-console": "console",
        "piloti-desktop": "console",
        "piloti-devtools": "console",
        "piloti-settings": "settings",
      };
      if (execCmd && builtinExecMap[execCmd]) {
        launchApp(builtinExecMap[execCmd]);
        return;
      }
      if (isBrowserRuntime) {
        const lower = `${entry.desktopId} ${entry.appId}`.toLowerCase();
        if (lower.includes("settings") || lower.includes("controlcenter")) {
          launchApp("settings", { forceCsd: true });
          return;
        }
      } else if (
        !actionId &&
        (entry.desktopId === "org.gnome.Settings.desktop" ||
          entry.desktopId === "gnome-control-center.desktop" ||
          entry.execArgv[0]?.endsWith("gnome-control-center") === true)
      ) {
        openGnomeControlCenter(domicile, undefined, settings.hiddenGnomePanels);
        return;
      }
      beginStartupNotification(entry.appId);
      launchXdgEntry(entry, actionId);
    },
    [
      beginStartupNotification,
      clearLaunchOverlays,
      domicile,
      isBrowserRuntime,
      launchApp,
      launchXdgEntry,
      openWebUrl,
      settings.hiddenGnomePanels,
    ]
  );

  const toggleOverview = React.useCallback(() => {
    setAltTabState((prev) => (prev.open ? { ...prev, open: false } : prev));
    setOverviewOpen((prev) => {
      const next = !prev;
      if (next) domicile.windows.focusShell();
      return next;
    });
  }, [domicile.windows]);

  const moveWindowToWorkspace = React.useCallback(
    (windowId: string, targetWorkspace: number) => {
      const ws = Math.max(1, targetWorkspace);
      const targetWin = combinedWindows.find((w) => w.id === windowId);
      console.info(
        `[Piloti] moved ${targetWin?.appId || windowId} to workspace ${ws}`
      );
      const settingsPatch: {
        workspaceCount?: number;
        savedWindowBounds?: typeof settings.savedWindowBounds;
      } = {};
      if (ws > settings.workspaceCount) {
        settingsPatch.workspaceCount = ws;
      }
      if (targetWin) {
        const key = resolveSpatialBoundsKey({
          appId: targetWin.appId,
          payload: targetWin.payload,
          browserUrl: targetWin.browserUrl,
          desktopId: targetWin.waylandDesktopId,
        });
        settingsPatch.savedWindowBounds = {
          ...settings.savedWindowBounds,
          [key]: {
            position: targetWin.position,
            size: targetWin.size,
            workspace: ws,
            maximized: targetWin.maximized,
            monitor: primaryMonitorName,
          },
        };
      }
      if (Object.keys(settingsPatch).length > 0) {
        updateSettings(settingsPatch);
      }
      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => ({
          ...cur,
          workspace: ws,
        }));
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        patchExternalMeta(setBrowserMeta, rawId, (cur) => ({
          ...cur,
          workspace: ws,
        }));
      } else {
        setShellWindows((prev) =>
          prev.map((w) => (w.id === windowId ? { ...w, workspace: ws } : w))
        );
      }
    },
    [
      combinedWindows,
      primaryMonitorName,
      settings.savedWindowBounds,
      settings.workspaceCount,
      updateSettings,
    ]
  );

  const removeWorkspace = React.useCallback(
    (workspace: number) => {
      if (settings.workspaceCount <= 1) return;
      const remap = (ws: number) =>
        ws === workspace ? 1 : ws > workspace ? ws - 1 : ws;
      setWaylandMeta((prev) => {
        const next: Record<string, ExternalWindowMeta> = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] = { ...v, workspace: remap(v.workspace) };
        }
        return next;
      });
      setBrowserMeta((prev) => {
        const next: Record<string, ExternalWindowMeta> = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] = { ...v, workspace: remap(v.workspace) };
        }
        return next;
      });
      setShellWindows((prev) =>
        prev.map((w) => ({ ...w, workspace: remap(w.workspace) }))
      );
      const nextCount = settings.workspaceCount - 1;
      const nextActive = Math.min(
        nextCount,
        settings.activeWorkspace === workspace
          ? 1
          : settings.activeWorkspace > workspace
            ? settings.activeWorkspace - 1
            : settings.activeWorkspace
      );
      updateSettings({ workspaceCount: nextCount, activeWorkspace: nextActive });
    },
    [settings.activeWorkspace, settings.workspaceCount, updateSettings]
  );

  const setAltTabIndex = React.useCallback<
    React.Dispatch<React.SetStateAction<number>>
  >((value) => {
    setAltTabState((prev) => ({
      ...prev,
      index: typeof value === "function" ? value(prev.index) : value,
    }));
  }, []);

  const mruWindows = React.useMemo(() => {
    const map = new Map(combinedWindows.map((w) => [w.id, w]));
    const ordered: DesktopWindowInstance[] = [];
    for (const id of mruIds) {
      const win = map.get(id);
      if (win) {
        ordered.push(win);
        map.delete(id);
      }
    }
    for (const win of map.values()) {
      ordered.push(win);
    }
    return ordered;
  }, [combinedWindows, mruIds]);

  const openAltTab = React.useCallback(() => {
    if (mruWindows.length === 0) return;
    domicile.windows.focusShell();
    setAltTabState({
      open: true,
      index: mruWindows.length > 1 ? 1 : 0,
    });
  }, [domicile.windows, mruWindows.length]);

  const cycleAltTab = React.useCallback(
    (delta: number) => {
      if (mruWindows.length === 0) return;
      domicile.windows.focusShell();
      setAltTabState((prev) => {
        if (!prev.open) {
          return {
            open: true,
            index: mruWindows.length > 1 ? 1 : 0,
          };
        }
        return {
          open: true,
          index: (prev.index + delta + mruWindows.length) % mruWindows.length,
        };
      });
    },
    [domicile.windows, mruWindows.length]
  );

  const commitAltTab = React.useCallback(
    (explicitWindowId?: string) => {
      const targetId = explicitWindowId ?? mruWindows[altTabIndex]?.id;
      setAltTabState((prev) => (prev.open ? { ...prev, open: false } : prev));
      if (targetId) {
        focusWindow(targetId);
      }
    },
    [altTabIndex, focusWindow, mruWindows]
  );

  const closeAltTab = React.useCallback(() => {
    setAltTabState((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  const switchWorkspace = React.useCallback(
    (delta: -1 | 1) => {
      const next = Math.max(
        1,
        Math.min(settings.workspaceCount, settings.activeWorkspace + delta)
      );
      if (next !== settings.activeWorkspace) {
        console.info(`[Piloti] switched to workspace ${next}`);
        updateSettings({ activeWorkspace: next });
      }
    },
    [settings.activeWorkspace, settings.workspaceCount, updateSettings]
  );

  useGlobalShortcuts({
    domicile,
    isBrowserRuntime,
    overviewOpen,
    setOverviewOpen,
    toggleOverview,
    setLauncherOpen,
    setControlPanelOpen,
    altTabOpen,
    cycleAltTab,
    commitAltTab,
    closeAltTab,
    switchWorkspace,
    takeScreenshot,
    focusedWindowId,
    launchApp,
    closeWindow,
    toggleMinimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
  });

  const dockRefs = React.useRef<
    Record<string, React.RefObject<Element | null>>
  >({});
  const registerDockRef = React.useCallback(
    (appId: string, node: HTMLElement | null) => {
      if (!dockRefs.current[appId]) {
        dockRefs.current[appId] = { current: node };
      } else {
        dockRefs.current[appId].current = node;
      }
    },
    []
  );

  const getDockRef = React.useCallback(
    (appId: string): React.RefObject<Element | null> => {
      if (!dockRefs.current[appId]) {
        dockRefs.current[appId] = { current: null };
      }
      return dockRefs.current[appId];
    },
    []
  );

  const focusedWindow = React.useMemo(
    () => combinedWindows.find((w) => w.id === focusedWindowId),
    [combinedWindows, focusedWindowId]
  );

  const { activeAppDef, handleMenuAction } = useGlobalAppMenu({
    focusedWindow,
    focusedWindowId,
    installedWebApps: settings.installedWebApps,
    installedXdgApps,
    backendsCtx,
    closeWindow,
    toggleMinimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
    launchApp,
    setLauncherOpen,
    setControlPanelOpen,
  });

  // Persist open windows to localStorage via xdg-session-management-v1
  React.useEffect(() => {
    if (!sessionHydratedRef.current) return;
    if (!settings.restoreWindowsOnLogin) {
      clearXdgSession();
      return;
    }
    const records = combinedWindows.map((w) =>
      serializeWindowToXdgSession(w, primaryMonitorName)
    );
    const timer = setTimeout(() => {
      saveXdgSession(records);
    }, 150);
    const flush = () => saveXdgSession(records);
    window.addEventListener("beforeunload", flush);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", flush);
    };
  }, [combinedWindows, primaryMonitorName, settings.restoreWindowsOnLogin]);

  const workspaceWindows = React.useMemo(
    () =>
      combinedWindows.filter(
        (w) => w.pinned || w.workspace === settings.activeWorkspace
      ),
    [combinedWindows, settings.activeWorkspace]
  );

  React.useEffect(() => {
    const onOpenPath = (e: Event) => {
      const filePath = (e as CustomEvent<{ path?: string }>).detail?.path;
      if (!filePath) return;
      if (isBrowserRuntime) {
        const entry = getVfsEntry(filePath);
        if (entry && entry.kind === "file") {
          if (isImageVfsFile(entry.name, entry.content)) {
            launchApp("image-viewer", { payload: entry.path });
            return;
          }
          if (isTextEditableVfsFile(entry.name)) {
            launchApp("text-editor", { payload: entry.path });
            return;
          }
          openWebUrl(buildVfsEntryWebAppUrl(entry), {
            asApp: true,
            appId: `file:${entry.path}`,
            title: entry.name,
          });
        }
        return;
      }
      launchDesktopCommand(domicile, ["xdg-open", filePath]);
    };
    window.addEventListener("piloti:open-path", onOpenPath);
    return () => window.removeEventListener("piloti:open-path", onOpenPath);
  }, [domicile, isBrowserRuntime, launchApp, openWebUrl]);

  const value = React.useMemo<WindowsContextValue>(
    () => ({
      windows: combinedWindows,
      workspaceWindows,
      waylandPopups,
      focusedWindowId,
      focusedWindow,
      clearFocusedWindow,
      activeAppDef,
      mruWindows,
      launchingApps,
      markWindowReady,
      launchApp,
      launchXdgApp,
      openGnomeSettings,
      openWebUrl,
      setBrowserFavicon,
      setBrowserTitle,
      focusWindow,
      closeWindow,
      forceQuitApp,
      toggleMinimizeWindow,
      minimizeWindow,
      toggleMaximizeWindow,
      tileWindow,
      updateWindowGeometry,
      handleMenuAction,
      launcherOpen,
      setLauncherOpen,
      controlPanelOpen,
      setControlPanelOpen,
      aboutOpen,
      setAboutOpen,
      altTabOpen,
      altTabIndex,
      setAltTabIndex,
      openAltTab,
      cycleAltTab,
      commitAltTab,
      closeAltTab,
      overviewOpen,
      setOverviewOpen,
      toggleOverview,
      moveWindowToWorkspace,
      removeWorkspace,
      registerDockRef,
      getDockRef,
      subscribeClientWindowRequest,
    }),
    [
      aboutOpen,
      activeAppDef,
      altTabIndex,
      altTabOpen,
      closeAltTab,
      closeWindow,
      clearFocusedWindow,
      combinedWindows,
      launcherOpen,
      commitAltTab,
      controlPanelOpen,
      cycleAltTab,
      overviewOpen,
      focusWindow,
      focusedWindow,
      focusedWindowId,
      forceQuitApp,
      getDockRef,
      handleMenuAction,
      launchApp,
      launchXdgApp,
      launchingApps,
      markWindowReady,
      minimizeWindow,
      moveWindowToWorkspace,
      mruWindows,
      openAltTab,
      openGnomeSettings,
      openWebUrl,
      registerDockRef,
      removeWorkspace,
      setAltTabIndex,
      setBrowserFavicon,
      setBrowserTitle,
      subscribeClientWindowRequest,
      tileWindow,
      toggleOverview,
      toggleMaximizeWindow,
      toggleMinimizeWindow,
      updateWindowGeometry,
      waylandPopups,
      workspaceWindows,
    ]
  );

  return value;
}

export function useWindowManager() {
  const ctx = React.useContext(WindowsContext);
  if (!ctx) {
    throw new Error("useWindowManager must be used within DesktopStateProvider");
  }
  return ctx;
}

export function useWindowActions(): WindowActionsValue {
  const actions = React.useContext(WindowActionsContext);
  if (actions) return actions;
  const ctx = React.useContext(WindowsContext);
  if (!ctx) {
    throw new Error("useWindowActions must be used within DesktopStateProvider");
  }
  return ctx;
}

