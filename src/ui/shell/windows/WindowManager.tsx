/// <reference types="@domicile-desktop/react/elements" />
import { FX_DURATION, fxTransition } from "@/ui/fx/motion";
import { canResize } from "@/core/windows/tiling";
import { WorkspaceTransition } from "@/ui/shell/windows/WorkspaceTransition";
import { logAppEvent, recordAppReady } from "@/core/util/perf-log";
import * as React from "react";
import { emitShellEvent, onShellEvent } from "@/core/windows/shell-events";
import { usePiloti } from "@/platform/shared/piloti";
import { WindowRequestKind } from "@domicile-desktop/sdk/window-state";
import { resolveAppModuleByUrl } from "@/core/data/app-modules";
import { WindowMenuItems } from "@/ui/components/common/WindowMenuButton";
import {
  getAppSetting,
  getAppSettingsVersion,
  subscribeAppSettings,
} from "@/core/config/app-settings";
import { PresentationOverlay } from "@/ui/shell/windows/PresentationOverlay";
import {
  consumeLaunchOriginRect,
  type LaunchOriginRect,
} from "@/core/windows/launch-origin";
import { computeOverviewWindowLayouts } from "@/ui/shell/overview/overview-layout";
import {
  getWindowPresentations,
  presentationTransform,
  pruneWindowPresentations,
  setWorkArea,
  subscribeWindowPresentation,
} from "@/core/windows/window-presentation";
import { ShellTitlebar, WindowAppChrome } from "@/ui/shell/windows/WindowAppChrome";
import { DesktopIconsApp } from "@/ui/apps/desktop-icons/DesktopIconsApp";
import { DropdownMenu, DropdownMenuContent } from "@/ui/components/ui/dropdown-menu";
import {
  Window,
  WindowContent,
  type WindowHandle,
  WindowMain,
  type WindowResizeEdge,
} from "@/ui/components/ui/window";
import {
  useWindowManager,
  type DesktopWindowInstance,
  useDesktopSettings,
  useSettingsSelector,
} from "@/ui/context/DesktopStateContext";
import { cn } from "@/core/util/utils";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { WindowBody } from "@/ui/shell/windows/WindowBody";
import { dismissOpenPopups } from "@/ui/shell/windows/dismiss-popups";

const DOMICILE_RESIZE_EDGE_MAP: Record<number, WindowResizeEdge> = {
  1: "n",
  2: "s",
  4: "w",
  5: "nw",
  6: "sw",
  8: "e",
  9: "ne",
  10: "se",
};

