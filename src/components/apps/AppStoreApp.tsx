import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Code2Icon,
  FlaskConicalIcon,
  Gamepad2Icon,
  GlobeIcon,
  MusicIcon,
  PackageIcon,
  PaletteIcon,
  SearchIcon,
  SparklesIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { AdwSplitView, type AdwSplitSidebarItem } from "@/components/ui/adw-split-view";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  WindowControlButton,
  WindowControls,
  WindowTitlebar,
} from "@/components/ui/window";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/vfs-state";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import {
  ensureFlathubRemote,
  type FlatpakAppEntry,
  type FlatpakCapabilities,
  getPopularFlathubApps,
  installFlatpakApp,
  listInstalledFlatpaks,
  probeFlatpakCapabilities,
  searchFlatpaks,
  uninstallFlatpakApp,
} from "@/lib/engine-desktop/flatpak";
import { APP_CATALOG, type AppDefinition } from "@/data/catalog";
import {
  canonicalizeWebUrl,
  DEFAULT_BROWSER_WEB_APPS,
  fetchWebPageMetadata,
  getCachedWebDescription,
  getWebAppFaviconUrl,
  type InstalledWebApp,
} from "@/data/web-apps";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  installWebAppDesktopEntry,
  removeWebAppDesktopEntry,
} from "@/lib/xdg/xdg-web-apps";

interface AppStoreAppProps {
  isCsd?: boolean;
  windowId?: string;
}

type StoreCategory =
  | "all"
  | "installed"
  | "Games"
  | "Graphics"
  | "Development"
  | "Productivity"
  | "Audio & Media"
  | "Science & Math"
  | "Utilities";

interface StoreItem {
  id: string;
  kind: "app" | "web" | "flatpak";
  title: string;
  subtitle: string;
  category: Exclude<StoreCategory, "all" | "installed">;
  installed: boolean;
  removable: boolean;
  appDef?: AppDefinition;
  webApp?: InstalledWebApp;
  flatpak?: FlatpakAppEntry;
  faviconUrl?: string;
}

interface StoreMetaState {
  fakeInstalledAppIds: string[];
  fakeRemovedAppIds: string[];
}

const STORE_META_STORAGE_KEY = "residence:app-store-state:v1";

const CORE_BUILTIN_IDS = new Set([
  "nautilus",
  "settings",
  "console",
  "text-editor",
  "terminal",
  "app-store",
]);

function loadStoreMeta(): StoreMetaState {
  try {
    const parsed = readVfsStateJson<Partial<StoreMetaState>>(
      VFS_STATE_PATHS.appStoreMeta,
      STORE_META_STORAGE_KEY,
    );
    if (parsed && typeof parsed === "object") {
      return {
        fakeInstalledAppIds: Array.isArray(parsed.fakeInstalledAppIds)
          ? parsed.fakeInstalledAppIds
          : [],
        fakeRemovedAppIds: Array.isArray(parsed.fakeRemovedAppIds)
          ? parsed.fakeRemovedAppIds
          : [],
      };
    }
  } catch {
    // ignore storage errors
  }
  return { fakeInstalledAppIds: [], fakeRemovedAppIds: [] };
}

function saveStoreMeta(meta: StoreMetaState) {
  try {
    writeVfsStateJson(VFS_STATE_PATHS.appStoreMeta, meta);
  } catch {
    // ignore storage errors
  }
}

function classifyWebAppCategory(
  app: InstalledWebApp,
): Exclude<StoreCategory, "all" | "installed"> {
  const hay = `${app.title} ${app.keywords ?? ""}`.toLowerCase();
  if (
    /whiteboard|drawing|paint|photo|svg|3d|sculpt|sketch|diagram|image|vector/.test(
      hay,
    )
  ) {
    return "Graphics";
  }
  if (
    /developer|code|json|sql|css|regex|crypto|encode|docs|game engine/.test(hay)
  ) {
    return "Development";
  }
  if (/audio|music|sound|radio|midi|video|stream|webrtc/.test(hay)) {
    return "Audio & Media";
  }
  if (/math|graph|geometry|calculator|weather|astronomy|globe/.test(hay)) {
    return "Science & Math";
  }
  if (/markdown|notes|pomodoro|clock|meeting/.test(hay)) {
    return "Productivity";
  }
  return "Utilities";
}

