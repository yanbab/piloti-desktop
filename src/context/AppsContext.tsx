import { hostFiles } from "@/lib/engine/host-files";
import * as React from "react";
import { retainVfsWatch } from "@/lib/engine/vfs-query";
import { usePiloti } from "@/lib/engine/piloti";
import { watchIconTheme } from "@domicile-desktop/sdk/icon-theme";
import {
  resolveUiAccentHex,
  APP_CATALOG,
  type AppDefinition,
} from "@/data/catalog";
import { launchDesktopCommand, readApplicationDirs } from "@/lib/engine-native";
import { getEngine } from "@/lib/engine/engine";
import { XDG_APPLICATION_DIRS } from "@/lib/xdg/xdg-basedir";
import { setSymbolicIconResolver } from "@/lib/shell/symbolic-icons";
import {
  APP_GRID_ICON_CANDIDATES,
  SHELL_XDG_ICON_GROUPS,
} from "@/lib/shell/shell-icon-names";
import {
  DEFAULT_ICON_ACCENT_CONFIG,
  iconAccentConfigFromIndex,
  markInheritedAccentIcon,
  tintIconDataUrl,
  type IconAccentConfig,
} from "@/lib/shell/icon-accent-tint";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";
import { logBootEvent, startBootPhase } from "@/lib/core/perf-log";
import {
  discoverInstalledXdgApps,
  type XdgDesktopEntry,
} from "xdg-desktop-entry";
import {
  buildXdgIconThemeIndex,
  loadCachedXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
  lookupXdgSymbolicIconPath,
  saveCachedXdgIconThemeIndex,
  type XdgIconThemeIndex,
} from "xdg-icon-theme";
import {
  buildOpenXdgFolderArgv,
  discoverXdgUserDirs,
  type XdgUserDir,
} from "@/lib/xdg/xdg-user-dirs";
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
    };
  }
  if (
    lower.includes("monitor") ||
    lower.includes("htop") ||
    lower.includes("system")
  ) {
    return {
      iconName: "activity",
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
    };
  }
  return {
    iconName: "sparkles",
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
  /** The app's `<icon>-symbolic` icon from the icon theme, if there is one. */
  loadSymbolicAppIcon: (appId: string) => Promise<string | undefined>;
  /** Runs the entry's command, with `files` as arguments. No launch feedback: see `WindowsContext`. */
  launchXdgEntry: (entry: XdgDesktopEntry, actionId?: string, files?: readonly string[]) => void;
  openXdgFolder: (folder: XdgUserDir) => void;
  refreshXdgApps: () => void;
}

export const AppsContext = React.createContext<AppsContextValue | null>(null);

/** Loads an icon file, marking inherited icons the theme says follow the accent. */
async function loadThemedIconUrl(
  files: Parameters<typeof loadXdgIconDataUrl>[0],
  iconIndex: XdgIconThemeIndex,
  path: string
): Promise<string | undefined> {
  const url = await loadXdgIconDataUrl(files, path);
  return markInheritedAccentIcon(url, path, iconAccentConfigFromIndex(iconIndex));
}

/** Resolves the first candidate name found in the icon theme chain. */
async function resolveThemedIconUrl(
  files: Parameters<typeof loadXdgIconDataUrl>[0],
  iconIndex: XdgIconThemeIndex,
  candidates: readonly string[],
  size = 64
): Promise<string | undefined> {
  const path = lookupXdgIconPath(iconIndex, candidates, size, 1);
  return path ? loadThemedIconUrl(files, iconIndex, path) : undefined;
}

const DOCK_ICONS_CACHE_KEY = "piloti.dock-icons.v21";
// Bump when icon resolution or accent marking changes, so cached icons and
// icon paths from an older build are not reused.
const ICON_CACHE_VERSION = 4;

interface DockIconsCachePayload {
  v?: number;
  theme: string;
  appGridIsSymbolic: boolean;
  icons: Record<string, string>;
}

