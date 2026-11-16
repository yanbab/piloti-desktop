/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ResizeEdge as DomicileResizeEdge,
  WindowRequestKind,
} from "@domicile-desktop/sdk/window-state";
import {
  WEBVIEW_FAVICON_CHANGE_EVENT,
  WEBVIEW_GUEST_FOCUS_EVENT,
  WEBVIEW_LOADING_CHANGE_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
  WEBVIEW_PAGE_FAILURE_CHANGE_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import {
  DownloadIcon,
  GlobeIcon,
  Loader2Icon,
  Maximize2Icon,
  MinusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
const ConsoleApp = React.lazy(() =>
  import("@/components/apps/ConsoleApp").then((m) => ({
    default: m.ConsoleApp,
  }))
);

const FilesApp = React.lazy(() =>
  import("@/components/apps/FilesApp").then((m) => ({
    default: m.FilesApp,
  }))
);
const TextEditorApp = React.lazy(() =>
  import("@/components/apps/TextEditorApp").then((m) => ({
    default: m.TextEditorApp,
  }))
);
const TerminalApp = React.lazy(() =>
  import("@/components/apps/TerminalApp").then((m) => ({
    default: m.TerminalApp,
  }))
);
const AppStoreApp = React.lazy(() =>
  import("@/components/apps/AppStoreApp").then((m) => ({
    default: m.AppStoreApp,
  }))
);
const SettingsApp = React.lazy(() =>
  import("@/components/apps/SettingsApp").then((m) => ({
    default: m.SettingsApp,
  }))
);
import { DesktopIconsApp } from "@/components/apps/DesktopIconsApp";
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
  type WindowHandle,
  WindowMain,
  type WindowResizeEdge,
  WindowTitle,
  WindowTitlebar,
} from "@/components/ui/window";
import {
  normalizeWebUrl,
  useSettings,
  useWindowManager,
  type DesktopWindowInstance,
} from "@/context/DesktopStateContext";
import {
  canonicalizeWebUrl,
  fetchWebPageMetadata,
  findMatchingWebApp,
  getCachedWebThemeColor,
  getContrastForeground,
  getHostnameFallbackTitle,
  isHostnameFallbackTitle,
  setCachedWebDescription,
  setCachedWebThemeColor,
} from "@/data/web-apps";
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
    <div
      ref={containerRef}
      onWheel={(e) => e.stopPropagation()}
      className="h-full w-full flex-1 overflow-hidden overscroll-none"
    >
      <app
        app-id={win.waylandAppId ?? ""}
        frame={
          win.syncedFrame !== undefined ? String(win.syncedFrame) : undefined
        }
        resizing={windowCtx?.resizing ? "" : undefined}
        style={win.cursor ? { cursor: win.cursor } : undefined}
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
  const { isBrowserRuntime, resolvedTheme, settings, updateSettings } =
    useSettings();
  const {
    focusedWindowId,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    setBrowserFavicon,
    setBrowserTitle,
  } = useWindowManager();
  const windowCtx = useWindowContext();
  const webviewRef = React.useRef<HTMLWebViewElement | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);

  const [address, setAddress] = React.useState(win.browserUrl ?? "");
  const [editingAddress, setEditingAddress] = React.useState(false);
  const [draftAddress, setDraftAddress] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [latestFavicon, setLatestFavicon] = React.useState("");
  const [themeColor, setThemeColor] = React.useState<string | null>(
    () =>
      getCachedWebThemeColor(win.browserUrl, resolvedTheme === "dark") ?? null
  );
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
    const syncLoading = () => setIsLoading(Boolean(view.loading));
    const syncFavicon = () => faviconHandlerRef.current(view.favicon || "");
    const syncFailure = () => {
      setPageFailure(view.pageFailure || "");
      setPageFailureError(view.pageFailureError || "");
      setPageFailureCanProceed(Boolean(view.pageFailureCanProceed));
    };
    const onGuestFocus = () => focusSelfRef.current();
    const onThemeColor = (e: Event) => {
      const color =
        (
          e as CustomEvent<{ themeColor?: string }> & {
            themeColor?: string;
          }
        ).detail?.themeColor ?? (e as { themeColor?: string }).themeColor;
      const next = color?.trim() || null;
      setThemeColor(next);
      setCachedWebThemeColor(
        view.url || win.browserUrl,
        next,
        resolvedTheme === "dark"
      );
    };

    view.addEventListener(WEBVIEW_GUEST_FOCUS_EVENT, onGuestFocus);
    view.addEventListener(WEBVIEW_LOADING_CHANGE_EVENT, syncLoading);
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, syncPage);
    view.addEventListener(WEBVIEW_FAVICON_CHANGE_EVENT, syncFavicon);
    view.addEventListener(WEBVIEW_PAGE_FAILURE_CHANGE_EVENT, syncFailure);
    view.addEventListener("did-change-theme-color", onThemeColor);

    syncLoading();
    syncPage();
    syncFavicon();
    syncFailure();

    return () => {
      view.removeEventListener(WEBVIEW_GUEST_FOCUS_EVENT, onGuestFocus);
      view.removeEventListener(WEBVIEW_LOADING_CHANGE_EVENT, syncLoading);
      view.removeEventListener(WEBVIEW_PAGE_CHANGE_EVENT, syncPage);
      view.removeEventListener(WEBVIEW_FAVICON_CHANGE_EVENT, syncFavicon);
      view.removeEventListener(WEBVIEW_PAGE_FAILURE_CHANGE_EVENT, syncFailure);
      view.removeEventListener("did-change-theme-color", onThemeColor);
    };
  }, [isBrowserRuntime, win.browserWindowId]);

  const currentUrl = normalizeWebUrl(address) ?? win.browserUrl ?? "";
  const canonicalUrl = canonicalizeWebUrl(currentUrl) ?? currentUrl;

  React.useEffect(() => {
    if (focusedWindowId !== win.id) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setDraftAddress(currentUrl);
        setEditingAddress(true);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [focusedWindowId, win.id, currentUrl]);

  React.useEffect(() => {
    if (!editingAddress) return;
    const frame = requestAnimationFrame(() => {
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingAddress]);

  const submitAddressEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeWebUrl(draftAddress);
    if (normalized) {
      setAddress(normalized);
      if (!isBrowserRuntime && webviewRef.current) {
        webviewRef.current.src = normalized;
      }
    }
    setEditingAddress(false);
  };
  const installedApps = settings.installedWebApps ?? [];
  const matchedInstalledApp = findMatchingWebApp(currentUrl, installedApps);
  const isInstalled = currentUrl !== "" && Boolean(matchedInstalledApp);

  const titleHandlerRef = React.useRef<(discoveredTitle: string) => void>(
    () => {}
  );
  titleHandlerRef.current = (discoveredTitle: string) => {
    const clean = discoveredTitle.trim();
    if (!clean) return;
    if (win.browserWindowId) {
      setBrowserTitle(win.browserWindowId, clean);
    }
    if (
      matchedInstalledApp &&
      isHostnameFallbackTitle(matchedInstalledApp.title, matchedInstalledApp.url) &&
      !isHostnameFallbackTitle(clean, currentUrl)
    ) {
      updateSettings({
        installedWebApps: installedApps.map((app) =>
          app.id === matchedInstalledApp.id ? { ...app, title: clean } : app
        ),
      });
    }
  };

  React.useEffect(() => {
    const cached =
      getCachedWebThemeColor(currentUrl, resolvedTheme === "dark") ?? null;
    setThemeColor(cached);
    if (!isBrowserRuntime || !currentUrl || !win.browserWindowId) return;
    if (cached !== null) {
      // Still fetch title if needed, or update themeColor in background
    }
    const controller = new AbortController();
    fetchWebPageMetadata(
      currentUrl,
      controller.signal,
      resolvedTheme === "dark"
    ).then(({ title, themeColor: fetchedThemeColor }) => {
      if (controller.signal.aborted) return;
      if (title) {
        titleHandlerRef.current(title);
      }
      if (fetchedThemeColor) {
        setThemeColor(fetchedThemeColor);
      }
    });
    return () => controller.abort();
  }, [isBrowserRuntime, currentUrl, win.browserWindowId, resolvedTheme]);

  const iframeSrc = normalizeWebUrl(address) ?? "about:blank";

  React.useEffect(() => {
    if (!isBrowserRuntime) return;
    if (iframeSrc === "about:blank") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 15000);
    return () => clearTimeout(timeout);
  }, [isBrowserRuntime, iframeSrc]);

  const handleIframeLoad = React.useCallback(() => {
    setIsLoading(false);
    try {
      const doc = iframeRef.current?.contentDocument;
      const docTitle = doc?.title?.trim();
      if (docTitle) {
        titleHandlerRef.current(docTitle);
      }
      const descContent =
        doc
          ?.querySelector('meta[name="description" i]')
          ?.getAttribute("content")
          ?.trim() ||
        doc
          ?.querySelector('meta[property="og:description" i]')
          ?.getAttribute("content")
          ?.trim();
      if (descContent && currentUrl) {
        setCachedWebDescription(currentUrl, descContent.replace(/\s+/g, " "));
      }
      const metaTags = doc?.querySelectorAll('meta[name="theme-color" i]');
      if (metaTags && metaTags.length > 0) {
        let matched: string | null = null;
        const prefersDark = resolvedTheme === "dark";
        for (const el of Array.from(metaTags)) {
          const content = el.getAttribute("content")?.trim();
          if (!content) continue;
          const media = el.getAttribute("media")?.toLowerCase() ?? "";
          if (!media) {
            matched = content;
            break;
          }
          if (
            (media.includes("prefers-color-scheme: dark") && prefersDark) ||
            (media.includes("prefers-color-scheme: light") && !prefersDark)
          ) {
            matched = content;
            break;
          }
          if (!matched) matched = content;
        }
        setThemeColor(matched);
      }
    } catch {
      // Cross-origin iframes restrict contentDocument access.
    }
  }, [resolvedTheme]);

  const toggleInstallApp = () => {
    if (!currentUrl) return;
    if (isInstalled) {
      updateSettings({
        installedWebApps: installedApps.filter(
          (a) =>
            a.url !== currentUrl &&
            canonicalizeWebUrl(a.url) !== canonicalUrl
        ),
      });
      return;
    }
    const fallbackTitle = getHostnameFallbackTitle(currentUrl) || currentUrl;
    const appTitle =
      win.title && win.title !== "Web" && win.title !== "Web View"
        ? win.title
        : fallbackTitle;
    updateSettings({
      installedWebApps: [
        ...installedApps,
        {
          id: `web:${canonicalUrl}`,
          title: appTitle,
          url: canonicalUrl,
          ...(latestFavicon ? { iconUrl: latestFavicon } : {}),
        },
      ],
    });
  };

  const contrastFg = getContrastForeground(themeColor);

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-adw-content">
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        style={
          themeColor
            ? {
                backgroundColor: themeColor,
                color: contrastFg ?? undefined,
                borderBottomColor: "rgba(128,128,128,0.22)",
              }
            : undefined
        }
        className={cn(
          "relative flex shrink-0 items-center gap-2 border-b border-adw-separator bg-adw-titlebar px-3 transition-colors duration-200 select-none",
          isCsd ? "h-10 rounded-t-[inherit]" : "h-9"
        )}
      >
        <div className="flex shrink-0 items-center" data-window-no-drag>
          <WindowMenuButton
            windowId={win.id}
            appId={win.appId}
            iconUrl={win.iconUrl}
            iconName={win.iconName}
            gradient={win.gradient}
            isWebApp
            extraItems={
              <DropdownMenuItem
                disabled={!currentUrl}
                onClick={toggleInstallApp}
              >
                {isInstalled ? "Remove App" : "Install App"}
              </DropdownMenuItem>
            }
          />
        </div>

        {editingAddress ? (
          <form
            onSubmit={submitAddressEdit}
            data-window-no-drag
            className="flex min-w-0 flex-1 items-center justify-center px-2"
          >
            <input
              ref={addressInputRef}
              type="text"
              value={draftAddress}
              onChange={(e) => setDraftAddress(e.target.value)}
              onBlur={() => setEditingAddress(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingAddress(false);
                }
              }}
              aria-label="Address"
              placeholder="https://…"
              className={cn(
                "h-7 w-full max-w-xl rounded-md border border-adw-accent/70 bg-black/8 px-2.5 text-[12.5px] font-medium outline-none dark:bg-white/12",
                !contrastFg && "text-adw-label"
              )}
            />
          </form>
        ) : (
          <div className="pointer-events-none flex min-w-0 flex-1 items-center justify-center gap-1.5 px-4">
            {isLoading && (
              <Loader2Icon
                aria-label="Loading"
                className={cn(
                  "size-3.5 shrink-0 animate-spin opacity-75",
                  !contrastFg && "text-adw-label"
                )}
              />
            )}
            <span
              className={cn(
                "truncate text-[13px] font-semibold",
                !contrastFg && "text-adw-label"
              )}
            >
              {win.title}
            </span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1" data-window-no-drag>
          {isCsd ? (
            <WindowControls className="[&_button]:text-current [&_button:hover]:bg-black/10 dark:[&_button:hover]:bg-white/12" />
          ) : (
            <div className="w-7" />
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isBrowserRuntime ? (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title={win.title}
            onLoad={handleIframeLoad}
            onError={() => setIsLoading(false)}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-adw-content p-6 text-center text-adw-label">
            <GlobeIcon className="size-7 text-adw-label-secondary" />
            <div className="text-sm font-semibold">Unable to load page</div>
            <div className="text-xs text-adw-label-secondary">
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
        <React.Suspense fallback={null}>
          <SettingsApp
            initialPane={win.payload}
            isCsd={isCsd}
            windowId={win.id}
          />
        </React.Suspense>
      );
    }

    if (win.builtinComponent === "console") {
      return (
        <React.Suspense fallback={null}>
          <ConsoleApp
            initialModule={win.payload}
            isCsd={isCsd}
            windowId={win.id}
          />
        </React.Suspense>
      );
    }

    if (win.builtinComponent === "files") {
      return (
        <React.Suspense fallback={null}>
          <FilesApp
            initialPath={win.payload}
            isCsd={isCsd}
            windowId={win.id}
          />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "text-editor") {
      return (
        <React.Suspense fallback={null}>
          <TextEditorApp initialPath={win.payload} windowId={win.id} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "terminal") {
      return (
        <React.Suspense fallback={null}>
          <TerminalApp initialPath={win.payload} windowId={win.id} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "app-store") {
      return (
        <React.Suspense fallback={null}>
          <AppStoreApp isCsd={isCsd} windowId={win.id} />
        </React.Suspense>
      );
    }

    // In Browser Dev Mode, simulated non-Settings Wayland windows render a minimal surface card
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-adw-content p-6 text-center text-adw-label">
        <div className="text-sm font-semibold">{win.title}</div>
        <div className="text-xs text-adw-label-secondary">
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

const DOMICILE_RESIZE_EDGE_MAP: Record<DomicileResizeEdge, WindowResizeEdge> = {
  [DomicileResizeEdge.Top]: "n",
  [DomicileResizeEdge.Bottom]: "s",
  [DomicileResizeEdge.Left]: "w",
  [DomicileResizeEdge.Right]: "e",
  [DomicileResizeEdge.TopLeft]: "nw",
  [DomicileResizeEdge.TopRight]: "ne",
  [DomicileResizeEdge.BottomLeft]: "sw",
  [DomicileResizeEdge.BottomRight]: "se",
};

export function WindowManager() {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings } = useSettings();
  const {
    workspaceWindows,
    waylandPopups,
    focusedWindowId,
    altTabOpen,
    overviewOpen,
    launcherOpen,
    controlPanelOpen,
    focusWindow,
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
  const lastDomFocusedIdRef = React.useRef<string | null>(null);
  const workspaceWindowsRef = React.useRef(workspaceWindows);
  workspaceWindowsRef.current = workspaceWindows;
  const focusWindowRef = React.useRef(focusWindow);
  focusWindowRef.current = focusWindow;

  React.useEffect(() => {
    const trackPointer = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointerdown", trackPointer, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointermove", trackPointer, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("pointerdown", trackPointer, {
        capture: true,
      });
      window.removeEventListener("pointermove", trackPointer, {
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
      const { x, y } = lastPointerRef.current;
      // Note: some domicile .deb builds emit kind 3 (Unfullscreen) on headerbar
      // drag instead of kind 5 (Move); handle both until upstream .deb aligns.
      if (
        req.kind === WindowRequestKind.Move ||
        req.kind === WindowRequestKind.Unfullscreen
      ) {
        handle.startMove(x, y);
      } else if (req.kind === WindowRequestKind.Resize) {
        handle.startResize(DOMICILE_RESIZE_EDGE_MAP[req.edges], x, y);
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
      if (targetWin.waylandAppId && !isBrowserRuntime) {
        if (domicile.windows.focused !== targetWin.waylandAppId) {
          domicile.windows.focus(targetWin.waylandAppId);
        }
        return;
      }

      if (domicile.windows.focused !== undefined) {
        domicile.windows.focusShell();
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
    domicile.windows,
    overviewOpen,
    focusedWindowId,
    isBrowserRuntime,
    workspaceWindows.length,
  ]);

  const dockPosition = settings.dockPosition ?? "bottom";
  const dockEdgeClearance = settings.dockAutoHide ? 8 : settings.dockSize + 24;
  const bottomDockClearance = dockPosition === "bottom" ? dockEdgeClearance : 8;
  const leftDockClearance = dockPosition === "left" ? dockEdgeClearance : 0;
  const rightDockClearance = dockPosition === "right" ? dockEdgeClearance : 0;

  return (
    <div
      className="relative isolate z-10 min-h-0 flex-1 overflow-clip"
      onScroll={(e) => {
        if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
        if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
      }}
    >
      {/* Transparent Desktop Icons App (below windows, above wallpaper) */}
      {!overviewOpen && <DesktopIconsApp bottomInset={bottomDockClearance} />}

      {/* Edge Snapping Drop Zone Preview */}
      {snapPreview && (
        <div
          aria-hidden="true"
          style={{
            bottom: `${bottomDockClearance + 6}px`,
          }}
          className={cn(
            "pointer-events-none absolute top-1.5 z-[5] rounded-[14px] border-2 border-adw-accent/70 bg-adw-accent/18 backdrop-blur-sm transition-all duration-150",
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
            resizable
            bounds="parent"
            inactive={!isFocused}
            minimized={win.minimized}
            minimizeTo={getDockRef(win.appId)}
            minimizeEffect="scale"
            maximized={win.maximized}
            maximizeInsets={{
              top: 0,
              right: rightDockClearance,
              bottom: bottomDockClearance,
              left: leftDockClearance,
            }}
            onSnapPreviewChange={setSnapPreview}
            onSnapCommit={(zone) => tileWindow(win.id, zone)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onZoom={() => toggleMaximizeWindow(win.id)}
            onContextMenu={(e) => e.stopPropagation()}
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
              zIndex: win.zIndex,
            }}
            className={cn(
              "contain-[layout_style] outline-none",
              isWaylandSurface && "bg-transparent",
              overviewOpen && "pointer-events-none opacity-0"
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
                  <div className="flex shrink-0 items-center" data-window-no-drag>
                    <WindowMenuButton windowId={win.id} />
                  </div>
                  <WindowTitle className="flex items-center justify-center gap-1.5">
                    <span className="truncate">{win.title}</span>
                  </WindowTitle>
                  <div className="flex shrink-0 items-center" data-window-no-drag>
                    <WindowControls />
                  </div>
                </WindowTitlebar>
              )}

              {/* Silent Alt / Super + Drag Full-Window Grab Overlay */}
              {modifierGrabActive && !altTabOpen && (
                <div
                  data-window-drag-region
                  className="absolute inset-0 z-40"
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
            style={popup.cursor ? { cursor: popup.cursor } : undefined}
            className="block h-full w-full"
          />
        </div>
      ))}
    </div>
  );
}
