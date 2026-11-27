/// <reference types="@domicile-desktop/react/elements" />
import { WorkspaceTransition } from "@/shell/windows/WorkspaceTransition";
import { hostFiles } from "@/lib/engine/host-files";
import { logAppEvent } from "@/lib/core/perf-log";
import { looksLikeUrl, webSearchUrl } from "@/lib/core/web-search";
import * as React from "react";
import { emitShellEvent, onShellEvent } from "@/lib/core/shell-events";
import { usePiloti } from "@/lib/engine/piloti";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { WindowRequestKind } from "@domicile-desktop/sdk/window-state";
import {
  WEBVIEW_CLOSE_EVENT,
  WEBVIEW_CONTENT_SIZE_CHANGE_EVENT,
  WEBVIEW_FAVICON_CHANGE_EVENT,
  WEBVIEW_GUEST_FOCUS_EVENT,
  WEBVIEW_HISTORY_CHANGE_EVENT,
  WEBVIEW_LOADING_CHANGE_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
  WEBVIEW_PAGE_FAILURE_CHANGE_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import { ChevronLeftIcon, DownloadIcon, ChevronDownIcon, FolderIcon, GlobeIcon, TerminalIcon, StarIcon, Loader2Icon, PlusIcon, PuzzleIcon } from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import { initAppModules, resolveAppModuleByUrl } from "@/data/app-modules";
import { IsolatedAppFrame } from "@/shell/windows/IsolatedAppFrame";
import { WindowMenuButton, WindowMenuItems } from "@/components/common/WindowMenuButton";
import {
  getAppSetting,
  getAppSettingsVersion,
  subscribeAppSettings,
} from "@/lib/core/app-settings";
import { PresentationOverlay } from "@/shell/windows/PresentationOverlay";
import {
  BrowserExtensionsMenu,
  type BrowserExtensionItem,
} from "@/shell/windows/BrowserExtensionsMenu";
import { _ } from "@/lib/core/i18n";
import {
  consumeLaunchOriginRect,
  type LaunchOriginRect,
} from "@/lib/windows/launch-origin";
import { computeOverviewWindowLayouts } from "@/shell/overview/overview-layout";
import {
  getWindowPresentations,
  presentationTransform,
  pruneWindowPresentations,
  setWorkArea,
  subscribeWindowPresentation,
} from "@/lib/windows/window-presentation";
import { AppChromeProvider, useAppChrome, type AppChrome } from "@/components/elements/app-chrome";
import { HeaderBar } from "@/components/elements/header-bar";
import { ShellTitlebar, WindowAppChrome } from "@/shell/windows/WindowAppChrome";
import { CalculatorApp } from "@/apps/calculator/CalculatorApp";
import { HelloWorldApp } from "@/apps/hello/HelloWorldApp";
import { PilotiDemoApp } from "@/apps/piloti-demo/PilotiDemoApp";
import { SelfiesApp } from "@/apps/selfies/SelfiesApp";
import { SystemMonitorApp } from "@/apps/system-monitor/SystemMonitorApp";
const ConsoleApp = React.lazy(() =>
  import("@/apps/console/ConsoleApp").then((m) => ({
    default: m.ConsoleApp,
  }))
);

const FilesApp = React.lazy(() =>
  import("@/apps/files/FilesApp").then((m) => ({
    default: m.FilesApp,
  }))
);
const TextsApp = React.lazy(() =>
  import("@/lib/engine/texts-host-shell").then((m) => ({
    default: m.ShellTextsApp,
  }))
);
const ImageViewerApp = React.lazy(() =>
  import("@/apps/image-viewer/ImageViewerApp").then((m) => ({
    default: m.ImageViewerApp,
  }))
);
const TerminalApp = React.lazy(() =>
  import("@/apps/terminal/XtermTerminalApp").then((m) => ({
    default: m.XtermTerminalApp,
  }))
);
const AppStoreApp = React.lazy(() =>
  import("@/apps/app-store/AppStoreApp").then((m) => ({
    default: m.AppStoreApp,
  }))
);
const SettingsApp = React.lazy(() =>
  import("@/apps/settings/SettingsApp").then((m) => ({
    default: m.SettingsApp,
  }))
);
const LoginScreenApp = React.lazy(() =>
  import("@/apps/login/LoginScreenApp").then((m) => ({
    default: m.LoginScreenApp,
  }))
);
import { DesktopIconsApp } from "@/apps/desktop-icons/DesktopIconsApp";
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
} from "@/components/ui/window";
import {
  normalizeWebUrl,
  useSystemBackends,
  useWindowManager,
  type DesktopWindowInstance,
  useDesktopSettings,
  useSettingsSelector,
  useUpdateSettings,
} from "@/context/DesktopStateContext";
import type { BrowserTab } from "@/context/WindowsContext";
import { BrowserTabBar } from "./BrowserTabBar";
import {
  isBookmarked,
  toggleBrowserBookmark,
  useBrowserBookmarks,
} from "@/shell/windows/browser-bookmarks";
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
import {
  WEB_DARK_READER_FILTER,
  normalizeExtensionsConfig,
  parseChromeWebStoreExtensionId,
  setExtensionEnabled,
} from "@/lib/engine/browser-extensions";
import { toggleWebAppInstall } from "@/lib/xdg/xdg-web-apps";

/**
 * Wraps the native Domicile `<app>` element and reports its exact viewport CSS
 * pixel box (`getBoundingClientRect()`) to `domicile.windows.setBounds` so
 * Wayland pointer coordinates and surface scaling match 1:1 to the pixel.
 */
