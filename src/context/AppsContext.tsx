import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { watchIconTheme } from "@domicile-desktop/sdk/icon-theme";
import {
  APP_CATALOG,
  type AppDefinition,
} from "@/data/catalog";
import { launchDesktopCommand } from "@/lib/gnome-bridge";
import { logBootEvent, startBootPhase } from "@/lib/perf-log";
import {
  discoverInstalledXdgApps,
  type XdgDesktopEntry,
} from "xdg-desktop-entry";
import {
  buildXdgIconThemeIndex,
  loadCachedXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
  resolveXdgIconUrl,
  saveCachedXdgIconThemeIndex,
  type XdgIconThemeIndex,
} from "xdg-icon-theme";
import {
  buildOpenXdgFolderArgv,
  discoverXdgUserDirs,
  type XdgUserDir,
} from "@/lib/xdg-user-dirs";
import { type SettingsContextValue } from "./SettingsContext";
import { type SystemBackendsContextValue } from "./SystemBackendsContext";

function resolveXdgVisualStyle(entry: XdgDesktopEntry): {
  iconName:
    | "settings"
    | "terminal"
    | "folder"
    | "globe"
    | "notes"
    | "activity"
    | "code"
    | "sparkles";
  gradient: string;
} {
  const lower = `${entry.desktopId} ${entry.icon ?? ""} ${entry.categories.join(" ")}`.toLowerCase();

  if (
    lower.includes("terminal") ||
    lower.includes("console") ||
    lower.includes("kitty") ||
    lower.includes("alacritty")
  ) {
    return {
      iconName: "terminal",
      gradient: "from-zinc-700 via-zinc-800 to-zinc-950",
    };
  }
  if (
    lower.includes("nautilus") ||
    lower.includes("folder") ||
    lower.includes("filemanager") ||
    lower.includes("baobab")
  ) {
    return {
      iconName: "folder",
      gradient: "from-sky-400 via-blue-500 to-blue-600",
    };
  }
  if (
    lower.includes("browser") ||
    lower.includes("firefox") ||
    lower.includes("chromium") ||
    lower.includes("epiphany") ||
    lower.includes("web")
  ) {
    return {
      iconName: "globe",
      gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    };
  }
  if (
    lower.includes("code") ||
    lower.includes("builder") ||
    lower.includes("development") ||
    lower.includes("ide")
  ) {
    return {
      iconName: "code",
      gradient: "from-blue-500 via-indigo-500 to-purple-600",
    };
  }
  if (
    lower.includes("texteditor") ||
    lower.includes("gedit") ||
    lower.includes("notes") ||
    lower.includes("evince") ||
    lower.includes("office")
  ) {
    return {
      iconName: "notes",
      gradient: "from-amber-400 via-orange-500 to-amber-600",
    };
  }
  if (
    lower.includes("monitor") ||
    lower.includes("htop") ||
    lower.includes("system")
  ) {
    return {
      iconName: "activity",
      gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    };
  }
  if (
    lower.includes("settings") ||
    lower.includes("controlcenter") ||
    lower.includes("tweaks") ||
    lower.includes("dconf")
  ) {
    return {
      iconName: "settings",
      gradient: "from-slate-400 via-slate-600 to-zinc-800",
    };
  }
  return {
    iconName: "sparkles",
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
  };
}

export function matchAppFromWayland(
  desktopId: string,
  title: string
): AppDefinition {
  const lower = `${desktopId} ${title}`.toLowerCase();
  if (lower.includes("nautilus") || lower.includes("files")) {
    return APP_CATALOG.find((a) => a.id === "nautilus")!;
  }
  if (
    lower.includes("kitty") ||
    lower.includes("kgx") ||
    lower.includes("console") ||
    lower.includes("alacritty") ||
    lower.includes("foot") ||
    lower.includes("term")
  ) {
    return APP_CATALOG.find((a) => a.id === "terminal")!;
  }
  if (
    lower.includes("firefox") ||
    lower.includes("epiphany") ||
    lower.includes("chrom") ||
    lower.includes("browser")
  ) {
    return APP_CATALOG.find((a) => a.id === "browser")!;
  }
  const cleanFallback = (() => {
    const raw = (desktopId || title || "App").replace(/\.desktop$/i, "");
    if (raw.includes(".")) {
      const last = raw.split(".").pop() || raw;
      return last.charAt(0).toUpperCase() + last.slice(1);
    }
    return raw;
  })();

  return {
    id: desktopId || "wayland-app",
    name: title || cleanFallback || "Application",
    shortName: cleanFallback || "App",
    description: "Wayland Client Application",
    category: "Utilities",
    iconName: "sparkles",
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    pinnedByDefault: false,
    defaultSize: { width: 740, height: 480 },
    menus: [],
  };
}

