import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ArrowUpCircleIcon,
  BriefcaseIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Code2Icon,
  FlaskConicalIcon,
  Gamepad2Icon,
  GlobeIcon,
  HeartIcon,
  LayersIcon,
  MusicIcon,
  PackageIcon,
  PaletteIcon,
  ArrowDownUpIcon,
  LayoutGridIcon,
  ListIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { AdwSplitView, type AdwSplitSidebarItem } from "@/components/ui/adw-split-view";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  WindowControlButton,
  WindowControls,
  WindowTitlebar,
} from "@/components/ui/window";
import { Switch } from "@/components/ui/switch";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";
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
  type AptUpdatePackage,
  ensureFlathubRemote,
  type FlatpakAppEntry,
  type FlatpakCapabilities,
  type FlatpakUpdateEntry,
  getPopularFlathubApps,
  installFlatpakApp,
  listAptUpdates,
  listFlatpakUpdates,
  listInstalledFlatpaks,
  probeFlatpakCapabilities,
  runAptUpdateAndFlatpakRefresh,
  runAptUpgrade,
  searchFlatpaks,
  uninstallFlatpakApp,
  updateAllFlatpaks,
  updateFlatpakApp,
} from "@/lib/engine-native/flatpak";
import {
  COLLECTION_APPS,
  COLLECTION_APP_IDS_BY_COLLECTION,
  type CollectionId,
} from "@/data/app-store-collections";
import {
  setXdgAppBadgeCount,
  setXdgAppProgress,
  setXdgAppUrgent,
} from "@/lib/xdg/xdg-badge-count";
import { APP_CATALOG, type AppDefinition } from "@/data/catalog";
import {
  canonicalizeWebUrl,
  DEFAULT_BROWSER_WEB_APPS,
  fetchWebPageMetadata,
  getCachedWebDescription,
  getWebAppFaviconUrl,
  type InstalledWebApp,
} from "@/data/web-apps";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
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
  | "updates"
  | "core-apps"
  | "circle-apps"
  | "kde-apps"
  | "web-apps"
  | "Games"
  | "Graphics"
  | "Development"
  | "Productivity"
  | "Multimedia"
  | "Science"
  | "Utilities";

type AppGenreCategory =
  | "Games"
  | "Graphics"
  | "Development"
  | "Productivity"
  | "Multimedia"
  | "Science"
  | "Utilities";

interface SoftwareSourcesState {
  webApps: boolean;
  flatpak: boolean;
  system: boolean;
}

const DEFAULT_SOFTWARE_SOURCES: SoftwareSourcesState = {
  webApps: true,
  flatpak: true,
  system: true,
};

const WEB_SIMULATED_APT_UPDATES: AptUpdatePackage[] = [
  {
    name: "libgtk-4-1",
    currentVersion: "4.14.2+ds-1",
    newVersion: "4.14.4+ds-1",
    architecture: "amd64",
  },
  {
    name: "pipewire",
    currentVersion: "1.0.5-1",
    newVersion: "1.0.7-1",
    architecture: "amd64",
  },
  {
    name: "mesa-vulkan-drivers",
    currentVersion: "24.0.6-1",
    newVersion: "24.1.1-1",
    architecture: "amd64",
  },
];

const WEB_SIMULATED_FLATPAK_UPDATES: FlatpakUpdateEntry[] = [
  {
    appId: "org.gnome.Calendar",
    name: "Calendar",
    version: "46.1",
    branch: "stable",
  },
  {
    appId: "org.kde.kdenlive",
    name: "Kdenlive",
    version: "24.08.2",
    branch: "stable",
  },
];

interface StoreItem {
  id: string;
  kind: "app" | "web" | "flatpak";
  title: string;
  subtitle: string;
  category: AppGenreCategory;
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
): AppGenreCategory {
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
    return "Multimedia";
  }
  if (/math|graph|geometry|calculator|weather|astronomy|globe/.test(hay)) {
    return "Science";
  }
  if (/markdown|notes|pomodoro|clock|meeting/.test(hay)) {
    return "Productivity";
  }
  return "Utilities";
}

function normalizeStoreCategory(
  raw: string | undefined,
  app: InstalledWebApp,
): AppGenreCategory {
  if (raw === "Multimedia" || raw === "Audio & Media") return "Multimedia";
  if (raw === "Science" || raw === "Science & Math") return "Science";
  if (
    raw === "Games" ||
    raw === "Graphics" ||
    raw === "Development" ||
    raw === "Productivity" ||
    raw === "Utilities"
  ) {
    return raw;
  }
  return classifyWebAppCategory(app);
}

function classifyCatalogCategory(
  cat: string,
): AppGenreCategory {
  if (cat === "Graphics") return "Graphics";
  if (cat === "Development") return "Development";
  if (cat === "Office" || cat === "Internet") return "Productivity";
  if (cat === "AudioVideo" || cat === "Media") return "Multimedia";
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
  {
    id: "updates",
    label: "Updates",
    icon: <ArrowUpCircleIcon className="size-4" />,
  },
];

const COLLECTION_ITEMS: Array<{
  id: CollectionId | "web-apps";
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "core-apps",
    label: "Core Apps",
    icon: <LayersIcon className="size-4" />,
  },
  {
    id: "circle-apps",
    label: "Circle Apps",
    icon: <HeartIcon className="size-4" />,
  },
  {
    id: "kde-apps",
    label: "KDE Apps",
    icon: <Code2Icon className="size-4" />,
  },
  {
    id: "web-apps",
    label: "Web Apps",
    icon: <GlobeIcon className="size-4" />,
  },
];

