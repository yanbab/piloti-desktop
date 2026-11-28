/// <reference types="@domicile-desktop/react/elements" />
import { hostFiles } from "@/lib/engine/host-files";
import { looksLikeUrl, webSearchUrl } from "@/lib/core/web-search";
import * as React from "react";
import { onShellEvent } from "@/lib/core/shell-events";
import { usePiloti } from "@/lib/engine/piloti";
import { useWatch } from "@domicile-desktop/react/use-watch";
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
import {
  ChevronLeftIcon,
  DownloadIcon,
  ChevronDownIcon,
  FolderIcon,
  GlobeIcon,
  TerminalIcon,
  StarIcon,
  Loader2Icon,
  PlusIcon,
  PuzzleIcon,
} from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import { WindowMenuButton } from "@/components/common/WindowMenuButton";
import {
  BrowserExtensionsMenu,
  type BrowserExtensionItem,
} from "@/shell/windows/BrowserExtensionsMenu";
import { _ } from "@/lib/core/i18n";
import {
  AppChromeProvider,
  useAppChrome,
  type AppChrome,
} from "@/components/elements/app-chrome";
import { HeaderBar } from "@/components/elements/header-bar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWindowContext } from "@/components/ui/window";
import {
  normalizeWebUrl,
  useSystemBackends,
  useWindowManager,
  type DesktopWindowInstance,
  useDesktopSettings,
  useSettingsSelector,
  useUpdateSettings,
} from "@/context/DesktopStateContext";
import {
  isBookmarked,
  toggleBrowserBookmark,
  useBrowserBookmarks,
} from "@/shell/windows/browser-bookmarks";
import {
  fetchWebPageMetadata,
  findMatchingWebApp,
  getCachedWebThemeColor,
  getContrastForeground,
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
import { useCapabilities } from "@/hooks/use-capabilities";
import { dismissOpenPopups } from "@/shell/windows/dismiss-popups";

// One array while there is nothing, so memos and effects keep still.
const NO_EXTENSIONS: NonNullable<ReturnType<typeof usePiloti>["extensions"]["list"]> = [];

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
  const bookmarks = useBrowserBookmarks();
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
        ? webSearchUrl(draftAddress, !compositor)
        : null;
    if (normalized) {
      setAddress(normalized);
      if (!compositor) {
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

  const canGoBack = !compositor ? historyState.index > 0 : nativeCanGoBack;
  const handleGoBack = React.useCallback(() => {
    if (!compositor) {
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
  }, [compositor]);

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

  const iframeSrc = normalizeWebUrl(address) ?? "about:blank";

  React.useEffect(() => {
    if (compositor) return;
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
  }, [compositor, iframeSrc]);

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
        {!compositor ? (
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

        {pageFailure && compositor && (
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