export interface AppsContextValue {
  installedXdgApps: XdgDesktopEntry[];
  xdgUserDirs: XdgUserDir[];
  activeIconTheme: string;
  fallbackAppIconUrl: string | undefined;
  appGridIsSymbolic: boolean;
  dockIconsReady: boolean;
  getAppIconUrl: (appIdOrName: string | undefined) => string | undefined;
  ensureWaylandIcons: (ids: readonly string[]) => void;
  launchXdgEntry: (entry: XdgDesktopEntry, actionId?: string) => void;
  openXdgFolder: (folder: XdgUserDir) => void;
  refreshXdgApps: () => void;
}

export const AppsContext = React.createContext<AppsContextValue | null>(null);

const APP_GRID_ICON_CANDIDATES: readonly string[] = [
  "view-app-grid-symbolic",
  "view-app-grid",
  "view-grid-symbolic",
  "view-grid",
  "show-applications",
  "applications-all",
];

const SHELL_XDG_ICON_GROUPS: Record<string, readonly string[]> = {
  __user_trash__: ["user-trash", "trash-empty", "gnome-fs-trash-empty"],
  __user_trash_full__: [
    "user-trash-full",
    "trash-full",
    "gnome-fs-trash-full",
  ],
  __fallback_app__: [
    "application-x-executable",
    "system-run",
    "applications-other",
    "package-x-generic",
    "org.gnome.Console",
  ],
  "image-x-generic": ["image-x-generic", "gnome-mime-image"],
  "video-x-generic": ["video-x-generic", "gnome-mime-video"],
  "audio-x-generic": ["audio-x-generic", "gnome-mime-audio"],
  "application-pdf": ["application-pdf", "x-office-document"],
  "text-x-script": ["text-x-script"],
  "package-x-generic": ["package-x-generic", "application-x-archive"],
  "text-x-generic": ["text-x-generic"],
  "text-html": ["text-html"],
};

const ADWAITA_DIRECT_ICON_FALLBACKS: Record<string, readonly string[]> = {
  nautilus: [
    "/usr/share/icons/Adwaita/scalable/places/folder.svg",
    "/usr/share/icons/hicolor/scalable/apps/org.gnome.Nautilus.svg",
  ],
  settings: ["/usr/share/icons/hicolor/scalable/apps/piloti-settings.svg"],
  console: ["/usr/share/icons/hicolor/scalable/apps/org.gnome.DevTools.svg"],
  terminal: ["/usr/share/icons/hicolor/scalable/apps/piloti-terminal.svg"],
  browser: ["/usr/share/icons/Adwaita/scalable/mimetypes/text-html.svg"],
  "web-view": ["/usr/share/icons/Adwaita/scalable/mimetypes/text-html.svg"],
  "text-editor": [
    "/usr/share/icons/hicolor/scalable/apps/piloti-text-editor.svg",
  ],
  "app-store": [
    "/usr/share/icons/hicolor/scalable/apps/org.gnome.Software.svg",
  ],
  "image-x-generic": [
    "/usr/share/icons/Adwaita/scalable/mimetypes/image-x-generic.svg",
  ],
  "video-x-generic": [
    "/usr/share/icons/Adwaita/scalable/mimetypes/video-x-generic.svg",
  ],
  "audio-x-generic": [
    "/usr/share/icons/Adwaita/scalable/mimetypes/audio-x-generic.svg",
  ],
  "application-pdf": [
    "/usr/share/icons/Adwaita/scalable/mimetypes/application-pdf.svg",
  ],
  "text-x-script": [
    "/usr/share/icons/Adwaita/scalable/mimetypes/text-x-script.svg",
  ],
  "package-x-generic": [
    "/usr/share/icons/Adwaita/scalable/mimetypes/package-x-generic.svg",
  ],
  "text-x-generic": [
    "/usr/share/icons/Adwaita/scalable/mimetypes/text-x-generic.svg",
  ],
  "text-html": ["/usr/share/icons/Adwaita/scalable/mimetypes/text-html.svg"],
  __user_trash__: [
    "/usr/share/icons/Adwaita/scalable/places/user-trash.svg",
  ],
  __user_trash_full__: [
    "/usr/share/icons/Adwaita/scalable/status/user-trash-full.svg",
  ],
  __fallback_app__: [
    "/usr/share/icons/Adwaita/scalable/mimetypes/application-x-executable.svg",
  ],
};