function loadCachedDockIcons(theme: string): DockIconsCachePayload | null {
  try {
    const parsed = readVfsStateJson<Partial<DockIconsCachePayload>>(
      VFS_STATE_PATHS.dockIconsCache,
      DOCK_ICONS_CACHE_KEY,
    );
    if (
      !parsed ||
      parsed.v !== ICON_CACHE_VERSION ||
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
  try {
    // Icons resolve in parallel: sorted, an unchanged cache is not rewritten.
    const icons = Object.fromEntries(
      Object.entries(payload.icons).sort(([a], [b]) => (a < b ? -1 : 1))
    );
    writeVfsStateJson(
      VFS_STATE_PATHS.dockIconsCache,
      { ...payload, icons, v: ICON_CACHE_VERSION },
      false
    );
  } catch {
    // ignore storage quota errors
  }
}

interface XdgAppsCachePayload {
  v: typeof ICON_CACHE_VERSION;
  theme: string;
  entries: XdgDesktopEntry[];
}

function loadCachedXdgApps(theme: string): XdgDesktopEntry[] | null {
  try {
    const parsed = readVfsStateJson<Partial<XdgAppsCachePayload>>(
      VFS_STATE_PATHS.xdgAppsCache,
    );
    if (
      !parsed ||
      parsed.v !== ICON_CACHE_VERSION ||
      parsed.theme !== theme ||
      !Array.isArray(parsed.entries) ||
      parsed.entries.length === 0
    ) {
      return null;
    }
    return parsed.entries;
  } catch {
    return null;
  }
}

function saveCachedXdgApps(theme: string, entries: XdgDesktopEntry[]): void {
  try {
    // Strip data-URL icon blobs from the persistent apps cache so it stays small (~35 KB)
    const compactEntries = entries.map((entry) => {
      if (!entry.iconUrl) return entry;
      const { iconUrl: _omit, ...rest } = entry;
      return rest as XdgDesktopEntry;
    });
    writeVfsStateJson(
      VFS_STATE_PATHS.xdgAppsCache,
      { v: ICON_CACHE_VERSION, theme, entries: compactEntries } satisfies XdgAppsCachePayload,
      false,
    );
  } catch {
    // ignore storage quota errors
  }
}

export function useAppsValue(
  settingsCtx: SettingsContextValue,
  backendsCtx: SystemBackendsContextValue,
  onEssentialIconsReady?: () => void
): AppsContextValue {
  const piloti = usePiloti();
  const { isBrowserRuntime, settings } = settingsCtx;  // FIXME : Capabilities
  const { gnomeIconThemeOverride } = backendsCtx;
  const onEssentialIconsReadyRef = React.useRef(onEssentialIconsReady);
  onEssentialIconsReadyRef.current = onEssentialIconsReady;

  const [portalIconTheme, setPortalIconTheme] = React.useState<string>("Piloti");
  const activeIconTheme =
    settings.interfaceTheme === "adwaita"
      ? "Adwaita"
      : settings.iconTheme &&
          settings.iconTheme !== "Papirus" &&
          settings.iconTheme !== "Adwaita"
        ? settings.iconTheme
        : gnomeIconThemeOverride &&
            gnomeIconThemeOverride !== "Papirus" &&
            gnomeIconThemeOverride !== "Adwaita"
          ? gnomeIconThemeOverride
          : portalIconTheme !== "Papirus" && portalIconTheme !== "Adwaita"
            ? portalIconTheme
            : "Piloti";

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
  // The same index as state, for lookups that must rerun when it changes.
  const [iconIndexState, setIconIndexState] = React.useState<XdgIconThemeIndex | null>(null);
  // The session's XDG_DATA_DIRS does not change while the shell runs.
  const appDirsPromiseRef = React.useRef<Promise<readonly string[]> | null>(null);
  const readAppDirs = React.useCallback(
    () =>
      (appDirsPromiseRef.current ??= getEngine().capabilities.systemServices
        ? readApplicationDirs(piloti)
        : Promise.resolve(XDG_APPLICATION_DIRS)),
    [piloti],
  );
  // Shade math from the icon theme's `[X-Piloti Accent]` group.
  const [iconAccentConfig, setIconAccentConfig] = React.useState<IconAccentConfig>(
    DEFAULT_ICON_ACCENT_CONFIG
  );
  const attemptedIconIdsRef = React.useRef<Set<string>>(new Set());

  // The shell's own symbolic icons; Cupertino keeps its glyphs.
  const themedSymbols = settings.interfaceTheme !== "cupertino";
  React.useLayoutEffect(() => {
    void setSymbolicIconResolver(
      !themedSymbols
        ? null
        : !iconIndexState
          ? "loading"
          : async (candidates) => {
              const path = lookupXdgSymbolicIconPath(iconIndexState, candidates);
              return path ? loadXdgIconDataUrl(hostFiles(piloti), path) : undefined;
            }
    );
  }, [themedSymbols, iconIndexState, piloti]);

  React.useEffect(() => {
    attemptedIconIdsRef.current.clear();
  }, [activeIconTheme]);

  React.useEffect(() => {
    try {
      return watchIconTheme(piloti, (res) => {
        res.match({
          Ok: (opt) => {
            opt.match({
              Some: (themeName) => {
                if (themeName) setPortalIconTheme(themeName);
              },
              None: () => setPortalIconTheme("Piloti"),
            });
          },
          Err: () => { },
        });
      });
    } catch {
      return undefined;
    }
  }, [piloti]);

  React.useEffect(() => {
    void refreshNonce;
    let cancelled = false;
    const preferredThemes =
      activeIconTheme === "Adwaita"
        ? ["Adwaita", "hicolor"]
        : [activeIconTheme, "Adwaita", "hicolor"];
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

    let bgIndexTimer: ReturnType<typeof setTimeout> | null = null;
    let bgAppsTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const finishDock = startBootPhase("dock");
      try {
        // Resolve icon theme index + user-dirs first without contending with
        // full /usr/share/applications scanning or large wallpaper transfers.
        // On repeat boots (refreshNonce === 0) with a valid cached index, use
        // it immediately and refresh the index lazily in the background.
        const finishIndex = startBootPhase("icon index + user-dirs");
        // A refresh (the Launcher opening) only rescans applications: the icon index is reused
        // as cached, and is rebuilt in the background at startup only.
        const useWarmCachedIndex = Boolean(cachedIndex);
        const iconIndexPromise = useWarmCachedIndex
          ? Promise.resolve(cachedIndex!)
          : buildXdgIconThemeIndex(hostFiles(piloti), preferredThemes);
        // Published at once: the desktop waits for it to know which folder to list.
        const userDirsPromise = discoverXdgUserDirs(hostFiles(piloti)).then((dirs) => {
          if (!cancelled) setXdgUserDirs(dirs);
          return dirs;
        });

        const [iconIndex, userDirs] = await Promise.all([
          iconIndexPromise,
          userDirsPromise,
        ]);
        if (cancelled) return;
        finishIndex(useWarmCachedIndex ? `${activeIconTheme} (cached)` : activeIconTheme);
        iconThemeIndexRef.current = iconIndex;
        setIconIndexState(iconIndex);
        setIconAccentConfig(iconAccentConfigFromIndex(iconIndex));
        if (!useWarmCachedIndex) {
          saveCachedXdgIconThemeIndex(preferredThemes, iconIndex);
        } else if (refreshNonce === 0) {
          bgIndexTimer = setTimeout(() => {
            if (cancelled) return;
            void buildXdgIconThemeIndex(hostFiles(piloti), preferredThemes)
              .then((fresh) => {
                if (cancelled) return;
                iconThemeIndexRef.current = fresh;
                setIconIndexState(fresh);
                saveCachedXdgIconThemeIndex(preferredThemes, fresh);
              })
              .catch(() => undefined);
          }, 4000);
        }

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
            const url = await resolveThemedIconUrl(
              hostFiles(piloti),
              iconIndex,
              app.xdgIcons ?? [app.id]
            );
            if (url) essentialIcons[app.id] = url;
          }),
          ...customPinnedIds.map(async (pinnedId) => {
            const cleanId = pinnedId.replace(/\.desktop$/i, "");
            const url = await resolveThemedIconUrl(
              hostFiles(piloti),
              iconIndex,
              [cleanId, cleanId.toLowerCase()]
            );
            if (url) {
              essentialIcons[pinnedId] = url;
              essentialIcons[cleanId] = url;
            }
          }),
          ...Object.entries(SHELL_XDG_ICON_GROUPS).map(
            async ([key, candidates]) => {
              const url = await resolveThemedIconUrl(
                hostFiles(piloti),
                iconIndex,
                candidates
              );
              if (url) essentialIcons[key] = url;
            }
          ),
          (async () => {
            for (const candidate of APP_GRID_ICON_CANDIDATES) {
              const path = lookupXdgIconPath(iconIndex, candidate, 64, 1);
              if (!path) continue;
              const url = await loadXdgIconDataUrl(hostFiles(piloti), path);
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
            const url = await resolveThemedIconUrl(
              hostFiles(piloti),
              iconIndex,
              dir.iconCandidates,
              48
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
        const cachedApps =
          refreshNonce === 0 ? loadCachedXdgApps(activeIconTheme) : null;
        const useWarmCachedApps = Boolean(cachedApps && cachedApps.length > 0);
        const apps = useWarmCachedApps
          ? cachedApps!
          : await discoverInstalledXdgApps(
              hostFiles(piloti),
              { iconThemes: preferredThemes, deferIconDataLoad: true, applicationDirs: await readAppDirs() },
              Promise.resolve(iconIndex)
            );
        if (cancelled) return;
        finishXdgApps(
          useWarmCachedApps ? `${apps.length} entries (cached)` : `${apps.length} entries`
        );
        setInstalledXdgApps(apps);
        if (!useWarmCachedApps) {
          saveCachedXdgApps(activeIconTheme, apps);
        }

        const loadIconsForApps = async (targetApps: XdgDesktopEntry[]) => {
          // Prioritize pinned dock apps, then batch-load remaining app icons.
          const orderedApps = [
            ...targetApps.filter(
              (e) => pinnedSet.has(e.desktopId) || pinnedSet.has(e.appId)
            ),
            ...targetApps.filter(
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
                if (!entry.iconPath) {
                  if (entry.icon && /^https?:\/\//i.test(entry.icon)) {
                    resolvedUrls.set(entry.desktopId, entry.icon);
                    batchIcons[entry.desktopId] = entry.icon;
                    batchIcons[entry.appId] = entry.icon;
                    batchIcons[entry.appId.toLowerCase()] = entry.icon;
                  }
                  return;
                }
                const url = await loadThemedIconUrl(
                  hostFiles(piloti),
                  iconIndex,
                  entry.iconPath
                );
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
        };

        await loadIconsForApps(apps);

        // Background SWR refresh when hydrated from cached XDG apps
        if (useWarmCachedApps && !cancelled) {
          bgAppsTimer = setTimeout(async () => {
            const applicationDirs = await readAppDirs();
            if (cancelled) return;
            const activeIdx = iconThemeIndexRef.current ?? iconIndex;
            void discoverInstalledXdgApps(
              hostFiles(piloti),
              { iconThemes: preferredThemes, deferIconDataLoad: true, applicationDirs },
              Promise.resolve(activeIdx)
            )
              .then(async (freshApps) => {
                if (cancelled) return;
                saveCachedXdgApps(activeIconTheme, freshApps);
                setInstalledXdgApps(freshApps);
                await loadIconsForApps(freshApps);
              })
              .catch(() => undefined);
          }, 4500);
        }
      } catch (err) {
        // No icon index: the shell's own glyphs rather than empty boxes.
        if (!iconThemeIndexRef.current) void setSymbolicIconResolver(null);
        logBootEvent(
          `dock/apps load failed: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        if (!cancelled) signalEssentialReady();
      }
    })();

    return () => {
      cancelled = true;
      if (bgIndexTimer) clearTimeout(bgIndexTimer);
      if (bgAppsTimer) clearTimeout(bgAppsTimer);
    };
    // pinnedAppIds only affects icon batch ordering, not discovery
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piloti, activeIconTheme, refreshNonce]);

  // Watch XDG application directories so newly installed apps appear without restarting the shell
  React.useEffect(() => {
    if (isBrowserRuntime) return;  // FIXME : Capabilities
    let stopped = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const stopFns: Array<() => void> = [];

    const scheduleRefresh = () => {
      if (stopped) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!stopped) refreshXdgApps();
      }, 400);
    };

    // Shared watches (one per folder for the whole shell); the first call only
    // says the watch is in place. Only folders that exist: a missing one would
    // watch its parent (one more inotify instance) for a folder that rarely
    // appears while the session runs.
    void readAppDirs().then(async (appDirs) => {
      const existing = (
        await Promise.all(
          appDirs.map(async (dir) =>
            (await piloti.vfs.stat(dir).catch(() => null))?.kind === "directory" ? dir : null,
          ),
        )
      ).filter((dir): dir is string => dir !== null);
      if (stopped) return;
      for (const dir of existing) {
        stopFns.push(
          retainVfsWatch(piloti.vfs, dir, (initial) => {
            if (!initial) scheduleRefresh();
          }),
        );
      }
    });

    return () => {
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      for (const stop of stopFns) stop();
    };
  }, [piloti, isBrowserRuntime, refreshXdgApps, readAppDirs]);  // FIXME : Capabilities

  const ensureWaylandIcons = React.useCallback(
    (ids: readonly string[]) => {
      const iconIndex = iconThemeIndexRef.current;
      if (!iconIndex) return;

      const pending: Array<{ baseId: string; raw: string }> = [];
      for (const raw of ids) {
        const baseId = raw.replace(/\.desktop$/i, "");
        if (
          !baseId ||
          appIconsMap[baseId] ||
          appIconsMap[raw] ||
          attemptedIconIdsRef.current.has(baseId)
        ) {
          continue;
        }
        attemptedIconIdsRef.current.add(baseId);
        pending.push({ baseId, raw });
      }
      if (pending.length === 0) return;

      void Promise.all(
        pending.map(async ({ baseId, raw }) => {
          try {
            const url = await resolveThemedIconUrl(
              hostFiles(piloti),
              iconIndex,
              [baseId, raw]
            );
            return url ? { baseId, raw, url } : null;
          } catch {
            return null;
          }
        })
      ).then((results) => {
        const updates: Record<string, string> = {};
        for (const res of results) {
          if (!res) continue;
          updates[res.baseId] = res.url;
          updates[res.raw] = res.url;
        }
        if (Object.keys(updates).length > 0) {
          setAppIconsMap((prev) => ({ ...prev, ...updates }));
        }
      });
    },
    [activeIconTheme, appIconsMap, piloti]
  );

  // Icons use the UI accent (same shade as selections and sidebar items),
  // not the brighter swatch hex.
  const activeAccentHex = React.useMemo(
    () =>
      resolveUiAccentHex(
        settings.accentColor,
        settings.customAccentHex,
        settings.interfaceTheme
      ),
    [settings.accentColor, settings.customAccentHex, settings.interfaceTheme]
  );

  // Only icons with accent markers change; the others come back as is.
  const tintedAppIconsMap = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, url] of Object.entries(appIconsMap)) {
      out[k] = tintIconDataUrl(url, activeAccentHex, iconAccentConfig) ?? url;
    }
    return out;
  }, [activeAccentHex, appIconsMap, iconAccentConfig]);

  const tintedInstalledXdgApps = React.useMemo(
    () =>
      installedXdgApps.map((entry) => {
        const iconUrl = tintIconDataUrl(entry.iconUrl, activeAccentHex, iconAccentConfig);
        return iconUrl === entry.iconUrl ? entry : { ...entry, iconUrl };
      }),
    [activeAccentHex, installedXdgApps, iconAccentConfig]
  );

  const getAppIconUrl = React.useCallback(
    (appIdOrName: string | undefined): string | undefined => {
      if (!appIdOrName) return undefined;
      const clean = appIdOrName.replace(/\.desktop$/i, "");
      return (
        tintedAppIconsMap[appIdOrName] ??
        tintedAppIconsMap[clean] ??
        tintedAppIconsMap[clean.toLowerCase()]
      );
    },
    [tintedAppIconsMap]
  );

  const loadSymbolicAppIcon = React.useCallback(
    async (appId: string) => {
      if (!iconIndexState) return undefined;
      const entry = installedXdgApps.find(
        (e) => e.appId === appId || e.desktopId === appId
      );
      const names =
        APP_CATALOG.find((a) => a.id === appId)?.xdgIcons ??
        [entry?.icon, appId].filter((n): n is string => Boolean(n));
      const path = lookupXdgSymbolicIconPath(iconIndexState, names);
      return path ? loadXdgIconDataUrl(hostFiles(piloti), path) : undefined;
    },
    [iconIndexState, installedXdgApps, piloti]
  );

  const launchXdgEntry = React.useCallback(
    (entry: XdgDesktopEntry, actionId?: string, files: readonly string[] = []) => {
      const action = actionId
        ? entry.actions.find((a) => a.id === actionId)
        : undefined;
      const argv =
        action && action.execArgv.length > 0 ? action.execArgv : entry.execArgv;

      if (argv.length > 0) {
        const fullArgv = [...argv, ...files];
        const finalArgv = entry.terminal ? ["kitty", "-e", ...fullArgv] : fullArgv;
        launchDesktopCommand(piloti, finalArgv, {
          cwd: isBrowserRuntime ? undefined : entry.workingDirectory,  // FIXME : Capabilities
        });
      }
    },
    [piloti, isBrowserRuntime]  // FIXME : Capabilities
  );

  const openXdgFolder = React.useCallback(
    (folder: XdgUserDir) => {
      launchDesktopCommand(
        piloti,
        buildOpenXdgFolderArgv(folder, isBrowserRuntime)  // FIXME : Capabilities
      );
    },
    [piloti, isBrowserRuntime]  // FIXME : Capabilities
  );

  const fallbackAppIconUrl = tintedAppIconsMap.__fallback_app__;

  return React.useMemo<AppsContextValue>(
    () => ({
      installedXdgApps: tintedInstalledXdgApps,
      xdgUserDirs,
      activeIconTheme,
      fallbackAppIconUrl,
      appGridIsSymbolic,
      dockIconsReady,
      getAppIconUrl,
      ensureWaylandIcons,
      loadSymbolicAppIcon,
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
      loadSymbolicAppIcon,
      tintedInstalledXdgApps,
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

