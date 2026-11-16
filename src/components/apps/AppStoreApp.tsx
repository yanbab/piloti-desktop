import * as React from "react";
import {
  CheckCircle2Icon,
  GlobeIcon,
  Maximize2Icon,
  MinusIcon,
  PackageIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { WindowControls } from "@/components/ui/window";
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
  useWindowManager,
} from "@/context/DesktopStateContext";
import { APP_CATALOG, type AppDefinition } from "@/data/catalog";
import {
  canonicalizeWebUrl,
  DEFAULT_BROWSER_WEB_APPS,
  fetchWebPageMetadata,
  getCachedWebDescription,
  getWebAppFaviconUrl,
  type InstalledWebApp,
} from "@/data/web-apps";
import { cn } from "@/lib/utils";

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
  kind: "app" | "web";
  title: string;
  subtitle: string;
  category: Exclude<StoreCategory, "all" | "installed">;
  installed: boolean;
  removable: boolean;
  appDef?: AppDefinition;
  webApp?: InstalledWebApp;
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
    const raw = localStorage.getItem(STORE_META_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreMetaState>;
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
    localStorage.setItem(STORE_META_STORAGE_KEY, JSON.stringify(meta));
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

const CATEGORY_ITEMS: Array<{
  id: Exclude<StoreCategory, "all" | "installed">;
  label: string;
}> = [
  { id: "Games", label: "Games" },
  { id: "Graphics", label: "Graphics & Design" },
  { id: "Development", label: "Developer Tools" },
  { id: "Productivity", label: "Productivity" },
  { id: "Audio & Media", label: "Audio & Media" },
  { id: "Science & Math", label: "Science & Math" },
  { id: "Utilities", label: "Utilities" },
];

const WebAppFavicon: React.FC<{
  url?: string;
  title: string;
  className?: string;
}> = ({ url, title, className = "size-11" }) => {
  const [failed, setFailed] = React.useState(false);

  if (!url || failed) {
    return (
      <GlobeIcon
        aria-label={title}
        className={cn(
          "shrink-0 text-sky-400 drop-shadow-[0_2px_5px_rgba(0,0,0,0.28)]",
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
        "shrink-0 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.28)]",
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
  const { getAppIconUrl } = useApps();
  const { settings, updateSettings } = useSettings();
  const {
    launchApp,
    openWebUrl,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
  } = useWindowManager();

  const [category, setCategory] = React.useState<StoreCategory>("all");
  const [query, setQuery] = React.useState("");
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
        title: app.name,
        subtitle: app.description,
        category: classifyCatalogCategory(app.category),
        installed,
        removable: !isCore,
        appDef: app,
      };
    });

    return [...appItems, ...webItems];
  }, [installedWebUrls, meta, descriptionTick]);

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
          updateSettings({
            installedWebApps: [...settings.installedWebApps, item.webApp],
          });
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
    [settings.installedWebApps, updateMeta, updateSettings],
  );

  const commitUninstall = React.useCallback(
    (item: StoreItem) => {
      if (!item.removable) return;
      if (item.kind === "web" && item.webApp) {
        const targetCanonical =
          canonicalizeWebUrl(item.webApp.url) ?? item.webApp.url;
        updateSettings({
          installedWebApps: settings.installedWebApps.filter(
            (w) => (canonicalizeWebUrl(w.url) ?? w.url) !== targetCanonical,
          ),
          pinnedAppIds: settings.pinnedAppIds.filter(
            (id) => id !== item.webApp?.id,
          ),
        });
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
    [settings.installedWebApps, settings.pinnedAppIds, updateMeta, updateSettings],
  );

  const handleInstall = React.useCallback(
    (item: StoreItem) => {
      runFakeProgress(item.id, "installing", () => commitInstall(item));
    },
    [commitInstall, runFakeProgress],
  );

  const handleUninstall = React.useCallback(
    (item: StoreItem) => {
      if (!item.removable) return;
      runFakeProgress(item.id, "removing", () => commitUninstall(item));
    },
    [commitUninstall, runFakeProgress],
  );

  const handleOpen = React.useCallback(
    (item: StoreItem) => {
      if (item.kind === "web" && item.webApp) {
        openWebUrl(item.webApp.url, { title: item.webApp.title });
        return;
      }
      if (item.kind === "app" && item.appDef) {
        launchApp(item.appDef.id);
      }
    },
    [launchApp, openWebUrl],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label select-none">
      {/* Header Bar */}
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        className={cn(
          "relative flex shrink-0 items-center justify-between gap-3 border-b border-adw-separator bg-adw-titlebar px-3 select-none",
          isCsd ? "h-10 rounded-t-[inherit]" : "h-10",
        )}
      >
        <div className="flex items-center gap-2" data-window-no-drag>
          {isCsd && windowId && (
            <WindowMenuButton windowId={windowId} appId="app-store" />
          )}
        </div>

        <span className="pointer-events-none text-[13px] font-semibold">
          Application Store
        </span>

        {isCsd && windowId ? (
          <div className="flex items-center" data-window-no-drag>
            <WindowControls />
          </div>
        ) : (
          <div className="w-6" />
        )}
      </div>

      {/* Main Split: Sidebar + Main View Column */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-adw-separator bg-adw-sidebar p-2.5">
          <div className="relative mb-1.5 flex items-center">
            <SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-adw-label-secondary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search"
              className="h-8 w-full rounded-lg border border-adw-separator bg-black/5 pr-2.5 pl-8 text-[12.5px] text-adw-label placeholder:text-adw-label-secondary focus:border-adw-accent focus:outline-none dark:bg-white/8"
            />
          </div>

          {SIDEBAR_ITEMS.map((entry) => {
            const active = category === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
                  active
                    ? "bg-black/10 text-adw-label dark:bg-white/12"
                    : "text-adw-label-secondary hover:bg-black/5 hover:text-adw-label dark:hover:bg-white/6",
                )}
              >
                {entry.icon}
                <span>{entry.label}</span>
              </button>
            );
          })}

          <div className="my-1.5 h-px bg-adw-separator" />
          <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-adw-label-tertiary uppercase">
            Categories
          </div>

          {CATEGORY_ITEMS.map((entry) => {
            const active = category === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                className={cn(
                  "flex items-center rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
                  active
                    ? "bg-black/10 text-adw-label dark:bg-white/12"
                    : "text-adw-label-secondary hover:bg-black/5 hover:text-adw-label dark:hover:bg-white/6",
                )}
              >
                <span className="truncate">{entry.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Main Column (Scrollable Grid + Scoped Bottom Action Bar) */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main
            className="flex-1 overflow-y-auto p-4"
            onClick={() => setSelectedId(null)}
          >
            {filteredItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-adw-label-secondary">
                <PackageIcon className="size-10 opacity-40" />
                <p className="text-sm font-medium">No applications found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => {
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
                            Install
                          </ContextMenuItem>
                        ) : (
                          <>
                            <ContextMenuItem onClick={() => handleOpen(item)}>
                              Open
                            </ContextMenuItem>
                            {item.removable && (
                              <ContextMenuItem
                                variant="destructive"
                                onClick={() => handleUninstall(item)}
                              >
                                Uninstall
                              </ContextMenuItem>
                            )}
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            )}
          </main>

          {/* Main-View-Only Bottom Selection Bar */}
          {selectedItem && (
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-adw-separator bg-adw-titlebar px-4 py-3">
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
                        ? "Removing…"
                        : "Installing…"}
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
                    Install
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
                      Open
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
                        Uninstall
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