async function resolveWithDirectAdwaitaFallback(
  files: Parameters<typeof resolveXdgIconUrl>[0],
  iconIndex: XdgIconThemeIndex,
  key: string,
  candidates: readonly string[]
): Promise<string | undefined> {
  const fromIndex = await resolveXdgIconUrl(files, iconIndex, candidates, 64, 1);
  if (fromIndex) return fromIndex;

  const directPaths = ADWAITA_DIRECT_ICON_FALLBACKS[key];
  if (!directPaths) return undefined;
  for (const directPath of directPaths) {
    const url = await loadXdgIconDataUrl(files, directPath);
    if (url) return url;
  }
  return undefined;
}

const DOCK_ICONS_CACHE_KEY = "piloti.dock-icons.v9";

interface DockIconsCachePayload {
  theme: string;
  appGridIsSymbolic: boolean;
  icons: Record<string, string>;
}

function loadCachedDockIcons(theme: string): DockIconsCachePayload | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DOCK_ICONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DockIconsCachePayload>;
    if (
      parsed.theme !== theme ||
      !parsed.icons ||
      typeof parsed.icons !== "object"
    ) {
      return null;
    }
    return {
      theme: parsed.theme,
      appGridIsSymbolic: Boolean(parsed.appGridIsSymbolic ?? true),
      icons: parsed.icons,
    };
  } catch {
    return null;
  }
}

function saveCachedDockIcons(payload: DockIconsCachePayload): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DOCK_ICONS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

