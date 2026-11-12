/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  WEBVIEW_FAVICON_CHANGE_EVENT,
  WEBVIEW_GUEST_FOCUS_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
  WEBVIEW_PAGE_FAILURE_CHANGE_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import {
  DownloadIcon,
  GlobeIcon,
  Maximize2Icon,
  MenuIcon,
  MinusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { ConsoleApp } from "@/components/apps/ConsoleApp";
import { SettingsApp } from "@/components/apps/SettingsApp";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useWindowContext,
  Window,
  WindowContent,
  WindowControls,
  WindowMain,
  WindowTitle,
  WindowTitlebar,
} from "@/components/ui/window";
import {
  normalizeWebUrl,
  useSettings,
  useWindowManager,
  type DesktopWindowInstance,
} from "@/context/DesktopStateContext";
import { resolveCursorStyle } from "@/lib/cursors";
import { cn } from "@/lib/utils";

/**
 * Wraps the native Domicile `<app>` element and reports its exact viewport CSS
 * pixel box (`getBoundingClientRect()`) to `domicile.windows.setBounds` so
 * Wayland pointer coordinates and surface scaling match 1:1 to the pixel.
 */
function WaylandAppSurface({ win }: { win: DesktopWindowInstance }) {
  const domicile = useDomicile();
  const windowCtx = useWindowContext();
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const syncBounds = React.useCallback(() => {
    if (!win.waylandAppId) return;
    if (win.minimized) {
      domicile.windows.setBounds(win.waylandAppId, {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    domicile.windows.setBounds(win.waylandAppId, {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, [domicile.windows, win.minimized, win.waylandAppId]);

  React.useLayoutEffect(() => {
    syncBounds();
  }, [
    syncBounds,
    win.position.x,
    win.position.y,
    win.size.width,
    win.size.height,
    win.maximized,
  ]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncBounds());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncBounds]);

  return (
    <div ref={containerRef} className="h-full w-full flex-1 overflow-hidden">
      <app
        app-id={win.waylandAppId ?? ""}
        frame={
          win.syncedFrame !== undefined ? String(win.syncedFrame) : undefined
        }
        resizing={windowCtx?.resizing ? "" : undefined}
        style={{ cursor: resolveCursorStyle(win.cursor) }}
        className="block h-full w-full"
      />
    </div>
  );
}

function WebViewSurface({
  win,
  isCsd,
}: {
  win: DesktopWindowInstance;
  isCsd: boolean;
}) {
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const {
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    setBrowserFavicon,
  } = useWindowManager();
  const windowCtx = useWindowContext();
  const webviewRef = React.useRef<HTMLWebViewElement | null>(null);

  const [address, setAddress] = React.useState(win.browserUrl ?? "");
  const [latestFavicon, setLatestFavicon] = React.useState("");
  const [pageFailure, setPageFailure] = React.useState("");
  const [pageFailureError, setPageFailureError] = React.useState("");
  const [pageFailureCanProceed, setPageFailureCanProceed] =
    React.useState(false);

  const focusSelfRef = React.useRef(() => focusWindow(win.id));
  focusSelfRef.current = () => focusWindow(win.id);
  const faviconHandlerRef = React.useRef((fav: string) => {
    setLatestFavicon(fav);
    if (win.browserWindowId) setBrowserFavicon(win.browserWindowId, fav);
  });
  faviconHandlerRef.current = (fav: string) => {
    setLatestFavicon(fav);
    if (win.browserWindowId) setBrowserFavicon(win.browserWindowId, fav);
  };

  React.useEffect(() => {
    if (win.browserUrl) {
      setAddress(win.browserUrl);
    }
  }, [win.browserUrl]);

  React.useEffect(() => {
    const view = webviewRef.current;
    if (!view || isBrowserRuntime) return;

    const syncPage = () => {
      if (view.url) setAddress(view.url);
    };
    const syncFavicon = () => faviconHandlerRef.current(view.favicon || "");
    const syncFailure = () => {
      setPageFailure(view.pageFailure || "");
      setPageFailureError(view.pageFailureError || "");
      setPageFailureCanProceed(Boolean(view.pageFailureCanProceed));
    };
    const onGuestFocus = () => focusSelfRef.current();

    view.addEventListener(WEBVIEW_GUEST_FOCUS_EVENT, onGuestFocus);
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, syncPage);
    view.addEventListener(WEBVIEW_FAVICON_CHANGE_EVENT, syncFavicon);
    view.addEventListener(WEBVIEW_PAGE_FAILURE_CHANGE_EVENT, syncFailure);

    syncPage();
    syncFavicon();
    syncFailure();

    return () => {
      view.removeEventListener(WEBVIEW_GUEST_FOCUS_EVENT, onGuestFocus);
      view.removeEventListener(WEBVIEW_PAGE_CHANGE_EVENT, syncPage);
      view.removeEventListener(WEBVIEW_FAVICON_CHANGE_EVENT, syncFavicon);
      view.removeEventListener(WEBVIEW_PAGE_FAILURE_CHANGE_EVENT, syncFailure);
    };
  }, [isBrowserRuntime, win.browserWindowId]);

  const currentUrl = normalizeWebUrl(address) ?? win.browserUrl ?? "";
  const installedApps = settings.installedWebApps ?? [];
  const isInstalled =
    currentUrl !== "" && installedApps.some((a) => a.url === currentUrl);

  const toggleInstallApp = () => {
    if (!currentUrl) return;
    if (isInstalled) {
      updateSettings({
        installedWebApps: installedApps.filter((a) => a.url !== currentUrl),
      });
      return;
    }
    let fallbackTitle = currentUrl;
    try {
      fallbackTitle = new URL(currentUrl).hostname.replace(/^www\./, "");
    } catch {
      // keep raw URL
    }
    const appTitle =
      win.title && win.title !== "Web" ? win.title : fallbackTitle;
    updateSettings({
      installedWebApps: [
        ...installedApps,
        {
          id: `web:${currentUrl}`,
          title: appTitle,
          url: currentUrl,
          ...(latestFavicon ? { iconUrl: latestFavicon } : {}),
        },
      ],
    });
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-mac-content">
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        onDoubleClick={(e) => {
          if (!isCsd) return;
          if ((e.target as HTMLElement).closest("button")) return;
          toggleMaximizeWindow(win.id);
        }}
        className={cn(
          "relative flex shrink-0 items-center gap-2 border-b border-mac-separator bg-mac-titlebar px-3 select-none",
          isCsd ? "h-[46px] rounded-t-[inherit]" : "h-9"
        )}
      >
        <div className="flex shrink-0 items-center" data-window-no-drag>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="App menu"
              className="flex size-7 items-center justify-center rounded-md text-mac-label transition-colors hover:bg-black/8 dark:hover:bg-white/10"
            >
              <MenuIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                disabled={!currentUrl}
                onClick={toggleInstallApp}
              >
                {isInstalled ? (
                  <>
                    <Trash2Icon className="size-3.5" />
                    Remove App
                  </>
                ) : (
                  <>
                    <DownloadIcon className="size-3.5" />
                    Install App
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="pointer-events-none flex min-w-0 flex-1 items-center justify-center px-4">
          <span className="truncate text-[13px] font-semibold text-mac-label">
            {win.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
          {isCsd ? (
            <>
              <button
                type="button"
                aria-label="Minimize"
                onClick={() => minimizeWindow(win.id)}
                className="flex size-6 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
              >
                <MinusIcon className="size-3" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                aria-label="Maximize"
                onClick={() => toggleMaximizeWindow(win.id)}
                className="flex size-6 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
              >
                <Maximize2Icon className="size-3" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={() => closeWindow(win.id)}
                className="flex size-6 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
              >
                <XIcon className="size-3.5" strokeWidth={2.25} />
              </button>
            </>
          ) : (
            <div className="w-7" />
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isBrowserRuntime ? (
          <iframe
            src={normalizeWebUrl(address) ?? "about:blank"}
            title={win.title}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <webview
            ref={webviewRef}
            window={win.browserWindowId}
            resizing={windowCtx?.resizing ? "" : undefined}
            className="block h-full w-full bg-white dark:bg-zinc-950"
          />
        )}

        {pageFailure && !isBrowserRuntime && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-mac-content p-6 text-center text-mac-label">
            <GlobeIcon className="size-7 text-mac-label-secondary" />
            <div className="text-sm font-semibold">Unable to load page</div>
            <div className="text-xs text-mac-label-secondary">
              {pageFailureError || pageFailure}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => webviewRef.current?.reload()}
              >
                Reload
              </Button>
              {pageFailureCanProceed && (
                <Button
                  size="sm"
                  onClick={() => webviewRef.current?.proceedPastWarning()}
                >
                  Proceed Anyway
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const WindowBody = React.memo(
  function WindowBody({
    win,
    isCsd,
  }: {
    win: DesktopWindowInstance;
    isCsd: boolean;
  }) {
    const { isBrowserRuntime } = useSettings();

    if (win.waylandAppId && !isBrowserRuntime) {
      return <WaylandAppSurface win={win} />;
    }

    if (win.browserWindowId) {
      return <WebViewSurface win={win} isCsd={isCsd} />;
    }

    if (win.builtinComponent === "settings") {
      return (
        <SettingsApp
          initialPane={win.payload}
          isCsd={isCsd}
          windowId={win.id}
        />
      );
    }

    if (win.builtinComponent === "console") {
      return (
        <ConsoleApp
          initialModule={win.payload}
          isCsd={isCsd}
          windowId={win.id}
        />
      );
    }

    // In Browser Dev Mode, simulated non-Settings Wayland windows render a minimal surface card
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-mac-content p-6 text-center text-mac-label">
        <div className="text-sm font-semibold">{win.title}</div>
        <div className="text-xs text-mac-label-secondary">
          Simulated Wayland surface (`{win.waylandAppId ?? win.appId}`) ·
          Renders native Linux client under Domicile
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.isCsd === next.isCsd &&
    prev.win.id === next.win.id &&
    prev.win.builtinComponent === next.win.builtinComponent &&
    prev.win.payload === next.win.payload &&
    prev.win.waylandAppId === next.win.waylandAppId &&
    prev.win.browserWindowId === next.win.browserWindowId &&
    prev.win.browserUrl === next.win.browserUrl &&
    prev.win.browserIsApp === next.win.browserIsApp &&
    prev.win.syncedFrame === next.win.syncedFrame &&
    prev.win.cursor === next.win.cursor &&
    prev.win.title === next.win.title &&
    prev.win.position.x === next.win.position.x &&
    prev.win.position.y === next.win.position.y &&
    prev.win.size.width === next.win.size.width &&
    prev.win.size.height === next.win.size.height &&
    prev.win.maximized === next.win.maximized &&
    prev.win.minimized === next.win.minimized
);

export function WindowManager() {
  const { isBrowserRuntime, settings } = useSettings();
  const {
    workspaceWindows,
    waylandPopups,
    focusedWindowId,
    altTabOpen,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
    updateWindowGeometry,
    getDockRef,
  } = useWindowManager();

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

  const bottomDockClearance = settings.dockAutoHide ? 8 : settings.dockSize + 26;

  return (
    <div className="relative isolate z-10 min-h-0 flex-1 overflow-hidden">
      {/* Edge Snapping Drop Zone Preview */}
      {snapPreview && (
        <div
          aria-hidden="true"
          style={{
            bottom: `${bottomDockClearance + 6}px`,
          }}
          className={cn(
            "pointer-events-none absolute top-1.5 z-[5] rounded-[14px] border-2 border-mac-accent/70 bg-mac-accent/18 backdrop-blur-sm transition-all duration-150",
            snapPreview === "left" && "left-2 right-1/2 mr-1",
            snapPreview === "right" && "right-2 left-1/2 ml-1",
            snapPreview === "full" && "inset-x-2"
          )}
        />
      )}

      {workspaceWindows.map((win) => {
        const isFocused = focusedWindowId === win.id;
        const isCsd =
          settings.windowDecorationMode === "csd" ||
          (settings.windowDecorationMode === "auto" && Boolean(win.clientFrame));
        const isWaylandSurface = Boolean(win.waylandAppId) && !isBrowserRuntime;

        return (
          <Window
            key={win.id}
            position={win.position}
            onPositionChange={(pos) =>
              updateWindowGeometry(win.id, { position: pos })
            }
            size={win.size}
            onSizeChange={(sz) => updateWindowGeometry(win.id, { size: sz })}
            minSize={win.minSize}
            draggable
            resizable
            bounds="parent"
            inactive={!isFocused}
            minimized={win.minimized}
            minimizeTo={getDockRef(win.appId)}
            maximized={win.maximized}
            maximizeInsets={{
              top: 0,
              right: 0,
              bottom: bottomDockClearance,
              left: 0,
            }}
            onSnapPreviewChange={setSnapPreview}
            onSnapCommit={(zone) => tileWindow(win.id, zone)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onZoom={() => toggleMaximizeWindow(win.id)}
            onPointerDown={() => {
              if (!isFocused) {
                focusWindow(win.id);
              }
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: win.zIndex,
            }}
            className={cn(
              "contain-[layout_style]",
              isWaylandSurface && "bg-transparent"
            )}
          >
            <WindowMain
              className={cn(
                "relative",
                isWaylandSurface && "bg-transparent"
              )}
            >
              {/* Server-Side Titlebar (SSD) */}
              {!isCsd && (
                <WindowTitlebar className="justify-between">
                  <WindowControls />
                  <WindowTitle className="flex items-center justify-center gap-1.5">
                    <span className="truncate">{win.title}</span>
                  </WindowTitle>
                </WindowTitlebar>
              )}

              {/* Single-Click Adwaita HeaderBar Drag Strip for CSD Wayland Windows */}
              {isCsd && win.waylandAppId && !win.builtinComponent && (
                <div
                  data-window-drag-region
                  onDoubleClick={() => toggleMaximizeWindow(win.id)}
                  className="absolute inset-x-24 top-0 z-30 h-[46px] cursor-grab active:cursor-grabbing"
                />
              )}

              {/* Silent Alt / Super + Drag Full-Window Grab Overlay */}
              {modifierGrabActive && !altTabOpen && (
                <div
                  data-window-drag-region
                  className="absolute inset-0 z-40 cursor-grab active:cursor-grabbing"
                />
              )}

              <WindowContent className="flex flex-col overflow-hidden">
                <WindowBody win={win} isCsd={isCsd} />
              </WindowContent>
            </WindowMain>
          </Window>
        );
      })}

      {/* Wayland Child Popups */}
      {waylandPopups.map((popup) => (
        <div
          key={popup.appId}
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
            style={{ cursor: resolveCursorStyle(popup.cursor) }}
            className="block h-full w-full"
          />
        </div>
      ))}
    </div>
  );
}
