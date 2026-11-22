/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { WindowRequestKind } from "@domicile-desktop/sdk/window-state";
import {
  WEBVIEW_CLOSE_EVENT,
  WEBVIEW_CONTENT_SIZE_CHANGE_EVENT,
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
  PuzzleIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { IsolatedAppFrame } from "@/components/shell/IsolatedAppFrame";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { _ } from "@/lib/core/i18n";
import {
  consumeLaunchOriginRect,
  type LaunchOriginRect,
} from "@/lib/shell/launch-origin";
import { computeOverviewWindowLayouts } from "@/lib/shell/overview-layout";
import { CalculatorApp } from "@/components/apps/CalculatorApp";
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
const ImageViewerApp = React.lazy(() =>
  import("@/components/apps/ImageViewerApp").then((m) => ({
    default: m.ImageViewerApp,
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
const LoginScreenApp = React.lazy(() =>
  import("@/components/apps/LoginScreenApp").then((m) => ({
    default: m.LoginScreenApp,
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
import { cn } from "@/lib/core/utils";
import { toggleWebAppInstall } from "@/lib/xdg/xdg-web-apps";

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
  const domicile = useDomicile();
  const { isBrowserRuntime, resolvedTheme, settings, updateSettings } =
    useSettings();
  const {
    focusedWindowId,
    focusWindow,
    clearFocusedWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    setBrowserFavicon,
    setBrowserTitle,
    markWindowReady,
  } = useWindowManager();
  const windowCtx = useWindowContext();
  const webviewRef = React.useRef<HTMLWebViewElement | null>(null);
  const extPopupWebviewRef = React.useRef<HTMLWebViewElement | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);

  const extensions =
    useWatch(domicile.extensions, "change", () => domicile.extensions.list) ??
    [];
  const [activeExtPopup, setActiveExtPopup] = React.useState<{
    id: string;
    popup: string;
  } | null>(null);
  const [extPopupSize, setExtPopupSize] = React.useState<{
    width: number;
    height: number;
  }>({ width: 360, height: 440 });
  const [demoPopupOpen, setDemoPopupOpen] = React.useState(false);
  const [demoBadgeCount, setDemoBadgeCount] = React.useState(1);

  React.useEffect(() => {
    if (isBrowserRuntime) return;
    return domicile.extensions.on("popup", (req) => {
      if (focusedWindowId !== win.id) return;
      setExtPopupSize({ width: 360, height: 440 });
      setActiveExtPopup(req);
    });
  }, [domicile.extensions, focusedWindowId, isBrowserRuntime, win.id]);

  React.useEffect(() => {
    const view = extPopupWebviewRef.current;
    if (!view || !activeExtPopup) return;
    const onSize = () => {
      if (view.contentWidth > 0 && view.contentHeight > 0) {
        setExtPopupSize({
          width: Math.max(200, Math.min(800, Math.round(view.contentWidth))),
          height: Math.max(120, Math.min(600, Math.round(view.contentHeight))),
        });
      }
    };
    const onClose = () => setActiveExtPopup(null);
    view.addEventListener(WEBVIEW_CONTENT_SIZE_CHANGE_EVENT, onSize);
    view.addEventListener(WEBVIEW_CLOSE_EVENT, onClose);
    return () => {
      view.removeEventListener(WEBVIEW_CONTENT_SIZE_CHANGE_EVENT, onSize);
      view.removeEventListener(WEBVIEW_CLOSE_EVENT, onClose);
    };
  }, [activeExtPopup]);

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
  const markReadyRef = React.useRef(() => markWindowReady(win.id));
  markReadyRef.current = () => markWindowReady(win.id);
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
      if (view.url && !view.loading) {
        markReadyRef.current();
      }
    };
    const syncLoading = () => {
      const loading = Boolean(view.loading);
      setIsLoading(loading);
      if (!loading) {
        markReadyRef.current();
      }
    };
    const syncFavicon = () => faviconHandlerRef.current(view.favicon || "");
    const syncFailure = () => {
      setPageFailure(view.pageFailure || "");
      setPageFailureError(view.pageFailureError || "");
      setPageFailureCanProceed(Boolean(view.pageFailureCanProceed));
      if (view.pageFailure) {
        markReadyRef.current();
      }
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
    () => { }
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
      markReadyRef.current();
      return;
    }
    setIsLoading(true);
    const timeout = setTimeout(() => {
      setIsLoading(false);
      markReadyRef.current();
    }, 15000);
    return () => clearTimeout(timeout);
  }, [isBrowserRuntime, iframeSrc]);

  const handleIframeLoad = React.useCallback(() => {
    setIsLoading(false);
    markReadyRef.current();
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
    toggleWebAppInstall({
      domicile,
      isBrowserRuntime,
      installedWebApps: installedApps,
      pinnedAppIds: settings.pinnedAppIds,
      updateSettings,
      url: currentUrl,
      title: win.title,
      iconUrl: latestFavicon,
    });
  };

  const contrastFg = getContrastForeground(themeColor);

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-adw-content">
      <WindowTitlebar
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
          "border-b border-adw-separator bg-adw-titlebar transition-colors duration-200",
          !isCsd && "rounded-t-none"
        )}
      >
        <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
          {isCsd && (
            <WindowControls
              side="left"
              className="[&_button]:text-current [&_button:hover]:bg-black/10 dark:[&_button:hover]:bg-white/12"
            />
          )}
          <WindowMenuButton
            side="left"
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
                {isInstalled ? _("Remove Web App") : _("Install Web App")}
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
          {isBrowserRuntime && settings.demoExtensionEnabled !== false && (
            <button
              type="button"
              title="Piloti Demo Extension"
              aria-label="Piloti Demo Extension"
              onClick={() => setDemoPopupOpen((v) => !v)}
              className={cn(
                "relative flex size-7 items-center justify-center rounded-md transition-colors",
                demoPopupOpen
                  ? "bg-black/14 dark:bg-white/18"
                  : "hover:bg-black/8 dark:hover:bg-white/10"
              )}
            >
              <PuzzleIcon className="size-3.5" />
              {demoBadgeCount > 0 && (
                <span
                  style={{ backgroundColor: "var(--adw-accent)" }}
                  className="pointer-events-none absolute right-0.5 bottom-0.5 min-w-3 rounded-full px-0.5 text-center text-[8.5px] leading-tight font-bold text-white shadow-xs"
                >
                  {demoBadgeCount}
                </span>
              )}
            </button>
          )}
          {!isBrowserRuntime &&
            extensions.map((ext) => (
              <button
                key={ext.id}
                type="button"
                disabled={!ext.enabled}
                title={ext.title || ext.name}
                aria-label={ext.title || ext.name}
                onClick={() => {
                  if (ext.popup) {
                    const popupUrl = ext.popup;
                    setExtPopupSize({ width: 360, height: 440 });
                    setActiveExtPopup((prev) =>
                      prev?.id === ext.id
                        ? null
                        : { id: ext.id, popup: popupUrl }
                    );
                  } else {
                    setActiveExtPopup(null);
                    domicile.extensions.activate(ext.id);
                  }
                }}
                className={cn(
                  "relative flex size-7 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40",
                  activeExtPopup?.id === ext.id
                    ? "bg-black/14 dark:bg-white/18"
                    : "hover:bg-black/8 dark:hover:bg-white/10"
                )}
              >
                {ext.icon ? (
                  <img
                    src={ext.icon}
                    alt=""
                    draggable={false}
                    className="size-4 rounded-[3px] object-contain"
                  />
                ) : (
                  <PuzzleIcon className="size-3.5" />
                )}
                {ext.badgeText && (
                  <span
                    style={{
                      backgroundColor:
                        ext.badgeColor && ext.badgeColor !== "#00000000"
                          ? ext.badgeColor
                          : "var(--adw-accent)",
                    }}
                    className="pointer-events-none absolute right-0.5 bottom-0.5 min-w-3 rounded-full px-0.5 text-center text-[8.5px] leading-tight font-bold text-white shadow-xs"
                  >
                    {ext.badgeText}
                  </span>
                )}
              </button>
            ))}
          <WindowMenuButton
            side="right"
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
                {isInstalled ? _("Remove Web App") : _("Install Web App")}
              </DropdownMenuItem>
            }
          />
          {isCsd ? (
            <WindowControls
              side="right"
              className="[&_button]:text-current [&_button:hover]:bg-black/10 dark:[&_button:hover]:bg-white/12"
            />
          ) : (
            <div className="w-7" />
          )}
        </div>
      </WindowTitlebar>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isBrowserRuntime ? (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title={win.title}
            onLoad={handleIframeLoad}
            onError={() => setIsLoading(false)}
            className="h-full w-full border-0 bg-adw-window"
          />
        ) : (
          <webview
            ref={webviewRef}
            window={win.browserWindowId}
            resizing={windowCtx?.resizing ? "" : undefined}
            className="block h-full w-full bg-adw-window"
          />
        )}

        {!isBrowserRuntime && activeExtPopup && (
          <>
            <div
              className="absolute inset-0 z-30"
              onClick={() => setActiveExtPopup(null)}
            />
            <div
              style={{
                width: `${extPopupSize.width}px`,
                height: `${extPopupSize.height}px`,
              }}
              className="absolute top-1.5 right-2 z-40 max-h-[calc(100%-12px)] max-w-[calc(100%-16px)] overflow-hidden rounded-xl border border-adw-separator bg-adw-window shadow-2xl"
            >
              <webview
                ref={extPopupWebviewRef}
                src={activeExtPopup.popup}
                extensionpopup=""
                className="block h-full w-full"
              />
            </div>
          </>
        )}

        {demoPopupOpen && isBrowserRuntime && settings.demoExtensionEnabled !== false && (
          <>
            <div
              className="absolute inset-0 z-30"
              onClick={() => setDemoPopupOpen(false)}
            />
            <div className="absolute top-1.5 right-2 z-40 w-[290px] max-w-[calc(100%-16px)] rounded-xl border border-adw-separator bg-adw-window p-3.5 text-adw-label shadow-2xl">
              <div className="flex items-center gap-2">
                <PuzzleIcon className="size-4 text-adw-accent" />
                <div className="text-[13px] font-semibold">
                  Piloti Demo Extension
                </div>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-adw-label-secondary">
                {_("Simulated extension popup in Web mode. On native Domicile, real Chrome extensions load via extensions.unpacked / extensions.web_store.")}
              </p>
              <div className="mt-2.5 rounded-lg bg-black/5 px-2.5 py-2 text-[11px] break-all text-adw-label-secondary dark:bg-white/6">
                <div className="font-medium text-adw-label">{win.title}</div>
                <div className="mt-0.5 opacity-80">{win.browserUrl || address}</div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={() => setDemoBadgeCount((c) => c + 1)}
                >
                  {_("Increment Badge")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => setDemoBadgeCount(0)}
                >
                  {_("Clear")}
                </Button>
              </div>
            </div>
          </>
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

function WindowDomReadySignal({
  windowId,
  onReady,
}: {
  windowId: string;
  onReady: (id: string) => void;
}) {
  React.useLayoutEffect(() => {
    onReady(windowId);
  }, [onReady, windowId]);
  return null;
}

const WindowBody = React.memo(
  function WindowBody({
    win,
    isCsd,
    onDomReady,
  }: {
    win: DesktopWindowInstance;
    isCsd: boolean;
    onDomReady: (id: string) => void;
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
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
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
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
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
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
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
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <TextEditorApp
            initialPath={win.payload}
            windowId={win.id}
            isCsd={isCsd}
          />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "image-viewer") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <ImageViewerApp
            initialPath={win.payload}
            windowId={win.id}
            isCsd={isCsd}
          />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "terminal") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <TerminalApp initialPath={win.payload} windowId={win.id} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "app-store") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <AppStoreApp isCsd={isCsd} windowId={win.id} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "calculator") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <CalculatorApp windowId={win.id} isCsd={isCsd} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "login-screen") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <LoginScreenApp windowId={win.id} isCsd={isCsd} />
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
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, reducedMotion } = useSettings();
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
  const handleDomReady = React.useCallback((id: string) => {
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
      if (win.minimized || reducedMotion) continue;

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
      el.style.transition = "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
      window.setTimeout(() => {
        if (windowElementsRef.current.get(win.id) === el) {
          el.style.transformOrigin = "top left";
        }
      }, 250);
    }
  }, [domReadyIds, getDockRef, reducedMotion, windows]);

  const handleAnimatedClose = React.useCallback(
    (win: DesktopWindowInstance) => {
      if (closingWindowIds.has(win.id)) return;
      const beforeCloseEvent = new CustomEvent("piloti:before-close-window", {
        cancelable: true,
        detail: { windowId: win.id },
      });
      if (!window.dispatchEvent(beforeCloseEvent)) {
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
    const onRequestAnimatedClose = (e: Event) => {
      const windowId = (e as CustomEvent<{ windowId?: string }>).detail?.windowId;
      if (!windowId) return;
      const win = windows.find((w) => w.id === windowId);
      if (win) {
        handleAnimatedClose(win);
      } else {
        closeWindow(windowId);
      }
    };
    window.addEventListener("piloti:request-animated-close", onRequestAnimatedClose);
    return () => window.removeEventListener("piloti:request-animated-close", onRequestAnimatedClose);
  }, [closeWindow, handleAnimatedClose, windows]);
  const [windowContextMenu, setWindowContextMenu] = React.useState<{
    windowId: string;
    x: number;
    y: number;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const preload = () => {
      void import("@/components/apps/FilesApp");
      void import("@/components/apps/TextEditorApp");
      void import("@/components/apps/ImageViewerApp");
      void import("@/components/apps/TerminalApp");
      void import("@/components/apps/SettingsApp");
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

  React.useEffect(() => {
    if (!windowContextMenu) return;
    const close = () => setWindowContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
    };
  }, [windowContextMenu]);
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
      stage.style.transition =
        "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 350ms cubic-bezier(0.22, 1, 0.36, 1)";
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

  return (
    <div
      className="relative isolate z-10 min-h-0 flex-1 overflow-clip"
      onPointerDown={(e) => {
        if (
          !(e.target as HTMLElement).closest(
            '[data-slot="window"], [data-slot="select-content"], [data-slot="dropdown-menu-content"], [data-slot="context-menu-content"]',
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
          transition: "opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)",
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
            "pointer-events-none absolute top-1.5 z-[5] rounded-[14px] border-2 border-adw-accent/70 bg-adw-accent/18 backdrop-blur-sm transition-all duration-150",
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
        {windows.map((win) => {
          const isActiveWorkspace = win.workspace === settings.activeWorkspace;
          const isFocused = isActiveWorkspace && focusedWindowId === win.id;
          const isCsd =
            settings.windowDecorationMode === "csd" ||
            (settings.windowDecorationMode === "auto" && Boolean(win.clientFrame));
          const isWaylandSurface = Boolean(win.waylandAppId) && !isBrowserRuntime;
          const ovLayout =
            overviewOpen && isActiveWorkspace
              ? overviewLayouts?.get(win.id)
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
              resizable={win.appId !== "calculator"}
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
                win.appId === "calculator" ? undefined : setSnapPreview
              }
              onSnapCommit={
                win.appId === "calculator"
                  ? undefined
                  : (zone) => tileWindow(win.id, zone)
              }
              onClose={() => handleAnimatedClose(win)}
              onMinimize={() => minimizeWindow(win.id)}
              onZoom={
                win.appId === "calculator"
                  ? undefined
                  : () => toggleMaximizeWindow(win.id)
              }
              onContextMenu={(e) => {
                e.stopPropagation();
                const target = e.target as HTMLElement | null;
                const isSidebarBody = Boolean(
                  target?.closest('[data-slot="adw-sidebar"], aside') &&
                  !target?.closest('[data-slot="window-titlebar"]'),
                );
                if (
                  !isSidebarBody &&
                  target?.closest(
                    '[data-slot="window-titlebar"], [data-window-drag-region], [data-slot="adw-sidebar-header"]',
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
                zIndex: win.zIndex,
                transformOrigin: "top left",
                transform: ovLayout
                  ? `translate(${ovLayout.dx}px, ${ovLayout.dy}px) scale(${ovLayout.scale})`
                  : "translate3d(0px, 0px, 0px) scale(1)",
                transition:
                  "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              className={cn(
                "contain-[layout_style] outline-none",
                isWaylandSurface && "bg-transparent",
                (win.ready === false ||
                  (win.builtinComponent && !domReadyIds.has(win.id))) &&
                  "opacity-0 pointer-events-none",
                overviewOpen && "pointer-events-none",
                closingWindowIds.has(win.id) && "pointer-events-none",
                !isActiveWorkspace && "invisible pointer-events-none",
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
                {!isCsd && (
                  <WindowTitlebar className="justify-between">
                    <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
                      <WindowControls side="left" />
                      <WindowMenuButton side="left" windowId={win.id} />
                    </div>
                    <WindowTitle className="flex items-center justify-center gap-1.5">
                      <span className="truncate">{win.title}</span>
                    </WindowTitle>
                    <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
                      <WindowMenuButton side="right" windowId={win.id} />
                      <WindowControls side="right" />
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
                  <WindowBody
                    win={win}
                    isCsd={isCsd}
                    onDomReady={handleDomReady}
                  />
                </WindowContent>
              </WindowMain>
            </Window>
          );
        })}
      </div>

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

      {/* Headerbar Right-Click Window Menu */}
      {windowContextMenu &&
        (() => {
          const ctxWin = windows.find((w) => w.id === windowContextMenu.windowId);
          if (!ctxWin) return null;
          const menuLeft =
            typeof window !== "undefined"
              ? Math.min(window.innerWidth - 180, windowContextMenu.x)
              : windowContextMenu.x;
          const menuTop =
            typeof window !== "undefined"
              ? Math.min(window.innerHeight - 200, windowContextMenu.y)
              : windowContextMenu.y;
          const itemCls =
            "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-adw-body text-adw-label hover:bg-adw-accent hover:text-white";
          return (
            <div
              role="menu"
              style={{ left: `${menuLeft}px`, top: `${menuTop}px`, zIndex: 9999 }}
              onPointerDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="adw-material-menu fixed min-w-44 rounded-adw-menu p-[6px] text-adw-label shadow-adw-menu outline-none"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  minimizeWindow(ctxWin.id);
                  setWindowContextMenu(null);
                }}
                className={itemCls}
              >
                {_("Minimize")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  toggleMaximizeWindow(ctxWin.id);
                  setWindowContextMenu(null);
                }}
                className={itemCls}
              >
                {ctxWin.maximized ? _("Restore") : _("Maximize")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  tileWindow(ctxWin.id, "left");
                  setWindowContextMenu(null);
                }}
                className={itemCls}
              >
                {_("Tile Left")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  tileWindow(ctxWin.id, "right");
                  setWindowContextMenu(null);
                }}
                className={itemCls}
              >
                {_("Tile Right")}
              </button>
              <div className="my-1 h-px bg-adw-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeWindow(ctxWin.id);
                  setWindowContextMenu(null);
                }}
                className={itemCls}
              >
                {_("Close")}
              </button>
            </div>
          );
        })()}
    </div>
  );
}