export function useAppsValue(
  settingsCtx: SettingsContextValue,
  backendsCtx: SystemBackendsContextValue,
  onEssentialIconsReady?: () => void
): AppsContextValue {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings } = settingsCtx;
  const { gnomeIconThemeOverride } = backendsCtx;
  const onEssentialIconsReadyRef = React.useRef(onEssentialIconsReady);
  onEssentialIconsReadyRef.current = onEssentialIconsReady;

  const [portalIconTheme, setPortalIconTheme] = React.useState<string>("Adwaita");
  const activeIconTheme =
    settings.iconTheme || gnomeIconThemeOverride || portalIconTheme;

  const [installedXdgApps, setInstalledXdgApps] = React.useState<
    XdgDesktopEntry[]
  >([]);
  const [xdgUserDirs, setXdgUserDirs] = React.useState<XdgUserDir[]>([]);
  const [appIconsMap, setAppIconsMap] = React.useState<Record<string, string>>(
    {}
  );
  const [appGridIsSymbolic, setAppGridIsSymbolic] = React.useState(true);
  const [dockIconsReady, setDockIconsReady] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const refreshXdgApps = React.useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);
  const iconThemeIndexRef = React.useRef<XdgIconThemeIndex | null>(null);

  React.useEffect(() => {
    try {
      return watchIconTheme(domicile, (res) => {
        res.match({
          Ok: (opt) => {
            opt.match({
              Some: (themeName) => {
                if (themeName) setPortalIconTheme(themeName);
              },
              None: () => setPortalIconTheme("Adwaita"),
            });
          },
          Err: () => {},
        });
      });
    } catch {
      return undefined;
    }
  }, [domicile]);

  React.useEffect(() => {
    void refreshNonce;
    let cancelled = false;
    const preferredThemes = [activeIconTheme, "Adwaita", "hicolor"];
    const cachedIndex = loadCachedXdgIconThemeIndex(preferredThemes);
    iconThemeIndexRef.current = cachedIndex;

    let signaledReady = false;
    const signalEssentialReady = () => {
      if (signaledReady) return;
      signaledReady = true;
      setDockIconsReady(true);
      onEssentialIconsReadyRef.current?.();
    };

    // Hydrate Dock icons immediately from SWR cache on repeat boots only if
    // every pinned app already has a cached icon.
    const cachedDock = loadCachedDockIcons(activeIconTheme);
    const hasAllPinnedCached =
      cachedDock !== null &&
      settings.pinnedAppIds.every(
        (id) =>
          Boolean(cachedDock.icons[id]) ||
          Boolean(cachedDock.icons[id.replace(/\.desktop$/i, "")])
      );
    if (cachedDock && hasAllPinnedCached && Object.keys(cachedDock.icons).length > 0) {
      setAppGridIsSymbolic(cachedDock.appGridIsSymbolic);
      setAppIconsMap((prev) => ({ ...cachedDock.icons, ...prev }));
      logBootEvent(
        `dock hydrated from cache (${Object.keys(cachedDock.icons).length} icons, theme=${activeIconTheme})`
      );
      signalEssentialReady();
    }

    (async () => {
      const finishDock = startBootPhase("dock");
      try {
        // Resolve icon theme index + user-dirs first without contending with
        // full /usr/share/applications scanning or large wallpaper transfers.
        const finishIndex = startBootPhase("icon index + user-dirs");
        const iconIndexPromise = buildXdgIconThemeIndex(
          domicile.files,
          preferredThemes
        );
        const userDirsPromise = discoverXdgUserDirs(domicile.files);

        const [iconIndex, userDirs] = await Promise.all([
          iconIndexPromise,
          userDirsPromise,
        ]);
        if (cancelled) return;
        finishIndex(activeIconTheme);
        iconThemeIndexRef.current = iconIndex;
        saveCachedXdgIconThemeIndex(preferredThemes, iconIndex);
        setXdgUserDirs(userDirs);

        // Resolve all Dock, launcher, trash, fallback, and folder icons together
        // so the Dock slides in atomically with all icons already painted.
        const essentialIcons: Record<string, string> = {};
        let resolvedAppGridSymbolic = true;
        const pinnedSet = new Set(settings.pinnedAppIds);
        const prioritizedCatalog = [
          ...APP_CATALOG.filter((app) => pinnedSet.has(app.id)),
          ...APP_CATALOG.filter((app) => !pinnedSet.has(app.id)),
        ];

        const catalogIds = new Set(APP_CATALOG.map((app) => app.id));
        const customPinnedIds = settings.pinnedAppIds.filter(
          (id) => !catalogIds.has(id)
        );

        await Promise.all([
          ...prioritizedCatalog.map(async (app) => {
            const url = await resolveWithDirectAdwaitaFallback(
              domicile.files,
              iconIndex,
              app.id,
              app.xdgIcons ?? [app.id]
            );
            if (url) essentialIcons[app.id] = url;
          }),
          ...customPinnedIds.map(async (pinnedId) => {
            const cleanId = pinnedId.replace(/\.desktop$/i, "");
            const url = await resolveXdgIconUrl(
              domicile.files,
              iconIndex,
              [cleanId, cleanId.toLowerCase()],
              64,
              1
            );
            if (url) {
              essentialIcons[pinnedId] = url;
              essentialIcons[cleanId] = url;
            }
          }),
          ...Object.entries(SHELL_XDG_ICON_GROUPS).map(
            async ([key, candidates]) => {
              const url = await resolveWithDirectAdwaitaFallback(
                domicile.files,
                iconIndex,
                key,
                candidates
              );
              if (url) essentialIcons[key] = url;
            }
          ),
          (async () => {
            for (const candidate of APP_GRID_ICON_CANDIDATES) {
              const path = lookupXdgIconPath(iconIndex, candidate, 64, 1);
              if (!path) continue;
              const url = await loadXdgIconDataUrl(domicile.files, path);
              if (url) {
                essentialIcons.__app_grid__ = url;
                resolvedAppGridSymbolic =
                  path.includes("/symbolic/") ||
                  path.endsWith("-symbolic.svg");
                break;
              }
            }
          })(),
          ...userDirs.map(async (dir) => {
            const url = await resolveXdgIconUrl(
              domicile.files,
              iconIndex,
              dir.iconCandidates,
              48,
              1
            );
            if (url) essentialIcons[`folder:${dir.key}`] = url;
          }),
        ]);

        if (cancelled) return;
        setAppGridIsSymbolic(resolvedAppGridSymbolic);
        setAppIconsMap((prev) => ({ ...prev, ...essentialIcons }));
        saveCachedDockIcons({
          theme: activeIconTheme,
          appGridIsSymbolic: resolvedAppGridSymbolic,
          icons: essentialIcons,
        });
        finishDock(`${Object.keys(essentialIcons).length} icons`);
        signalEssentialReady();

        const finishXdgApps = startBootPhase("xdg apps");
        const apps = await discoverInstalledXdgApps(
          domicile.files,
          { iconThemes: preferredThemes, deferIconDataLoad: true },
          Promise.resolve(iconIndex)
        );
        if (cancelled) return;
        finishXdgApps(`${apps.length} entries`);
        setInstalledXdgApps(apps);

        // Prioritize pinned dock apps, then batch-load remaining app icons.
        const orderedApps = [
          ...apps.filter(
            (e) => pinnedSet.has(e.desktopId) || pinnedSet.has(e.appId)
          ),
          ...apps.filter(
            (e) => !pinnedSet.has(e.desktopId) && !pinnedSet.has(e.appId)
          ),
        ];

        const BATCH_SIZE = 16;
        const resolvedUrls = new Map<string, string>();
        for (let i = 0; i < orderedApps.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const chunk = orderedApps.slice(i, i + BATCH_SIZE);
          const batchIcons: Record<string, string> = {};
          await Promise.all(
            chunk.map(async (entry) => {
              if (!entry.iconPath) return;
              const url = await loadXdgIconDataUrl(domicile.files, entry.iconPath);
              if (!url) return;
              resolvedUrls.set(entry.desktopId, url);
              batchIcons[entry.desktopId] = url;
              batchIcons[entry.appId] = url;
              batchIcons[entry.appId.toLowerCase()] = url;
              if (entry.icon) {
                batchIcons[entry.icon] = url;
              }
            })
          );
          if (cancelled) return;
          if (Object.keys(batchIcons).length > 0) {
            setAppIconsMap((prev) => ({ ...prev, ...batchIcons }));
          }
        }

        if (!cancelled && resolvedUrls.size > 0) {
          setInstalledXdgApps((prev) =>
            prev.map((entry) => {
              const url = resolvedUrls.get(entry.desktopId);
              return url ? { ...entry, iconUrl: url } : entry;
            })
          );
        }
      } catch (err) {
        logBootEvent(
          `dock/apps load failed: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        if (!cancelled) signalEssentialReady();
      }
    })();

    return () => {
      cancelled = true;
    };
    // pinnedAppIds only affects icon batch ordering, not discovery
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domicile.files, activeIconTheme]);

  const ensureWaylandIcons = React.useCallback(
    (ids: readonly string[]) => {
      const iconIndex = iconThemeIndexRef.current;
      if (!iconIndex) return;

      for (const raw of ids) {
        const baseId = raw.replace(/\.desktop$/i, "");
        if (!baseId || appIconsMap[baseId] || appIconsMap[raw]) continue;

        resolveXdgIconUrl(domicile.files, iconIndex, [baseId, raw], 64, 1)
          .then((url) => {
            if (url) {
              setAppIconsMap((prev) => ({
                ...prev,
                [baseId]: url,
                [raw]: url,
              }));
            }
          })
          .catch(() => {});
      }
    },
    [appIconsMap, domicile.files]
  );

  const getAppIconUrl = React.useCallback(
    (appIdOrName: string | undefined): string | undefined => {
      if (!appIdOrName) return undefined;
      const clean = appIdOrName.replace(/\.desktop$/i, "");
      return (
        appIconsMap[appIdOrName] ??
        appIconsMap[clean] ??
        appIconsMap[clean.toLowerCase()]
      );
    },
    [appIconsMap]
  );

  const launchXdgEntry = React.useCallback(
    (entry: XdgDesktopEntry, actionId?: string) => {
      const action = actionId
        ? entry.actions.find((a) => a.id === actionId)
        : undefined;
      const argv =
        action && action.execArgv.length > 0 ? action.execArgv : entry.execArgv;

      if (argv.length > 0) {
        const finalArgv = entry.terminal ? ["kitty", "-e", ...argv] : argv;
        launchDesktopCommand(domicile, finalArgv, {
          cwd: isBrowserRuntime ? undefined : entry.workingDirectory,
        });
      }
    },
    [domicile, isBrowserRuntime]
  );

  const openXdgFolder = React.useCallback(
    (folder: XdgUserDir) => {
      launchDesktopCommand(
        domicile,
        buildOpenXdgFolderArgv(folder, isBrowserRuntime)
      );
    },
    [domicile, isBrowserRuntime]
  );

  const fallbackAppIconUrl = appIconsMap.__fallback_app__;

  return React.useMemo<AppsContextValue>(
    () => ({
      installedXdgApps,
      xdgUserDirs,
      activeIconTheme,
      fallbackAppIconUrl,
      appGridIsSymbolic,
      dockIconsReady,
      getAppIconUrl,
      ensureWaylandIcons,
      launchXdgEntry,
      openXdgFolder,
      refreshXdgApps,
    }),
    [
      activeIconTheme,
      appGridIsSymbolic,
      dockIconsReady,
      ensureWaylandIcons,
      fallbackAppIconUrl,
      getAppIconUrl,
      installedXdgApps,
      launchXdgEntry,
      openXdgFolder,
      refreshXdgApps,
      xdgUserDirs,
    ]
  );
}

export function useOptionalApps() {
  return React.useContext(AppsContext);
}

export function useApps() {
  const ctx = React.useContext(AppsContext);
  if (!ctx) {
    throw new Error("useApps must be used within DesktopStateProvider");
  }
  return ctx;
}

export { resolveXdgVisualStyle };