function WaylandAppSurface({ win }: { win: DesktopWindowInstance }) {
  const piloti = usePiloti();
  const windowCtx = useWindowContext();
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const syncBounds = React.useCallback(() => {
    if (!win.waylandAppId) return;
    if (win.minimized) {
      piloti.windows.setBounds(win.waylandAppId, {
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
    piloti.windows.setBounds(win.waylandAppId, {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, [piloti.windows, win.minimized, win.waylandAppId]);

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

function darkenThemeColor(cssColor: string): string {
  const raw = cssColor.trim();
  let r: number;
  let g: number;
  let b: number;
  const hex3 = raw.match(/^#([\da-f]{3})$/i);
  const hex6 = raw.match(/^#([\da-f]{6})$/i);
  const rgb = raw.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (hex3) {
    r = Number.parseInt(hex3[1][0] + hex3[1][0], 16);
    g = Number.parseInt(hex3[1][1] + hex3[1][1], 16);
    b = Number.parseInt(hex3[1][2] + hex3[1][2], 16);
  } else if (hex6) {
    r = Number.parseInt(hex6[1].slice(0, 2), 16);
    g = Number.parseInt(hex6[1].slice(2, 4), 16);
    b = Number.parseInt(hex6[1].slice(4, 6), 16);
  } else if (rgb) {
    r = Math.min(255, Number.parseInt(rgb[1], 10));
    g = Math.min(255, Number.parseInt(rgb[2], 10));
    b = Math.min(255, Number.parseInt(rgb[3], 10));
  } else {
    return "#1c1c20";
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const factor = luminance > 0.5 ? 0.18 : luminance > 0.25 ? 0.38 : 0.75;
  const base = 18;
  const dr = Math.round(r * factor + base * (1 - factor));
  const dg = Math.round(g * factor + base * (1 - factor));
  const db = Math.round(b * factor + base * (1 - factor));
  return `rgb(${dr}, ${dg}, ${db})`;
}

function dismissOpenPopups() {
  emitShellEvent("piloti:dismiss-popups");
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  document.body.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    })
  );
}

void initAppModules();

/** A Domicile app module window (`domicile open --app <entry.js>`). */
function isAppModuleWindow(win: DesktopWindowInstance) {
  return Boolean(win.browserIsApp && win.browserUrl?.startsWith("domicile://app-"));
}

/**
 * Our own frame around an isolated app module: standard titlebar (controls,
 * window menu, title), no address bar; the module's page fills the rest.
 */
function AppModuleSurface({
  win,
}: {
  win: DesktopWindowInstance;
}) {
  const isCsd = useAppChrome().decorations === "client";
  const windowCtx = useWindowContext();
  const { setBrowserTitle, markWindowReady } = useWindowManager();
  const viewRef = React.useRef<HTMLWebViewElement | null>(null);
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view || !win.browserWindowId) return;
    const id = win.browserWindowId;
    const sync = () => {
      const t = view.title?.trim();
      if (t && !t.startsWith("domicile://")) setBrowserTitle(id, t);
      if (view.url && !view.loading) markWindowReady(win.id);
    };
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, sync);
    view.addEventListener(WEBVIEW_LOADING_CHANGE_EVENT, sync);
    sync();
    return () => {
      view.removeEventListener(WEBVIEW_PAGE_CHANGE_EVENT, sync);
      view.removeEventListener(WEBVIEW_LOADING_CHANGE_EVENT, sync);
    };
  }, [win.browserWindowId, win.id, setBrowserTitle, markWindowReady]);
  const mod = resolveAppModuleByUrl(win.browserUrl);
  const isModule = Boolean(mod);
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view || !isModule) return;
    // A module that refuses to close asks in its own window: answer "stay".
    const onDialog = (event: Event) => {
      const dialog = event as Event & { dialogType: string; dismiss: () => void };
      if (dialog.dialogType !== "beforeunload") return;
      event.preventDefault();
      dialog.dismiss();
    };
    view.addEventListener("domicile-dialog", onDialog);
    return () => view.removeEventListener("domicile-dialog", onDialog);
  }, [isModule, win.browserWindowId]);
  if (mod?.csd) {
    // The module draws its own header. The webview swallows pointer events, so
    // the shell lays window controls and a drag strip over the header area.
    const drag = mod.drag ?? { left: 96, right: 96, height: 36 };
    return (
      <div className="relative h-full w-full flex-1 overflow-hidden bg-ui-window">
        <webview
          ref={viewRef}
          window={win.browserWindowId}
          resizing={windowCtx?.resizing ? "" : undefined}
          className="block h-full w-full bg-ui-window"
        />
        {isCsd && (
          <>
            <div
              className="absolute top-0 left-0 z-10 flex items-center gap-1.5 pl-2.5"
              style={{ height: drag.height }}
              data-window-no-drag
            >
              <WindowControls side="left" />
            </div>
            <div
              className="absolute top-0 right-0 z-10 flex items-center gap-1.5 pr-2.5"
              style={{ height: drag.height }}
              data-window-no-drag
            >
              <WindowControls side="right" />
            </div>
          </>
        )}
        <div
          data-window-drag-region=""
          className="absolute top-0 z-10"
          style={{ left: drag.left, right: drag.right, height: drag.height }}
        />
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-ui-window">
      <HeaderBar>
        <HeaderBar.Title>{win.title}</HeaderBar.Title>
      </HeaderBar>
      <webview
        ref={viewRef}
        window={win.browserWindowId}
        resizing={windowCtx?.resizing ? "" : undefined}
        className="block min-h-0 w-full flex-1 bg-ui-window"
      />
    </div>
  );
}

function WebViewSurface({
  win,
  darkReaderEnabled,
  onToggleDarkReader,
  active = true,
  tabBar,
}: {
  win: DesktopWindowInstance;
  darkReaderEnabled: boolean;
  onToggleDarkReader: () => void;
  /** False for a background tab: it stays mounted but ignores shortcuts. */
  active?: boolean;
  tabBar?: React.ReactNode;
}) {
  const isCsd = useAppChrome().decorations === "client";
  const piloti = usePiloti();
  const isBrowserRuntime = useSettingsSelector((v) => v.isBrowserRuntime); // FIXME : Capabilities
  const resolvedTheme = useSettingsSelector((v) => v.resolvedTheme);
  const settings = useDesktopSettings(["activeWorkspace", "darkReaderWebEnabled", "debugMode", "demoExtensionEnabled", "dockAutoHide", "dockPosition", "dockSize", "installedWebApps", "pinnedAppIds", "pinnedExtensionIds", "windowButtonLayout", "windowDecorationMode"]);
  const updateSettings = useUpdateSettings();
  const { pushNotification } = useSystemBackends();
  const {
    focusedWindowId,
    launchApp,
    focusWindow,
    clearFocusedWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    setBrowserFavicon,
    setBrowserTitle,
    markWindowReady,
    openBrowserTab,
    closeBrowserTab,
    reopenClosedBrowserTab,
  } = useWindowManager();
  const isFocusedTab = active && focusedWindowId === win.id;
  const isBrowserApp = win.appId === "browser";
  const windowCtx = useWindowContext();
  const webviewRef = React.useRef<HTMLWebViewElement | null>(null);
  const extPopupWebviewRef = React.useRef<HTMLWebViewElement | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);

  const extensions =
    useWatch(piloti.extensions, "change", () => piloti.extensions.list) ??
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
    if (isBrowserRuntime) return;  // FIXME : Capabilities
    return piloti.extensions.on("popup", (req) => {
      if (!isFocusedTab) return;
      setExtPopupSize({ width: 360, height: 440 });
      setActiveExtPopup(req);
    });
  }, [piloti.extensions, isFocusedTab, isBrowserRuntime]);  // FIXME : Capabilities

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

  const prefersDark = resolvedTheme === "dark" || darkReaderEnabled;
  const [address, setAddress] = React.useState(win.browserUrl ?? "");
  const [historyState, setHistoryState] = React.useState<{
    stack: string[];
    index: number;
  }>(() => {
    const init = normalizeWebUrl(win.browserUrl ?? "");
    return { stack: init ? [init] : [], index: 0 };
  });
  const [nativeCanGoBack, setNativeCanGoBack] = React.useState(false);
  const [editingAddress, setEditingAddress] = React.useState(false);
  const [draftAddress, setDraftAddress] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [latestFavicon, setLatestFavicon] = React.useState("");
  const [themeColor, setThemeColor] = React.useState<string | null>(
    () => getCachedWebThemeColor(win.browserUrl, prefersDark) ?? null
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
      const normalized = normalizeWebUrl(win.browserUrl);
      if (normalized) {
        setHistoryState((prev) => {
          if (prev.stack[prev.index] === normalized) return prev;
          const nextStack = [...prev.stack.slice(0, prev.index + 1), normalized];
          return { stack: nextStack, index: nextStack.length - 1 };
        });
      }
    }
  }, [win.browserUrl]);

  React.useEffect(() => {
    const view = webviewRef.current;
    if (!view || isBrowserRuntime) return;  // FIXME : Capabilities

    const syncHistory = () => setNativeCanGoBack(Boolean(view.canGoBack));
    const syncPage = () => {
      if (view.url) setAddress(view.url);
      if (view.url && !view.loading) {
        markReadyRef.current();
      }
      syncHistory();
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
        prefersDark
      );
    };

    view.addEventListener(WEBVIEW_GUEST_FOCUS_EVENT, onGuestFocus);
    view.addEventListener(WEBVIEW_LOADING_CHANGE_EVENT, syncLoading);
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, syncPage);
    view.addEventListener(WEBVIEW_HISTORY_CHANGE_EVENT, syncHistory);
    view.addEventListener(WEBVIEW_FAVICON_CHANGE_EVENT, syncFavicon);
    view.addEventListener(WEBVIEW_PAGE_FAILURE_CHANGE_EVENT, syncFailure);
    view.addEventListener("did-change-theme-color", onThemeColor);

    syncLoading();
    syncPage();
    syncHistory();
    syncFavicon();
    syncFailure();

    return () => {
      view.removeEventListener(WEBVIEW_GUEST_FOCUS_EVENT, onGuestFocus);
      view.removeEventListener(WEBVIEW_LOADING_CHANGE_EVENT, syncLoading);
      view.removeEventListener(WEBVIEW_PAGE_CHANGE_EVENT, syncPage);
      view.removeEventListener(WEBVIEW_HISTORY_CHANGE_EVENT, syncHistory);
      view.removeEventListener(WEBVIEW_FAVICON_CHANGE_EVENT, syncFavicon);
      view.removeEventListener(WEBVIEW_PAGE_FAILURE_CHANGE_EVENT, syncFailure);
      view.removeEventListener("did-change-theme-color", onThemeColor);
    };
  }, [isBrowserRuntime, prefersDark, win.browserWindowId, win.browserUrl]);  // FIXME : Capabilities

  const currentUrl = normalizeWebUrl(address) ?? win.browserUrl ?? "";
  const bookmarks = useBrowserBookmarks();
  const bookmarked = isBrowserApp && Boolean(currentUrl) && isBookmarked(bookmarks, currentUrl);
  const canonicalUrl = canonicalizeWebUrl(currentUrl) ?? currentUrl;
  const storeExtId = React.useMemo(
    () => parseChromeWebStoreExtensionId(currentUrl),
    [currentUrl]
  );
  const storeExtInstalled = React.useMemo(
    () => Boolean(storeExtId && extensions.some((e) => e.id === storeExtId)),
    [extensions, storeExtId]
  );

  const handleToggleStoreExtension = React.useCallback(async () => {
    if (!storeExtId) return;
    if (isBrowserRuntime) {  // FIXME : Capabilities
      pushNotification({
        appName: "Chrome Web Store",
        summary: _("Extension ID: %s", storeExtId),
        body: _(
          "Chrome Web Store extensions install natively under Domicile Linux."
        ),
      });
      return;
    }
    try {
      await hostFiles(piloti).createDir(".config/piloti").catch(() => undefined);
      let existing: Record<string, unknown> = {};
      const readRes = await hostFiles(piloti)
        .readText(".config/piloti/domicile.json")
        .catch(() => null);
      if (readRes) {
        readRes.match({
          Ok: (text) => {
            try {
              existing = JSON.parse(text) as Record<string, unknown>;
            } catch {
              existing = {};
            }
          },
          Err: () => undefined,
        });
      }
      const prevExt = normalizeExtensionsConfig(existing.extensions);
      const nextInstalled = !prevExt.web_store.includes(storeExtId);
      const nextExt = setExtensionEnabled(
        prevExt,
        "web_store",
        storeExtId,
        nextInstalled
      );
      await hostFiles(piloti).write(
        ".config/piloti/domicile.json",
        JSON.stringify({ ...existing, extensions: nextExt }, null, 2) + "\n"
      );
      pushNotification({
        appName: "Chrome Web Store",
        summary: nextInstalled
          ? _("Added Extension (%s)", storeExtId)
          : _("Removed Extension (%s)", storeExtId),
        body: _(
          "Saved to ~/.config/piloti/domicile.json. Restart Domicile to apply."
        ),
      });
    } catch {
      pushNotification({
        appName: "Chrome Web Store",
        summary: _("Could not update extensions config"),
        body: storeExtId,
        urgency: "critical",
      });
    }
  }, [piloti, isBrowserRuntime, pushNotification, storeExtId]);  // FIXME : Capabilities

  React.useEffect(() => {
    if (!isFocusedTab) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === "l") {
        e.preventDefault();
        setDraftAddress(currentUrl);
        setEditingAddress(true);
      } else if (isBrowserApp && key === "t") {
        e.preventDefault();
        openBrowserTab(win.id);
      } else if (isBrowserApp && key === "w" && win.browserWindowId) {
        e.preventDefault();
        closeBrowserTab(win.id, win.browserWindowId);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isFocusedTab, isBrowserApp, win.id, win.browserWindowId, currentUrl, openBrowserTab, closeBrowserTab]);

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
    // An address goes there; anything else is a web search.
    const normalized = looksLikeUrl(draftAddress)
      ? normalizeWebUrl(draftAddress)
      : draftAddress.trim()
        ? webSearchUrl(draftAddress, isBrowserRuntime)  // FIXME : Capabilities
        : null;
    if (normalized) {
      setAddress(normalized);
      if (isBrowserRuntime) {  // FIXME : Capabilities
        setHistoryState((prev) => {
          if (prev.stack[prev.index] === normalized) return prev;
          const nextStack = [...prev.stack.slice(0, prev.index + 1), normalized];
          return { stack: nextStack, index: nextStack.length - 1 };
        });
      } else if (webviewRef.current) {
        webviewRef.current.src = normalized;
      }
    }
    setEditingAddress(false);
  };

  const canGoBack = isBrowserRuntime ? historyState.index > 0 : nativeCanGoBack;  // FIXME : Capabilities
  const handleGoBack = React.useCallback(() => {
    if (isBrowserRuntime) {  // FIXME : Capabilities
      setHistoryState((prev) => {
        if (prev.index <= 0) return prev;
        const nextIndex = prev.index - 1;
        const prevUrl = prev.stack[nextIndex];
        if (prevUrl) setAddress(prevUrl);
        return { ...prev, index: nextIndex };
      });
    } else {
      webviewRef.current?.goBack();
    }
  }, [isBrowserRuntime]);  // FIXME : Capabilities

  React.useEffect(() => {
    const triggerPrint = () => {
      if (!isFocusedTab) return;
      if (isBrowserRuntime) {  // FIXME : Capabilities
        try {
          const cw = iframeRef.current?.contentWindow;
          if (cw) {
            cw.focus();
            cw.print();
            return;
          }
        } catch {
          // Cross-origin iframes throw on contentWindow.print()
        }
        window.print();
      } else {
        const view = webviewRef.current as
          | (HTMLWebViewElement & { print?: () => void })
          | null;
        if (view && typeof view.print === "function") {
          view.print();
        } else {
          window.print();
        }
      }
    };
    const onPrintFocused = () => triggerPrint();
    const onAppAction = (e: Event) => {
      const detail = (
        e as CustomEvent<{ windowId?: string; actionId?: string }>
      ).detail;
      if (!detail || (detail.windowId && detail.windowId !== win.id)) return;
      if (detail.actionId === "file:print") triggerPrint();
      if (!active) return;
      if (detail.actionId === "browser:new-tab") openBrowserTab(win.id);
      if (detail.actionId === "browser:new-window") launchApp("browser", { forceNew: true });
      if (detail.actionId === "browser:reopen-tab") reopenClosedBrowserTab(win.id);
      if (detail.actionId === "browser:close-tab" && win.browserWindowId) {
        closeBrowserTab(win.id, win.browserWindowId);
      }
    };
    const offPrintFocused = onShellEvent("piloti:print-focused", onPrintFocused);
    // Ctrl/Cmd+Shift+T brings the last closed tab back.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!active || !isFocusedTab || !(e.ctrlKey || e.metaKey) || e.altKey || !e.shiftKey) return;
      if (e.key.toLowerCase() !== "t") return;
      e.preventDefault();
      reopenClosedBrowserTab(win.id);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("piloti:app-action", onAppAction);
    return () => {
      offPrintFocused();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("piloti:app-action", onAppAction);
    };
  }, [isFocusedTab, active, isBrowserRuntime, win.id, win.browserWindowId, openBrowserTab, closeBrowserTab, reopenClosedBrowserTab, launchApp]);  // FIXME : Capabilities
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
    const cached = getCachedWebThemeColor(currentUrl, prefersDark) ?? null;
    setThemeColor(cached);
    if (!isBrowserRuntime || !currentUrl || !win.browserWindowId) return;  // FIXME : Capabilities
    if (cached !== null) {
      // Still fetch title if needed, or update themeColor in background
    }
    const controller = new AbortController();
    fetchWebPageMetadata(currentUrl, controller.signal, prefersDark).then(
      ({ title, themeColor: fetchedThemeColor }) => {
        if (controller.signal.aborted) return;
        if (title) {
          titleHandlerRef.current(title);
        }
        if (fetchedThemeColor) {
          setThemeColor(fetchedThemeColor);
        }
      }
    );
    return () => controller.abort();
  }, [isBrowserRuntime, currentUrl, win.browserWindowId, prefersDark]);  // FIXME : Capabilities

  const iframeSrc = normalizeWebUrl(address) ?? "about:blank";

  React.useEffect(() => {
    if (!isBrowserRuntime) return;  // FIXME : Capabilities
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
  }, [isBrowserRuntime, iframeSrc]);  // FIXME : Capabilities

  const handleIframeLoad = React.useCallback(() => {
    setIsLoading(false);
    markReadyRef.current();
    try {
      const frameHref = iframeRef.current?.contentWindow?.location?.href;
      if (frameHref && frameHref !== "about:blank") {
        setAddress(frameHref);
        setHistoryState((prev) => {
          if (prev.stack[prev.index] === frameHref) return prev;
          const nextStack = [...prev.stack.slice(0, prev.index + 1), frameHref];
          return { stack: nextStack, index: nextStack.length - 1 };
        });
      }
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
  }, [currentUrl, prefersDark]);

  const toggleExtensionPin = (id: string) => {
    const current = settings.pinnedExtensionIds ?? [];
    updateSettings({
      pinnedExtensionIds: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  };

  const extensionMenuItems: BrowserExtensionItem[] = isBrowserRuntime  // FIXME : Capabilities
    ? [
        {
          id: "dark-reader",
          name: "Dark Reader",
          pressed: darkReaderEnabled,
          onActivate: onToggleDarkReader,
        },
        ...(settings.demoExtensionEnabled !== false
          ? [
              {
                id: "piloti-demo",
                name: "Piloti Demo Extension",
                badgeText: demoBadgeCount > 0 ? String(demoBadgeCount) : undefined,
                active: demoPopupOpen,
                onActivate: () => setDemoPopupOpen((v) => !v),
              },
            ]
          : []),
      ]
    : extensions.map((ext) => ({
        id: ext.id,
        name: ext.title || ext.name,
        icon: ext.icon || undefined,
        badgeText: ext.badgeText || undefined,
        badgeColor: ext.badgeColor,
        enabled: ext.enabled,
        active: activeExtPopup?.id === ext.id,
        onActivate: () => {
          const closing = activeExtPopup?.id === ext.id;
          if (!closing) piloti.extensions.activate(ext.id);
          if (ext.popup) {
            setExtPopupSize({ width: 360, height: 440 });
            setActiveExtPopup(closing ? null : { id: ext.id, popup: ext.popup });
          } else {
            setActiveExtPopup(null);
          }
        },
      }));

  const toggleInstallApp = () => {
    toggleWebAppInstall({
      piloti,
      installedWebApps: installedApps,
      pinnedAppIds: settings.pinnedAppIds,
      updateSettings,
      url: currentUrl,
      title: win.title,
      iconUrl: latestFavicon,
    });
  };

  const effectiveThemeColor = themeColor
    ? darkReaderEnabled
      ? darkenThemeColor(themeColor)
      : themeColor
    : null;
  const contrastFg = getContrastForeground(effectiveThemeColor);

  const chrome: AppChrome = {
    appId: win.appId,
    windowId: win.id,
    decorations: isCsd ? "client" : "server",
    // Also under a server-side titlebar: Install Web App lives in it.
    menu: (side) => (
      <WindowMenuButton
        side={side}
        windowId={win.id}
        appId={win.appId}
        iconUrl={win.iconUrl}
        iconName={win.iconName}
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
    ),
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-ui-window">
      <AppChromeProvider value={chrome}>
        <HeaderBar
          style={
            effectiveThemeColor
              ? {
                backgroundColor: effectiveThemeColor,
                color: contrastFg ?? undefined,
                borderBottomColor: "rgba(128,128,128,0.22)",
                ...(contrastFg
                  ? ({ "--window-controls-fg": contrastFg } as React.CSSProperties)
                  : {}),
              }
              : undefined
          }
          className={cn(
            "transition-colors duration-200",
            // The address field takes the room the centred title leaves.
            editingAddress && "grid-cols-[auto_minmax(0,1fr)_auto]",
            // A tinted header tints its window buttons too.
            "[&_[data-slot=window-controls]_button]:bg-[color-mix(in_srgb,currentColor_10%,transparent)] [&_[data-slot=window-controls]_button]:text-current [&_[data-slot=window-controls]_button:hover]:bg-[color-mix(in_srgb,currentColor_18%,transparent)]",
          )}
        >
          <HeaderBar.Start>
            <button
              type="button"
              title={_("Back")}
              aria-label={_("Back")}
              disabled={!canGoBack}
              onClick={handleGoBack}
              className={cn(
                "flex size-7 items-center justify-center rounded-ui-control transition-colors disabled:pointer-events-none disabled:opacity-35",
                "hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
              )}
            >
              <SymbolicIcon name="go-previous" fallback={ChevronLeftIcon} className="size-4" />
            </button>
          </HeaderBar.Start>
          <HeaderBar.Title interactive>
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
                    "h-7 w-full max-w-xl rounded-ui-control border border-ui-accent/70 bg-black/8 px-2.5 text-ui-body font-medium outline-none dark:bg-white/12",
                    !contrastFg && "text-ui-label"
                  )}
                />
              </form>
            ) : (
              <div className="pointer-events-none flex min-w-0 shrink items-center justify-center gap-1.5 px-4">
                {isLoading && (
                  <Loader2Icon
                    aria-label="Loading"
                    className={cn(
                      "size-3.5 shrink-0 animate-spin opacity-75",
                      !contrastFg && "text-ui-label"
                    )}
                  />
                )}
                <button
                  type="button"
                  data-window-no-drag
                  aria-label={_("Edit address")}
                  onClick={() => {
                    setDraftAddress(currentUrl);
                    setEditingAddress(true);
                  }}
                  className={cn(
                    "pointer-events-auto max-w-full cursor-text truncate rounded-ui-control px-2 py-0.5 text-ui-body font-semibold transition-colors hover-fill:bg-black/6 dark:hover-fill:bg-white/10",
                    !contrastFg && "text-ui-label"
                  )}
                >
                  {win.title}
                </button>
              </div>
            )}
          </HeaderBar.Title>
          <HeaderBar.End>
            {storeExtId && (
              <Button
                size="sm"
                variant={storeExtInstalled ? "secondary" : "default"}
                onClick={() => void handleToggleStoreExtension()}
                className="mr-1 h-6 gap-1 px-2 text-ui-small"
              >
                <SymbolicIcon name="folder-download" fallback={DownloadIcon} className="size-3" />
                {storeExtInstalled
                  ? _("Remove Extension")
                  : _("Install Extension")}
              </Button>
            )}
            {isBrowserApp && (
              <button
                type="button"
                data-slot="browser-bookmark-toggle"
                aria-pressed={bookmarked}
                disabled={!currentUrl}
                title={bookmarked ? _("Remove Bookmark") : _("Add Bookmark")}
                aria-label={bookmarked ? _("Remove Bookmark") : _("Add Bookmark")}
                onClick={() => toggleBrowserBookmark(currentUrl, win.title)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-ui-control transition-colors disabled:opacity-35 active:text-black dark:active:text-white hover-fill:bg-black/8 dark:hover-fill:bg-white/10",
                  bookmarked ? "text-ui-accent" : "text-ui-label-secondary"
                )}
              >
                <SymbolicIcon
                  name={bookmarked ? "starred" : "non-starred"}
                  fallback={StarIcon}
                  className={cn("size-4", bookmarked && "fill-current")}
                />
              </button>
            )}
            {isBrowserApp && (
              // Split button: + opens a web page tab; the chevron lists apps
              // that can open in a tab. Placeholder: those apps will declare
              // tab support in their .desktop entry (e.g. `X-Piloti-Tabs=true`).
              <div data-slot="new-tab-split" className="flex items-center">
                <button
                  type="button"
                  title={_("New Tab")}
                  aria-label={_("New Tab")}
                  onClick={() => openBrowserTab(win.id)}
                  className="flex size-7 items-center justify-center rounded-l-ui-control transition-colors hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
                >
                  <SymbolicIcon name="list-add" fallback={PlusIcon} className="size-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={_("New Tab With…")}
                    title={_("New Tab With…")}
                    className="flex h-7 w-4 items-center justify-center rounded-r-ui-control outline-none transition-colors hover-fill:bg-black/8 data-[popup-open]:bg-black/12 dark:hover-fill:bg-white/10 dark:data-[popup-open]:bg-white/15"
                  >
                    <SymbolicIcon name="pan-down" fallback={ChevronDownIcon} className="size-3" strokeWidth={2.5} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem onClick={() => openBrowserTab(win.id)}>
                      <SymbolicIcon name="web-browser" fallback={GlobeIcon} className="size-4" />
                      {_("Web Page")}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <SymbolicIcon name="folder" fallback={FolderIcon} className="size-4" />
                      {_("Folders")}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <SymbolicIcon name="utilities-terminal" fallback={TerminalIcon} className="size-4" />
                      {_("Terminal")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <BrowserExtensionsMenu
              items={extensionMenuItems}
              pinnedIds={settings.pinnedExtensionIds ?? []}
              onTogglePin={toggleExtensionPin}
              onManage={() => launchApp("settings", { payload: "extensions" })}
            />
          </HeaderBar.End>
        </HeaderBar>
      </AppChromeProvider>
      {tabBar}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isBrowserRuntime ? (  // FIXME : Capabilities
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title={win.title}
            onLoad={handleIframeLoad}
            onError={() => setIsLoading(false)}
            onPointerDownCapture={dismissOpenPopups}
            onFocus={dismissOpenPopups}
            style={
              darkReaderEnabled
                ? { filter: WEB_DARK_READER_FILTER, colorScheme: "dark" }
                : undefined
            }
            className="h-full w-full border-0 bg-ui-window"
          />
        ) : (
          <webview
            ref={webviewRef}
            window={win.browserWindowId}
            resizing={windowCtx?.resizing ? "" : undefined}
            className="block h-full w-full bg-ui-window"
          />
        )}

        {!isBrowserRuntime && activeExtPopup && (  // FIXME : Capabilities
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
              className="absolute top-1.5 right-2 z-40 max-h-[calc(100%-12px)] max-w-[calc(100%-16px)] overflow-hidden rounded-ui-box border border-ui-separator bg-ui-window shadow-2xl"
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

        {demoPopupOpen && isBrowserRuntime && settings.demoExtensionEnabled !== false && (  // FIXME : Capabilities
          <>
            <div
              className="absolute inset-0 z-30"
              onClick={() => setDemoPopupOpen(false)}
            />
            <div className="absolute top-1.5 right-2 z-40 w-[290px] max-w-[calc(100%-16px)] rounded-ui-box border border-ui-separator bg-ui-window p-3.5 text-ui-label shadow-2xl">
              <div className="flex items-center gap-2">
                <SymbolicIcon name="application-x-addon" fallback={PuzzleIcon} className="size-4 text-ui-accent" />
                <div className="text-ui-body font-semibold">
                  Piloti Demo Extension
                </div>
              </div>
              <p className="mt-1 text-ui-small leading-relaxed text-ui-label-secondary">
                {_("Simulated extension popup in Web mode. On native Domicile, real Chrome extensions load via extensions.unpacked / extensions.web_store.")}
              </p>
              <div className="mt-2.5 rounded-ui-control bg-black/5 px-2.5 py-2 text-ui-small break-all text-ui-label-secondary dark:bg-white/6">
                <div className="font-medium text-ui-label">{win.title}</div>
                <div className="mt-0.5 opacity-80">{win.browserUrl || address}</div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 flex-1 text-ui-body"
                  onClick={() => setDemoBadgeCount((c) => c + 1)}
                >
                  {_("Increment Badge")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-ui-body"
                  onClick={() => setDemoBadgeCount(0)}
                >
                  {_("Clear")}
                </Button>
              </div>
            </div>
          </>
        )}

        {pageFailure && !isBrowserRuntime && (  // FIXME : Capabilities
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ui-window p-6 text-center text-ui-label">
            <SymbolicIcon name="web-browser" fallback={GlobeIcon} className="size-7 text-ui-label-secondary" />
            <div className="text-ui-body font-semibold">Unable to load page</div>
            <div className="text-ui-small text-ui-label-secondary">
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

/**
 * A web window and its tabs. Every tab keeps its page mounted (switching never
 * reloads it); only the active one is shown. The tab bar appears from two
 * tabs on, under the toolbar (Safari).
 */
function BrowserTabsSurface({
  win,
  darkReaderEnabled,
  onToggleDarkReader,
}: {
  win: DesktopWindowInstance;
  darkReaderEnabled: boolean;
  onToggleDarkReader: () => void;
}) {
  const {
    selectBrowserTab,
    closeBrowserTab,
    reorderBrowserTabs,
    detachBrowserTab,
    pinBrowserTab,
  } = useWindowManager();
  const tabs: BrowserTab[] = win.browserTabs ?? [
    {
      id: win.browserWindowId!,
      url: win.browserUrl ?? "",
      title: win.title,
      iconUrl: win.iconUrl,
    },
  ];
  const showTabBar = tabs.length > 1;
  // One tab bar for the window, always mounted and only shown or hidden. Each
  // page keeps an empty slot of the bar's height under its toolbar; the bar is
  // laid over the active page's slot.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [tabBarTop, setTabBarTop] = React.useState(0);
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !showTabBar) return;
    const measure = () => {
      const slot = container.querySelector<HTMLElement>(
        '[data-active-tab] [data-slot="browser-tab-slot"]'
      );
      if (slot) setTabBarTop(slot.offsetTop);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [showTabBar, win.browserWindowId]);
  const tabSlot = (
    <div
      data-slot="browser-tab-slot"
      className={cn("h-ui-control-large shrink-0", !showTabBar && "hidden")}
    />
  );
  return (
    <div ref={containerRef} className="relative flex h-full w-full flex-1 overflow-hidden">
      <BrowserTabBar
        hidden={!showTabBar}
        top={tabBarTop}
        tabs={tabs}
        activeId={win.browserWindowId}
        onSelect={(id) => selectBrowserTab(win.id, id)}
        onClose={(id) => closeBrowserTab(win.id, id)}
        onReorder={(ids) => reorderBrowserTabs(win.id, ids)}
        onDetach={(id) => detachBrowserTab(win.id, id)}
        onPin={(id, pinned) => pinBrowserTab(win.id, id, pinned)}
      />
      {tabs.map((tab) => {
        const active = tab.id === win.browserWindowId;
        return (
          <div
            key={tab.id}
            data-active-tab={active || undefined}
            aria-hidden={!active || undefined}
            className={cn(
              "absolute inset-0 flex",
              !active && "invisible pointer-events-none"
            )}
          >
            <WebViewSurface
              win={
                active
                  ? win
                  : {
                      ...win,
                      browserWindowId: tab.id,
                      browserUrl: tab.url,
                      title: tab.title,
                      iconUrl: tab.iconUrl,
                    }
              }
              active={active}
              tabBar={tabSlot}
              darkReaderEnabled={darkReaderEnabled}
              onToggleDarkReader={onToggleDarkReader}
            />
          </div>
        );
      })}
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
    onDomReady,
    darkReaderEnabled,
    onToggleDarkReader,
  }: {
    win: DesktopWindowInstance;
    onDomReady: (id: string) => void;
    darkReaderEnabled: boolean;
    onToggleDarkReader: () => void;
  }) {
    const isCsd = useAppChrome().decorations === "client";
    const isBrowserRuntime = useSettingsSelector((v) => v.isBrowserRuntime); // FIXME : Capabilities

    if (win.waylandAppId && !isBrowserRuntime) {  // FIXME : Capabilities
      return <WaylandAppSurface win={win} />;
    }

    if (win.browserWindowId && isAppModuleWindow(win)) {
      return <AppModuleSurface win={win} />;
    }

    if (win.browserWindowId) {
      return (
        <BrowserTabsSurface
          win={win}
          darkReaderEnabled={darkReaderEnabled}
          onToggleDarkReader={onToggleDarkReader}
        />
      );
    }

    if (win.builtinComponent === "settings") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <SettingsApp
            initialPane={win.payload}
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
            windowId={win.id}
          />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "texts" && win.isolated) {
      return (
        <IsolatedAppFrame
          appId="texts"
          windowId={win.id}
          title={win.title}
          isCsd={isCsd}
          initialPath={win.payload}
        />
      );
    }
    if (win.builtinComponent === "texts") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <TextsApp
            initialPath={win.payload}
            windowId={win.id}
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
          <AppStoreApp windowId={win.id} initialPayload={win.payload} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "calculator") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <CalculatorApp windowId={win.id} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "hello-world") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <HelloWorldApp />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "piloti-demo") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <PilotiDemoApp />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "selfies") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <SelfiesApp windowId={win.id} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "system-monitor") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <SystemMonitorApp windowId={win.id} />
        </React.Suspense>
      );
    }
    if (win.builtinComponent === "login-screen") {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <LoginScreenApp windowId={win.id} />
        </React.Suspense>
      );
    }

    // In Browser Dev Mode, simulated non-Settings Wayland windows render a minimal surface card
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ui-window p-6 text-center text-ui-label">
        <div className="text-ui-body font-semibold">{win.title}</div>
        <div className="text-ui-small text-ui-label-secondary">
          Simulated Wayland surface (`{win.waylandAppId ?? win.appId}`) ·
          Renders native Linux client under Domicile
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.darkReaderEnabled === next.darkReaderEnabled &&
    prev.win.id === next.win.id &&
    prev.win.builtinComponent === next.win.builtinComponent &&
    prev.win.payload === next.win.payload &&
    prev.win.waylandAppId === next.win.waylandAppId &&
    prev.win.browserWindowId === next.win.browserWindowId &&
    prev.win.browserUrl === next.win.browserUrl &&
    prev.win.browserIsApp === next.win.browserIsApp &&
    sameBrowserTabs(prev.win.browserTabs, next.win.browserTabs) &&
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