function classifyFlatpakCategory(
  mainCategories?: string[],
): AppGenreCategory {
  const cats = (mainCategories ?? []).map((c) => c.toLowerCase());
  if (cats.includes("game")) return "Games";
  if (cats.includes("graphics")) return "Graphics";
  if (cats.includes("development")) return "Development";
  if (cats.includes("office")) return "Productivity";
  if (cats.includes("audiovideo")) return "Multimedia";
  if (cats.includes("science") || cats.includes("education")) {
    return "Science";
  }
  return "Utilities";
}

const CATEGORY_ITEMS: Array<{
  id: AppGenreCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "Games", label: "Games", icon: <Gamepad2Icon className="size-4" /> },
  {
    id: "Graphics",
    label: "Graphics",
    icon: <PaletteIcon className="size-4" />,
  },
  {
    id: "Development",
    label: "Development",
    icon: <Code2Icon className="size-4" />,
  },
  {
    id: "Productivity",
    label: "Productivity",
    icon: <BriefcaseIcon className="size-4" />,
  },
  {
    id: "Multimedia",
    label: "Multimedia",
    icon: <MusicIcon className="size-4" />,
  },
  {
    id: "Science",
    label: "Science",
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
    hasUserFlathub: false,
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
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const mainRef = React.useRef<HTMLElement | null>(null);

  const [sources, setSources] = React.useState<SoftwareSourcesState>(() => {
    const saved = readVfsStateJson<Partial<SoftwareSourcesState>>(
      VFS_STATE_PATHS.appStoreSources,
      "piloti.appstore.sources.v1",
    );
    return {
      webApps: saved?.webApps ?? DEFAULT_SOFTWARE_SOURCES.webApps,
      flatpak: saved?.flatpak ?? DEFAULT_SOFTWARE_SOURCES.flatpak,
      system: saved?.system ?? DEFAULT_SOFTWARE_SOURCES.system,
    };
  });
  const updateSources = React.useCallback(
    (patch: Partial<SoftwareSourcesState>) => {
      setSources((prev) => {
        const next = { ...prev, ...patch };
        writeVfsStateJson(
          VFS_STATE_PATHS.appStoreSources,
          next,
        );
        return next;
      });
    },
    [],
  );

  const [settingsPopoverOpen, setSettingsPopoverOpen] = React.useState(false);
  const settingsPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const settingsPopoverPanelRef = React.useRef<HTMLDivElement | null>(null);
  const [settingsPopoverPos, setSettingsPopoverPos] = React.useState<{
    top: number;
    right: number;
  }>({ top: 0, right: 0 });
  React.useEffect(() => {
    if (!settingsPopoverOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        settingsPopoverRef.current &&
        !settingsPopoverRef.current.contains(target) &&
        !settingsPopoverPanelRef.current?.contains(target)
      ) {
        setSettingsPopoverOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [settingsPopoverOpen]);

  const [aptUpdates, setAptUpdates] = React.useState<AptUpdatePackage[]>(() =>
    isBrowserRuntime ? WEB_SIMULATED_APT_UPDATES : [],
  );
  const [flatpakUpdates, setFlatpakUpdates] = React.useState<
    FlatpakUpdateEntry[]
  >(() => (isBrowserRuntime ? WEB_SIMULATED_FLATPAK_UPDATES : []));
  const [systemUpdatesExpanded, setSystemUpdatesExpanded] =
    React.useState(false);
  const [reloadingUpdates, setReloadingUpdates] = React.useState(false);
  const [updatingTarget, setUpdatingTarget] = React.useState<string | null>(
    null,
  );
  const [opStatus, setOpStatus] = React.useState<{
    progress: number | null;
    statusLine?: string;
  } | null>(null);
  const [viewMode, setViewMode] = React.useState<"list" | "grid">("list");
  const [sortMode, setSortMode] = React.useState<
    "default" | "name" | "category" | "installed"
  >("default");
  const busyRef = React.useRef(false);
  const beginOp = React.useCallback((): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setXdgAppUrgent("app-store", false);
    return true;
  }, []);
  const endOp = React.useCallback(() => {
    busyRef.current = false;
  }, []);

  const totalUpdatesCount =
    (sources.system && aptUpdates.length > 0 ? 1 : 0) +
    (sources.flatpak ? flatpakUpdates.length : 0);

  React.useEffect(() => {
    setXdgAppBadgeCount("app-store", totalUpdatesCount);
  }, [totalUpdatesCount]);

  const refreshUpdates = React.useCallback(async () => {
    if (isBrowserRuntime) return;
    const [aptList, fpList] = await Promise.all([
      sources.system ? listAptUpdates(domicile) : Promise.resolve([]),
      sources.flatpak ? listFlatpakUpdates(domicile) : Promise.resolve([]),
    ]);
    setAptUpdates(aptList);
    setFlatpakUpdates(fpList);
  }, [domicile, isBrowserRuntime, sources.flatpak, sources.system]);

  React.useEffect(() => {
    void refreshUpdates();
  }, [refreshUpdates]);

  const {
    highlightedId: highlightedCategory,
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: [...SIDEBAR_ITEMS, ...COLLECTION_ITEMS, ...CATEGORY_ITEMS].map(
      (e) => e.id,
    ),
    activeId: category,
    onActivate: (id) => setCategory(id),
    sidebarRef,
    contentRef: mainRef,
  });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<StoreMetaState>(loadStoreMeta);
  const [pendingOp, setPendingOp] = React.useState<{
    id: string;
    kind: "installing" | "removing";
    /** `null` renders an indeterminate progress bar (no `aria-valuenow`). */
    progress: number | null;
    statusLine?: string;
  } | null>(null);
  const opRafRef = React.useRef<number | null>(null);

  const isBusy =
    pendingOp !== null ||
    opStatus !== null ||
    reloadingUpdates ||
    updatingTarget !== null;

  React.useEffect(() => {
    if (pendingOp) {
      setXdgAppProgress(
        "app-store",
        pendingOp.progress === null ? null : pendingOp.progress / 100,
      );
    } else if (opStatus) {
      setXdgAppProgress(
        "app-store",
        opStatus.progress === null ? null : opStatus.progress / 100,
      );
    } else if (reloadingUpdates || updatingTarget !== null) {
      setXdgAppProgress("app-store", null);
    } else {
      setXdgAppProgress("app-store", undefined);
    }
    return () => {
      setXdgAppProgress("app-store", undefined);
    };
  }, [opStatus, pendingOp, reloadingUpdates, updatingTarget]);

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
    for (const entry of COLLECTION_APPS) {
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
            }
          : { ...entry, installed: installedFlatpakIds.has(entry.appId) },
      );
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
        category: normalizeStoreCategory(webApp.category, webApp),
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

    return [
      ...(sources.system ? appItems : []),
      ...(sources.webApps ? webItems : []),
      ...(sources.flatpak ? flatpakItems : []),
    ];
  }, [
    installedWebUrls,
    meta,
    descriptionTick,
    flatpakItems,
    sources.flatpak,
    sources.system,
    sources.webApps,
  ]);

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category === "updates") return false;
      if (category === "installed" && !item.installed) return false;
      if (
        category === "core-apps" ||
        category === "circle-apps" ||
        category === "kde-apps"
      ) {
        const ids = COLLECTION_APP_IDS_BY_COLLECTION[category];
        if (item.kind !== "flatpak" || !item.flatpak || !ids.has(item.flatpak.appId)) {
          return false;
        }
      } else if (
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
        (item.flatpak?.appId.toLowerCase().includes(q) ?? false) ||
        (item.webApp?.keywords?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, category, query]);

  const sortedItems = React.useMemo(() => {
    if (sortMode === "default") return filteredItems;
    const copy = [...filteredItems];
    if (sortMode === "name") {
      copy.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "category") {
      copy.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
      );
    } else if (sortMode === "installed") {
      copy.sort(
        (a, b) =>
          Number(b.installed) - Number(a.installed) ||
          a.title.localeCompare(b.title),
      );
    }
    return copy;
  }, [filteredItems, sortMode]);

  const webAppsByCategory = React.useMemo(() => {
    if (category !== "web-apps") return [];
    const groups = new Map<AppGenreCategory, StoreItem[]>();
    for (const item of sortedItems) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return CATEGORY_ITEMS.map((cat) => ({
      id: cat.id,
      title: _(cat.label),
      list: groups.get(cat.id) ?? [],
    })).filter((g) => g.list.length > 0);
  }, [category, sortedItems]);

  const flatpakUpdateById = React.useMemo(
    () => new Map(flatpakUpdates.map((u) => [u.appId, u])),
    [flatpakUpdates],
  );

  const sidebarItems = React.useMemo<AdwSplitSidebarItem[]>(() => {
    const countFor = (id: StoreCategory): number | undefined => {
      if (id === "updates") return totalUpdatesCount > 0 ? totalUpdatesCount : undefined;
      if (id === "all") return items.length;
      if (id === "installed") return items.filter((i) => i.installed).length;
      if (id === "web-apps") return items.filter((i) => i.kind === "web").length;
      if (id === "core-apps" || id === "circle-apps" || id === "kde-apps") {
        const ids = COLLECTION_APP_IDS_BY_COLLECTION[id];
        return items.filter(
          (i) => i.kind === "flatpak" && i.flatpak && ids.has(i.flatpak.appId),
        ).length;
      }
      return items.filter((i) => i.category === id).length;
    };
    return [...SIDEBAR_ITEMS, ...COLLECTION_ITEMS, ...CATEGORY_ITEMS].map(
      (entry, idx) => ({
        id: entry.id,
        label: _(entry.label),
        icon: entry.icon,
        selected: highlightedCategory === entry.id,
        onClick: () => setCategory(entry.id),
        badge: countFor(entry.id),
        separatorAfter:
          idx === SIDEBAR_ITEMS.length - 1 ||
          idx === SIDEBAR_ITEMS.length + COLLECTION_ITEMS.length - 1,
      }),
    );
  }, [highlightedCategory, items, totalUpdatesCount]);

  const webAndAppItems = React.useMemo(
    () => sortedItems.filter((item) => item.kind !== "flatpak"),
    [sortedItems],
  );

  const flatpakStoreItems = React.useMemo(
    () => sortedItems.filter((item) => item.kind === "flatpak"),
    [sortedItems],
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

  const pendingAbortRef = React.useRef<AbortController | null>(null);

  const handleCancelPendingOp = React.useCallback(() => {
    if (opRafRef.current !== null) {
      cancelAnimationFrame(opRafRef.current);
      opRafRef.current = null;
    }
    pendingAbortRef.current?.abort();
    pendingAbortRef.current = null;
    setPendingOp(null);
    endOp();
  }, [endOp]);

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
        if (!beginOp()) return;
        const fp = item.flatpak;
        if (isBrowserRuntime) {
          pushNotification({
            appName: "App Store",
            summary: `Flatpak: ${fp.name}`,
            body: `Run on Domicile Linux: flatpak install --user -y flathub ${fp.appId}`,
          });
          return;
        }
        if (pendingOp) return;
        const controller = new AbortController();
        pendingAbortRef.current = controller;
        setSelectedId(item.id);
        setPendingOp({
          id: item.id,
          kind: "installing",
          progress: null,
          statusLine: `flatpak install --user -y ${fp.origin || "flathub"} ${fp.appId}`,
        });
        void (async () => {
          const targetRemote = fp.origin || "flathub";
          if (targetRemote === "flathub" && !flatpakCaps.hasUserFlathub) {
            setPendingOp({
              id: item.id,
              kind: "installing",
              progress: null,
              statusLine: "flatpak remote-add --user flathub…",
            });
            await ensureFlathubRemote(domicile);
          }
          if (controller.signal.aborted) {
            setPendingOp(null);
            return;
          }
          const res = await installFlatpakApp(
            domicile,
            fp.appId,
            targetRemote,
            ({ line, progress }) =>
              setPendingOp((prev) =>
                prev && prev.id === item.id
                  ? {
                      ...prev,
                      progress: progress !== null ? progress : prev.progress,
                      statusLine: line,
                    }
                  : prev,
              ),
            controller.signal,
          );
          if (pendingAbortRef.current === controller) {
            pendingAbortRef.current = null;
          }
          setPendingOp(null);
          if (res.canceled) {
            pushNotification({
              appName: "App Store",
              summary: _("Canceled installing %s", fp.name),
              body: fp.appId,
            });
          } else if (res.ok) {
            await refreshFlatpakList();
            await refreshXdgApps();
            pushNotification({
              appName: "App Store",
              summary: `Installed ${fp.name}`,
              body: fp.appId,
            });
          } else {
            pushNotification({
              appName: "App Store",
              summary: `Failed to install ${fp.name}`,
              body: res.error || "Flatpak install failed",
              urgency: "critical",
            });
          }
          endOp();
        })();
        return;
      }
      if (!beginOp()) return;
      runFakeProgress(item.id, "installing", () => {
        commitInstall(item);
        endOp();
      });
    },
    [
      commitInstall,
      domicile,
      flatpakCaps.hasUserFlathub,
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
        if (isBrowserRuntime || !beginOp()) return;
        if (!beginOp()) return;
        const fp = item.flatpak;
        const controller = new AbortController();
        pendingAbortRef.current = controller;
        setSelectedId(item.id);
        setPendingOp({
          id: item.id,
          kind: "removing",
          progress: null,
          statusLine: `flatpak uninstall -y ${fp.appId}`,
        });
        void (async () => {
          const res = await uninstallFlatpakApp(domicile, fp.appId, {
            installation: fp.installation,
            signal: controller.signal,
            onUpdate: ({ line, progress }) =>
              setPendingOp((prev) =>
                prev && prev.id === item.id
                  ? {
                      ...prev,
                      progress: progress !== null ? progress : prev.progress,
                      statusLine: line,
                    }
                  : prev,
              ),
          });
          if (pendingAbortRef.current === controller) {
            pendingAbortRef.current = null;
          }
          setPendingOp(null);
          if (res.canceled) {
            return;
          }
          if (res.ok) {
            await refreshFlatpakList();
            await refreshXdgApps();
            pushNotification({
              appName: "App Store",
              summary: `Uninstalled ${fp.name}`,
              body: fp.appId,
            });
          } else {
            pushNotification({
              appName: "App Store",
              summary: `Failed to uninstall ${fp.name}`,
              body: res.error || "Flatpak uninstall failed",
              urgency: "critical",
            });
          }
          endOp();
        })();
        return;
      }
      if (!beginOp()) return;
      runFakeProgress(item.id, "removing", () => {
        commitUninstall(item);
        endOp();
      });
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
        if (isBrowserRuntime) {
          pushNotification({
            appName: "App Store",
            summary: `Flatpak: ${item.flatpak.name}`,
            body: `Run on Domicile Linux: flatpak run ${item.flatpak.appId}`,
          });
          return;
        }
        launchApp(item.flatpak.appId);
        return;
      }
      if (item.kind === "app" && item.appDef) {
        launchApp(item.appDef.id);
      }
    },
    [isBrowserRuntime, launchApp, openWebUrl, pushNotification],
  );

  const handleReloadUpdates = React.useCallback(async () => {
    if (!beginOp()) return;
    setReloadingUpdates(true);
    setOpStatus({ progress: null, statusLine: "apt update && flatpak update" });
    try {
      if (isBrowserRuntime) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        setAptUpdates(WEB_SIMULATED_APT_UPDATES);
        setFlatpakUpdates(WEB_SIMULATED_FLATPAK_UPDATES);
      } else {
        await runAptUpdateAndFlatpakRefresh(domicile);
        await refreshUpdates();
      }
      pushNotification({
        appName: "App Store",
        summary: _("Software catalog refreshed"),
        body: "apt update && flatpak update",
      });
    } finally {
      setReloadingUpdates(false);
      setOpStatus(null);
      endOp();
    }
  }, [beginOp, domicile, endOp, isBrowserRuntime, pushNotification, refreshUpdates]);

  const handleUpgradeSystem = React.useCallback(async () => {
    if (!beginOp()) return;
    setUpdatingTarget("__system__");
    setOpStatus({ progress: null, statusLine: "apt upgrade -y" });
    try {
      if (isBrowserRuntime) {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        setAptUpdates([]);
        pushNotification({
          appName: "App Store",
          summary: _("System upgrades installed"),
          body: "apt upgrade -y",
        });
      } else {
        const res = await runAptUpgrade(domicile);
        if (res.ok) {
          setAptUpdates([]);
          pushNotification({
            appName: "App Store",
            summary: _("System upgrades installed"),
            body: "apt upgrade -y",
          });
        } else {
          pushNotification({
            appName: "App Store",
            summary: _("System upgrade failed"),
            body: res.error || "apt upgrade -y",
            urgency: "critical",
          });
        }
        await refreshUpdates();
      }
    } finally {
      setUpdatingTarget(null);
      setOpStatus(null);
      endOp();
    }
  }, [beginOp, domicile, endOp, isBrowserRuntime, pushNotification, refreshUpdates]);

  const handleUpgradeFlatpak = React.useCallback(
    async (appId: string) => {
      if (!beginOp()) return;
      setUpdatingTarget(appId);
      setOpStatus({ progress: null, statusLine: `flatpak update -y ${appId}` });
      try {
        if (isBrowserRuntime) {
          await new Promise((resolve) => window.setTimeout(resolve, 550));
          setFlatpakUpdates((prev) => prev.filter((u) => u.appId !== appId));
        } else {
          const res = await updateFlatpakApp(domicile, appId, {
            onUpdate: ({ line, progress }) =>
              setOpStatus({ progress, statusLine: line }),
          });
          if (!res.ok) {
            pushNotification({
              appName: "App Store",
              summary: _("Failed to upgrade %s", appId),
              body: res.error || "",
              urgency: "critical",
            });
          }
          await refreshUpdates();
        }
      } finally {
        setUpdatingTarget(null);
        setOpStatus(null);
        endOp();
      }
    },
    [beginOp, domicile, endOp, isBrowserRuntime, pushNotification, refreshUpdates],
  );

  const handleUpgradeAll = React.useCallback(async () => {
    if (!beginOp()) return;
    setUpdatingTarget("__all__");
    setOpStatus({ progress: null, statusLine: _("Upgrading all packages and apps…") });
    try {
      if (isBrowserRuntime) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        if (sources.system) setAptUpdates([]);
        if (sources.flatpak) setFlatpakUpdates([]);
        pushNotification({
          appName: "App Store",
          summary: _("All upgrades installed"),
          body: _("Your system and applications are up to date."),
        });
      } else {
        if (sources.system && aptUpdates.length > 0) {
          setOpStatus({ progress: null, statusLine: "apt upgrade -y" });
          await runAptUpgrade(domicile);
        }
        if (sources.flatpak && flatpakUpdates.length > 0) {
          await updateAllFlatpaks(domicile, {
            onUpdate: ({ line, progress }) =>
              setOpStatus({ progress, statusLine: line }),
          });
        }
        await refreshUpdates();
        pushNotification({
          appName: "App Store",
          summary: _("All upgrades installed"),
          body: _("Your system and applications are up to date."),
        });
      }
    } finally {
      setUpdatingTarget(null);
      setOpStatus(null);
      endOp();
    }
  }, [
    aptUpdates.length,
    beginOp,
    domicile,
    endOp,
    flatpakUpdates.length,
    isBrowserRuntime,
    pushNotification,
    refreshUpdates,
    sources.flatpak,
    sources.system,
  ]);

  React.useEffect(() => {
    const onWinKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      ) {
        return;
      }
      if (category === "updates") return;
      const winEl = mainRef.current?.closest('[data-slot="window"]');
      const isFocusedWin =
        (winEl && !winEl.hasAttribute("data-inactive")) ||
        (mainRef.current &&
          document.activeElement &&
          winEl?.contains(document.activeElement));
      if (!isFocusedWin) return;
      if (e.key.length === 1 && /^[a-z0-9._-]$/i.test(e.key)) {
        e.preventDefault();
        setSearchOpen(true);
        setQuery((prev) => (searchOpen ? prev + e.key : e.key));
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onWinKeyDown);
    return () => window.removeEventListener("keydown", onWinKeyDown);
  }, [category, searchOpen]);

  return (
    <AdwSplitView
      title={_("App Store")}
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
          (e.ctrlKey || e.metaKey) &&
          !e.altKey &&
          e.key.toLowerCase() === "f"
        ) {
          e.preventDefault();
          setSearchOpen(true);
          requestAnimationFrame(() => searchInputRef.current?.focus());
          return;
        }
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
          setSearchOpen(true);
          setQuery((prev) => (searchOpen ? prev + e.key : e.key));
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
          <div className="flex min-w-0 items-center gap-1.5" data-window-no-drag>
            {!isCsd && (
              <WindowMenuButton windowId={windowId} appId="app-store" />
            )}
            <span className="truncate px-2 text-[13.5px] font-medium text-adw-label">
              {_(
                [...SIDEBAR_ITEMS, ...COLLECTION_ITEMS, ...CATEGORY_ITEMS].find(
                  (i) => i.id === category,
                )?.label ?? "Explore"
              )}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
            {category !== "updates" && searchOpen && (
              <div className="relative flex items-center">
                <SearchIcon className="pointer-events-none absolute left-2 size-3.5 text-adw-label-secondary" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (query.length > 0) {
                        setQuery("");
                      } else {
                        setSearchOpen(false);
                      }
                    }
                  }}
                  placeholder={_("Search")}
                  aria-label={_("Search")}
                  className="h-7 w-44 rounded-md border border-adw-separator bg-black/6 pr-6 pl-7 text-[12px] text-adw-label placeholder:text-adw-label-secondary focus:border-adw-accent focus:outline-none dark:bg-white/10 [&::-webkit-search-cancel-button]:hidden"
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
            )}
            <button
              type="button"
              aria-label={_("Search")}
              title="Search (Ctrl+F)"
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  } else {
                    setQuery("");
                  }
                  return next;
                });
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                searchOpen
                  ? "bg-black/10 text-adw-label dark:bg-white/15"
                  : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
              )}
            >
              <SearchIcon className="size-4" />
            </button>
            {category !== "updates" && (
              <>
                <div className="flex items-center rounded-md bg-black/6 p-0.5 dark:bg-white/8">
                  <button
                    type="button"
                    aria-label={_("List view")}
                    title={_("List view")}
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                      viewMode === "list"
                        ? "bg-adw-window text-adw-label shadow-xs"
                        : "text-adw-label-secondary hover:text-adw-label",
                    )}
                  >
                    {_("List")}
                  </button>
                  <button
                    type="button"
                    aria-label={_("Grid view")}
                    title={_("Grid view")}
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                      viewMode === "grid"
                        ? "bg-adw-window text-adw-label shadow-xs"
                        : "text-adw-label-secondary hover:text-adw-label",
                    )}
                  >
                    {_("Grid")}
                  </button>
                </div>
                <select
                  aria-label={_("Sort")}
                  value={sortMode}
                  onChange={(e) =>
                    setSortMode(
                      e.target.value as "default" | "name" | "category" | "installed",
                    )
                  }
                  className="h-7 rounded-md border border-adw-separator bg-black/6 px-2 text-[11.5px] font-medium text-adw-label outline-none dark:bg-white/10"
                >
                  <option value="default">{_("Default")}</option>
                  <option value="name">{_("Name")}</option>
                  <option value="category">{_("Category")}</option>
                  <option value="installed">{_("Installed")}</option>
                </select>
              </>
            )}
            <button
              type="button"
              aria-label={_("Refresh")}
              title={_("Refresh (apt update && flatpak update)")}
              disabled={isBusy}
              onClick={() => void handleReloadUpdates()}
              className="flex size-7 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label disabled:opacity-50 dark:hover:bg-white/10"
            >
              <RefreshCwIcon
                className={cn("size-4", reloadingUpdates && "animate-spin")}
              />
            </button>
            <div ref={settingsPopoverRef} className="relative z-40">
              <button
                type="button"
                aria-label={_("Software Sources")}
                aria-expanded={settingsPopoverOpen}
                title={_("Software Sources")}
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsPopoverOpen((prev) => !prev);
                }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  settingsPopoverOpen
                    ? "bg-black/10 text-adw-label dark:bg-white/15"
                    : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10",
                )}
              >
                <SlidersHorizontalIcon className="size-4" />
              </button>
              {settingsPopoverOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto absolute top-9 right-0 z-[200] w-60 rounded-xl border border-adw-separator bg-white/95 p-3 shadow-2xl ring-1 ring-black/10 backdrop-blur-2xl dark:bg-zinc-900/95 dark:ring-white/15"
                >
                  <div className="mb-2 text-[11px] font-semibold tracking-wider text-adw-label-tertiary uppercase">
                    {_("Software Sources")}
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-adw-label">
                        {_("Web Apps")}
                      </span>
                      <Switch
                        checked={sources.webApps}
                        onCheckedChange={(checked) =>
                          updateSources({ webApps: Boolean(checked) })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-adw-label">
                        {_("Flatpak")}
                      </span>
                      <Switch
                        checked={sources.flatpak}
                        onCheckedChange={(checked) =>
                          updateSources({ flatpak: Boolean(checked) })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-adw-label">
                        {_("System")}
                      </span>
                      <Switch
                        checked={sources.system}
                        onCheckedChange={(checked) =>
                          updateSources({ system: Boolean(checked) })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {isCsd && windowId && <WindowControls side="right" />}
          </div>
        </WindowTitlebar>
      )}
      footer={
        pendingOp || opStatus ? (
          <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-adw-separator bg-adw-titlebar px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="shrink-0 text-[11.5px] font-medium text-adw-label">
                {pendingOp
                  ? pendingOp.kind === "removing"
                    ? _("Removing…")
                    : _("Installing…")
                  : reloadingUpdates
                    ? _("Refreshing…")
                    : _("Upgrading…")}
              </span>
              {(pendingOp?.statusLine || opStatus?.statusLine) && (
                <span className="min-w-0 truncate font-mono text-[11px] text-adw-label-secondary">
                  {pendingOp?.statusLine ?? opStatus?.statusLine}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {(() => {
                const prog = pendingOp ? pendingOp.progress : (opStatus?.progress ?? null);
                const isRemoving = pendingOp?.kind === "removing";
                return (
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    {...(prog !== null ? { "aria-valuenow": prog } : {})}
                    className="relative h-1.5 w-36 overflow-hidden rounded-full bg-black/10 dark:bg-white/12"
                  >
                    {prog === null ? (
                      <div
                        className={cn(
                          "h-full w-2/5 animate-[piloti-indeterminate_1.3s_ease-in-out_infinite]",
                          isRemoving ? "bg-adw-red" : "bg-adw-accent",
                        )}
                      />
                    ) : (
                      <div
                        style={{ width: `${prog}%` }}
                        className={cn(
                          "h-full transition-[width] duration-75",
                          isRemoving ? "bg-adw-red" : "bg-adw-accent",
                        )}
                      />
                    )}
                  </div>
                );
              })()}
              {pendingOp && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={_("Cancel")}
                  title={_("Cancel")}
                  onClick={handleCancelPendingOp}
                  className="h-6 px-2 text-[11px]"
                >
                  <XIcon className="mr-1 size-3" />
                  {_("Cancel")}
                </Button>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {({ onContentScroll }) => (
        <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          ref={mainRef}
          onKeyDown={onContentKeyDown}
          onScroll={onContentScroll}
          className="flex-1 overflow-y-auto p-4"
          onClick={() => setSelectedId(null)}
        >
            {category === "updates" ? (
              <div className="mx-auto max-w-3xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-adw-label">
                      {_("Available Updates")}
                    </h2>
                    <p className="text-[12px] text-adw-label-secondary">
                      {totalUpdatesCount === 0
                        ? _("Your system and applications are up to date.")
                        : _("%d upgrades available", totalUpdatesCount)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {totalUpdatesCount > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleUpgradeAll()}
                      >
                        {updatingTarget === "__all__"
                          ? _("Upgrading…")
                          : _("Upgrade All")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isBusy}
                      onClick={() => void handleReloadUpdates()}
                    >
                      <RefreshCwIcon
                        className={cn("mr-1.5 size-3.5", reloadingUpdates && "animate-spin")}
                      />
                      {reloadingUpdates ? _("Refreshing…") : _("Refresh")}
                    </Button>
                  </div>
                </div>

                {totalUpdatesCount === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-adw-separator bg-adw-card py-12 text-center text-adw-label-secondary">
                    <CheckCircle2Icon className="size-10 text-emerald-500 opacity-80" />
                    <p className="text-sm font-medium text-adw-label">
                      {_("Software is up to date")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sources.system && aptUpdates.length > 0 && (
                      <div className="overflow-hidden rounded-xl border border-adw-separator bg-adw-card">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSystemUpdatesExpanded((prev) => !prev)}
                            aria-expanded={systemUpdatesExpanded}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-adw-accent/15 text-adw-accent">
                              <ServerIcon className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13.5px] font-semibold text-adw-label">
                                  {_("System Updates")}
                                </span>
                                <span className="rounded-full bg-black/6 px-2 py-0.5 text-[10.5px] font-medium text-adw-label-secondary dark:bg-white/10">
                                  {_("%d packages", aptUpdates.length)}
                                </span>
                              </div>
                              <div className="truncate text-[11.5px] text-adw-label-secondary">
                                apt upgrade -y
                              </div>
                            </div>
                            <ChevronDownIcon
                              className={cn(
                                "size-4 shrink-0 text-adw-label-tertiary transition-transform duration-150",
                                systemUpdatesExpanded && "rotate-180",
                              )}
                            />
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => void handleUpgradeSystem()}
                          >
                            {updatingTarget === "__system__"
                              ? _("Upgrading…")
                              : _("Upgrade")}
                          </Button>
                        </div>

                        {systemUpdatesExpanded && (
                          <div className="divide-y divide-adw-separator/60 border-t border-adw-separator/60 bg-black/[0.02] dark:bg-white/[0.02]">
                            {aptUpdates.map((pkg) => (
                              <div
                                key={pkg.name}
                                className="flex items-center justify-between gap-3 px-4 py-2 font-mono text-[11.5px]"
                              >
                                <span className="truncate font-medium text-adw-label">
                                  {pkg.name}
                                </span>
                                <span className="shrink-0 text-adw-label-tertiary">
                                  {pkg.currentVersion
                                    ? `${pkg.currentVersion} → ${pkg.newVersion ?? ""}`
                                    : (pkg.newVersion ?? "")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {sources.flatpak && flatpakUpdates.length > 0 && (
                      <div className="divide-y divide-adw-separator/60 overflow-hidden rounded-xl border border-adw-separator bg-adw-card">
                        {flatpakUpdates.map((upd) => {
                          const storeItem = items.find(
                            (i) => i.kind === "flatpak" && i.flatpak?.appId === upd.appId,
                          );
                          const isSelected = storeItem && selectedId === storeItem.id;
                          return (
                            <div
                              key={upd.appId}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (storeItem) setSelectedId(storeItem.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && storeItem) setSelectedId(storeItem.id);
                              }}
                              className={cn(
                                "flex cursor-default items-center justify-between gap-3 px-3.5 py-2.5 transition-colors outline-none",
                                isSelected
                                  ? "bg-adw-accent/15"
                                  : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <WebAppFavicon
                                  url={
                                    storeItem?.faviconUrl ??
                                    `https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/${upd.appId}.png`
                                  }
                                  title={upd.name}
                                  className="size-10"
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-[13px] font-semibold text-adw-label">
                                    {upd.name}
                                  </div>
                                  <div className="truncate text-[11.5px] text-adw-label-secondary">
                                    {storeItem?.subtitle || upd.appId}
                                    {upd.version ? ` · v${upd.version}` : ""}
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isBusy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleUpgradeFlatpak(upd.appId);
                                }}
                                className="h-7 px-3 text-[11.5px]"
                              >
                                {updatingTarget === upd.appId
                                  ? _("Upgrading…")
                                  : _("Upgrade")}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
            <>
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
                {(category === "web-apps"
                  ? webAppsByCategory
                  : [
                      { id: "web", title: _("Web Apps"), list: webAndAppItems },
                      { id: "flatpak", title: _("Flatpaks"), list: flatpakStoreItems },
                    ]
                )
                  .filter((group) => group.list.length > 0)
                  .map((group) => (
                    <section key={group.id} className="space-y-2.5">
                      <h2 className="px-0.5 text-[12px] font-semibold tracking-wider text-adw-label-tertiary uppercase">
                        {group.title}
                      </h2>
                      <div
                        className={cn(
                          viewMode === "list"
                            ? "divide-y divide-adw-separator/60 overflow-hidden rounded-xl border border-adw-separator bg-adw-card"
                            : "grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-2.5",
                        )}
                      >
                        {group.list.map((item) => {
                          const isSelected = selectedId === item.id;
                          const upgradable =
                            item.kind === "flatpak" && item.flatpak
                              ? flatpakUpdateById.get(item.flatpak.appId)
                              : undefined;
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
                                    "relative flex cursor-default items-center gap-3 overflow-hidden transition-colors outline-none",
                                    viewMode === "list"
                                      ? cn(
                                          "px-3.5 py-2.5",
                                          isSelected
                                            ? "bg-adw-accent/15"
                                            : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                                        )
                                      : cn(
                                          "rounded-xl p-3",
                                          isSelected
                                            ? "bg-adw-accent/15 ring-1 ring-adw-accent/60"
                                            : "bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
                                        ),
                                  )}
                                >
                                  {item.kind === "app" && item.appDef ? (
                                    <AppSquircleIcon
                                      iconUrl={getAppIconUrl(item.appDef.id)}
                                      iconName={item.appDef.iconName}
                                      gradient={item.appDef.gradient}
                                      className="size-10"
                                    />
                                  ) : (
                                    <WebAppFavicon
                                      url={item.faviconUrl}
                                      title={item.title}
                                      className="size-10"
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

                                  {viewMode === "list" && (
                                    <div
                                      className="flex shrink-0 items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {upgradable && item.flatpak && (
                                        <button
                                          type="button"
                                          title={_("Upgrade")}
                                          aria-label={_("Upgrade")}
                                          disabled={isBusy}
                                          onClick={() =>
                                            void handleUpgradeFlatpak(item.flatpak!.appId)
                                          }
                                          className="flex size-7 items-center justify-center rounded-md text-adw-accent transition-colors hover:bg-adw-accent/15 disabled:opacity-40"
                                        >
                                          <RefreshCwIcon className="size-3.5" />
                                        </button>
                                      )}
                                      {item.installed ? (
                                        <>
                                          {item.removable && (
                                            <button
                                              type="button"
                                              title={_("Uninstall")}
                                              aria-label={_("Uninstall")}
                                              disabled={isBusy}
                                              onClick={() => handleUninstall(item)}
                                              className="flex size-7 items-center justify-center rounded-md text-adw-label-tertiary transition-colors hover:bg-rose-500/12 hover:text-rose-500 disabled:opacity-40"
                                            >
                                              <XIcon className="size-3.5" />
                                            </button>
                                          )}
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            disabled={isBusy}
                                            onClick={() => handleOpen(item)}
                                            className="h-7 px-3 text-[11.5px]"
                                          >
                                            {_("Open")}
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={isBusy}
                                          onClick={() => handleInstall(item)}
                                          className="h-7 px-3 text-[11.5px]"
                                        >
                                          {_("Install")}
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  {pendingOp?.id === item.id && (
                                    <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/10 dark:bg-white/10">
                                      {pendingOp.progress === null ? (
                                        <div
                                          className={cn(
                                            "h-full w-2/5 animate-[piloti-indeterminate_1.3s_ease-in-out_infinite]",
                                            pendingOp.kind === "removing"
                                              ? "bg-adw-red"
                                              : "bg-adw-accent",
                                          )}
                                        />
                                      ) : (
                                        <div
                                          style={{ width: `${pendingOp.progress}%` }}
                                          className={cn(
                                            "h-full transition-[width] duration-75",
                                            pendingOp.kind === "removing"
                                              ? "bg-adw-red"
                                              : "bg-adw-accent",
                                          )}
                                        />
                                      )}
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
            </>
            )}
          </main>

          {/* Right-side Infos Inspector Panel (AppFinder / Files style) */}
          {selectedItem && (
            <aside
              onClick={(e) => e.stopPropagation()}
              className="flex w-72 shrink-0 flex-col border-l border-adw-separator bg-adw-sidebar"
            >
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-adw-separator px-3">
                <button
                  type="button"
                  aria-label={_("Close")}
                  onClick={() => setSelectedId(null)}
                  className="flex size-6 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
                >
                  <XIcon className="size-3.5" />
                </button>
                <span className="text-[12.5px] font-semibold text-adw-label">
                  {_("Infos")}
                </span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="flex flex-col items-center text-center">
                  {selectedItem.kind === "app" && selectedItem.appDef ? (
                    <AppSquircleIcon
                      iconUrl={getAppIconUrl(selectedItem.appDef.id)}
                      iconName={selectedItem.appDef.iconName}
                      gradient={selectedItem.appDef.gradient}
                      className="size-16"
                    />
                  ) : (
                    <WebAppFavicon
                      url={selectedItem.faviconUrl}
                      title={selectedItem.title}
                      className="size-16"
                    />
                  )}
                  <h3 className="mt-3 text-[15px] font-bold text-adw-label">
                    {selectedItem.title}
                  </h3>
                  <p className="mt-1 text-[12px] leading-snug text-adw-label-secondary">
                    {selectedItem.subtitle}
                  </p>
                  {(() => {
                    const upd =
                      selectedItem.kind === "flatpak" && selectedItem.flatpak
                        ? flatpakUpdateById.get(selectedItem.flatpak.appId)
                        : undefined;
                    if (!upd?.version) return null;
                    return (
                      <div className="mt-1.5 text-[11px] font-medium text-adw-accent">
                        {_("Upgrade available: %s", upd.version)}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  {!selectedItem.installed ? (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={isBusy}
                      onClick={() => handleInstall(selectedItem)}
                    >
                      {_("Install")}
                    </Button>
                  ) : (
                    <>
                      {selectedItem.kind === "flatpak" &&
                      selectedItem.flatpak &&
                      flatpakUpdateById.has(selectedItem.flatpak.appId) ? (
                        <Button
                          type="button"
                          className="flex-1"
                          disabled={isBusy}
                          onClick={() =>
                            void handleUpgradeFlatpak(selectedItem.flatpak!.appId)
                          }
                        >
                          {updatingTarget === selectedItem.flatpak.appId
                            ? _("Upgrading…")
                            : _("Upgrade")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => handleOpen(selectedItem)}
                        >
                          {_("Open")}
                        </Button>
                      )}
                      {selectedItem.removable && (
                        <Button
                          type="button"
                          variant="destructive"
                          className="flex-1"
                          disabled={isBusy}
                          onClick={() => handleUninstall(selectedItem)}
                        >
                          {_("Uninstall")}
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="divide-y divide-adw-separator/60 overflow-hidden rounded-xl border border-adw-separator bg-adw-card text-[12px]">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("Category")}</span>
                    <span className="font-medium text-adw-label">
                      {_(selectedItem.category)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("Source")}</span>
                    <span className="font-medium text-adw-label">
                      {selectedItem.kind === "flatpak"
                        ? selectedItem.flatpak?.origin || "Flathub"
                        : selectedItem.kind === "web"
                          ? _("Web App")
                          : _("System")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("ID")}</span>
                    <span className="max-w-[150px] truncate font-mono text-[11px] text-adw-label">
                      {selectedItem.flatpak?.appId ||
                        selectedItem.appDef?.id ||
                        selectedItem.id}
                    </span>
                  </div>
                  {selectedItem.webApp?.url && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-adw-label-secondary">{_("URL")}</span>
                      <span className="max-w-[150px] truncate font-mono text-[11px] text-adw-accent">
                        {selectedItem.webApp.url}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("Status")}</span>
                    <span className="font-medium text-adw-label">
                      {selectedItem.installed ? _("Installed") : _("Available")}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
        )}
      </AdwSplitView>
    );
  };