function classifyCatalogCategory(
  cat: string,
): Exclude<StoreCategory, "all" | "installed"> {
  if (cat === "Graphics") return "Graphics";
  if (cat === "Development") return "Development";
  if (cat === "Office" || cat === "Internet") return "Productivity";
  if (cat === "AudioVideo" || cat === "Media") return "Audio & Media";
  return "Utilities";
}

const SIDEBAR_ITEMS: Array<{
  id: StoreCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "all", label: "Explore", icon: <SparklesIcon className="size-4" /> },
  {
    id: "installed",
    label: "Installed",
    icon: <CheckCircle2Icon className="size-4" />,
  },
];

function classifyFlatpakCategory(
  mainCategories?: string[],
): Exclude<StoreCategory, "all" | "installed"> {
  const cats = (mainCategories ?? []).map((c) => c.toLowerCase());
  if (cats.includes("game")) return "Games";
  if (cats.includes("graphics")) return "Graphics";
  if (cats.includes("development")) return "Development";
  if (cats.includes("office")) return "Productivity";
  if (cats.includes("audiovideo")) return "Audio & Media";
  if (cats.includes("science") || cats.includes("education")) {
    return "Science & Math";
  }
  return "Utilities";
}

const CATEGORY_ITEMS: Array<{
  id: Exclude<StoreCategory, "all" | "installed">;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "Games", label: "Games", icon: <Gamepad2Icon className="size-4" /> },
  {
    id: "Graphics",
    label: "Graphics & Design",
    icon: <PaletteIcon className="size-4" />,
  },
  {
    id: "Development",
    label: "Developer Tools",
    icon: <Code2Icon className="size-4" />,
  },
  {
    id: "Productivity",
    label: "Productivity",
    icon: <BriefcaseIcon className="size-4" />,
  },
  {
    id: "Audio & Media",
    label: "Audio & Media",
    icon: <MusicIcon className="size-4" />,
  },
  {
    id: "Science & Math",
    label: "Science & Math",
    icon: <FlaskConicalIcon className="size-4" />,
  },
  {
    id: "Utilities",
    label: "Utilities",
    icon: <WrenchIcon className="size-4" />,
  },
];

const WebAppFavicon: React.FC<{
  url?: string;
  title: string;
  className?: string;
}> = ({ url, title, className = "size-11" }) => {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) {
    return (
      <GlobeIcon
        aria-label={title}
        className={cn(
          "shrink-0 text-sky-400",
          className,
        )}
      />
    );
  }

  return (
    <img
      src={url}
      alt={title}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 object-contain",
        className,
      )}
      draggable={false}
    />
  );
};

