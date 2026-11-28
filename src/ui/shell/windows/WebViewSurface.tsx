/// <reference types="@domicile-desktop/react/elements" />
import { hostFiles } from "@/core/files/host-files";
import { looksLikeUrl, webSearchUrl } from "@/core/util/web-search";
import * as React from "react";
import { onShellEvent } from "@/core/windows/shell-events";
import { usePiloti } from "@/platform/shared/piloti";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  WEBVIEW_CLOSE_EVENT,
  WEBVIEW_CONTENT_SIZE_CHANGE_EVENT,
  WEBVIEW_CONTEXT_MENU_EVENT,
  WEBVIEW_DIALOG_EVENT,
  WEBVIEW_DIALOG_WITHDRAWN_EVENT,
  WEBVIEW_PERMISSION_REQUEST_EVENT,
  WEBVIEW_PERMISSION_REQUEST_WITHDRAWN_EVENT,
  WEBVIEW_FILE_CHOOSER_EVENT,
  WEBVIEW_FAVICON_CHANGE_EVENT,
  WEBVIEW_GUEST_FOCUS_EVENT,
  WEBVIEW_GUEST_KEYDOWN_EVENT,
  WEBVIEW_HISTORY_CHANGE_EVENT,
  WEBVIEW_LOADING_CHANGE_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
  WEBVIEW_PAGE_FAILURE_CHANGE_EVENT,
  WEBVIEW_ZOOM_IN_REQUEST_EVENT,
  WEBVIEW_ZOOM_OUT_REQUEST_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
  RotateCwIcon,
  TriangleAlertIcon,
  XIcon,
  DownloadIcon,
  GlobeIcon,
  StarIcon,
  Loader2Icon,
  PuzzleIcon,
} from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { WindowMenuButton } from "@/ui/components/common/WindowMenuButton";
import {
  BrowserExtensionsMenu,
  type BrowserExtensionItem,
} from "@/ui/shell/windows/BrowserExtensionsMenu";
import { _ } from "@/core/util/i18n";
import {
  AppChromeProvider,
  useAppChrome,
  type AppChrome,
} from "@/ui/components/elements/app-chrome";
import { HeaderBar } from "@/ui/components/elements/header-bar";
import { Button } from "@/ui/components/ui/button";
import {
  DropdownMenuItem,
} from "@/ui/components/ui/dropdown-menu";
import { useWindowContext } from "@/ui/components/ui/window";
import {
  normalizeWebUrl,
  useSystemBackends,
  useWindowManager,
  type DesktopWindowInstance,
  useDesktopSettings,
  useSettingsSelector,
  useUpdateSettings,
} from "@/ui/context/DesktopStateContext";
import {
  isBookmarked,
  toggleBrowserBookmark,
  useBrowserBookmarks,
} from "@/ui/shell/windows/browser-bookmarks";
import {
  fetchWebPageMetadata,
  findMatchingWebApp,
  getCachedWebThemeColor,
  getContrastForeground,
  isHostnameFallbackTitle,
  setCachedWebDescription,
  setCachedWebThemeColor,
} from "@/core/data/web-apps";
import { cn } from "@/core/util/utils";
import {
  WEB_DARK_READER_FILTER,
  normalizeExtensionsConfig,
  parseChromeWebStoreExtensionId,
  setExtensionEnabled,
} from "@/platform/shared/browser-extensions";
import { toggleWebAppInstall } from "@/platform/shared/web-apps-store";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { dismissOpenPopups } from "@/ui/shell/windows/dismiss-popups";
import { BrowserFindBar } from "@/ui/shell/windows/BrowserFindBar";
import {
  BROWSER_TAB_RELOAD_EVENT,
  browserShortcut,
  browserTabTarget,
  type BrowserCommand,
} from "@/ui/shell/windows/browser-shortcuts";
import { formatBrowserZoom, nextBrowserZoom } from "@/ui/shell/windows/browser-zoom";
import { useWebViewStatus } from "@/ui/shell/windows/use-webview-status";
import {
  canFrameGoBack,
  canFrameGoForward,
  frameCurrentUrl,
  frameHistoryVersion,
  framePushed,
  frameRemoved,
  frameStarted,
  stepFrame,
  subscribeFrameHistory,
} from "@/ui/shell/windows/demo-frame-history";
import { BrowserAddressSuggestions } from "@/ui/shell/windows/BrowserAddressSuggestions";
import {
  addressSuggestions,
  clearBrowserHistory,
  readBrowserHistory,
  recordBrowserVisit,
} from "@/ui/shell/windows/browser-history";
import { BrowserPageMenu, type PageMenuCommands } from "@/ui/shell/windows/BrowserPageMenu";
import { PageDialog, PermissionBubble } from "@/ui/shell/windows/BrowserPagePrompts";
import { BrowserDownloadsMenu } from "@/ui/shell/windows/BrowserDownloadsMenu";
import { BrowserSiteInfo } from "@/ui/shell/windows/BrowserSiteInfo";
import { BrowserNewTabButton } from "@/ui/shell/windows/BrowserNewTabButton";
import { BrowserHistoryMenu } from "@/ui/shell/windows/BrowserHistoryMenu";

function siteHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
import { BrowserFileChooser } from "@/ui/shell/windows/BrowserFileChooser";
import {
  downloadFileName,
  freeDownloadPath,
  startDownloadsBridge,
} from "@/ui/shell/windows/browser-downloads";
import { DownloadState } from "@domicile-desktop/sdk/desktop/downloads";

const toolbarButton = cn(
  "flex size-7 items-center justify-center rounded-ui-control transition-colors disabled:pointer-events-none disabled:opacity-35",
  "hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
);

// One array while there is nothing, so memos and effects keep still.
const NO_EXTENSIONS: NonNullable<ReturnType<typeof usePiloti>["extensions"]["list"]> = [];

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/** Menu bar actions (`browser:<command>`) that run a toolbar command. */
const MENU_COMMANDS = new Set<BrowserCommand["kind"]>([
  "back",
  "forward",
  "reload",
  "find",
  "zoom-in",
  "zoom-out",
  "zoom-reset",
  "focus-address",
  "toggle-bookmark",
  "clear-history",
]);

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

export function WebViewSurface({
  win,
  darkReaderEnabled,
  onToggleDarkReader,
  active = true,
  tabbed = false,
}: {
  win: DesktopWindowInstance;
  darkReaderEnabled: boolean;
  onToggleDarkReader: () => void;
  /** False for a background tab: it stays mounted but ignores shortcuts. */
  active?: boolean;
  /** Under the tab bar, which holds the window controls: this header has none. */
  tabbed?: boolean;
}) {
  const isCsd = useAppChrome().decorations === "client";
  const piloti = usePiloti();
  const { compositor } = useCapabilities();
  const resolvedTheme = useSettingsSelector((v) => v.resolvedTheme);
  const settings = useDesktopSettings(["activeWorkspace", "darkReaderWebEnabled", "debugMode", "demoExtensionEnabled", "dockAutoHide", "dockPosition", "dockSize", "installedWebApps", "pinnedAppIds", "pinnedExtensionIds", "windowButtonLayout", "windowDecorationMode"]);
  const updateSettings = useUpdateSettings();
  const { pushNotification } = useSystemBackends();
  const {
    focusedWindowId,
    launchApp,
    focusWindow,
    setBrowserFavicon,
    setBrowserTitle,
    markWindowReady,
    openBrowserTab,
    closeBrowserTab,
    reopenClosedBrowserTab,
    selectBrowserTab,
  } = useWindowManager();
  const isFocusedTab = active && focusedWindowId === win.id;
  const isBrowserApp = win.appId === "browser";
  const windowCtx = useWindowContext();
  const webviewRef = React.useRef<HTMLWebViewElement | null>(null);
  // The same element, as state, for children that listen to it.
  const [webviewEl, setWebviewEl] = React.useState<HTMLWebViewElement | null>(null);
  React.useEffect(() => setWebviewEl(compositor ? webviewRef.current : null), [compositor]);
  const extPopupWebviewRef = React.useRef<HTMLWebViewElement | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);

  const extensions =
    useWatch(piloti.extensions, "change", () => piloti.extensions.list) ??
    NO_EXTENSIONS;
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
    if (!compositor) return;
    return piloti.extensions.on("popup", (req) => {
      if (!isFocusedTab) return;
      setExtPopupSize({ width: 360, height: 440 });
      setActiveExtPopup(req);
    });
  }, [piloti.extensions, isFocusedTab, compositor]);

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
  // Web demo: the iframe keeps its first address; later ones are navigations
  // inside it, so they enter the document's history (demo-frame-history.ts).
  const frameId = win.browserWindowId ?? win.id;
  const [initialSrc] = React.useState(
    () => normalizeWebUrl(win.browserUrl ?? "") ?? "about:blank"
  );
  React.useSyncExternalStore(subscribeFrameHistory, frameHistoryVersion, frameHistoryVersion);
  /** Loads the shell started (address, Back, Reload): not links in the page. */
  const expectedLoadsRef = React.useRef({ count: 0, until: 0 });
  const expectLoad = () => {
    const pending = expectedLoadsRef.current;
    pending.count = Date.now() < pending.until ? pending.count + 1 : 1;
    // A step within a page loads nothing: forget it after a while.
    pending.until = Date.now() + 10_000;
  };
  const loadedOnceRef = React.useRef(false);
  React.useEffect(() => {
    if (compositor) return;
    frameStarted(frameId, initialSrc);
    return () => frameRemoved(frameId);
  }, [compositor, frameId, initialSrc]);
  const navigateFrame = (url: string) => {
    const frame = iframeRef.current;
    if (!frame) return;
    expectLoad();
    setIsLoading(true);
    try {
      // Allowed across origins, and adds a history entry as a link would.
      frame.contentWindow!.location.href = url;
    } catch {
      frame.src = url;
    }
    framePushed(frameId, url);
    setAddress(url);
  };
  const navigateFrameRef = React.useRef(navigateFrame);
  navigateFrameRef.current = navigateFrame;
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
  const status = useWebViewStatus(webviewRef, compositor);
  const [demoZoom, setDemoZoom] = React.useState(1);
  const zoom = compositor ? status.zoom : demoZoom;
  const [findOpen, setFindOpen] = React.useState(false);
  const [findQuery, setFindQuery] = React.useState("");
  const [findToken, setFindToken] = React.useState(0);
  const [fileChooser, setFileChooser] = React.useState<DomicileFileChooserEvent | null>(null);
  const [pageMenu, setPageMenu] = React.useState<DomicileContextMenuEvent | null>(null);
  const closePageMenu = React.useCallback(() => setPageMenu(null), []);
  const [permissionRequest, setPermissionRequest] =
    React.useState<DomicilePermissionRequestEvent | null>(null);
  const [pageDialog, setPageDialog] = React.useState<DomicileDialogEvent | null>(null);

  // The engine draws no prompt: permissions and alert/confirm/prompt are ours.
  React.useEffect(() => {
    const view = webviewRef.current;
    if (!view || !compositor) return;
    const onPermission = (event: Event) => {
      event.preventDefault();
      setPermissionRequest(event as DomicilePermissionRequestEvent);
    };
    const onPermissionGone = () => setPermissionRequest(null);
    const onDialog = (event: Event) => {
      event.preventDefault();
      setPageDialog(event as DomicileDialogEvent);
    };
    const onDialogGone = () => setPageDialog(null);
    view.addEventListener(WEBVIEW_PERMISSION_REQUEST_EVENT, onPermission);
    view.addEventListener(WEBVIEW_PERMISSION_REQUEST_WITHDRAWN_EVENT, onPermissionGone);
    view.addEventListener(WEBVIEW_DIALOG_EVENT, onDialog);
    view.addEventListener(WEBVIEW_DIALOG_WITHDRAWN_EVENT, onDialogGone);
    return () => {
      view.removeEventListener(WEBVIEW_PERMISSION_REQUEST_EVENT, onPermission);
      view.removeEventListener(WEBVIEW_PERMISSION_REQUEST_WITHDRAWN_EVENT, onPermissionGone);
      view.removeEventListener(WEBVIEW_DIALOG_EVENT, onDialog);
      view.removeEventListener(WEBVIEW_DIALOG_WITHDRAWN_EVENT, onDialogGone);
    };
  }, [compositor]);

  // The engine draws no right-click menu: it says what was clicked.
  React.useEffect(() => {
    const view = webviewRef.current;
    if (!view || !compositor) return;
    const onContextMenu = (event: Event) => {
      dismissOpenPopups();
      setPageMenu(event as DomicileContextMenuEvent);
    };
    view.addEventListener(WEBVIEW_CONTEXT_MENU_EVENT, onContextMenu);
    return () => view.removeEventListener(WEBVIEW_CONTEXT_MENU_EVENT, onContextMenu);
  }, [compositor]);

  // Downloads show on the Dock and notify, whichever window started them.
  React.useEffect(() => {
    if (!compositor) return;
    startDownloadsBridge(piloti, {
      onFinished: (d) =>
        pushNotification({
          appName: _("Web Browser"),
          summary: d.state === DownloadState.Complete ? _("Download Complete") : _("Download Failed"),
          body: downloadFileName(d.path),
          ...(d.state === DownloadState.Failed ? { urgency: "critical" as const } : {}),
        }),
    });
  }, [compositor, piloti, pushNotification]);

  // The engine draws no file dialog: a download saves straight to the
  // download folder under a free name; an upload gets the shell's chooser.
  React.useEffect(() => {
    const view = webviewRef.current;
    if (!view || !compositor) return;
    const onFileChooser = (event: Event) => {
      const e = event as DomicileFileChooserEvent;
      e.preventDefault();
      if (e.mode !== "save") {
        setFileChooser(e);
        return;
      }
      const folder = e.currentFolder || `${e.home.replace(/\/$/, "")}/Downloads`;
      const claimed = new Set(
        (piloti.downloads.list ?? [])
          .filter((d) => d.state === DownloadState.InProgress)
          .map((d) => d.path)
      );
      void freeDownloadPath(
        folder,
        e.suggestedName,
        async (path) => (await piloti.vfs.stat(path)) !== null,
        claimed
      )
        .then((path) => e.choose([path]))
        .catch(() => {
          try {
            e.cancel();
          } catch {
            // Already answered.
          }
        });
    };
    view.addEventListener(WEBVIEW_FILE_CHOOSER_EVENT, onFileChooser);
    return () => view.removeEventListener(WEBVIEW_FILE_CHOOSER_EVENT, onFileChooser);
  }, [compositor, piloti]);

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

  const lastBrowserUrlRef = React.useRef(win.browserUrl);
  React.useEffect(() => {
    if (!win.browserUrl || win.browserUrl === lastBrowserUrlRef.current) return;
    lastBrowserUrlRef.current = win.browserUrl;
    const normalized = normalizeWebUrl(win.browserUrl);
    if (!compositor && normalized) navigateFrameRef.current(normalized);
    else setAddress(win.browserUrl);
  }, [compositor, win.browserUrl]);

  React.useEffect(() => {
    const view = webviewRef.current;
    if (!view || !compositor) return;

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
  }, [compositor, prefersDark, win.browserWindowId, win.browserUrl]);

  const currentUrl = normalizeWebUrl(address) ?? win.browserUrl ?? "";
  // The lock follows the page's committed address (native), never the typed
  // one; the demo can only go by the scheme.
  const security = compositor
    ? status.security
    : currentUrl.startsWith("https:")
      ? "secure"
      : "";
  const bookmarks = useBrowserBookmarks();
  // Each page shown is a visit (not the pages restored at start).
  const shownOnceRef = React.useRef(false);
  React.useEffect(() => {
    if (!isBrowserApp || !currentUrl) return;
    if (shownOnceRef.current) recordBrowserVisit(currentUrl);
    shownOnceRef.current = true;
  }, [isBrowserApp, currentUrl]);
  const bookmarked = isBrowserApp && Boolean(currentUrl) && isBookmarked(bookmarks, currentUrl);
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
    if (!compositor) {
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
  }, [piloti, compositor, pushNotification, storeExtId]);

  React.useEffect(() => {
    if (!editingAddress) return;
    const frame = requestAnimationFrame(() => {
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingAddress]);

  // Untouched, the field lists the bookmarks; typed into, matching pages.
  const [suggestIndex, setSuggestIndex] = React.useState(-1);
  const [addressInput, setAddressInput] = React.useState<HTMLInputElement | null>(null);
  const suggestQuery = draftAddress === currentUrl ? "" : draftAddress;
  const suggestions = React.useMemo(
    () =>
      editingAddress && isBrowserApp
        ? addressSuggestions(suggestQuery, bookmarks, readBrowserHistory(), Date.now())
        : [],
    [editingAddress, isBrowserApp, suggestQuery, bookmarks]
  );
  React.useEffect(() => setSuggestIndex(-1), [suggestQuery, editingAddress]);

  const goTo = (normalized: string) => {
    if (!compositor) {
      navigateFrame(normalized);
    } else if (webviewRef.current) {
      setAddress(normalized);
      webviewRef.current.src = normalized;
    }
    setEditingAddress(false);
  };

  const submitAddressEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const picked = suggestions[suggestIndex];
    if (picked) {
      goTo(picked.url);
      return;
    }
    // An address goes there; anything else is a web search.
    const normalized = looksLikeUrl(draftAddress)
      ? normalizeWebUrl(draftAddress)
      : draftAddress.trim()
        ? webSearchUrl(draftAddress, !compositor)
        : null;
    if (normalized) {
      if (!compositor) {
        navigateFrame(normalized);
      } else if (webviewRef.current) {
        setAddress(normalized);
        webviewRef.current.src = normalized;
      }
    }
    setEditingAddress(false);
  };

  const stepDemoHistory = (direction: -1 | 1) => {
    const url = stepFrame(frameId, direction);
    if (url === undefined) return;
    expectLoad();
    setIsLoading(true);
    if (url) setAddress(url);
  };
  const canGoBack = !compositor ? canFrameGoBack(frameId) : nativeCanGoBack;
  const handleGoBack = () => {
    if (!compositor) stepDemoHistory(-1);
    else webviewRef.current?.goBack();
  };

  const canGoForward = !compositor ? canFrameGoForward(frameId) : status.canGoForward;
  const handleGoForward = () => {
    if (!compositor) stepDemoHistory(1);
    else webviewRef.current?.goForward();
  };

  const handleReload = React.useCallback(() => {
    if (compositor) {
      webviewRef.current?.reload();
      return;
    }
    const frame = iframeRef.current;
    // After a link in a page of another origin the address is unknown.
    const url = frameCurrentUrl(frameId);
    if (!frame || !url) return;
    expectLoad();
    setIsLoading(true);
    try {
      // The page's own reload is out of reach across origins; replacing its
      // address with itself adds no history entry.
      frame.contentWindow!.location.replace(url);
    } catch {
      frame.src = url;
    }
  }, [compositor, frameId]);

  const handleStop = React.useCallback(() => {
    if (compositor) {
      webviewRef.current?.stop();
      return;
    }
    try {
      iframeRef.current?.contentWindow?.stop();
    } catch {
      // Cross-origin frames cannot be stopped from here.
    }
    setIsLoading(false);
  }, [compositor]);

  const applyZoom = React.useCallback(
    (next: number) => {
      if (!compositor) {
        setDemoZoom(next);
        return;
      }
      try {
        webviewRef.current?.setZoom(next);
      } catch {
        // RangeError outside 0.25 to 5: the steps stay inside.
      }
    },
    [compositor]
  );
  const zoomRef = React.useRef(zoom);
  zoomRef.current = zoom;

  // Ctrl+wheel over the page: the engine asks, the shell picks the step.
  React.useEffect(() => {
    const view = webviewRef.current;
    if (!view || !compositor) return;
    const zoomIn = () => applyZoom(nextBrowserZoom(zoomRef.current, 1));
    const zoomOut = () => applyZoom(nextBrowserZoom(zoomRef.current, -1));
    view.addEventListener(WEBVIEW_ZOOM_IN_REQUEST_EVENT, zoomIn);
    view.addEventListener(WEBVIEW_ZOOM_OUT_REQUEST_EVENT, zoomOut);
    return () => {
      view.removeEventListener(WEBVIEW_ZOOM_IN_REQUEST_EVENT, zoomIn);
      view.removeEventListener(WEBVIEW_ZOOM_OUT_REQUEST_EVENT, zoomOut);
    };
  }, [compositor, applyZoom]);

  // Find in page: native only, a demo iframe is another origin.
  const findQueryRef = React.useRef(findQuery);
  findQueryRef.current = findQuery;
  const openFind = React.useCallback(() => {
    setFindOpen(true);
    setFindToken((t) => t + 1);
    const query = findQueryRef.current;
    if (query.trim()) webviewRef.current?.find(query);
  }, []);
  const closeFind = React.useCallback(() => {
    setFindOpen(false);
    webviewRef.current?.stopFinding();
    webviewRef.current?.focus();
  }, []);
  const changeFindQuery = React.useCallback((query: string) => {
    setFindQuery(query);
    webviewRef.current?.find(query.trim() ? query : "");
  }, []);
  const stepFind = React.useCallback((backward: boolean) => {
    const query = findQueryRef.current;
    if (query.trim()) webviewRef.current?.find(query, backward);
  }, []);

  /** Runs a shortcut or menu command; false when it does not apply here. */
  const runCommand = (command: BrowserCommand): boolean => {
    switch (command.kind) {
      case "focus-address":
        setDraftAddress(currentUrl);
        setEditingAddress(true);
        return true;
      case "new-tab":
        if (!isBrowserApp) return false;
        openBrowserTab(win.id);
        return true;
      case "new-window":
        if (!isBrowserApp) return false;
        launchApp("browser", { forceNew: true });
        return true;
      case "close-tab":
        if (!isBrowserApp || !win.browserWindowId) return false;
        closeBrowserTab(win.id, win.browserWindowId);
        return true;
      case "reopen-tab":
        if (!isBrowserApp) return false;
        reopenClosedBrowserTab(win.id);
        return true;
      case "back":
        handleGoBack();
        return true;
      case "forward":
        handleGoForward();
        return true;
      case "reload":
        handleReload();
        return true;
      case "find":
        if (!compositor) return false;
        openFind();
        return true;
      case "find-next":
      case "find-previous":
        if (!compositor) return false;
        if (findOpen) stepFind(command.kind === "find-previous");
        else openFind();
        return true;
      case "zoom-in":
        applyZoom(nextBrowserZoom(zoom, 1));
        return true;
      case "zoom-out":
        applyZoom(nextBrowserZoom(zoom, -1));
        return true;
      case "zoom-reset":
        applyZoom(1);
        return true;
      case "toggle-bookmark":
        if (!isBrowserApp || !currentUrl) return false;
        toggleBrowserBookmark(currentUrl, win.title);
        return true;
      case "clear-history":
        if (!isBrowserApp) return false;
        clearBrowserHistory();
        return true;
      case "next-tab":
      case "previous-tab":
      case "select-tab": {
        if (!isBrowserApp) return false;
        const ids = (win.browserTabs ?? []).map((t) => t.id);
        const target = browserTabTarget(command, ids, win.browserWindowId);
        if (target) selectBrowserTab(win.id, target);
        return ids.length > 1;
      }
    }
  };
  const runCommandRef = React.useRef(runCommand);
  runCommandRef.current = runCommand;

  // The tab menu's Reload, for this tab even in the background.
  React.useEffect(() => {
    const onReloadTab = (e: Event) => {
      const tabId = (e as CustomEvent<{ tabId?: string }>).detail?.tabId;
      if (tabId && tabId === win.browserWindowId) runCommandRef.current({ kind: "reload" });
    };
    window.addEventListener(BROWSER_TAB_RELOAD_EVENT, onReloadTab);
    return () => window.removeEventListener(BROWSER_TAB_RELOAD_EVENT, onReloadTab);
  }, [win.browserWindowId]);

  const historyNewTab = isBrowserApp ? (url: string) => openBrowserTab(win.id, url) : undefined;

  const pageMenuCommands: PageMenuCommands = {
    canGoBack,
    canGoForward,
    back: handleGoBack,
    forward: handleGoForward,
    reload: handleReload,
    print: () => webviewRef.current?.print(),
    openInNewTab: isBrowserApp ? (url) => openBrowserTab(win.id, url) : undefined,
    openInNewWindow: (url) => launchApp("browser", { forceNew: true, payload: url }),
    searchWeb: (text) => {
      const url = webSearchUrl(text, !compositor);
      if (isBrowserApp) openBrowserTab(win.id, url);
      else launchApp("browser", { payload: url });
    },
  };

  // The page's chords arrive as guest keydowns; the toolbar's as keydowns.
  React.useEffect(() => {
    if (!isFocusedTab) return;
    const onKeyDown = (event: Event) => {
      const e = event as KeyboardEvent;
      if (e.defaultPrevented) return;
      const command = browserShortcut(e);
      if (!command) return;
      if ((command.kind === "back" || command.kind === "forward") && isEditableTarget(e.target)) {
        return;
      }
      if (runCommandRef.current(command)) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener(WEBVIEW_GUEST_KEYDOWN_EVENT, onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener(WEBVIEW_GUEST_KEYDOWN_EVENT, onKeyDown);
    };
  }, [isFocusedTab]);

  React.useEffect(() => {
    const triggerPrint = () => {
      if (!isFocusedTab) return;
      if (!compositor) {
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
      const command = detail.actionId?.startsWith("browser:")
        ? (detail.actionId.slice("browser:".length) as BrowserCommand["kind"])
        : null;
      if (command && MENU_COMMANDS.has(command)) {
        runCommandRef.current({ kind: command } as BrowserCommand);
      }
      if (detail.actionId === "browser:new-tab") openBrowserTab(win.id);
      if (detail.actionId === "browser:new-window") launchApp("browser", { forceNew: true });
      if (detail.actionId === "browser:reopen-tab") reopenClosedBrowserTab(win.id);
      if (detail.actionId === "browser:close-tab" && win.browserWindowId) {
        closeBrowserTab(win.id, win.browserWindowId);
      }
    };
    const offPrintFocused = onShellEvent("piloti:print-focused", onPrintFocused);
    window.addEventListener("piloti:app-action", onAppAction);
    return () => {
      offPrintFocused();
      window.removeEventListener("piloti:app-action", onAppAction);
    };
  }, [isFocusedTab, active, compositor, win.id, win.browserWindowId, openBrowserTab, closeBrowserTab, reopenClosedBrowserTab, launchApp]);
  const installedApps = settings.installedWebApps ?? [];
  const matchedInstalledApp = findMatchingWebApp(currentUrl, installedApps);
  const isInstalled = currentUrl !== "" && Boolean(matchedInstalledApp);

  const titleHandlerRef = React.useRef<(discoveredTitle: string) => void>(
    () => { }
  );
  titleHandlerRef.current = (discoveredTitle: string) => {
    const clean = discoveredTitle.trim();
    if (!clean) return;
    if (isBrowserApp && !isHostnameFallbackTitle(clean, currentUrl)) {
      recordBrowserVisit(currentUrl, clean, false);
    }
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
    if (compositor || !currentUrl || !win.browserWindowId) return;
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
  }, [compositor, currentUrl, win.browserWindowId, prefersDark]);

  React.useEffect(() => {
    if (compositor) return;
    if (initialSrc === "about:blank") {
      setIsLoading(false);
      markReadyRef.current();
    } else {
      setIsLoading(true);
    }
  }, [compositor, initialSrc]);

  // A page that never says it loaded stops spinning after a while.
  React.useEffect(() => {
    if (compositor || !isLoading) return;
    const timeout = setTimeout(() => {
      setIsLoading(false);
      markReadyRef.current();
    }, 15000);
    return () => clearTimeout(timeout);
  }, [compositor, isLoading]);

  const handleIframeLoad = React.useCallback(() => {
    setIsLoading(false);
    markReadyRef.current();
    const pending = expectedLoadsRef.current;
    const expected = pending.count > 0 && Date.now() < pending.until;
    if (expected) pending.count--;
    let frameHref: string | null = null;
    try {
      const href = iframeRef.current?.contentWindow?.location?.href;
      if (href && href !== "about:blank") frameHref = href;
    } catch {
      // Another origin: its address is not readable.
    }
    // A link followed in the page: a new entry the shell did not make.
    if (!expected && loadedOnceRef.current) framePushed(frameId, frameHref);
    loadedOnceRef.current = true;
    if (frameHref) setAddress(frameHref);
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
  }, [currentUrl, prefersDark, frameId]);

  const toggleExtensionPin = (id: string) => {
    const current = settings.pinnedExtensionIds ?? [];
    updateSettings({
      pinnedExtensionIds: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  };

  const extensionMenuItems: BrowserExtensionItem[] = !compositor
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
            {/* The window menu stays with the page (Install Web App is in it). */}
            {tabbed && chrome.menu?.("left")}
            <BrowserHistoryMenu view={webviewEl} direction="back" onOpenInNewTab={historyNewTab}>
              <button
                type="button"
                title={_("Back")}
                aria-label={_("Back")}
                disabled={!canGoBack}
                onClick={handleGoBack}
                className={toolbarButton}
              >
                <SymbolicIcon name="go-previous" fallback={ChevronLeftIcon} className="size-4" />
              </button>
            </BrowserHistoryMenu>
            <BrowserHistoryMenu view={webviewEl} direction="forward" onOpenInNewTab={historyNewTab}>
              <button
                type="button"
                title={_("Forward")}
                aria-label={_("Forward")}
                disabled={!canGoForward}
                onClick={handleGoForward}
                className={toolbarButton}
              >
                <SymbolicIcon name="go-next" fallback={ChevronRightIcon} className="size-4" />
              </button>
            </BrowserHistoryMenu>
            {isLoading ? (
              <button
                type="button"
                data-slot="browser-stop"
                title={_("Stop")}
                aria-label={_("Stop")}
                onClick={handleStop}
                className={toolbarButton}
              >
                <SymbolicIcon name="window-close" fallback={XIcon} className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                data-slot="browser-reload"
                title={_("Reload")}
                aria-label={_("Reload")}
                disabled={!currentUrl || (!compositor && !frameCurrentUrl(frameId))}
                onClick={handleReload}
                className={toolbarButton}
              >
                <SymbolicIcon name="view-refresh" fallback={RotateCwIcon} className="size-4" />
              </button>
            )}
          </HeaderBar.Start>
          <HeaderBar.Title interactive>
            {editingAddress ? (
              <form
                onSubmit={submitAddressEdit}
                data-window-no-drag
                className="relative flex min-w-0 flex-1 items-center justify-center px-2"
              >
                <input
                  ref={(node) => {
                    addressInputRef.current = node;
                    setAddressInput(node);
                  }}
                  type="text"
                  value={draftAddress}
                  onChange={(e) => setDraftAddress(e.target.value)}
                  onBlur={() => setEditingAddress(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingAddress(false);
                    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      if (suggestions.length === 0) return;
                      e.preventDefault();
                      const step = e.key === "ArrowDown" ? 1 : -1;
                      setSuggestIndex((i) =>
                        Math.max(-1, Math.min(suggestions.length - 1, i + step))
                      );
                    }
                  }}
                  role="combobox"
                  aria-expanded={suggestions.length > 0}
                  aria-autocomplete="list"
                  aria-label={_("Address")}
                  placeholder="https://…"
                  className={cn(
                    "h-7 w-full max-w-xl rounded-ui-control border border-ui-accent/70 bg-black/8 px-2.5 text-ui-body font-medium outline-none dark:bg-white/12",
                    !contrastFg && "text-ui-label"
                  )}
                />
                <BrowserAddressSuggestions
                  anchor={addressInput}
                  items={suggestions}
                  selected={suggestIndex}
                  empty={suggestQuery === ""}
                  onPick={goTo}
                  onHover={setSuggestIndex}
                />
              </form>
            ) : (
              <div className="pointer-events-none flex min-w-0 shrink items-center justify-center gap-1.5 px-4">
                {isLoading ? (
                  <Loader2Icon
                    aria-label={_("Loading")}
                    className={cn(
                      "size-3.5 shrink-0 animate-spin opacity-75",
                      !contrastFg && "text-ui-label"
                    )}
                  />
                ) : compositor ? (
                  <BrowserSiteInfo view={webviewEl} security={security} site={siteHost(currentUrl)} />
                ) : security === "secure" ? (
                  <SymbolicIcon
                    name="network-wireless-encrypted"
                    fallback={LockIcon}
                    aria-label={_("Secure Connection")}
                    className="size-3.5 shrink-0 opacity-60"
                  />
                ) : security === "warning" || security === "dangerous" ? (
                  <span
                    title={_("Not Secure")}
                    className={cn(
                      "flex shrink-0 items-center",
                      security === "dangerous" && "text-ui-red"
                    )}
                  >
                    <SymbolicIcon
                      name="dialog-warning"
                      fallback={TriangleAlertIcon}
                      aria-label={_("Not Secure")}
                      className="size-3.5"
                    />
                  </span>
                ) : null}
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
            {Math.abs(zoom - 1) > 0.001 && (
              <button
                type="button"
                data-slot="browser-zoom-reset"
                title={_("Reset Zoom")}
                aria-label={_("Reset Zoom")}
                onClick={() => applyZoom(1)}
                className="mr-0.5 h-6 rounded-ui-control px-1.5 text-ui-small font-medium tabular-nums transition-colors hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
              >
                {formatBrowserZoom(zoom)}
              </button>
            )}
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
            {isBrowserApp && !tabbed && <BrowserNewTabButton windowId={win.id} />}
            {compositor && <BrowserDownloadsMenu />}
            <BrowserExtensionsMenu
              items={extensionMenuItems}
              pinnedIds={settings.pinnedExtensionIds ?? []}
              onTogglePin={toggleExtensionPin}
              onManage={() => launchApp("settings", { payload: "extensions" })}
            />
            {tabbed && chrome.menu?.("right")}
          </HeaderBar.End>
        </HeaderBar>
      </AppChromeProvider>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!compositor ? (
          <iframe
            ref={iframeRef}
            src={initialSrc}
            title={win.title}
            onLoad={handleIframeLoad}
            onError={() => setIsLoading(false)}
            onPointerDownCapture={dismissOpenPopups}
            onFocus={dismissOpenPopups}
            style={{
              ...(darkReaderEnabled
                ? { filter: WEB_DARK_READER_FILTER, colorScheme: "dark" as const }
                : {}),
              // The demo zooms the frame itself: a page of another origin
              // cannot be asked to.
              ...(demoZoom !== 1
                ? {
                  width: `${100 / demoZoom}%`,
                  height: `${100 / demoZoom}%`,
                  transform: `scale(${demoZoom})`,
                  transformOrigin: "0 0",
                }
                : {}),
            }}
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

        {isLoading && compositor && status.loadProgress > 0 && (
          <div
            aria-hidden
            data-slot="browser-load-progress"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5"
          >
            <div
              className="h-full bg-ui-accent transition-[width] duration-200 ease-out"
              style={{ width: `${Math.round(status.loadProgress * 100)}%` }}
            />
          </div>
        )}

        {findOpen && compositor && (
          <BrowserFindBar
            query={findQuery}
            onQueryChange={changeFindQuery}
            matches={status.findMatches}
            activeMatch={status.findActiveMatch}
            focusToken={findToken}
            onStep={stepFind}
            onClose={closeFind}
          />
        )}

        {compositor && status.tooltip && !status.targetUrl && (
          <div
            role="tooltip"
            style={{ left: status.tooltipX + 12, top: status.tooltipY + 20 }}
            className="pointer-events-none absolute z-20 max-w-xs rounded-ui-control px-2 py-1 text-ui-small font-medium text-ui-label shadow-ui-dock-label ui-material-dock-label dark:text-white/95"
          >
            {status.tooltip}
          </div>
        )}

        {compositor && status.targetUrl && (
          <div
            data-slot="browser-link-status"
            className="pointer-events-none absolute bottom-1 left-1 z-20 max-w-[min(32rem,calc(100%-8px))] truncate rounded-ui-control border border-ui-separator bg-ui-window/95 px-2 py-0.5 text-ui-caption text-ui-label-secondary shadow-sm backdrop-blur-md"
          >
            {status.targetUrl}
          </div>
        )}

        {compositor && activeExtPopup && (
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

        {demoPopupOpen && !compositor && settings.demoExtensionEnabled !== false && (
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

        {permissionRequest && compositor && (
          <PermissionBubble request={permissionRequest} onDone={() => setPermissionRequest(null)} />
        )}

        {pageDialog && compositor && (
          <PageDialog dialog={pageDialog} onDone={() => setPageDialog(null)} />
        )}

        {pageMenu && compositor && (
          <BrowserPageMenu event={pageMenu} commands={pageMenuCommands} onClose={closePageMenu} />
        )}

        {fileChooser && (
          <BrowserFileChooser event={fileChooser} onDone={() => setFileChooser(null)} />
        )}

        {(pageFailure || status.renderProcessGone) && compositor && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ui-window p-6 text-center text-ui-label">
            <SymbolicIcon
              name={status.renderProcessGone ? "dialog-error" : "web-browser"}
              fallback={GlobeIcon}
              className="size-7 text-ui-label-secondary"
            />
            <div className="text-ui-body font-semibold">
              {status.renderProcessGone
                ? status.renderProcessGone === "oom"
                  ? _("This page ran out of memory")
                  : _("This page crashed")
                : _("Unable to load page")}
            </div>
            {!status.renderProcessGone && (
              <div className="text-ui-small text-ui-label-secondary">
                {pageFailureError || pageFailure}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => webviewRef.current?.reload()}
              >
                {_("Reload")}
              </Button>
              {pageFailureCanProceed && !status.renderProcessGone && (
                <Button
                  size="sm"
                  onClick={() => webviewRef.current?.proceedPastWarning()}
                >
                  {_("Proceed Anyway")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
