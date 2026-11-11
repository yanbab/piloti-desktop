import * as React from "react";
import { useDisplays } from "@domicile-desktop/react/displays";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { useFocusedWindow, useWindows } from "@domicile-desktop/react/windows";
import {
  WindowRequestKind,
  WindowState,
} from "@domicile-desktop/sdk/window-state";
import {
  APP_CATALOG,
  type AppDefinition,
  type BuiltinAppId,
} from "@/data/catalog";
import {
  type GnomeSettingsPanel,
  launchWithGnomeEnv,
  openGnomeControlCenter,
} from "@/lib/gnome-bridge";
import type { XdgDesktopEntry } from "xdg-desktop";
import { matchAppFromWayland, useApps } from "./AppsContext";
import { useSettings } from "./SettingsContext";
import { useSystemBackends } from "./SystemBackendsContext";

export interface DesktopWindowInstance {
  id: string;
  appId: string;
  title: string;
  iconName: string;
  iconUrl?: string;
  gradient: string;
  builtinComponent?: BuiltinAppId;
  waylandAppId?: string;
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
  minimized: boolean;
  maximized: boolean;
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

interface WindowsContextValue {
  windows: DesktopWindowInstance[];
  workspaceWindows: DesktopWindowInstance[];
  waylandPopups: ResolvedPopupWindow[];
  focusedWindowId: string | null;
  focusedWindow: DesktopWindowInstance | undefined;
  activeAppDef: AppDefinition;
  mruWindows: DesktopWindowInstance[];
  launchApp: (
    appId: string,
    options?: { payload?: string; forceNew?: boolean; forceCsd?: boolean }
  ) => void;
  launchXdgApp: (entry: XdgDesktopEntry, actionId?: string) => void;
  openGnomeSettings: (panel?: GnomeSettingsPanel) => void;
  openWebUrl: (rawUrl: string) => void;
  focusWindow: (windowId: string) => void;
  closeWindow: (windowId: string) => void;
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
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  controlCenterOpen: boolean;
  setControlCenterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aboutOpen: boolean;
  setAboutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openUrlOpen: boolean;
  setOpenUrlOpen: React.Dispatch<React.SetStateAction<boolean>>;
  altTabOpen: boolean;
  altTabIndex: number;
  setAltTabIndex: React.Dispatch<React.SetStateAction<number>>;
  openAltTab: () => void;
  cycleAltTab: (delta: number) => void;
  commitAltTab: (explicitWindowId?: string) => void;
  closeAltTab: () => void;
  registerDockRef: (appId: string, node: HTMLElement | null) => void;
  getDockRef: (appId: string) => React.RefObject<Element | null>;
}

const WindowsContext = React.createContext<WindowsContextValue | null>(null);

let nextZIndex = 20;
let nextShellWinCounter = 1;

interface ExternalWindowMeta {
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
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

export function WindowsProvider({ children }: { children: React.ReactNode }) {
  const domicile = useDomicile();
  const displays = useDisplays();
  const waylandWindows = useWindows();
  const waylandFocused = useFocusedWindow();
  const browserWindows =
    useWatch(domicile.browser, "change", () => domicile.browser.windows) ?? [];

  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { gnomeCapabilities, takeScreenshot } = useSystemBackends();
  const {
    installedXdgApps,
    getAppIconUrl,
    ensureWaylandIcons,
    launchXdgEntry,
  } = useApps();

  const primaryDisplay = displays?.[0];
  const screenWidth =
    primaryDisplay?.width ??
    (typeof window !== "undefined" ? window.innerWidth : 1440);
  const screenHeight =
    primaryDisplay?.height ??
    (typeof window !== "undefined" ? window.innerHeight : 900);

  // Built-in Settings window (the sole built-in shell app; auto-opened in Browser Dev Mode)
  const [shellWindows, setShellWindows] = React.useState<
    DesktopWindowInstance[]
  >(() => {
    if (typeof window !== "undefined" && window.__PILOTI_BROWSER_HOST__) {
      const settingsDef = APP_CATALOG.find((a) => a.id === "settings")!;
      const saved = settings.savedWindowBounds?.settings;
      return [
        {
          id: "shell:settings-1",
          appId: "settings",
          title: "System Settings",
          iconName: settingsDef.iconName,
          gradient: settingsDef.gradient,
          builtinComponent: "settings",
          workspace: 1,
          position: saved?.position ?? {
            x: Math.max(80, Math.round(screenWidth * 0.22)),
            y: Math.max(48, Math.round(screenHeight * 0.1)),
          },
          size: saved?.size ?? { width: 820, height: 540 },
          minSize: settingsDef.minSize ?? { width: 620, height: 400 },
          minimized: false,
          maximized: false,
          zIndex: ++nextZIndex,
          payload: "appearance",
        },
      ];
    }
    return [];
  });

  const [waylandMeta, setWaylandMeta] = React.useState<
    Record<string, ExternalWindowMeta>
  >({});

  const [browserMeta, setBrowserMeta] = React.useState<
    Record<string, ExternalWindowMeta>
  >({});

  // Sync Domicile `<webview>` browser windows
  React.useEffect(() => {
    const activeIds = new Set(browserWindows.map((bw) => bw.id));
    let newlyFocusedId: string | null = null;

    setBrowserMeta((prev) => {
      let changed = false;
      const next: Record<string, ExternalWindowMeta> = {};
      for (const [id, meta] of Object.entries(prev)) {
        if (activeIds.has(id)) next[id] = meta;
        else changed = true;
      }

      browserWindows.forEach((bw, idx) => {
        if (!next[bw.id]) {
          changed = true;
          const defaultW =
            bw.width > 200 ? bw.width : Math.min(1040, Math.max(640, screenWidth - 120));
          const defaultH =
            bw.height > 150 ? bw.height : Math.min(720, Math.max(460, screenHeight - 140));
          next[bw.id] = {
            position: {
              x: Math.max(40, 110 + (idx % 5) * 44),
              y: Math.max(24, 40 + (idx % 5) * 32),
            },
            size: { width: defaultW, height: defaultH },
            minimized: false,
            maximized: false,
            tiled: null,
            zIndex: ++nextZIndex,
            workspace: settings.activeWorkspace,
          };
          newlyFocusedId = `browser:${bw.id}`;
        }
      });

      return changed ? next : prev;
    });

    if (newlyFocusedId) {
      const fid = newlyFocusedId;
      setFocusedWindowId(fid);
      setMruIds((prev) => [fid, ...prev.filter((id) => id !== fid)]);
      domicile.windows.focusShell();
    }
  }, [
    browserWindows,
    domicile.windows,
    screenHeight,
    screenWidth,
    settings.activeWorkspace,
  ]);

  // Sync new Wayland windows and restore remembered geometry per desktopId
  React.useEffect(() => {
    const toplevels = waylandWindows.filter((w) => w.parent === undefined);
    const idsToResolve: string[] = [];

    setWaylandMeta((prev) => {
      let changed = false;
      const next = { ...prev };
      toplevels.forEach((w, idx) => {
        if (w.desktopId) idsToResolve.push(w.desktopId);
        if (!next[w.appId]) {
          changed = true;
          const remembered =
            settings.savedWindowBounds[w.desktopId] ??
            settings.savedWindowBounds[w.desktopId.replace(/\.desktop$/i, "")];
          next[w.appId] = {
            position: remembered?.position ?? {
              x: 90 + (idx % 5) * 48,
              y: 44 + (idx % 5) * 34,
            },
            size: remembered?.size ?? {
              width: w.width && w.width > 200 ? w.width : 760,
              height: w.height && w.height > 150 ? w.height : 500,
            },
            minimized: false,
            maximized: false,
            tiled: null,
            zIndex: ++nextZIndex,
            workspace: settings.activeWorkspace,
          };
        }
      });
      return changed ? next : prev;
    });

    if (idsToResolve.length > 0) {
      ensureWaylandIcons(idsToResolve);
    }
  }, [
    ensureWaylandIcons,
    settings.activeWorkspace,
    settings.savedWindowBounds,
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
          Err: () => undefined,
        });
        if (cancelled || !listening) return;
        stopListening = () => listening.stop();
        const reader = listening.items.getReader();

        while (!cancelled) {
          const { done, value: req } = await reader.read();
          if (done || !req || cancelled) break;
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
            req.kind === WindowRequestKind.Unmaximize ||
            req.kind === WindowRequestKind.Unfullscreen
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
          }
        }
      } catch {
        // ignore if stream closes
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
    }));

    const toplevels = waylandWindows
      .filter((w) => w.parent === undefined)
      .map((w, idx): DesktopWindowInstance => {
        const matched = matchAppFromWayland(w.desktopId, w.title);
        const xdgMatch = installedXdgApps.find(
          (e) =>
            e.desktopId === w.desktopId ||
            e.appId === w.desktopId ||
            e.appId.toLowerCase() === w.desktopId.toLowerCase()
        );
        const resolvedIconUrl =
          xdgMatch?.iconUrl ??
          getAppIconUrl(w.desktopId) ??
          getAppIconUrl(w.appId) ??
          getAppIconUrl(matched.id);
        const meta = waylandMeta[w.appId] ?? {
          position: { x: 90 + idx * 45, y: 48 + idx * 36 },
          size: { width: 740, height: 480 },
          minimized: false,
          maximized: false,
          tiled: null,
          zIndex: 15 + idx,
          workspace: 1,
        };
        return {
          id: `wayland:${w.appId}`,
          appId: xdgMatch?.appId ?? matched.id,
          title: w.title || xdgMatch?.name || matched.name || w.appId,
          iconName: matched.iconName,
          iconUrl: resolvedIconUrl,
          gradient: matched.gradient,
          waylandAppId: w.appId,
          clientFrame: w.clientFrame,
          cursor: w.cursor,
          syncedFrame: syncedParentFrames.get(w.appId),
          tiled: meta.tiled ?? null,
          workspace: meta.workspace,
          position: meta.position,
          size: meta.size,
          minSize: {
            width: w.minWidth ?? matched.minSize?.width ?? 320,
            height: w.minHeight ?? matched.minSize?.height ?? 220,
          },
          minimized: meta.minimized,
          maximized: meta.maximized,
          zIndex: meta.zIndex,
        };
      });

    const resolvedBrowserWindows = browserWindows.map((bw, idx): DesktopWindowInstance => {
      const meta = browserMeta[bw.id] ?? {
        position: { x: 110 + idx * 44, y: 40 + idx * 32 },
        size: { width: 960, height: 640 },
        minimized: false,
        maximized: false,
        tiled: null,
        zIndex: 18 + idx,
        workspace: settings.activeWorkspace,
      };
      let fallbackTitle = "Web View";
      if (bw.title) {
        fallbackTitle = bw.title;
      } else if (bw.url) {
        try {
          fallbackTitle = new URL(bw.url).hostname || bw.url;
        } catch {
          fallbackTitle = bw.url;
        }
      }
      return {
        id: `browser:${bw.id}`,
        appId: bw.appId || "browser",
        title: fallbackTitle,
        iconName: "globe",
        iconUrl: bw.appId ? getAppIconUrl(bw.appId) : getAppIconUrl("browser"),
        gradient: "from-cyan-400 via-blue-500 to-indigo-600",
        browserWindowId: bw.id,
        browserUrl: bw.url,
        browserIsApp: bw.isApp,
        workspace: meta.workspace,
        position: meta.position,
        size: meta.size,
        minSize: { width: 420, height: 300 },
        minimized: meta.minimized,
        maximized: meta.maximized,
        tiled: meta.tiled ?? null,
        zIndex: meta.zIndex,
      };
    });

    return [...resolvedShellWindows, ...resolvedBrowserWindows, ...toplevels].sort(
      (a, b) => a.zIndex - b.zIndex
    );
  }, [
    shellWindows,
    browserWindows,
    browserMeta,
    waylandWindows,
    waylandMeta,
    syncedParentFrames,
    installedXdgApps,
    getAppIconUrl,
    settings.activeWorkspace,
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
      const titlebarHeight = isCsd ? 0 : 32;
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

  const focusWindow = React.useCallback(
    (windowId: string) => {
      const newZ = ++nextZIndex;
      setFocusedWindowId(windowId);
      setMruIds((prev) => [windowId, ...prev.filter((id) => id !== windowId)]);

      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => ({
          ...cur,
          minimized: false,
          zIndex: newZ,
        }));
        domicile.windows.focus(rawId);
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        const curMeta = browserMeta[rawId];
        if (curMeta && curMeta.workspace !== settings.activeWorkspace) {
          updateSettings({ activeWorkspace: curMeta.workspace });
        }
        patchExternalMeta(setBrowserMeta, rawId, (cur) => ({
          ...cur,
          minimized: false,
          zIndex: newZ,
        }));
        domicile.windows.focusShell();
      } else {
        setShellWindows((prev) =>
          prev.map((w) => {
            if (w.id === windowId) {
              if (w.workspace !== settings.activeWorkspace) {
                updateSettings({ activeWorkspace: w.workspace });
              }
              return { ...w, minimized: false, zIndex: newZ };
            }
            return w;
          })
        );
        domicile.windows.focusShell();
      }
    },
    [browserMeta, domicile.windows, settings.activeWorkspace, updateSettings]
  );

  const closeWindow = React.useCallback(
    (windowId: string) => {
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
    [domicile.browser, domicile.windows]
  );

  const minimizeWindow = React.useCallback(
    (windowId: string) => {
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

  const toggleMaximizeWindow = React.useCallback((windowId: string) => {
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
  }, []);

  const updateWindowGeometry = React.useCallback(
    (
      windowId: string,
      patch: {
        position?: { x: number; y: number };
        size?: { width: number; height: number };
      }
    ) => {
      const clampedPosition = patch.position
        ? {
          x: Math.round(patch.position.x),
          y: Math.max(0, Math.round(patch.position.y)),
        }
        : undefined;

      const targetWin = combinedWindows.find((w) => w.id === windowId);
      if (targetWin) {
        const nextPos = clampedPosition ?? targetWin.position;
        const nextSize = patch.size ?? targetWin.size;
        const key = targetWin.appId;
        updateSettings({
          savedWindowBounds: {
            ...settings.savedWindowBounds,
            [key]: { position: nextPos, size: nextSize },
          },
        });
      }

      if (windowId.startsWith("wayland:")) {
        const rawId = windowId.slice("wayland:".length);
        patchExternalMeta(setWaylandMeta, rawId, (cur) => ({
          ...cur,
          position: clampedPosition ?? cur.position,
          size: patch.size ?? cur.size,
          tiled: clampedPosition ? null : cur.tiled,
        }));
      } else if (windowId.startsWith("browser:")) {
        const rawId = windowId.slice("browser:".length);
        patchExternalMeta(setBrowserMeta, rawId, (cur) => ({
          ...cur,
          position: clampedPosition ?? cur.position,
          size: patch.size ?? cur.size,
          tiled: clampedPosition ? null : cur.tiled,
        }));
      } else {
        setShellWindows((prev) =>
          prev.map((w) =>
            w.id === windowId
              ? {
                ...w,
                position: clampedPosition ?? w.position,
                size: patch.size ?? w.size,
                tiled: clampedPosition ? null : w.tiled,
              }
              : w
          )
        );
      }
    },
    [combinedWindows, settings.savedWindowBounds, updateSettings]
  );

  const tileWindow = React.useCallback(
    (windowId: string, side: "left" | "right" | "full") => {
      if (side === "full") {
        toggleMaximizeWindow(windowId);
        return;
      }
      const menubarHeight = 30;
      const topInset = 6;
      const bottomInset = settings.dockAutoHide ? 12 : settings.dockSize + 30;
      const usableHeight = Math.max(
        300,
        screenHeight - menubarHeight - topInset - bottomInset
      );
      const halfWidth = Math.floor((screenWidth - 24) / 2);
      const pos = {
        x: side === "left" ? 8 : halfWidth + 16,
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
      focusWindow(windowId);
    },
    [
      focusWindow,
      screenHeight,
      screenWidth,
      settings.dockAutoHide,
      settings.dockSize,
      toggleMaximizeWindow,
    ]
  );

  const launchApp = React.useCallback(
    (
      appId: string,
      options?: { payload?: string; forceNew?: boolean; forceCsd?: boolean }
    ) => {
      const def = APP_CATALOG.find((a) => a.id === appId);

      // Focus existing window unless forceNew
      if (!options?.forceNew) {
        const existing = combinedWindows.find((w) => w.appId === appId);
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

      if (
        !isBrowserRuntime &&
        appId === "settings" &&
        settings.preferGnomeControlCenter &&
        gnomeCapabilities.gnomeControlCenter &&
        options?.forceCsd === undefined
      ) {
        const panelMap: Record<string, GnomeSettingsPanel> = {
          appearance: "appearance",
          wallpaper: "background",
          network: "wifi",
          sound: "sound",
          displays: "display",
          about: "system",
        };
        const panel = options?.payload ? panelMap[options.payload] : undefined;
        openGnomeControlCenter(domicile, panel, settings.hiddenGnomePanels);
        return;
      }

      // Only `settings` is a built-in shell window
      if (appId === "settings" || def?.builtinComponent === "settings") {
        const settingsDef = def ?? APP_CATALOG[0];
        const count = ++nextShellWinCounter;
        const offset = (count % 5) * 28;
        const remembered = settings.savedWindowBounds?.settings;
        const width =
          remembered?.size.width ??
          Math.min(settingsDef.defaultSize.width, screenWidth - 48);
        const height =
          remembered?.size.height ??
          Math.min(settingsDef.defaultSize.height, screenHeight - 120);
        const newWin: DesktopWindowInstance = {
          id: `shell:settings-${count}`,
          appId: "settings",
          title: settingsDef.name,
          iconName: settingsDef.iconName,
          gradient: settingsDef.gradient,
          builtinComponent: "settings",
          clientFrame: options?.forceCsd ?? settings.uiTheme === "adwaita",
          workspace: settings.activeWorkspace,
          position: remembered?.position ?? {
            x: Math.max(24, Math.round((screenWidth - width) / 2 - 20 + offset)),
            y: Math.max(
              42,
              Math.round((screenHeight - height) / 2 - 20 + offset)
            ),
          },
          size: { width, height },
          minSize: settingsDef.minSize ?? { width: 620, height: 400 },
          minimized: false,
          maximized: false,
          zIndex: ++nextZIndex,
          payload: options?.payload,
        };
        setShellWindows((prev) => [...prev, newWin]);
        setFocusedWindowId(newWin.id);
        setMruIds((prev) => [newWin.id, ...prev]);
        return;
      }

      // All other applications run as native Wayland / Linux processes (or FakeHost Wayland windows)
      launchWithGnomeEnv(domicile, def?.linuxCommand ?? [appId]);
    },
    [
      combinedWindows,
      domicile,
      focusWindow,
      gnomeCapabilities.gnomeControlCenter,
      isBrowserRuntime,
      screenHeight,
      screenWidth,
      settings.activeWorkspace,
      settings.hiddenGnomePanels,
      settings.preferGnomeControlCenter,
      settings.savedWindowBounds,
      settings.uiTheme,
    ]
  );

  const openGnomeSettings = React.useCallback(
    (panel?: GnomeSettingsPanel) => {
      if (isBrowserRuntime) {
        const reverseMap: Partial<Record<GnomeSettingsPanel, string>> = {
          wifi: "network",
          network: "network",
          bluetooth: "network",
          sound: "sound",
          display: "displays",
          background: "wallpaper",
          appearance: "appearance",
          system: "about",
        };
        launchApp("settings", {
          payload: panel ? reverseMap[panel] ?? "appearance" : "appearance",
          forceCsd: true,
        });
        return;
      }
      openGnomeControlCenter(domicile, panel, settings.hiddenGnomePanels);
    },
    [domicile, isBrowserRuntime, launchApp, settings.hiddenGnomePanels]
  );

  const launchXdgApp = React.useCallback(
    (entry: XdgDesktopEntry, actionId?: string) => {
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
      launchXdgEntry(entry, actionId);
    },
    [
      domicile,
      isBrowserRuntime,
      launchApp,
      launchXdgEntry,
      settings.hiddenGnomePanels,
    ]
  );

  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [controlCenterOpen, setControlCenterOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [openUrlOpen, setOpenUrlOpen] = React.useState(false);

  const openWebUrl = React.useCallback(
    (rawUrl: string) => {
      const normalized = normalizeWebUrl(rawUrl);
      if (!normalized) return;
      domicile.browser.open(normalized);
    },
    [domicile.browser]
  );

  const [altTabState, setAltTabState] = React.useState<{
    open: boolean;
    index: number;
  }>({ open: false, index: 0 });
  const altTabOpen = altTabState.open;
  const altTabIndex = altTabState.index;

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

  // Global Domicile key grabs
  React.useEffect(() => {
    const chords = [
      "Alt+Space",
      "Alt+space",
      "Alt+Tab",
      "Alt+Shift+Tab",
      "Meta+Return",
      "Print",
    ];
    for (const c of chords) {
      try {
        domicile.keyboard.grab(c);
      } catch {
        // ignore invalid keysym warnings in fake host
      }
    }
    const unlisten = domicile.keyboard.on("shortcut", ({ chord }) => {
      if (chord === "Alt+Space" || chord === "Alt+space") {
        domicile.windows.focusShell();
        setCommandPaletteOpen((v) => !v);
      } else if (chord === "Alt+Tab") {
        domicile.windows.focusShell();
        cycleAltTab(1);
      } else if (chord === "Alt+Shift+Tab") {
        domicile.windows.focusShell();
        cycleAltTab(-1);
      } else if (chord === "Meta+Return") {
        launchWithGnomeEnv(domicile, ["kitty"]);
      } else if (chord === "Print") {
        void takeScreenshot();
      }
    });
    const unlistenRelease = domicile.keyboard.on(
      "shortcutrelease",
      ({ chord, altKey }) => {
        if ((chord === "Alt+Tab" || chord === "Alt+Shift+Tab") && !altKey) {
          commitAltTab();
        }
      }
    );
    const unlistenMods = domicile.keyboard.on("modifierschange", () => {
      if (
        altTabOpen &&
        domicile.keyboard.modifiers &&
        !domicile.keyboard.modifiers.alt
      ) {
        commitAltTab();
      }
    });
    return () => {
      unlisten();
      unlistenRelease();
      unlistenMods();
      for (const c of chords) {
        try {
          domicile.keyboard.ungrab(c);
        } catch {
          // ignore
        }
      }
    };
  }, [
    altTabOpen,
    commitAltTab,
    cycleAltTab,
    domicile,
    takeScreenshot,
  ]);

  // DOM keyboard shortcuts (Browser Dev Mode & shell-focused windows)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (isBrowserRuntime && e.altKey && e.code === "Space") ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
      if (isBrowserRuntime && e.altKey && e.key === "Tab") {
        e.preventDefault();
        cycleAltTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (altTabOpen) {
        if (e.key === "ArrowRight" || (isBrowserRuntime && e.key === "Tab")) {
          e.preventDefault();
          cycleAltTab(e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          cycleAltTab(-1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          commitAltTab();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeAltTab();
          return;
        }
      }
      if (isBrowserRuntime && e.metaKey && e.key === "Enter") {
        e.preventDefault();
        launchWithGnomeEnv(domicile, ["kitty"]);
        return;
      }
      if (e.altKey && e.key === ",") {
        e.preventDefault();
        launchApp("settings");
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setControlCenterOpen((v) => !v);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "w" && focusedWindowId) {
        e.preventDefault();
        closeWindow(focusedWindowId);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "m" && focusedWindowId) {
        e.preventDefault();
        toggleMinimizeWindow(focusedWindowId);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "f" && focusedWindowId) {
        e.preventDefault();
        toggleMaximizeWindow(focusedWindowId);
        return;
      }
      if (e.altKey && e.key === "[" && focusedWindowId) {
        e.preventDefault();
        tileWindow(focusedWindowId, "left");
        return;
      }
      if (e.altKey && e.key === "]" && focusedWindowId) {
        e.preventDefault();
        tileWindow(focusedWindowId, "right");
        return;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (altTabOpen && e.key === "Alt") {
        commitAltTab();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    altTabOpen,
    closeAltTab,
    closeWindow,
    commitAltTab,
    cycleAltTab,
    domicile,
    focusedWindowId,
    isBrowserRuntime,
    launchApp,
    tileWindow,
    toggleMaximizeWindow,
    toggleMinimizeWindow,
  ]);

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

  const activeAppDef = React.useMemo<AppDefinition>(() => {
    if (focusedWindow) {
      const def = APP_CATALOG.find((a) => a.id === focusedWindow.appId);
      if (def) return def;
      return matchAppFromWayland(focusedWindow.appId, focusedWindow.title);
    }
    return {
      id: "piloti",
      name: "Piloti",
      shortName: "Piloti",
      description: "Piloti Desktop Shell",
      category: "System",
      iconName: "sparkles",
      gradient: "from-blue-500 to-indigo-600",
      pinnedByDefault: false,
      defaultSize: { width: 800, height: 500 },
      menus: [
        {
          title: "File",
          items: [
            {
              label: "Launch Terminal",
              shortcut: "Meta+↵",
              actionId: "launch:terminal",
            },
            {
              label: "Open Files (Nautilus)",
              actionId: "launch:nautilus",
            },
            {
              label: "Open Command Palette…",
              shortcut: "Alt+Space",
              actionId: "shell:palette",
            },
          ],
        },
        {
          title: "View",
          items: [
            {
              label: "System Settings…",
              shortcut: "Alt+,",
              actionId: "launch:settings",
            },
            {
              label: "Toggle Control Center",
              shortcut: "Alt+N",
              actionId: "shell:control-center",
            },
          ],
        },
      ],
    };
  }, [focusedWindow]);

  const handleMenuAction = React.useCallback(
    (actionId: string) => {
      if (actionId === "window:close" && focusedWindowId) {
        closeWindow(focusedWindowId);
      } else if (actionId === "window:minimize" && focusedWindowId) {
        toggleMinimizeWindow(focusedWindowId);
      } else if (actionId === "window:zoom" && focusedWindowId) {
        toggleMaximizeWindow(focusedWindowId);
      } else if (actionId === "window:tile-left" && focusedWindowId) {
        tileWindow(focusedWindowId, "left");
      } else if (actionId === "window:tile-right" && focusedWindowId) {
        tileWindow(focusedWindowId, "right");
      } else if (actionId === "app:new-window" && focusedWindow) {
        launchApp(focusedWindow.appId, { forceNew: true });
      } else if (actionId.startsWith("settings:")) {
        const section = actionId.split(":")[1];
        launchApp("settings", { payload: section });
      } else if (actionId.startsWith("launch:")) {
        const target = actionId.split(":")[1];
        launchApp(target);
      } else if (actionId === "shell:palette") {
        setCommandPaletteOpen(true);
      } else if (actionId === "shell:control-center") {
        setControlCenterOpen((v) => !v);
      }
    },
    [
      closeWindow,
      focusedWindow,
      focusedWindowId,
      launchApp,
      tileWindow,
      toggleMaximizeWindow,
      toggleMinimizeWindow,
    ]
  );

  const workspaceWindows = React.useMemo(
    () => combinedWindows.filter((w) => w.workspace === settings.activeWorkspace),
    [combinedWindows, settings.activeWorkspace]
  );

  const value = React.useMemo<WindowsContextValue>(
    () => ({
      windows: combinedWindows,
      workspaceWindows,
      waylandPopups,
      focusedWindowId,
      focusedWindow,
      activeAppDef,
      mruWindows,
      launchApp,
      launchXdgApp,
      openGnomeSettings,
      openWebUrl,
      focusWindow,
      closeWindow,
      toggleMinimizeWindow,
      minimizeWindow,
      toggleMaximizeWindow,
      tileWindow,
      updateWindowGeometry,
      handleMenuAction,
      commandPaletteOpen,
      setCommandPaletteOpen,
      controlCenterOpen,
      setControlCenterOpen,
      aboutOpen,
      setAboutOpen,
      openUrlOpen,
      setOpenUrlOpen,
      altTabOpen,
      altTabIndex,
      setAltTabIndex,
      openAltTab,
      cycleAltTab,
      commitAltTab,
      closeAltTab,
      registerDockRef,
      getDockRef,
    }),
    [
      aboutOpen,
      activeAppDef,
      altTabIndex,
      altTabOpen,
      closeAltTab,
      closeWindow,
      combinedWindows,
      commandPaletteOpen,
      commitAltTab,
      controlCenterOpen,
      cycleAltTab,
      focusWindow,
      focusedWindow,
      focusedWindowId,
      getDockRef,
      handleMenuAction,
      launchApp,
      launchXdgApp,
      minimizeWindow,
      mruWindows,
      openAltTab,
      openGnomeSettings,
      openUrlOpen,
      openWebUrl,
      registerDockRef,
      setAltTabIndex,
      tileWindow,
      toggleMaximizeWindow,
      toggleMinimizeWindow,
      updateWindowGeometry,
      waylandPopups,
      workspaceWindows,
    ]
  );

  return (
    <WindowsContext.Provider value={value}>{children}</WindowsContext.Provider>
  );
}

export function useWindowManager() {
  const ctx = React.useContext(WindowsContext);
  if (!ctx) {
    throw new Error("useWindowManager must be used within WindowsProvider");
  }
  return ctx;
}