export function WindowManager() {
  const piloti = usePiloti();
  const { compositor } = useCapabilities();
  const settings = useDesktopSettings(["activeWorkspace", "darkReaderWebEnabled", "debugMode", "demoExtensionEnabled", "dockAutoHide", "dockPosition", "dockSize", "installedWebApps", "pinnedAppIds", "pinnedExtensionIds", "windowButtonLayout", "windowDecorationMode"]);
  const reducedMotion = useSettingsSelector((v) => v.reducedMotion);
  const {
    windows,
    workspaceWindows,
    waylandPopups,
    focusedWindowId,
    altTabOpen,
    overviewOpen,
    launcherOpen,
    controlPanelOpen,
    focusWindow,
    clearFocusedWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
    updateWindowGeometry,
    getDockRef,
    subscribeClientWindowRequest,
  } = useWindowManager();

  const lastPointerRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const windowHandlesRef = React.useRef<Map<string, WindowHandle>>(new Map());
  const windowElementsRef = React.useRef<Map<string, HTMLDivElement>>(
    new Map()
  );
  const windowOriginsRef = React.useRef<Map<string, LaunchOriginRect>>(
    new Map()
  );
  const animatedOpenedRef = React.useRef<Set<string>>(new Set());
  const [domReadyIds, setDomReadyIds] = React.useState<Set<string>>(
    () => new Set()
  );
  // Log each window's life, to see how long apps take to show.
  const loggedWindowsRef = React.useRef<Map<string, string>>(new Map());
  const readyLoggedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const logged = loggedWindowsRef.current;
    for (const win of windows) {
      if (logged.has(win.id)) continue;
      logged.set(win.id, win.appId);
      logAppEvent(win.appId, "window created");
    }
    const open = new Set(windows.map((w) => w.id));
    for (const [id, appId] of logged) {
      if (open.has(id)) continue;
      logged.delete(id);
      readyLoggedRef.current.delete(id);
      logAppEvent(appId, "closed");
    }
  }, [windows]);
  const windowsRef = React.useRef(windows);
  windowsRef.current = windows;
  const handleDomReady = React.useCallback((id: string) => {
    const appId = loggedWindowsRef.current.get(id);
    if (appId && !readyLoggedRef.current.has(id)) {
      readyLoggedRef.current.add(id);
      // A frame says itself when its app is drawn (`IsolatedAppFrame`).
      if (!windowsRef.current.find((w) => w.id === id)?.isolated) recordAppReady(appId, false);
    }
    setDomReadyIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const [closingWindowIds, setClosingWindowIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [darkReaderByWindowId, setDarkReaderByWindowId] = React.useState<
    Record<string, boolean>
  >({});
  const toggleDarkReaderForWindow = React.useCallback(
    (windowId: string) => {
      setDarkReaderByWindowId((prev) => ({
        ...prev,
        [windowId]: !(prev[windowId] ?? Boolean(settings.darkReaderWebEnabled)),
      }));
    },
    [settings.darkReaderWebEnabled]
  );

  React.useLayoutEffect(() => {
    const activeIds = new Set(windows.map((w) => w.id));
    for (const id of Array.from(animatedOpenedRef.current)) {
      if (!activeIds.has(id)) {
        animatedOpenedRef.current.delete(id);
        windowOriginsRef.current.delete(id);
      }
    }
    setDomReadyIds((prev) => {
      let changed = false;
      for (const id of prev) {
        if (!activeIds.has(id)) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        if (activeIds.has(id)) next.add(id);
      }
      return next;
    });

    for (const win of windows) {
      if (win.ready === false) continue;
      if (win.builtinComponent && !domReadyIds.has(win.id)) continue;
      if (animatedOpenedRef.current.has(win.id)) continue;
      animatedOpenedRef.current.add(win.id);
      if (win.minimized || reducedMotion || settings.debugMode) continue;

      let origin =
        windowOriginsRef.current.get(win.id) ?? consumeLaunchOriginRect();
      if (!origin) {
        const dockEl = getDockRef(win.appId)?.current;
        if (dockEl) {
          const r = dockEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            origin = { left: r.left, top: r.top, width: r.width, height: r.height };
          }
        }
      }
      if (!origin) continue;
      windowOriginsRef.current.set(win.id, origin);

      const el = windowElementsRef.current.get(win.id);
      if (!el) continue;
      const originCx = origin.left + origin.width / 2;
      const originCy = origin.top + origin.height / 2;
      const winCx = win.position.x + win.size.width / 2;
      const winCy = win.position.y + win.size.height / 2;
      const dx = Math.round(originCx - winCx);
      const dy = Math.round(originCy - winCy);
      const scale = Math.max(
        0.12,
        Math.min(0.45, origin.width / Math.max(120, win.size.width))
      );

      el.style.transition = "none";
      el.style.transformOrigin = "center center";
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
      void el.offsetWidth;
      el.style.transition = fxTransition(FX_DURATION.open, "settle", "transform");
      el.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
      window.setTimeout(() => {
        if (windowElementsRef.current.get(win.id) === el) {
          el.style.transformOrigin = "top left";
        }
      }, 250);
    }
  }, [domReadyIds, getDockRef, reducedMotion, settings.debugMode, windows]);

  const handleAnimatedClose = React.useCallback(
    (win: DesktopWindowInstance) => {
      if (closingWindowIds.has(win.id)) return;
      const allowed = emitShellEvent(
        "piloti:before-close-window",
        { windowId: win.id },
        { cancelable: true },
      );
      if (!allowed) return;
      // A module may refuse: don't fade out a window that is going to stay.
      if (resolveAppModuleByUrl(win.browserUrl)) {
        closeWindow(win.id);
        return;
      }
      const el = windowElementsRef.current.get(win.id);
      if (!el || reducedMotion) {
        closeWindow(win.id);
        return;
      }

      setClosingWindowIds((prev) => new Set(prev).add(win.id));
      el.style.transition = "opacity 160ms ease-out";
      el.style.opacity = "0";
      window.setTimeout(() => {
        setClosingWindowIds((prev) => {
          const next = new Set(prev);
          next.delete(win.id);
          return next;
        });
        closeWindow(win.id);
      }, 160);
    },
    [closeWindow, closingWindowIds, reducedMotion]
  );

  React.useEffect(() => {
    const onRequestAnimatedClose = (detail: { windowId: string }) => {
      const windowId = detail?.windowId;
      if (!windowId) return;
      const win = windows.find((w) => w.id === windowId);
      if (win) {
        handleAnimatedClose(win);
      } else {
        closeWindow(windowId);
      }
    };
    return onShellEvent("piloti:request-animated-close", onRequestAnimatedClose);
  }, [closeWindow, handleAnimatedClose, windows]);
  const [windowContextMenu, setWindowContextMenu] = React.useState<{
    windowId: string;
    x: number;
    y: number;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const preload = () => {
      void import("@/ui/apps/files/FilesApp");
      void import("@/ui/apps/texts/TextsApp");
      void import("@/ui/apps/image-viewer/ImageViewerApp");
      void import("@/ui/apps/terminal/XtermTerminalApp");
      void import("@/ui/apps/settings/SettingsApp");
    };
    const ric = (
      window as {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(preload, { timeout: 1500 });
      return () => {
        (
          window as { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
      };
    }
    const timer = globalThis.setTimeout(preload, 800);
    return () => globalThis.clearTimeout(timer);
  }, []);

  const lastDomFocusedIdRef = React.useRef<string | null>(null);
  const workspaceWindowsRef = React.useRef(workspaceWindows);
  workspaceWindowsRef.current = workspaceWindows;
  const focusWindowRef = React.useRef(focusWindow);
  focusWindowRef.current = focusWindow;

  const heldPressRef = React.useRef<{
    pointerId: number;
    button: number;
    clientX: number;
    clientY: number;
    targetAppId: string | null;
  } | null>(null);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const targetAppId =
        e.target instanceof Element
          ? (e.target.closest("app")?.getAttribute("app-id") ?? null)
          : null;
      heldPressRef.current = {
        pointerId: e.pointerId,
        button: e.button,
        clientX: e.clientX,
        clientY: e.clientY,
        targetAppId,
      };
    };
    const onPointerMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (heldPressRef.current && e.pointerId === heldPressRef.current.pointerId) {
        heldPressRef.current.clientX = e.clientX;
        heldPressRef.current.clientY = e.clientY;
      }
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (heldPressRef.current && e.pointerId === heldPressRef.current.pointerId) {
        heldPressRef.current = null;
      }
    };
    window.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointermove", onPointerMove, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerup", onPointerEnd, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointercancel", onPointerEnd, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      window.removeEventListener("pointermove", onPointerMove, {
        capture: true,
      });
      window.removeEventListener("pointerup", onPointerEnd, {
        capture: true,
      });
      window.removeEventListener("pointercancel", onPointerEnd, {
        capture: true,
      });
    };
  }, []);

  React.useEffect(() => {
    return subscribeClientWindowRequest((req) => {
      const targetWin = workspaceWindowsRef.current.find(
        (w) => w.waylandAppId === req.appId
      );
      const handle = targetWin
        ? windowHandlesRef.current.get(targetWin.id)
        : undefined;
      if (!targetWin || !handle) return;
      focusWindowRef.current(targetWin.id);
      const rawReq = req as { kind: number; edges?: number };
      const held = heldPressRef.current;
      console.info(
        `[Piloti] client window request kind=${rawReq.kind} app=${req.appId} held=${held ? held.pointerId : "none"}`
      );
      if (!held) {
        // The button was already released before the async request arrived; drop it
        // so the window does not get stuck following the cursor.
        return;
      }
      if (held.targetAppId && held.targetAppId !== req.appId) {
        // Ignore stray startup/background requests (e.g. unset_fullscreen on launch)
        // when the active press belongs to a different window.
        return;
      }
      // On domicile 1.2.0-1 (pre-#2049), GTK4 apps (e.g. Nautilus, GNOME Flatpaks) emit
      // xdg_toplevel.unset_fullscreen (kind 3) right when a headerbar drag begins.
      // Because `held` guarantees a live pointer press on this window, accepting
      // Unfullscreen when not fullscreen enables GTK4 headerbar moves while still
      // ignoring startup/no-press unset_fullscreen events.
      // Omit `pointerId` so Wayland `<app>` drags use `window` capture listeners;
      // calling `setPointerCapture` from an async IPC callback after an `<app>`
      // pointerdown immediately triggers `lostpointercapture` in Chromium.
      if (
        rawReq.kind === 5 ||
        (req.kind === WindowRequestKind.Unfullscreen && !targetWin.fullscreen)
      ) {
        handle.startMove(held.clientX, held.clientY);
      } else if (rawReq.kind === 6 && typeof rawReq.edges === "number") {
        const edge = DOMICILE_RESIZE_EDGE_MAP[rawReq.edges];
        if (edge) handle.startResize(edge, held.clientX, held.clientY);
      }
    });
  }, [subscribeClientWindowRequest]);

  const [modifierGrabActive, setModifierGrabActive] = React.useState(false);
  const [snapPreview, setSnapPreview] = React.useState<
    "left" | "right" | "full" | null
  >(null);

  React.useEffect(() => {
    const syncModifier = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setModifierGrabActive(false);
        return;
      }
      setModifierGrabActive(e.altKey || e.metaKey);
    };
    const clearModifier = () => setModifierGrabActive(false);

    window.addEventListener("keydown", syncModifier);
    window.addEventListener(
      "domicile-guest-keydown",
      syncModifier as EventListener
    );
    window.addEventListener("keyup", syncModifier);
    window.addEventListener("blur", clearModifier);
    return () => {
      window.removeEventListener("keydown", syncModifier);
      window.removeEventListener(
        "domicile-guest-keydown",
        syncModifier as EventListener
      );
      window.removeEventListener("keyup", syncModifier);
      window.removeEventListener("blur", clearModifier);
    };
  }, []);

  React.useEffect(() => {
    if (launcherOpen || controlPanelOpen || altTabOpen || overviewOpen) {
      // Allow re-focusing the active window once shell overlays close.
      lastDomFocusedIdRef.current = null;
      return;
    }
    if (!focusedWindowId) {
      lastDomFocusedIdRef.current = null;
      return;
    }
    if (lastDomFocusedIdRef.current === focusedWindowId) return;

    const targetWin = workspaceWindowsRef.current.find(
      (w) => w.id === focusedWindowId && !w.minimized
    );
    if (!targetWin) return;
    lastDomFocusedIdRef.current = focusedWindowId;

    const frame = requestAnimationFrame(() => {
      if (targetWin.waylandAppId && compositor) {
        if (piloti.windows.focused !== targetWin.waylandAppId) {
          piloti.windows.focus(targetWin.waylandAppId);
        }
        return;
      }

      if (piloti.windows.focused !== undefined) {
        piloti.windows.focusShell();
      }
      const el = windowElementsRef.current.get(targetWin.id);
      if (!el || el.contains(document.activeElement)) return;
      const preferred = el.querySelector<HTMLElement>(
        "webview, iframe, [autofocus], [data-window-autofocus]"
      );
      (preferred ?? el).focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    altTabOpen,
    launcherOpen,
    controlPanelOpen,
    piloti.windows,
    overviewOpen,
    focusedWindowId,
    compositor,
    workspaceWindows.length,
  ]);

  const overviewLayouts = React.useMemo(() => {
    if (!overviewOpen || typeof window === "undefined") return null;
    return computeOverviewWindowLayouts(
      workspaceWindows,
      window.innerWidth,
      window.innerHeight - 30,
    );
  }, [overviewOpen, workspaceWindows]);
  const dockPosition = settings.dockPosition ?? "bottom";
  const dockEdgeClearance = settings.dockAutoHide ? 8 : settings.dockSize + 24;
  const bottomDockClearance = dockPosition === "bottom" ? dockEdgeClearance : 8;
  const leftDockClearance = dockPosition === "left" ? dockEdgeClearance : 0;
  const rightDockClearance = dockPosition === "right" ? dockEdgeClearance : 0;

  const workspaceStageRef = React.useRef<HTMLDivElement | null>(null);

  // Plugin presentations (Picture-in-Picture…): scaled like the overview,
  // without changing the window's real geometry.
  const windowPresentations = React.useSyncExternalStore(
    subscribeWindowPresentation,
    getWindowPresentations,
    getWindowPresentations,
  );
  const appSettingsVersion = React.useSyncExternalStore(
    subscribeAppSettings,
    getAppSettingsVersion,
    getAppSettingsVersion,
  );
  const [stageSize, setStageSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const stage = workspaceStageRef.current;
    if (!stage) return;
    const update = () =>
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  // Same rectangle a maximized window fills.
  const workArea = React.useMemo(
    () => ({
      x: leftDockClearance,
      y: 0,
      width: Math.max(0, stageSize.width - leftDockClearance - rightDockClearance),
      height: Math.max(0, stageSize.height - bottomDockClearance),
    }),
    [stageSize, leftDockClearance, rightDockClearance, bottomDockClearance],
  );
  React.useEffect(() => {
    setWorkArea(workArea);
  }, [workArea]);
  React.useEffect(() => {
    pruneWindowPresentations(new Set(windows.map((w) => w.id)));
  }, [windows]);

  React.useEffect(() => {
    let cleanupTimer = 0;
    const onZoomFromThumb = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          left?: number;
          top?: number;
          width?: number;
          height?: number;
        }>
      ).detail;
      const stage = workspaceStageRef.current;
      if (!stage || !detail || !detail.width || !detail.height) return;
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) return;

      const scaleX = detail.width / stageRect.width;
      const scaleY = detail.height / stageRect.height;
      const dx = (detail.left ?? 0) - stageRect.left;
      const dy = (detail.top ?? 0) - stageRect.top;

      window.clearTimeout(cleanupTimer);
      stage.style.transition = "none";
      stage.style.transformOrigin = "top left";
      stage.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`;
      stage.style.borderRadius = "14px";
      void stage.offsetWidth;
      stage.style.transition = fxTransition(FX_DURATION.overview, "settle", "transform", "border-radius");
      stage.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
      stage.style.borderRadius = "0px";
      cleanupTimer = window.setTimeout(() => {
        stage.style.transition = "";
        stage.style.transformOrigin = "";
        stage.style.transform = "";
        stage.style.borderRadius = "";
      }, 370);
    };
    window.addEventListener("piloti:workspace-zoom-from-thumb", onZoomFromThumb);
    return () => {
      window.clearTimeout(cleanupTimer);
      window.removeEventListener(
        "piloti:workspace-zoom-from-thumb",
        onZoomFromThumb,
      );
    };
  }, []);

  React.useEffect(() => {
    const onWindowBlur = () => {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === "IFRAME") {
        const winId = activeEl
          .closest("[data-window-id]")
          ?.getAttribute("data-window-id");
        if (winId) {
          focusWindowRef.current(winId);
        }
        dismissOpenPopups();
      }
    };
    window.addEventListener("blur", onWindowBlur);
    return () => window.removeEventListener("blur", onWindowBlur);
  }, []);

  const renderedWindows = windows;

  return (
    <div
      className="relative isolate z-10 min-h-0 flex-1 overflow-clip"
      onPointerDown={(e) => {
        // Menus are portaled out of their window (React still bubbles their
        // presses here): using one, or dismissing it, keeps the focus.
        if (
          !(e.target as HTMLElement).closest(
            '[data-slot="window"], [data-wayland-popup], [data-slot="select-content"], [data-slot="dropdown-menu-content"], [data-slot="context-menu-content"], [role="menu"], [data-popup-backdrop]',
          )
        ) {
          clearFocusedWindow();
        }
      }}
      onScroll={(e) => {
        if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
        if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
      }}
    >
      {/* Transparent Desktop Icons App (below windows, above wallpaper) */}
      <div
        style={{
          transition: fxTransition(FX_DURATION.overview, "settle", "opacity"),
        }}
        className={cn(
          "pointer-events-none absolute inset-0 z-0",
          overviewOpen && "opacity-0",
        )}
      >
        <DesktopIconsApp bottomInset={0} />
      </div>

      {/* Edge Snapping Drop Zone Preview */}
      {snapPreview && (
        <div
          aria-hidden="true"
          style={{
            bottom: `${bottomDockClearance + 6}px`,
          }}
          className={cn(
            "pointer-events-none absolute top-1.5 z-[5] rounded-[14px] border-2 border-ui-accent/70 bg-ui-accent/18 backdrop-blur-sm transition-all duration-150",
            snapPreview === "left" && "left-2 right-1/2 mr-1",
            snapPreview === "right" && "right-2 left-1/2 ml-1",
            snapPreview === "full" && "inset-x-2"
          )}
        />
      )}

      <div
        ref={workspaceStageRef}
        className="pointer-events-none absolute inset-0 z-[1] [&>*]:pointer-events-auto"
      >
        {renderedWindows.map((win) => {
          const isActiveWorkspace = win.workspace === settings.activeWorkspace;
          const isFocused = isActiveWorkspace && focusedWindowId === win.id;
          const isCsd =
            settings.windowDecorationMode === "csd" ||
            (settings.windowDecorationMode === "auto" && Boolean(win.clientFrame));
          const isWaylandSurface = Boolean(win.waylandAppId) && compositor;
          const ovLayout =
            overviewOpen && isActiveWorkspace
              ? overviewLayouts?.get(win.id)
              : undefined;
          const presentation = ovLayout
            ? undefined
            : windowPresentations.get(win.id);
          const presented = presentation
            ? presentationTransform(
              win.maximized
                ? { x: workArea.x, y: workArea.y, width: workArea.width }
                : { x: win.position.x, y: win.position.y, width: win.size.width },
              presentation,
            )
            : undefined;

          return (
            <Window
              key={win.id}
              data-app-id={win.appId}
              data-window-id={win.id}
              ref={(node) => {
                if (node) {
                  windowElementsRef.current.set(win.id, node);
                } else {
                  windowElementsRef.current.delete(win.id);
                }
              }}
              tabIndex={-1}
              windowRef={(handle) => {
                if (handle) {
                  windowHandlesRef.current.set(win.id, handle);
                } else {
                  windowHandlesRef.current.delete(win.id);
                }
              }}
              position={win.position}
              onPositionChange={(pos) =>
                updateWindowGeometry(win.id, { position: pos })
              }
              size={win.size}
              onSizeChange={(sz) => updateWindowGeometry(win.id, { size: sz })}
              minSize={win.minSize}
              maxSize={win.maxSize}
              draggable
              resizable={canResize(win.appId) && !presentation}
              bounds="parent"
              inactive={!isFocused}
              minimized={overviewOpen ? false : win.minimized}
              minimizeTo={getDockRef(win.appId)}
              minimizeEffect="scale"
              maximized={win.maximized}
              buttonLayout={settings.windowButtonLayout}
              maximizeInsets={{
                top: 0,
                right: rightDockClearance,
                bottom: bottomDockClearance,
                left: leftDockClearance,
              }}
              onSnapPreviewChange={
                !canResize(win.appId) ? undefined : setSnapPreview
              }
              onSnapCommit={
                !canResize(win.appId)
                  ? undefined
                  : (zone) => tileWindow(win.id, zone)
              }
              onClose={() => handleAnimatedClose(win)}
              onMinimize={() => minimizeWindow(win.id)}
              onZoom={
                !canResize(win.appId)
                  ? undefined
                  : () => toggleMaximizeWindow(win.id)
              }
              onContextMenu={(e) => {
                e.stopPropagation();
                const target = e.target as HTMLElement | null;
                const isSidebarBody = Boolean(
                  target?.closest('[data-slot="ui-sidebar"], aside') &&
                  !target?.closest('[data-slot="window-titlebar"]'),
                );
                if (
                  !isSidebarBody &&
                  target?.closest(
                    '[data-slot="window-titlebar"], [data-window-drag-region], [data-slot="ui-sidebar-header"]',
                  )
                ) {
                  e.preventDefault();
                  focusWindow(win.id);
                  setWindowContextMenu({
                    windowId: win.id,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }
              }}
              onWheel={(e) => e.stopPropagation()}
              onPointerDown={() => {
                if (!isFocused) {
                  focusWindow(win.id);
                }
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: presentation?.above ? 100000 + win.zIndex : win.zIndex,
                transformOrigin: "top left",
                transform: ovLayout
                  ? `translate(${ovLayout.dx}px, ${ovLayout.dy}px) scale(${ovLayout.scale})`
                  : presented
                    ? `translate(${presented.dx}px, ${presented.dy}px) scale(${presented.scale})`
                    : "translate3d(0px, 0px, 0px) scale(1)",
                transition:
                  presentation?.animate === false
                    ? "none"
                    : // No opacity fade: while a window is part transparent the
                    // vibrant sidebar cannot blur what is behind the window.
                    fxTransition(FX_DURATION.overview, "settle", "transform"),
              }}
              className={cn(
                "contain-[layout_style] outline-none",
                isWaylandSurface && "bg-transparent",
                // Debug mode shows a window while it is still loading.
                !settings.debugMode &&
                (win.ready === false ||
                  (win.builtinComponent && !domReadyIds.has(win.id))) &&
                "opacity-0 pointer-events-none",
                overviewOpen && "pointer-events-none",
                closingWindowIds.has(win.id) && "pointer-events-none",
                !isActiveWorkspace && "invisible pointer-events-none",
                // Per-app dark mode (`apps/<app-id>.ini` color-scheme=dark).
                appSettingsVersion >= 0 &&
                getAppSetting(win.appId, "color-scheme") === "dark" &&
                "dark",
              )}
              aria-hidden={!isActiveWorkspace || undefined}
            >
              <WindowMain
                className={cn(
                  "relative",
                  isWaylandSurface && "bg-transparent"
                )}
              >
                {/* Server-Side Titlebar (SSD) */}
                {!isCsd && win.builtinComponent !== "terminal" && (
                  <ShellTitlebar windowId={win.id} appId={win.appId} title={win.title} />
                )}

                {/* Non-interactive presentation: the presenter gets the pointer */}
                {presentation &&
                  (presentation.interactive === false || presentation.floating) && (
                    <PresentationOverlay
                      windowId={win.id}
                      presentation={presentation}
                      naturalSize={
                        win.maximized
                          ? { width: workArea.width, height: workArea.height }
                          : win.size
                      }
                      workArea={workArea}
                    />
                  )}

                {/* Silent Alt / Super + Drag Full-Window Grab Overlay */}
                {modifierGrabActive && !altTabOpen && (
                  <div
                    data-window-drag-region
                    className="absolute inset-0 z-40"
                  />
                )}

                <WindowContent className="flex flex-col overflow-hidden">
                  <WindowAppChrome
                    windowId={win.id}
                    appId={win.appId}
                    // The terminal never gets a server-side titlebar.
                    isCsd={isCsd || win.builtinComponent === "terminal"}
                  >
                    <WindowBody
                      win={win}
                      onDomReady={handleDomReady}
                      darkReaderEnabled={Boolean(
                        darkReaderByWindowId[win.id] ??
                        settings.darkReaderWebEnabled
                      )}
                      onToggleDarkReader={() => toggleDarkReaderForWindow(win.id)}
                    />
                  </WindowAppChrome>
                </WindowContent>
              </WindowMain>
            </Window>
          );
        })}
      </div>
      <WorkspaceTransition
        stageRef={workspaceStageRef}
        empty={!overviewOpen && !renderedWindows.some((w) => w.workspace === settings.activeWorkspace && !w.minimized)}
      />

      {/* Wayland Child Popups */}
      {waylandPopups.map((popup) => (
        <div
          key={popup.appId}
          data-wayland-popup=""
          onPointerDown={() => {
            if (focusedWindowId !== popup.parentToplevelId) {
              focusWindow(popup.parentToplevelId);
            }
          }}
          style={{
            position: "absolute",
            left: `${popup.x}px`,
            top: `${popup.y}px`,
            width: `${popup.width}px`,
            height: `${popup.height}px`,
            zIndex: popup.zIndex,
          }}
          className="pointer-events-auto overflow-visible"
        >
          <app
            app-id={popup.appId}
            frame={String(popup.frame)}
            style={popup.cursor ? { cursor: popup.cursor } : undefined}
            className="block h-full w-full"
          />
        </div>
      ))}

      {/* Headerbar Right-Click Window Menu (same entries as the ⋮ button) */}
      {windowContextMenu && (
        <DropdownMenu
          open
          onOpenChange={(open) => {
            if (!open) setWindowContextMenu(null);
          }}
        >
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={0}
            anchor={{
              getBoundingClientRect: () =>
                DOMRect.fromRect({
                  x: windowContextMenu.x,
                  y: windowContextMenu.y,
                  width: 0,
                  height: 0,
                }),
            }}
            className="min-w-44"
          >
            <WindowMenuItems
              windowId={windowContextMenu.windowId}
              onSelect={() => setWindowContextMenu(null)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