/** Tabs of a web window: same order, titles and icons. */
function sameBrowserTabs(a?: BrowserTab[], b?: BrowserTab[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (tab, i) =>
      tab.id === b[i].id &&
      tab.title === b[i].title &&
      tab.iconUrl === b[i].iconUrl &&
      tab.url === b[i].url
  );
}

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
  const isBrowserRuntime = useSettingsSelector((v) => v.isBrowserRuntime); // FIXME : Capabilities
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
  const handleDomReady = React.useCallback((id: string) => {
    const appId = loggedWindowsRef.current.get(id);
    if (appId && !readyLoggedRef.current.has(id)) {
      readyLoggedRef.current.add(id);
      logAppEvent(appId, "ready");
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
      el.style.transition = "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)";
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
      void import("@/apps/files/FilesApp");
      void import("@/apps/texts/TextsApp");
      void import("@/apps/image-viewer/ImageViewerApp");
      void import("@/apps/terminal/XtermTerminalApp");
      void import("@/apps/settings/SettingsApp");
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
      if (targetWin.waylandAppId && !isBrowserRuntime) {  // FIXME : Capabilities
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
    isBrowserRuntime,  // FIXME : Capabilities
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
            '[data-slot="window"], [data-slot="select-content"], [data-slot="dropdown-menu-content"], [data-slot="context-menu-content"], [role="menu"], [data-popup-backdrop]',
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
          const isWaylandSurface = Boolean(win.waylandAppId) && !isBrowserRuntime;  // FIXME : Capabilities
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
              resizable={win.appId !== "calculator" && !presentation}
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
                      "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
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
