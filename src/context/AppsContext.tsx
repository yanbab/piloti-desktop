import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { watchIconTheme } from "@domicile-desktop/sdk/icon-theme";
import {
  ACCENT_COLORS,
  APP_CATALOG,
  type AppDefinition,
} from "@/data/catalog";
import { launchDesktopCommand } from "@/lib/gnome-bridge";
import { tintIconDataUrl } from "@/lib/icon-accent-tint";
import { PAPIRUS_VIRTUAL_ICONS } from "@/lib/papirus-virtual-icons";
import { PILOTI_VIRTUAL_ICONS } from "@/lib/piloti-virtual-icons";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/vfs-state";
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
  "view-app-grid",
  "show-applications",
  "applications-all",
  "view-app-grid-symbolic",
  "view-grid-symbolic",
  "view-grid",
];

const SHELL_XDG_ICON_GROUPS: Record<string, readonly string[]> = {
  folder: ["folder", "inode-directory"],
  "folder-open": ["folder-open", "folder"],
  __user_trash__: ["user-trash", "trash-empty", "gnome-fs-trash-empty"],
  __user_trash_full__: [
    "user-trash-full",
    "trash-full",
    "gnome-fs-trash-full",
  ],
  __usb_drive__: [
    "drive-removable-media-usb",
    "drive-removable-media",
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
  "application-x-zerosize": [
    "application-x-zerosize",
    "text-x-generic-empty",
    "text-x-generic",
  ],
  "text-x-markdown": ["text-x-markdown", "text-markdown"],
  "text-html": ["text-html"],
};

const PAPIRUS_DIRECT_ICON_FALLBACKS: Record<string, readonly string[]> = {
  nautilus: [
    "/usr/share/icons/Papirus/64x64/apps/system-file-manager.svg",
    "/usr/share/icons/Papirus/64x64/places/folder.svg",
  ],
  "folder-open": [
    "/usr/share/icons/Papirus/64x64/places/folder-open.svg",
    "/usr/share/icons/Papirus/64x64/places/folder.svg",
  ],
  settings: [
    "/usr/share/icons/Papirus/64x64/apps/preferences-desktop.svg",
    "/usr/share/icons/Papirus/64x64/apps/preferences-system.svg",
  ],
  console: [
    "/usr/share/icons/Papirus/64x64/apps/piloti-console.svg",
    "/usr/share/icons/Papirus/64x64/apps/utilities-terminal.svg",
  ],
  terminal: ["/usr/share/icons/Papirus/64x64/apps/utilities-terminal.svg"],
  browser: ["/usr/share/icons/Papirus/64x64/apps/internet-web-browser.svg"],
  "web-view": ["/usr/share/icons/Papirus/64x64/apps/internet-web-browser.svg"],
  "text-editor": [
    "/usr/share/icons/Papirus/64x64/apps/accessories-text-editor.svg",
  ],
  "app-store": [
    "/usr/share/icons/Papirus/64x64/apps/system-software-install.svg",
  ],
  calculator: [
    "/usr/share/icons/Papirus/64x64/apps/accessories-calculator.svg",
  ],
  "image-viewer": [
    "/usr/share/icons/Papirus/64x64/apps/org.gnome.Loupe.svg",
    "/usr/share/icons/Papirus/64x64/apps/multimedia-photo-viewer.svg",
  ],
  "login-screen": [
    "/usr/share/icons/Papirus/64x64/apps/system-users.svg",
  ],
  "image-x-generic": [
    "/usr/share/icons/Papirus/64x64/mimetypes/image-x-generic.svg",
  ],
  "video-x-generic": [
    "/usr/share/icons/Papirus/64x64/mimetypes/video-x-generic.svg",
  ],
  "audio-x-generic": [
    "/usr/share/icons/Papirus/64x64/mimetypes/audio-x-generic.svg",
  ],
  "application-pdf": [
    "/usr/share/icons/Papirus/64x64/mimetypes/application-pdf.svg",
  ],
  "text-x-script": [
    "/usr/share/icons/Papirus/64x64/mimetypes/text-x-script.svg",
  ],
  "text-x-markdown": [
    "/usr/share/icons/Papirus/64x64/mimetypes/text-x-markdown.svg",
  ],
  "package-x-generic": [
    "/usr/share/icons/Papirus/64x64/mimetypes/package-x-generic.svg",
  ],
  "text-x-generic": [
    "/usr/share/icons/Papirus/64x64/mimetypes/text-x-generic.svg",
  ],
  "application-x-zerosize": [
    "/usr/share/icons/Papirus/64x64/mimetypes/application-x-zerosize.svg",
    "/usr/share/icons/Papirus/64x64/mimetypes/text-x-generic.svg",
  ],
  "text-html": ["/usr/share/icons/Papirus/64x64/mimetypes/text-html.svg"],
  __user_trash__: [
    "/usr/share/icons/Papirus/64x64/places/user-trash.svg",
  ],
  __user_trash_full__: [
    "/usr/share/icons/Papirus/64x64/status/user-trash-full.svg",
  ],
  __usb_drive__: [
    "/usr/share/icons/Papirus/64x64/devices/drive-removable-media-usb.svg",
    "/usr/share/icons/Papirus/64x64/devices/drive-removable-media.svg",
  ],
  __fallback_app__: [
    "/usr/share/icons/Papirus/64x64/mimetypes/application-x-executable.svg",
  ],
};

async function resolveWithDirectAdwaitaFallback(
  files: Parameters<typeof resolveXdgIconUrl>[0],
  iconIndex: XdgIconThemeIndex,
  key: string,
  candidates: readonly string[],
  allowPapirusFallback = true
): Promise<string | undefined> {
  const fromIndex = await resolveXdgIconUrl(files, iconIndex, candidates, 64, 1);
  if (fromIndex) return fromIndex;
  if (!allowPapirusFallback) return undefined;

  const directPaths = PAPIRUS_DIRECT_ICON_FALLBACKS[key];
  if (!directPaths) return undefined;
  for (const directPath of directPaths) {
    const url = await loadXdgIconDataUrl(files, directPath);
    if (url) return url;
    const bundledJson = PILOTI_VIRTUAL_ICONS[directPath];
    if (bundledJson) {
      return `data:application/json;charset=utf-8,${encodeURIComponent(bundledJson)}`;
    }
    const bundledSvg = PAPIRUS_VIRTUAL_ICONS[directPath];
    if (bundledSvg) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bundledSvg)}`;
    }
  }
  return undefined;
}

const DOCK_ICONS_CACHE_KEY = "piloti.dock-icons.v19";

interface DockIconsCachePayload {
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
    writeVfsStateJson(VFS_STATE_PATHS.dockIconsCache, payload, false);
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
  const attemptedIconIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    attemptedIconIdsRef.current.clear();
  }, [activeIconTheme]);

  React.useEffect(() => {
    try {
      return watchIconTheme(domicile, (res) => {
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
  }, [domicile]);

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
              app.xdgIcons ?? [app.id],
              activeIconTheme !== "Adwaita"
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
                candidates,
                activeIconTheme !== "Adwaita"
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
              if (!entry.iconPath) {
                if (entry.icon && /^https?:\/\//i.test(entry.icon)) {
                  resolvedUrls.set(entry.desktopId, entry.icon);
                  batchIcons[entry.desktopId] = entry.icon;
                  batchIcons[entry.appId] = entry.icon;
                  batchIcons[entry.appId.toLowerCase()] = entry.icon;
                }
                return;
              }
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
  }, [domicile.files, activeIconTheme, refreshNonce]);

  // Watch XDG application directories so newly installed apps appear without restarting the shell
  React.useEffect(() => {
    if (isBrowserRuntime) return;
    let stopped = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const stopFns: Array<() => void> = [];
    const appDirs = [
      ".local/share/applications",
      "/usr/share/applications",
      "/usr/local/share/applications",
      "/var/lib/flatpak/exports/share/applications",
      ".local/share/flatpak/exports/share/applications",
    ];

    const scheduleRefresh = () => {
      if (stopped) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!stopped) refreshXdgApps();
      }, 400);
    };

    for (const dir of appDirs) {
      void domicile.files
        .watch(dir)
        .then((res) => {
          res.match({
            Ok: async (listening) => {
              if (stopped) {
                listening.stop();
                return;
              }
              stopFns.push(() => listening.stop());
              const reader = listening.items.getReader();
              while (!stopped) {
                const next = await reader.read();
                if (next.done) break;
                scheduleRefresh();
              }
            },
            Err: () => undefined,
          });
        })
        .catch(() => undefined);
    }

    return () => {
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      for (const stop of stopFns) stop();
    };
  }, [domicile.files, isBrowserRuntime, refreshXdgApps]);

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
            const url = await resolveWithDirectAdwaitaFallback(
              domicile.files,
              iconIndex,
              baseId,
              [baseId, raw],
              activeIconTheme !== "Adwaita"
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
    [activeIconTheme, appIconsMap, domicile.files]
  );

  const activeAccentHex = React.useMemo(() => {
    const custom = settings.customAccentHex?.trim();
    if (custom && /^#[0-9a-fA-F]{6}$/.test(custom)) {
      return custom;
    }
    return (
      ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.hex ?? "#2190a4"
    );
  }, [settings.accentColor, settings.customAccentHex]);

  const tintedAppIconsMap = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, url] of Object.entries(appIconsMap)) {
      out[k] = tintIconDataUrl(url, activeAccentHex) ?? url;
    }
    return out;
  }, [activeAccentHex, appIconsMap]);

  const tintedInstalledXdgApps = React.useMemo(
    () =>
      installedXdgApps.map((entry) =>
        entry.iconUrl
          ? {
              ...entry,
              iconUrl: tintIconDataUrl(entry.iconUrl, activeAccentHex) ?? entry.iconUrl,
            }
          : entry
      ),
    [activeAccentHex, installedXdgApps]
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