export const AppStoreApp: React.FC<AppStoreAppProps> = ({
  isCsd = false,
  windowId,
}) => {
  const domicile = useDomicile();
  const { getAppIconUrl, refreshXdgApps } = useApps();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const { launchApp, openWebUrl } = useWindowActions();

  const [flatpakCaps, setFlatpakCaps] = React.useState<FlatpakCapabilities>({
    available: false,
    hasFlathub: false,
  });
  const [installedFlatpaks, setInstalledFlatpaks] = React.useState<
    FlatpakAppEntry[]
  >([]);
  const [flathubEntries, setFlathubEntries] = React.useState<FlatpakAppEntry[]>(
    () => getPopularFlathubApps(),
  );
  const [featuredSlide, setFeaturedSlide] = React.useState(0);

  const [category, setCategory] = React.useState<StoreCategory>("all");
  const [query, setQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const mainRef = React.useRef<HTMLElement | null>(null);
  const {
    highlightedId: highlightedCategory,
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: [...SIDEBAR_ITEMS, ...CATEGORY_ITEMS].map((e) => e.id),
    activeId: category,
    onActivate: (id) => setCategory(id),
    sidebarRef,
    contentRef: mainRef,
  });
  const sidebarItems: AdwSplitSidebarItem[] = [
    ...SIDEBAR_ITEMS,
    ...CATEGORY_ITEMS,
  ].map((entry, idx) => ({
    id: entry.id,
    label: _(entry.label),
    icon: entry.icon,
    selected: highlightedCategory === entry.id,
    onClick: () => setCategory(entry.id),
    separatorAfter: idx === SIDEBAR_ITEMS.length - 1,
  }));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<StoreMetaState>(loadStoreMeta);
  const [pendingOp, setPendingOp] = React.useState<{
    id: string;
    kind: "installing" | "removing";
    progress: number;
  } | null>(null);
  const opRafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (opRafRef.current !== null) {
        cancelAnimationFrame(opRafRef.current);
      }
    };
  }, []);

  const updateMeta = React.useCallback(
    (updater: (prev: StoreMetaState) => StoreMetaState) => {
      setMeta((prev) => {
        const next = updater(prev);
        saveStoreMeta(next);
        return next;
      });
    },
    [],
  );

  const installedWebUrls = React.useMemo(() => {
    const set = new Set<string>();
    for (const app of settings.installedWebApps) {
      set.add(canonicalizeWebUrl(app.url) ?? app.url);
    }
    return set;
  }, [settings.installedWebApps]);

  const [descriptionTick, setDescriptionTick] = React.useState(0);
  const [customWebUrl, setCustomWebUrl] = React.useState("");

  const handleAddCustomWebApp = (e: React.FormEvent) => {
    e.preventDefault();
    const canonical = canonicalizeWebUrl(customWebUrl);
    if (!canonical) return;
    const hostTitle = new URL(canonical).hostname.replace(/^www\./, "");
    if (!installedWebUrls.has(canonical)) {
      const initialApp: InstalledWebApp = {
        id: `web:${canonical}`,
        title: hostTitle,
        url: canonical,
        iconUrl: getWebAppFaviconUrl(canonical),
        category: "Internet",
      };
      void installWebAppDesktopEntry(domicile, isBrowserRuntime, initialApp);
      void fetchWebPageMetadata(canonical).then(({ title, iconUrl, startUrl }) => {
        if (title || iconUrl || startUrl) {
          void installWebAppDesktopEntry(domicile, isBrowserRuntime, {
            ...initialApp,
            ...(title ? { title } : {}),
            ...(iconUrl ? { iconUrl } : {}),
            ...(startUrl ? { url: startUrl } : {}),
          });
        }
        setDescriptionTick((n) => n + 1);
      });
    }
    setCustomWebUrl("");
    openWebUrl(canonical);
  };

  React.useEffect(() => {
    const missing = DEFAULT_BROWSER_WEB_APPS.filter(
      (app) => getCachedWebDescription(app.url) === undefined
    );
    if (missing.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;
    Promise.allSettled(
      missing.map(async (app) => {
        const res = await fetchWebPageMetadata(app.url, controller.signal);
        if (!cancelled && res.description) {
          setDescriptionTick((n) => n + 1);
        }
      })
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const installedFlatpakIds = React.useMemo(
    () => new Set(installedFlatpaks.map((f) => f.appId)),
    [installedFlatpaks],
  );

  const refreshFlatpakList = React.useCallback(async () => {
    if (isBrowserRuntime) return;
    const [caps, list] = await Promise.all([
      probeFlatpakCapabilities(domicile),
      listInstalledFlatpaks(domicile),
    ]);
    setFlatpakCaps(caps);
    setInstalledFlatpaks(list);
  }, [domicile, isBrowserRuntime]);

  React.useEffect(() => {
    void refreshFlatpakList();
  }, [refreshFlatpakList]);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setFlathubEntries(getPopularFlathubApps(installedFlatpakIds));
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchFlatpaks(
        domicile,
        q,
        installedFlatpakIds,
        controller.signal,
      ).then((entries) => {
        if (!controller.signal.aborted) {
          setFlathubEntries(entries);
        }
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [domicile, installedFlatpakIds, query]);

  const flatpakItems = React.useMemo<StoreItem[]>(() => {
    const popularById = new Map(
      getPopularFlathubApps().map((entry) => [entry.appId, entry]),
    );
    const byId = new Map<string, FlatpakAppEntry>();
    for (const entry of installedFlatpaks) {
      const popular = popularById.get(entry.appId);
      byId.set(entry.appId, {
        ...popular,
        ...entry,
        description: entry.description || popular?.description,
        iconUrl: entry.iconUrl || popular?.iconUrl,
        mainCategories: entry.mainCategories ?? popular?.mainCategories,
        installed: true,
      });
    }
    for (const entry of flathubEntries) {
      const existing = byId.get(entry.appId);
      byId.set(
        entry.appId,
        existing
          ? {
              ...entry,
              ...existing,
              description: existing.description || entry.description,
              iconUrl: existing.iconUrl || entry.iconUrl,
              mainCategories: existing.mainCategories ?? entry.mainCategories,
              installed: true,
            }
          : { ...entry, installed: installedFlatpakIds.has(entry.appId) },
      );
    }
    return Array.from(byId.values()).map((fp) => ({
      id: `flatpak:${fp.appId}`,
      kind: "flatpak",
      title: fp.name,
      subtitle: fp.description || fp.appId,
      category: classifyFlatpakCategory(fp.mainCategories),
      installed: fp.installed,
      removable: fp.installed,
      flatpak: fp,
      faviconUrl: fp.iconUrl || getAppIconUrl(fp.appId),
    }));
  }, [flathubEntries, getAppIconUrl, installedFlatpakIds, installedFlatpaks]);

  const items = React.useMemo<StoreItem[]>(() => {
    void descriptionTick;
    const fakeInstalledSet = new Set(meta.fakeInstalledAppIds);
    const fakeRemovedSet = new Set(meta.fakeRemovedAppIds);

    const webItems: StoreItem[] = DEFAULT_BROWSER_WEB_APPS.map((webApp) => {
      const canonical = canonicalizeWebUrl(webApp.url) ?? webApp.url;
      const installed = installedWebUrls.has(canonical);
      const cachedDesc = getCachedWebDescription(webApp.url);
      return {
        id: webApp.id,
        kind: "web",
        title: webApp.title,
        subtitle:
          cachedDesc || new URL(webApp.url).hostname.replace(/^www\./, ""),
        category:
          (webApp.category as StoreItem["category"]) ??
          classifyWebAppCategory(webApp),
        installed,
        removable: true,
        webApp,
        faviconUrl: getWebAppFaviconUrl(webApp.url),
      };
    });

    const appItems: StoreItem[] = APP_CATALOG.filter(
      (app) => app.id !== "app-store",
    ).map((app) => {
      const isCore = CORE_BUILTIN_IDS.has(app.id);
      const installed = isCore
        ? !fakeRemovedSet.has(app.id)
        : fakeInstalledSet.has(app.id);
      return {
        id: `app:${app.id}`,
        kind: "app",
        title: _(app.name),
        subtitle: _(app.description),
        category: classifyCatalogCategory(app.category),
        installed,
        removable: !isCore,
        appDef: app,
      };
    });

    return [...appItems, ...webItems, ...flatpakItems];
  }, [installedWebUrls, meta, descriptionTick, flatpakItems]);

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category === "installed" && !item.installed) return false;
      if (
        category !== "all" &&
        category !== "installed" &&
        item.category !== category
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.webApp?.keywords?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, category, query]);

  const webAndAppItems = React.useMemo(
    () => filteredItems.filter((item) => item.kind !== "flatpak"),
    [filteredItems],
  );

  const flatpakStoreItems = React.useMemo(
    () => filteredItems.filter((item) => item.kind === "flatpak"),
    [filteredItems],
  );

  const featuredItems = React.useMemo(() => {
    const withIcons = flatpakItems.filter((item) => item.faviconUrl);
    return (withIcons.length > 0 ? withIcons : flatpakItems).slice(0, 6);
  }, [flatpakItems]);

  const activeSlideIndex =
    featuredItems.length > 0 ? featuredSlide % featuredItems.length : 0;
  const activeFeaturedItem = featuredItems[activeSlideIndex] ?? null;

  const selectedItem = React.useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const runFakeProgress = React.useCallback(
    (id: string, kind: "installing" | "removing", onComplete: () => void) => {
      if (pendingOp) return;
      const duration = 500 + Math.random() * 500;
      const start = performance.now();
      setPendingOp({ id, kind, progress: 5 });

      const step = (now: number) => {
        const elapsed = now - start;
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));
        if (elapsed < duration) {
          setPendingOp({ id, kind, progress: Math.max(5, pct) });
          opRafRef.current = requestAnimationFrame(step);
        } else {
          opRafRef.current = null;
          setPendingOp(null);
          onComplete();
        }
      };

      opRafRef.current = requestAnimationFrame(step);
    },
    [pendingOp],
  );

  const commitInstall = React.useCallback(
    (item: StoreItem) => {
      if (item.kind === "web" && item.webApp) {
        const targetCanonical =
          canonicalizeWebUrl(item.webApp.url) ?? item.webApp.url;
        if (
          !settings.installedWebApps.some(
            (w) => (canonicalizeWebUrl(w.url) ?? w.url) === targetCanonical,
          )
        ) {
          void installWebAppDesktopEntry(
            domicile,
            isBrowserRuntime,
            item.webApp,
          );
        }
        return;
      }
      if (item.kind === "app" && item.appDef) {
        const appId = item.appDef.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.includes(appId)
            ? prev.fakeInstalledAppIds
            : [...prev.fakeInstalledAppIds, appId],
          fakeRemovedAppIds: prev.fakeRemovedAppIds.filter((id) => id !== appId),
        }));
      }
    },
    [domicile, isBrowserRuntime, settings.installedWebApps, updateMeta],
  );

  const commitUninstall = React.useCallback(
    (item: StoreItem) => {
      if (!item.removable) return;
      if (item.kind === "web" && item.webApp) {
        void removeWebAppDesktopEntry(
          domicile,
          isBrowserRuntime,
          item.webApp,
        );
        if (settings.pinnedAppIds.includes(item.webApp.id)) {
          updateSettings({
            pinnedAppIds: settings.pinnedAppIds.filter(
              (id) => id !== item.webApp?.id,
            ),
          });
        }
        return;
      }
      if (item.kind === "app" && item.appDef) {
        const appId = item.appDef.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.filter(
            (id) => id !== appId,
          ),
          fakeRemovedAppIds: prev.fakeRemovedAppIds.includes(appId)
            ? prev.fakeRemovedAppIds
            : [...prev.fakeRemovedAppIds, appId],
        }));
      }
    },
    [
      domicile,
      isBrowserRuntime,
      settings.pinnedAppIds,
      updateMeta,
      updateSettings,
    ],
  );

  const handleInstall = React.useCallback(
    (item: StoreItem) => {
      if (item.kind === "flatpak" && item.flatpak) {
        const fp = item.flatpak;
        if (isBrowserRuntime) {
          pushNotification({
            appName: "Applications",
            summary: `Flatpak: ${fp.name}`,
            body: `Run on Domicile Linux: flatpak install --user flathub ${fp.appId}`,
          });
          return;
        }
        if (pendingOp) return;
        setPendingOp({ id: item.id, kind: "installing", progress: 8 });
        void (async () => {
          if (!flatpakCaps.hasFlathub) {
            await ensureFlathubRemote(domicile);
          }
          const res = await installFlatpakApp(
            domicile,
            fp.appId,
            fp.origin || "flathub",
            (pct) => setPendingOp({ id: item.id, kind: "installing", progress: pct }),
          );
          setPendingOp(null);
          if (res.ok) {
            await refreshFlatpakList();
            await refreshXdgApps();
            pushNotification({
              appName: "Applications",
              summary: `Installed ${fp.name}`,
              body: fp.appId,
            });
          } else {
            pushNotification({
              appName: "Applications",
              summary: `Failed to install ${fp.name}`,
              body: res.error || "Flatpak install failed",
              urgency: "critical",
            });
          }
        })();
        return;
      }
      runFakeProgress(item.id, "installing", () => commitInstall(item));
    },
    [
      commitInstall,
      domicile,
      flatpakCaps.hasFlathub,
      isBrowserRuntime,
      pendingOp,
      pushNotification,
      refreshFlatpakList,
      refreshXdgApps,
      runFakeProgress,
    ],
  );

  const handleUninstall = React.useCallback(
    (item: StoreItem) => {
      if (!item.removable) return;
      if (item.kind === "flatpak" && item.flatpak) {
        if (isBrowserRuntime || pendingOp) return;
        const fp = item.flatpak;
        setPendingOp({ id: item.id, kind: "removing", progress: 25 });
        void (async () => {
          const res = await uninstallFlatpakApp(domicile, fp.appId);
          setPendingOp(null);
          if (res.ok) {
            await refreshFlatpakList();
            await refreshXdgApps();
            pushNotification({
              appName: "Applications",
              summary: `Uninstalled ${fp.name}`,
              body: fp.appId,
            });
          } else {
            pushNotification({
              appName: "Applications",
              summary: `Failed to uninstall ${fp.name}`,
              body: res.error || "Flatpak uninstall failed",
              urgency: "critical",
            });
          }
        })();
        return;
      }
      runFakeProgress(item.id, "removing", () => commitUninstall(item));
    },
    [
      commitUninstall,
      domicile,
      isBrowserRuntime,
      pendingOp,
      pushNotification,
      refreshFlatpakList,
      refreshXdgApps,
      runFakeProgress,
    ],
  );

  const handleOpen = React.useCallback(
    (item: StoreItem) => {
      if (item.kind === "web" && item.webApp) {
        openWebUrl(item.webApp.url, { title: item.webApp.title });
        return;
      }
      if (item.kind === "flatpak" && item.flatpak) {
        launchApp(item.flatpak.appId);
        return;
      }
      if (item.kind === "app" && item.appDef) {
        launchApp(item.appDef.id);
      }
    },
    [launchApp, openWebUrl],
  );

  return (
    <AdwSplitView
      title={_("Applications")}
      appId="app-store"
      windowId={windowId}
      isCsd={isCsd}
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-44"
      compactBreakpoint={580}
      sidebarRef={sidebarRef}
      onSidebarKeyDown={onSidebarKeyDown}
      onSidebarKeyUp={onSidebarKeyUp}
      onKeyDown={(e) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key.length === 1 &&
          /^[a-z0-9._-]$/i.test(e.key)
        ) {
          e.preventDefault();
          setQuery((prev) => prev + e.key);
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }
      }}
      header={({ isCompact, contentScrolled }) => (
        <WindowTitlebar
          data-window-drag-region={isCsd ? "" : undefined}
          className={cn(
            "bg-adw-titlebar transition-colors",
            !isCompact && "rounded-tl-none",
            !isCsd && "rounded-t-none",
            contentScrolled
              ? "border-b border-adw-separator"
              : "border-b border-transparent",
          )}
        >
          <div className="flex items-center gap-2" data-window-no-drag>
            {!isCsd && (
              <WindowMenuButton windowId={windowId} appId="app-store" />
            )}
          </div>

          <span className="pointer-events-none truncate text-[13px] font-semibold">
            {_(
              [...SIDEBAR_ITEMS, ...CATEGORY_ITEMS].find((i) => i.id === category)
                ?.label ?? "Explore"
            )}
          </span>

          <div className="flex items-center gap-1.5" data-window-no-drag>
            <div className="relative flex items-center">
              <SearchIcon className="pointer-events-none absolute left-2 size-3.5 text-adw-label-secondary" />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                placeholder={_("Search")}
                aria-label={_("Search")}
                className="h-7 w-40 rounded-md border border-adw-separator bg-black/5 pr-6 pl-7 text-[12px] text-adw-label placeholder:text-adw-label-secondary focus:border-adw-accent focus:outline-none dark:bg-white/8 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <WindowControlButton
                  aria-label={_("Clear search")}
                  onClick={() => {
                    setQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-1 size-4.5 [&_svg]:size-2.5"
                >
                  <XIcon strokeWidth={2.25} />
                </WindowControlButton>
              )}
            </div>
            {isCsd && windowId && <WindowControls side="right" />}
          </div>
        </WindowTitlebar>
      )}
      footer={
        selectedItem ? (
          <div className="flex h-[46px] shrink-0 items-center justify-between gap-4 border-t border-adw-separator bg-adw-titlebar px-4">
            <div className="flex min-w-0 items-center gap-3">
              {selectedItem.kind === "app" && selectedItem.appDef ? (
                <AppSquircleIcon
                  iconUrl={getAppIconUrl(selectedItem.appDef.id)}
                  iconName={selectedItem.appDef.iconName}
                  gradient={selectedItem.appDef.gradient}
                  className="size-9"
                />
              ) : (
                <WebAppFavicon
                  url={selectedItem.faviconUrl}
                  title={selectedItem.title}
                  className="size-9"
                />
              )}
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">
                  {selectedItem.title}
                </div>
                <div className="truncate text-[12px] text-adw-label-secondary">
                  {selectedItem.subtitle}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {pendingOp?.id === selectedItem.id ? (
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] font-medium text-adw-label-secondary">
                    {pendingOp.kind === "removing"
                      ? _("Removing…")
                      : _("Installing…")}
                  </span>
                  <div
                    role="progressbar"
                    aria-valuenow={pendingOp.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 w-36 overflow-hidden rounded-full bg-black/10 dark:bg-white/12"
                  >
                    <div
                      style={{ width: `${pendingOp.progress}%` }}
                      className={cn(
                        "h-full rounded-full transition-[width] duration-75",
                        pendingOp.kind === "removing"
                          ? "bg-adw-red"
                          : "bg-adw-accent",
                      )}
                    />
                  </div>
                </div>
              ) : !selectedItem.installed ? (
                <Button
                  type="button"
                  size="lg"
                  className="px-5"
                  disabled={pendingOp !== null}
                  onClick={() => handleInstall(selectedItem)}
                >
                  {_("Install")}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    className="px-5"
                    onClick={() => handleOpen(selectedItem)}
                  >
                    {_("Open")}
                  </Button>
                  {selectedItem.removable && (
                    <Button
                      type="button"
                      size="lg"
                      variant="destructive"
                      className="px-5"
                      disabled={pendingOp !== null}
                      onClick={() => handleUninstall(selectedItem)}
                    >
                      {_("Uninstall")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {({ onContentScroll }) => (
        <main
          ref={mainRef}
          onKeyDown={onContentKeyDown}
          onScroll={onContentScroll}
          className="flex-1 overflow-y-auto p-4"
          onClick={() => setSelectedId(null)}
        >
            {category === "all" && !query.trim() && activeFeaturedItem && (
              <section
                aria-label="Featured applications"
                onClick={(e) => e.stopPropagation()}
                className="relative mb-5 overflow-hidden rounded-2xl border border-adw-separator bg-black/5 px-5 py-8 dark:bg-white/5"
              >
                {activeFeaturedItem.faviconUrl && (
                  <>
                    <img
                      src={activeFeaturedItem.faviconUrl}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none absolute inset-0 size-full scale-[2.2] object-cover opacity-85 blur-[64px] saturate-[2.4] contrast-110 select-none dark:opacity-75"
                    />
                    <img
                      src={activeFeaturedItem.faviconUrl}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none absolute -top-1/2 -left-1/4 size-[960px] object-contain opacity-65 blur-[72px] saturate-[2.6] select-none dark:opacity-55"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/15 to-white/25 dark:from-black/25 dark:via-black/15 dark:to-black/35"
                    />
                  </>
                )}
                <div className="relative z-10 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Previous featured app"
                    onClick={() =>
                      setFeaturedSlide(
                        (prev) =>
                          (prev - 1 + featuredItems.length) %
                          featuredItems.length,
                      )
                    }
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-adw-label-secondary transition-colors hover:bg-black/10 hover:text-adw-label dark:bg-white/8 dark:hover:bg-white/15"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(activeFeaturedItem.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSelectedId(activeFeaturedItem.id);
                      }
                    }}
                    className="flex min-w-0 flex-1 cursor-default flex-col items-center justify-center gap-2.5 text-center outline-none"
                  >
                    <WebAppFavicon
                      url={activeFeaturedItem.faviconUrl}
                      title={activeFeaturedItem.title}
                      className="size-16 shrink-0"
                    />
                    <div className="min-w-0 max-w-md">
                      <div className="truncate text-base font-bold text-adw-label">
                        {activeFeaturedItem.title}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] text-adw-label-secondary">
                        {activeFeaturedItem.subtitle}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Next featured app"
                    onClick={() =>
                      setFeaturedSlide(
                        (prev) => (prev + 1) % featuredItems.length,
                      )
                    }
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-adw-label-secondary transition-colors hover:bg-black/10 hover:text-adw-label dark:bg-white/8 dark:hover:bg-white/15"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>

                {featuredItems.length > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    {featuredItems.map((feat, idx) => (
                      <button
                        key={feat.id}
                        type="button"
                        aria-label={`Show ${feat.title}`}
                        onClick={() => setFeaturedSlide(idx)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          idx === activeSlideIndex
                            ? "w-4 bg-adw-accent"
                            : "w-1.5 bg-black/20 hover:bg-black/35 dark:bg-white/25 dark:hover:bg-white/45",
                        )}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {filteredItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-adw-label-secondary">
                <PackageIcon className="size-10 opacity-40" />
                <p className="text-sm font-medium">{_("No applications found")}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {[
                  { id: "web", title: _("Web Apps"), list: webAndAppItems },
                  { id: "flatpak", title: _("Flatpaks"), list: flatpakStoreItems },
                ]
                  .filter((group) => group.list.length > 0)
                  .map((group) => (
                    <section key={group.id} className="space-y-2.5">
                      <h2 className="px-0.5 text-[12px] font-semibold tracking-wider text-adw-label-tertiary uppercase">
                        {group.title}
                      </h2>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {group.list.map((item) => {
                          const isSelected = selectedId === item.id;
                          return (
                            <ContextMenu key={item.id}>
                              <ContextMenuTrigger>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(item.id);
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (item.installed) {
                                      handleOpen(item);
                                    } else {
                                      handleInstall(item);
                                    }
                                  }}
                                  onContextMenu={() => setSelectedId(item.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      setSelectedId(item.id);
                                    }
                                  }}
                                  className={cn(
                                    "relative flex cursor-default items-center gap-3 overflow-hidden rounded-xl p-3 transition-colors outline-none",
                                    isSelected
                                      ? "bg-adw-accent/15 ring-1 ring-adw-accent/60"
                                      : "bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
                                  )}
                                >
                                  {item.kind === "app" && item.appDef ? (
                                    <AppSquircleIcon
                                      iconUrl={getAppIconUrl(item.appDef.id)}
                                      iconName={item.appDef.iconName}
                                      gradient={item.appDef.gradient}
                                      className="size-11"
                                    />
                                  ) : (
                                    <WebAppFavicon
                                      url={item.faviconUrl}
                                      title={item.title}
                                    />
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-semibold">
                                      {item.title}
                                    </div>
                                    <p className="truncate text-[11.5px] text-adw-label-secondary">
                                      {item.subtitle}
                                    </p>
                                  </div>

                                  {pendingOp?.id === item.id && (
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10 dark:bg-white/10">
                                      <div
                                        style={{ width: `${pendingOp.progress}%` }}
                                        className={cn(
                                          "h-full transition-[width] duration-75",
                                          pendingOp.kind === "removing"
                                            ? "bg-adw-red"
                                            : "bg-adw-accent",
                                        )}
                                      />
                                    </div>
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-40">
                                {!item.installed ? (
                                  <ContextMenuItem onClick={() => handleInstall(item)}>
                                    {_("Install")}
                                  </ContextMenuItem>
                                ) : (
                                  <>
                                    <ContextMenuItem onClick={() => handleOpen(item)}>
                                      {_("Open")}
                                    </ContextMenuItem>
                                    {item.removable && (
                                      <ContextMenuItem
                                        variant="destructive"
                                        onClick={() => handleUninstall(item)}
                                      >
                                        {_("Uninstall")}
                                      </ContextMenuItem>
                                    )}
                                  </>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })}
                      </div>
                    </section>
                  ))}
              </div>
            )}
          </main>
        )}
      </AdwSplitView>
    );
  };
