import { webSearchUrl } from "@/lib/core/web-search";
import { isWebEngine } from "@/lib/engine/engine";
import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { countRender } from "@/lib/core/render-stats";
import { LayersIcon, LayoutTemplateIcon } from "lucide-react";
import { BellRingIcon, CalculatorIcon, CameraIcon, Columns2Icon, GlobeIcon, LockIcon, Maximize2Icon, MoonIcon, PaletteIcon, SettingsIcon, PuzzleIcon, SunIcon, VideoIcon, Volume2Icon, VolumeXIcon } from "@/components/ui/symbols";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  useApps,
  useSystemBackends,
  type DesktopWindowInstance,
  useWindowActions,
  useWindowManagerSelector,
  useDesktopSettings,
  useUpdateSettings,
} from "@/context/DesktopStateContext";
import { usePlugins } from "@/context/PluginsContext";
import { APP_CATALOG, isBuiltinAppEntry } from "@/data/catalog";
import {
  canonicalizeWebUrl,
  getWebAppFaviconUrl,
  resolveWebAppTitle,
} from "@/data/web-apps";
import { isAppSearchEnabled } from "@/lib/core/app-permissions";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { evaluateLauncherMath } from "@/shell/launcher/launcher-math";
import { captureLaunchOriginFromElement } from "@/lib/windows/launch-origin";
import {
  loadWorkspaceSnapshots,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from "@/shell/launcher/workspace-snapshots";
import {
  floatingBounds,
  floatingDragPosition,
  settleFloatingPosition,
} from "@/lib/windows/floating-window";
import { settleSurface } from "@/lib/dnd/drag-feedback";
import { startPointerDrag } from "@/lib/dnd/pointer-drag";

/** Height of the menu bar above the floating area. */
const MENU_BAR_HEIGHT = 30;
import { consumeLegacyLocalStorageValue } from "@/lib/engine/vfs-state";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";
import { AppSquircleIcon } from "@/components/common/AppSymbol";

const RECENT_LAUNCHES_KEY = "piloti.launcher.recent.v1";
const LEGACY_RECENT_LAUNCHES_KEY = "piloti.command-palette.recent.v1";
const MAX_RECENT_LAUNCHES = 6;
const QUERY_HISTORY_KEY = "piloti.launcher.query-history.v1";
const LAUNCHER_HEIGHT_KEY = "piloti.launcher.height.v1";
const LAUNCHER_OFFSET_KEY = "piloti.launcher.offset.v1";
const MAX_QUERY_HISTORY = 20;

interface LauncherPersistedState {
  queryHistory?: string[];
  recentLaunches?: string[];
  height?: number;
  offset?: { x: number; y: number };
}

function readLauncherState(): LauncherPersistedState {
  const fromVfs = readVfsStateJson<LauncherPersistedState>(
    VFS_STATE_PATHS.launcher
  );
  if (fromVfs && typeof fromVfs === "object") {
    return fromVfs;
  }
  // One-time migration from legacy localStorage keys
  const migrated: LauncherPersistedState = {};
  let hasLegacy = false;
  try {
    const rawHist = consumeLegacyLocalStorageValue(QUERY_HISTORY_KEY);
    if (rawHist) {
      const parsed = JSON.parse(rawHist);
      if (Array.isArray(parsed)) {
        migrated.queryHistory = parsed.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0
        );
        hasLegacy = true;
      }
    }
    const rawRecent =
      consumeLegacyLocalStorageValue(RECENT_LAUNCHES_KEY) ??
      consumeLegacyLocalStorageValue(LEGACY_RECENT_LAUNCHES_KEY);
    if (rawRecent) {
      const parsed = JSON.parse(rawRecent);
      if (Array.isArray(parsed)) {
        migrated.recentLaunches = parsed.filter(
          (x): x is string => typeof x === "string"
        );
        hasLegacy = true;
      }
    }
    const rawHeight = consumeLegacyLocalStorageValue(LAUNCHER_HEIGHT_KEY);
    const savedH = Number(rawHeight);
    if (rawHeight && Number.isFinite(savedH) && savedH >= 180) {
      migrated.height = savedH;
      hasLegacy = true;
    }
    const rawOffset = consumeLegacyLocalStorageValue(LAUNCHER_OFFSET_KEY);
    if (rawOffset) {
      const parsed = JSON.parse(rawOffset) as { x?: unknown; y?: unknown };
      if (
        typeof parsed?.x === "number" &&
        Number.isFinite(parsed.x) &&
        typeof parsed?.y === "number" &&
        Number.isFinite(parsed.y)
      ) {
        migrated.offset = { x: parsed.x, y: parsed.y };
        hasLegacy = true;
      }
    }
    if (hasLegacy) {
      writeVfsStateJson(VFS_STATE_PATHS.launcher, migrated);
    }
  } catch {
    // ignore storage errors
  }
  return migrated;
}

function writeLauncherStatePatch(patch: Partial<LauncherPersistedState>): void {
  try {
    const current = readLauncherState();
    writeVfsStateJson(VFS_STATE_PATHS.launcher, { ...current, ...patch });
  } catch {
    // ignore storage errors
  }
}

function loadQueryHistory(): string[] {
  const list = readLauncherState().queryHistory;
  return Array.isArray(list)
    ? list.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
}

function saveQueryHistory(query: string, prev: readonly string[]): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [...prev];
  const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(
    0,
    MAX_QUERY_HISTORY
  );
  writeLauncherStatePatch({ queryHistory: next });
  return next;
}

function loadRecentLaunches(): string[] {
  const list = readLauncherState().recentLaunches;
  return Array.isArray(list)
    ? list.filter((x): x is string => typeof x === "string")
    : [];
}

function saveRecentLaunch(key: string, prev: readonly string[]): string[] {
  const next = [key, ...prev.filter((k) => k !== key)].slice(
    0,
    MAX_RECENT_LAUNCHES
  );
  writeLauncherStatePatch({ recentLaunches: next });
  return next;
}

function normalizeSearch(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function detectValidUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (/^(https?|file):\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  if (
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(
      trimmed
    )
  ) {
    return `https://${trimmed}`;
  }
  return null;
}

/**
 * Scores how well search tokens match a primary title and optional keywords.
 * Returns -1 when any token fails to match.
 */
function scoreMatch(
  tokens: readonly string[],
  primary: string,
  secondary = ""
): number {
  if (tokens.length === 0) return 0;
  const p = normalizeSearch(primary);
  const s = normalizeSearch(secondary);
  const combined = s ? `${p} ${s}` : p;

  let score = 0;
  for (const token of tokens) {
    if (!combined.includes(token)) return -1;
    if (p === token) score += 100;
    else if (p.startsWith(token)) score += 60;
    else if (p.includes(` ${token}`) || p.includes(`-${token}`)) score += 40;
    else if (p.includes(token)) score += 20;
    else score += 5;
  }
  return score;
}

interface PaletteEntry {
  value: string;
  score: number;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
}

function filterAndSort(entries: PaletteEntry[]): PaletteEntry[] {
  return entries
    .filter((e) => e.score >= 0)
    .sort((a, b) => b.score - a.score);
}

/** Best matches first; equal scores (e.g. an empty search) in A–Z order. */
function filterAndSortByName(entries: PaletteEntry[]): PaletteEntry[] {
  return entries
    .filter((e) => e.score >= 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}


let persistedLauncherQuery = "";


type LauncherWindow = Pick<
  DesktopWindowInstance,
  "id" | "appId" | "title" | "minimized" | "payload" | "browserUrl" | "browserWindowId" | "iconUrl"
>;
const NO_LAUNCHER_WINDOWS: LauncherWindow[] = [];
function pickLauncherWindow(w: DesktopWindowInstance): LauncherWindow {
  return {
    id: w.id,
    appId: w.appId,
    title: w.title,
    minimized: w.minimized,
    payload: w.payload,
    browserUrl: w.browserUrl,
    browserWindowId: w.browserWindowId,
    iconUrl: w.iconUrl,
  };
}

export const Launcher = React.memo(function Launcher() {
  countRender("Launcher");
  const settings = useDesktopSettings(["hiddenGnomePanels", "installedWebApps", "muted", "themeMode"]);
  const updateSettings = useUpdateSettings();
  const { realFilesystem } = useCapabilities();
  const { pluginCommands } = usePlugins();
  const {
    pushNotification,
    lockSession,
    takeScreenshot,
    startScreenRecording,
    availableGnomePanels,
  } = useSystemBackends();
  const {
    installedXdgApps,
    xdgUserDirs,
    openXdgFolder,
    getAppIconUrl,
  } = useApps();
  // While closed the Launcher only needs `launcherOpen`; window data is
  // selected only when open so window changes don't re-render it.
  const { launcherOpen, windows, mruWindows, focusedWindowId } =
    useWindowManagerSelector((wm) => {
      if (!wm.launcherOpen) {
        return {
          launcherOpen: false,
          windows: NO_LAUNCHER_WINDOWS,
          mruWindows: NO_LAUNCHER_WINDOWS,
          focusedWindowId: null,
        };
      }
      return {
        launcherOpen: true,
        windows: wm.windows.map(pickLauncherWindow),
        mruWindows: wm.mruWindows.map(pickLauncherWindow),
        focusedWindowId: wm.focusedWindowId,
      };
    });
  const {
    setLauncherOpen,
    launchApp,
    launchXdgApp,
    openWebUrl,
    openGnomeSettings,
    focusWindow,
    tileWindow,
    toggleMaximizeWindow,
    openAltTab,
  } = useWindowActions();

  const [searchQuery, setSearchQueryState] = React.useState(
    () => persistedLauncherQuery
  );
  const setSearchQuery = React.useCallback(
    (next: string | ((prev: string) => string)) => {
      setSearchQueryState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        persistedLauncherQuery = resolved;
        return resolved;
      });
    },
    []
  );
  const [selectedValue, setSelectedValue] = React.useState("");
  const [recentLaunches, setRecentLaunches] = React.useState<string[]>(
    loadRecentLaunches
  );
  const [queryHistory, setQueryHistory] =
    React.useState<string[]>(loadQueryHistory);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const recordLaunch = React.useCallback((key: string) => {
    setRecentLaunches((prev) => saveRecentLaunch(key, prev));
  }, []);

  React.useEffect(() => {
    if (launcherOpen) {
      setHistoryIndex(-1);
      const frame = requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [launcherOpen]);

  const [snapshots, setSnapshots] = React.useState<WorkspaceSnapshot[]>(() =>
    loadWorkspaceSnapshots()
  );

  const detectedUrl = React.useMemo(
    () => detectValidUrl(searchQuery),
    [searchQuery]
  );

  const mathResult = React.useMemo(
    () => evaluateLauncherMath(searchQuery),
    [searchQuery]
  );

  const runAndClose = React.useCallback(
    (fn: () => void) => {
      if (searchQuery.trim()) {
        setQueryHistory((prev) => saveQueryHistory(searchQuery, prev));
      }
      setHistoryIndex(-1);
      setLauncherOpen(false);
      fn();
    },
    [searchQuery, setLauncherOpen]
  );

  const tokens = React.useMemo(
    () => normalizeSearch(searchQuery).split(/\s+/).filter(Boolean),
    [searchQuery]
  );

  // Show the panel at once; fill the list on the next frame so opening is not blocked by it.
  const [listReady, setListReady] = React.useState(false);
  React.useEffect(() => {
    if (!launcherOpen) {
      setListReady(false);
      return;
    }
    const id = window.setTimeout(() => setListReady(true), 0);
    return () => window.clearTimeout(id);
  }, [launcherOpen]);

  const sections = React.useMemo(() => {
    if (!listReady) return [];
    const out: { heading: string; items: PaletteEntry[] }[] = [];

    if (mathResult) {
      out.push({
        heading: "Calculator",
        items: [
          {
            value: `math:copy:${mathResult.result}`,
            score: 1200,
            icon: <CalculatorIcon className="size-4 text-ui-accent" />,
            label: `= ${mathResult.result}`,
            hint: `${mathResult.expression} · Copy Result`,
            onSelect: () =>
              runAndClose(() => {
                void navigator.clipboard?.writeText(
                  String(mathResult.rawValue)
                );
              }),
          },
          {
            value: `math:open:${mathResult.result}`,
            score: 1190,
            icon: <CalculatorIcon className="size-4" />,
            label: "Open in Calculator",
            onSelect: () => runAndClose(() => launchApp("calculator")),
          },
        ],
      });
    }

    if (detectedUrl) {
      out.push({
        heading: "Open URL",
        items: [
          {
            value: `url:${detectedUrl}`,
            score: 1000,
            icon: <GlobeIcon className="size-4" />,
            label: `Open ${detectedUrl}`,
            onSelect: () => runAndClose(() => openWebUrl(detectedUrl)),
          },
        ],
      });
    }

    const nativeAppEntries: PaletteEntry[] = [
      ...APP_CATALOG.filter(
        (app) => Boolean(app.builtinComponent) && isAppSearchEnabled(app.id)
      ).map((app) => {
        const localizedName = _(app.name);
        const localizedShort = _(app.shortName);
        const localizedDesc = _(app.description);
        const englishMeta = `${app.name} ${app.shortName} ${app.command ?? ""} ${app.description}`;
        const localizedMeta = `${localizedName} ${localizedShort} ${localizedDesc}`;
        return {
          value: `builtin:${app.id}`,
          score: Math.max(
            scoreMatch(tokens, localizedName, `${localizedMeta} ${englishMeta}`),
            scoreMatch(tokens, app.name, `${englishMeta} ${localizedMeta}`)
          ),
          icon: (
            <AppSquircleIcon
              iconUrl={getAppIconUrl(app.id)}
              className="size-5 rounded-[5px]"
            />
          ),
          label: localizedName,
          onSelect: () => {
            recordLaunch(`builtin:${app.id}`);
            runAndClose(() => launchApp(app.id));
          },
        };
      }),
      ...installedXdgApps
        .filter(
          (entry) =>
            isAppSearchEnabled(entry.desktopId) &&
            !isBuiltinAppEntry(entry.exec) &&
            !entry.desktopId.startsWith("piloti-webapp-") &&
            !entry.exec?.startsWith("piloti-webapp ")
        )
        .map((entry) => {
          const localizedName = _(entry.name);
          const localizedGeneric = entry.genericName ? _(entry.genericName) : "";
          const keywords = entry.keywords.join(" ");
          return {
            value: `app:${entry.desktopId}`,
            score: Math.max(
              scoreMatch(
                tokens,
                localizedName,
                `${localizedGeneric} ${entry.name} ${entry.genericName ?? ""} ${keywords}`
              ),
              scoreMatch(
                tokens,
                entry.name,
                `${entry.genericName ?? ""} ${keywords} ${localizedName} ${localizedGeneric}`
              )
            ),
            icon: (
              <AppSquircleIcon
                iconUrl={
                  entry.iconUrl ??
                  getAppIconUrl(entry.desktopId) ??
                  (entry.icon && /^https?:\/\//i.test(entry.icon)
                    ? entry.icon
                    : undefined)
                }
                className="size-5 shrink-0 rounded-[5px]"
              />
            ),
            label: localizedName,
            onSelect: () => {
              recordLaunch(`app:${entry.desktopId}`);
              runAndClose(() => launchXdgApp(entry));
            },
          };
        }),
    ];

    const webAppEntries: PaletteEntry[] = settings.installedWebApps.map((webApp) => {
      const displayTitle = resolveWebAppTitle({
        rawUrl: webApp.url,
        hostTitle: webApp.title,
        installedApps: settings.installedWebApps,
      });
      const resolvedWebIcon =
        (webApp.iconUrl && /^(https?:|data:|blob:|\/)/i.test(webApp.iconUrl)
          ? webApp.iconUrl
          : undefined) || getWebAppFaviconUrl(webApp.url);
      return {
        value: `web:${webApp.id}`,
        score: scoreMatch(
          tokens,
          displayTitle,
          `${webApp.url} ${webApp.keywords ?? ""}`
        ),
        icon: (
          <AppSquircleIcon
            iconUrl={resolvedWebIcon}
            fallbackIconUrl={
              getAppIconUrl("browser") ?? getAppIconUrl("web-browser")
            }
            squircle
            className="size-5 shrink-0"
          />
        ),
        label: displayTitle,
        onSelect: () => {
          recordLaunch(`web:${webApp.id}`);
          runAndClose(() => openWebUrl(webApp.url));
        },
      };
    });

    const appEntries: PaletteEntry[] = [...nativeAppEntries, ...webAppEntries];

    if (tokens.length === 0) {
      const runningEntries: PaletteEntry[] = mruWindows.map((win) => ({
        value: `win:${win.id}`,
        score: 900,
        icon: (
          <AppSquircleIcon
            iconUrl={win.iconUrl ?? getAppIconUrl(win.appId)}
            fallbackIconUrl={
              win.browserWindowId ? getAppIconUrl("browser") : undefined
            }
            squircle={Boolean(win.browserWindowId)}
            className="size-5"
          />
        ),
        label: win.title,
        hint:
          win.id === focusedWindowId
            ? "Focused"
            : win.minimized
              ? "Minimized"
              : "Running",
        onSelect: () => runAndClose(() => focusWindow(win.id)),
      }));

      const openAppIds = new Set(windows.map((w) => w.appId));
      const openWebUrls = new Set(
        windows
          .map((w) => canonicalizeWebUrl(w.browserUrl))
          .filter((u): u is string => Boolean(u))
      );
      const installedWebByLaunchKey = new Map(
        settings.installedWebApps.map((webApp) => [
          `web:${webApp.id}`,
          canonicalizeWebUrl(webApp.url),
        ])
      );
      const appByKey = new Map(appEntries.map((entry) => [entry.value, entry]));
      const recentEntries: PaletteEntry[] = [];
      for (const key of recentLaunches) {
        if (recentEntries.length >= 4) break;
        const found = appByKey.get(key);
        if (!found) continue;
        const rawId = key.replace(/^(builtin|app|web):/, "").replace(/\.desktop$/i, "");
        if (openAppIds.has(rawId)) continue;
        const webCanonical = installedWebByLaunchKey.get(key);
        if (webCanonical && openWebUrls.has(webCanonical)) continue;
        recentEntries.push({
          ...found,
          value: `recent:${key}`,
          hint: "Recent",
        });
      }

      const combinedRecentAndRunning = [...runningEntries, ...recentEntries];
      if (combinedRecentAndRunning.length > 0) {
        out.push({
          heading: "Recent",
          items: combinedRecentAndRunning,
        });
      }
    } else {
      const windowItems = filterAndSort(
        windows.map((win) => ({
          value: `win:${win.id}`,
          score: scoreMatch(tokens, win.title, win.appId),
          icon: (
            <AppSquircleIcon
              iconUrl={win.iconUrl ?? getAppIconUrl(win.appId)}
              fallbackIconUrl={
                win.browserWindowId ? getAppIconUrl("browser") : undefined
              }
              squircle={Boolean(win.browserWindowId)}
              className="size-5"
            />
          ),
          label: win.title,
          hint: win.id === focusedWindowId ? "Focused" : "Running",
          onSelect: () => runAndClose(() => focusWindow(win.id)),
        }))
      );
      if (windowItems.length > 0) {
        out.push({ heading: "Open Windows", items: windowItems });
      }
    }

    const filteredApps = filterAndSortByName(nativeAppEntries);
    if (filteredApps.length > 0) {
      out.push({ heading: "Apps", items: filteredApps });
    }

    const filteredWebApps = filterAndSortByName(webAppEntries);
    if (filteredWebApps.length > 0) {
      out.push({ heading: "Web Apps", items: filteredWebApps });
    }

    const folderItems = filterAndSort(
      xdgUserDirs.map((dir) => {
        const localizedDir = _(dir.name);
        const dirKeywords = `folder directory ${dir.key} ${dir.displayPath} ${dir.keywords.join(" ")}`;
        return {
          value: `folder:${dir.key}`,
          score: Math.max(
            scoreMatch(tokens, localizedDir, `${dir.name} ${dirKeywords}`),
            scoreMatch(tokens, dir.name, `${localizedDir} ${dirKeywords}`)
          ),
          icon: (
            <AppSquircleIcon
              iconUrl={getAppIconUrl(`folder:${dir.key}`)}
              className="size-5 shrink-0 rounded-[5px]"
            />
          ),
          label: localizedDir,
          hint: dir.displayPath,
          onSelect: () => runAndClose(() => openXdgFolder(dir)),
        };
      })
    );
    if (folderItems.length > 0) {
      out.push({ heading: "Folders", items: folderItems });
    }

    if (realFilesystem && tokens.length > 0) {
      const hiddenSet = new Set(settings.hiddenGnomePanels);
      const settingsIconUrl = getAppIconUrl("settings");
      const settingsItems = filterAndSort([
        {
          value: "settings:__overview__",
          score: scoreMatch(
            tokens,
            "System Settings",
            "gnome control center preferences"
          ),
          icon: (
            <AppSquircleIcon
              iconUrl={settingsIconUrl}
              className="size-5 shrink-0 rounded-[5px]"
            />
          ),
          label: "Open System Settings",
          onSelect: () => runAndClose(() => openGnomeSettings()),
        },
        ...availableGnomePanels
          .filter((p) => !hiddenSet.has(p.desktopId))
          .map((panel) => ({
            value: `settings:${panel.panelId}`,
            score: scoreMatch(
              tokens,
              panel.name,
              `settings system ${panel.panelId} ${panel.comment ?? ""}`
            ),
            icon: (
              <AppSquircleIcon
                iconUrl={settingsIconUrl}
                className="size-5 shrink-0 rounded-[5px]"
              />
            ),
            label: panel.name,
            hint: "System Settings",
            onSelect: () => runAndClose(() => openGnomeSettings(panel.panelId)),
          })),
      ]);
      if (settingsItems.length > 0) {
        out.push({ heading: "Settings", items: settingsItems });
      }
    }

    if (tokens.length > 0) {
      const actionEntries: PaletteEntry[] = [
      {
        value: "act:screenshot",
        score: scoreMatch(tokens, "Take Interactive Screenshot", "capture area window"),
        icon: <CameraIcon className="size-4" />,
        label: "Take Interactive Screenshot",
        onSelect: () => runAndClose(() => void takeScreenshot()),
      },
      {
        value: "act:record",
        score: scoreMatch(tokens, "Record Screen", "video screencast"),
        icon: <VideoIcon className="size-4" />,
        label: "Record Screen",
        onSelect: () => runAndClose(() => void startScreenRecording()),
      },
      {
        value: "act:appearance",
        score: scoreMatch(
          tokens,
          `Switch to ${settings.themeMode === "dark" ? "Light" : "Dark"} Appearance`,
          "toggle theme dark light mode"
        ),
        icon:
          settings.themeMode === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          ),
        label: `Switch to ${settings.themeMode === "dark" ? "Light" : "Dark"} Appearance`,
        onSelect: () =>
          runAndClose(() =>
            updateSettings({
              themeMode: settings.themeMode === "dark" ? "light" : "dark",
            })
          ),
      },
      {
        value: "act:alt-tab",
        score: scoreMatch(tokens, "Open Window Switcher", "switch windows alt tab"),
        icon: <LayersIcon className="size-4" />,
        label: "Open Window Switcher",
        onSelect: () => runAndClose(() => openAltTab()),
      },
      ...(focusedWindowId
        ? [
          {
            value: "act:tile-left",
            score: scoreMatch(tokens, "Tile Focused Window to Left Half", "snap"),
            icon: <Columns2Icon className="size-4" />,
            label: "Tile Focused Window to Left Half",
            onSelect: () =>
              runAndClose(() => tileWindow(focusedWindowId, "left")),
          },
          {
            value: "act:tile-right",
            score: scoreMatch(tokens, "Tile Focused Window to Right Half", "snap"),
            icon: <Columns2Icon className="size-4" />,
            label: "Tile Focused Window to Right Half",
            onSelect: () =>
              runAndClose(() => tileWindow(focusedWindowId, "right")),
          },
          {
            value: "act:maximize",
            score: scoreMatch(tokens, "Toggle Maximize Focused Window", "zoom fullscreen"),
            icon: <Maximize2Icon className="size-4" />,
            label: "Toggle Maximize Focused Window",
            onSelect: () =>
              runAndClose(() => toggleMaximizeWindow(focusedWindowId)),
          },
        ]
        : []),
      {
        value: "act:wallpaper",
        score: scoreMatch(tokens, "Change Desktop Wallpaper", "background"),
        icon: <PaletteIcon className="size-4" />,
        label: "Change Desktop Wallpaper",
        onSelect: () =>
          runAndClose(() => launchApp("settings", { payload: "wallpaper" })),
      },
      {
        value: "act:dock",
        score: scoreMatch(tokens, "Configure Dock & Menu Bar", "magnification size"),
        icon: <SettingsIcon className="size-4" />,
        label: "Configure Dock & Menu Bar",
        onSelect: () =>
          runAndClose(() => launchApp("settings", { payload: "dock" })),
      },
      {
        value: "act:mute",
        score: scoreMatch(
          tokens,
          settings.muted ? "Unmute System Audio" : "Mute System Audio",
          "sound volume"
        ),
        icon: settings.muted ? (
          <Volume2Icon className="size-4" />
        ) : (
          <VolumeXIcon className="size-4" />
        ),
        label: settings.muted ? "Unmute System Audio" : "Mute System Audio",
        onSelect: () =>
          runAndClose(() => updateSettings({ muted: !settings.muted })),
      },
      {
        value: "act:notify",
        score: scoreMatch(tokens, "Send Test Notification", "toast"),
        icon: <BellRingIcon className="size-4" />,
        label: "Send Test Notification",
        onSelect: () =>
          runAndClose(() =>
            pushNotification({
              appName: "Launcher",
              summary: "Test Notification Dispatched",
              body: "Notifications appear as banners and in Control panel history.",
            })
          ),
      },
      {
        value: "act:save-snapshot",
        score: scoreMatch(
          tokens,
          "Save Current Workspace Layout",
          "snapshot profile save layout workspace"
        ),
        icon: <LayoutTemplateIcon className="size-4" />,
        label: searchQuery.trim().toLowerCase().startsWith("save ")
          ? `Save Workspace Layout "${searchQuery.trim().slice(5).trim()}"`
          : "Save Current Workspace Layout",
        onSelect: () =>
          runAndClose(() => {
            const customName = searchQuery
              .trim()
              .toLowerCase()
              .startsWith("save ")
              ? searchQuery.trim().slice(5).trim()
              : `Layout ${snapshots.length + 1}`;
            const saved = saveWorkspaceSnapshot(
              customName,
              windows
                .filter((w) => !w.minimized)
                .map((w) => ({
                  appId: w.appId,
                  payload: w.payload,
                  browserUrl: w.browserUrl,
                  title: w.title,
                }))
            );
            setSnapshots(saved);
            pushNotification({
              appName: "Launcher",
              summary: `Saved layout "${customName}"`,
              body: `${windows.filter((w) => !w.minimized).length} window(s) snapshotted.`,
            });
          }),
      },
      ...snapshots.map((snap) => ({
        value: `act:restore-snapshot:${snap.id}`,
        score: scoreMatch(
          tokens,
          `Restore Layout: ${snap.name}`,
          "snapshot profile restore layout workspace"
        ),
        icon: <LayoutTemplateIcon className="size-4" />,
        label: `Restore Layout: ${snap.name}`,
        hint: `${snap.windows.length} window(s)`,
        onSelect: () =>
          runAndClose(() => {
            for (const w of snap.windows) {
              if (w.browserUrl) {
                openWebUrl(w.browserUrl, { asApp: true, title: w.title });
              } else {
                launchApp(w.appId, { payload: w.payload, forceNew: true });
              }
            }
          }),
      })),
      {
        value: "act:lock",
        score: scoreMatch(tokens, "Lock Session", "lock screen security"),
        icon: <LockIcon className="size-4" />,
        label: "Lock Session",
        onSelect: () => runAndClose(() => lockSession()),
      },
    ];
      const filteredActions = filterAndSort(actionEntries);
      if (filteredActions.length > 0) {
        out.push({ heading: "Actions", items: filteredActions });
      }
    }

    if (pluginCommands.length > 0) {
      const pluginItems = filterAndSort(
        pluginCommands.map((cmd) => ({
          value: `plugin:${cmd.pluginId}:${cmd.id}`,
          score: scoreMatch(tokens, cmd.title, `${cmd.pluginId} ${cmd.keywords ?? ""}`),
          icon: <PuzzleIcon className="size-4" />,
          label: cmd.title,
          hint: cmd.pluginId,
          onSelect: () => runAndClose(() => cmd.run()),
        }))
      );
      if (pluginItems.length > 0) {
        out.push({ heading: "Plugins", items: pluginItems });
      }
    }

    const webQuery = searchQuery.trim();
    if (webQuery && !detectedUrl && !mathResult) {
      out.push({
        heading: _("Web Search"),
        items: [
          {
            value: "web-search",
            score: -1,
            icon: <GlobeIcon className="size-4" />,
            label: _("Search the web for “%s”", webQuery),
            onSelect: () =>
              runAndClose(() => openWebUrl(webSearchUrl(webQuery, isWebEngine()))),
          },
        ],
      });
    }

    return out;
  }, [
    listReady,
    availableGnomePanels,
    detectedUrl,
    mathResult,
    pluginCommands,
    searchQuery,
    snapshots,
    focusWindow,
    focusedWindowId,
    getAppIconUrl,
    installedXdgApps,
    launchApp,
    launchXdgApp,
    lockSession,
    mruWindows,
    openAltTab,
    openGnomeSettings,
    openWebUrl,
    openXdgFolder,
    pushNotification,
    recentLaunches,
    recordLaunch,
    runAndClose,
    settings.hiddenGnomePanels,
    settings.installedWebApps,
    settings.muted,
    settings.themeMode,
    startScreenRecording,
    takeScreenshot,
    tileWindow,
    toggleMaximizeWindow,
    tokens,
    updateSettings,
    windows,
    xdgUserDirs,
  ]);

  const firstItemValue = sections[0]?.items[0]?.value ?? "";
  const allItemsByValue = React.useMemo(
    () => new Map(sections.flatMap((s) => s.items.map((i) => [i.value, i]))),
    [sections]
  );
  const allValues = React.useMemo(
    () => new Set(allItemsByValue.keys()),
    [allItemsByValue]
  );

  const activeCompletionItem = React.useMemo(() => {
    if (!searchQuery.trim()) return undefined;
    const active =
      allItemsByValue.get(selectedValue) ?? sections[0]?.items[0];
    if (!active) return undefined;
    return active.label.toLowerCase().startsWith(searchQuery.toLowerCase())
      ? active
      : undefined;
  }, [allItemsByValue, searchQuery, sections, selectedValue]);

  const prevQueryRef = React.useRef(searchQuery);
  React.useEffect(() => {
    const queryChanged = prevQueryRef.current !== searchQuery;
    prevQueryRef.current = searchQuery;
    if (!firstItemValue) {
      setSelectedValue("");
    } else if (queryChanged || !selectedValue || !allValues.has(selectedValue)) {
      setSelectedValue(firstItemValue);
    }
  }, [allValues, firstItemValue, searchQuery, selectedValue]);

  const [listHeight, setListHeight] = React.useState<number>(() => {
    const saved = readLauncherState().height;
    if (typeof saved === "number" && Number.isFinite(saved) && saved >= 180) {
      return saved;
    }
    return 360;
  });

  const [popupOffset, setPopupOffset] = React.useState<{ x: number; y: number }>(
    () => {
      const saved = readLauncherState().offset;
      if (
        saved &&
        typeof saved.x === "number" &&
        Number.isFinite(saved.x) &&
        typeof saved.y === "number" &&
        Number.isFinite(saved.y)
      ) {
        return { x: saved.x, y: saved.y };
      }
      return { x: 0, y: 0 };
    }
  );
  const searchHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const popupOffsetRef = React.useRef(popupOffset);
  popupOffsetRef.current = popupOffset;

  // The launcher is a floating window: free to move, snapping to the screen
  // edges, resisting past them, and settling back inside on release.
  const placePopupOffset = React.useCallback(
    (
      popup: HTMLElement,
      desiredX: number,
      desiredY: number,
      phase: "drag" | "settle"
    ) => {
      // Resting rectangle = current rectangle minus the current offset. Never
      // toggle `translate` to measure it: with a transition running, that
      // animates the launcher back to its resting spot and out again.
      const current = popup.getBoundingClientRect();
      const [tx = 0, ty = 0] = (getComputedStyle(popup).translate || "")
        .split(/\s+/)
        .map((v) => Number.parseFloat(v) || 0);
      const base = {
        left: current.left - tx,
        top: current.top - ty,
        width: current.width,
        height: current.height,
      };

      const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const bounds = floatingBounds({
        x: 0,
        y: MENU_BAR_HEIGHT,
        width: vw,
        height: vh - MENU_BAR_HEIGHT,
      });
      const rect = {
        x: base.left + desiredX,
        y: base.top + desiredY,
        width: base.width,
        height: base.height,
      };
      const placed =
        phase === "drag"
          ? floatingDragPosition(rect, bounds)
          : settleFloatingPosition(rect, bounds);
      let nextX = Math.round(placed.x - base.left);
      let nextY = Math.round(placed.y - base.top);
      // Magnetic snap back to the default spot when dropped near it.
      if (phase === "settle" && Math.abs(nextX) <= 10 && Math.abs(nextY) <= 10) {
        nextX = 0;
        nextY = 0;
      }
      return { x: nextX, y: nextY };
    },
    []
  );

  React.useLayoutEffect(() => {
    const popup = searchHeaderRef.current?.closest<HTMLElement>(
      '[data-slot="dropdown-menu-content"]'
    );
    if (!popup) return;
    if (popupOffset.x === 0 && popupOffset.y === 0) {
      popup.style.translate = "";
      return;
    }
    const placed = placePopupOffset(popup, popupOffset.x, popupOffset.y, "settle");
    popup.style.translate =
      placed.x || placed.y ? `${placed.x}px ${placed.y}px` : "";
  }, [placePopupOffset, launcherOpen, listHeight, popupOffset.x, popupOffset.y]);

  const handleHeaderDragPointerDown = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (e.button !== 0) return;
    const popup = searchHeaderRef.current?.closest<HTMLElement>(
      '[data-slot="dropdown-menu-content"]'
    );
    if (!popup) return;

    const baseOffset = popupOffsetRef.current;
    let latest = baseOffset;
    const showOffset = () => {
      popup.style.translate =
        latest.x || latest.y ? `${latest.x}px ${latest.y}px` : "";
    };

    startPointerDrag(e, {
      onMove: (_ev, { dx, dy }) => {
        latest = placePopupOffset(popup, baseOffset.x + dx, baseOffset.y + dy, "drag");
        showOffset();
      },
      onEnd: (_ev, { moved }) => {
        if (!moved) return;
        latest = placePopupOffset(popup, latest.x, latest.y, "settle");
        settleSurface(popup, "translate", showOffset);
        setPopupOffset(latest);
        writeLauncherStatePatch({ offset: latest });
      },
    });
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startHeight = listHeight;
    const maxAllowed =
      typeof window !== "undefined"
        ? Math.max(240, window.innerHeight - 140)
        : 720;
    const heightFor = (dy: number) =>
      Math.min(maxAllowed, Math.max(180, Math.round(startHeight + dy)));

    startPointerDrag(e, {
      threshold: 0,
      onMove: (_ev, { dy }) => setListHeight(heightFor(dy)),
      onEnd: (_ev, { dy, moved }) => {
        if (moved) writeLauncherStatePatch({ height: heightFor(dy) });
      },
    });
  };

  return (
    <Command
      shouldFilter={false}
      value={selectedValue}
      onValueChange={setSelectedValue}
      onKeyDown={(e) => {
        // Ctrl+A selects the whole query, as on Linux (in a browser on macOS
        // it would move the caret to the start of the line).
        if (
          e.ctrlKey &&
          !e.altKey &&
          !e.metaKey &&
          !e.shiftKey &&
          e.key.toLowerCase() === "a" &&
          e.target instanceof HTMLInputElement
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.target.select();
          return;
        }
        if (e.key === "Escape") {
          if (searchQuery.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setHistoryIndex(-1);
            setSearchQuery("");
          }
          return;
        }
        if (
          (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
          searchQuery === ""
        ) {
          return;
        }
        if (
          e.key === "ArrowUp" &&
          (historyIndex >= 0 || selectedValue === firstItemValue || !firstItemValue) &&
          queryHistory.length > 0
        ) {
          const nextIdx = Math.min(queryHistory.length - 1, historyIndex + 1);
          if (nextIdx !== historyIndex) {
            e.preventDefault();
            e.stopPropagation();
            setHistoryIndex(nextIdx);
            setSearchQuery(queryHistory[nextIdx] ?? "");
            return;
          }
        }
        if (e.key === "ArrowDown" && historyIndex >= 0) {
          e.preventDefault();
          e.stopPropagation();
          if (historyIndex === 0) {
            setHistoryIndex(-1);
            setSearchQuery("");
          } else {
            const nextIdx = historyIndex - 1;
            setHistoryIndex(nextIdx);
            setSearchQuery(queryHistory[nextIdx] ?? "");
          }
          return;
        }
        // Typing stays in the launcher (the menu must not treat letters as
        // typeahead), but global shortcuts (Alt+Space, Alt+N, Cmd+K…) still
        // reach the shell.
        if (!e.altKey && !e.metaKey && !e.ctrlKey) e.stopPropagation();
      }}
      className="relative w-full"
    >
      <div
        ref={searchHeaderRef}
        data-launcher-drag-header=""
        onPointerDown={handleHeaderDragPointerDown}
        className="cursor-default [&_[data-slot=command-input-wrapper]]:cursor-default"
      >
        <CommandInput
          ref={inputRef}
          autoFocus
          placeholder={_("Search or URL")}
          value={searchQuery}
          onValueChange={(val) => {
            setHistoryIndex(-1);
            setSearchQuery(val);
          }}
          completion={activeCompletionItem?.label}
          onAcceptCompletion={setSearchQuery}
        />
      </div>
      <CommandList
        style={{ maxHeight: `${listHeight}px` }}
      >
        {!listReady ? (
          <div className="py-6 text-center text-ui-body text-ui-label-secondary">
            {_("Loading…")}
          </div>
        ) : sections.length === 0 ? (
          <div className="py-6 text-center text-ui-body text-ui-label-secondary">
            {_("No matching apps, folders, settings, or commands.")}
          </div>
        ) : (
          sections.map((section, idx) => (
            <React.Fragment key={section.heading}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={_(section.heading)}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    data-launcher-item={item.value}
                    onSelect={() => {
                      const el = document.querySelector(
                        `[data-launcher-item="${CSS.escape(item.value)}"]`
                      ) as HTMLElement | null;
                      captureLaunchOriginFromElement(el);
                      item.onSelect();
                    }}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="shrink-0 text-ui-small text-ui-label-tertiary">
                        {item.hint}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))
        )}
      </CommandList>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize launcher height"
        onPointerDown={handleResizePointerDown}
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize select-none"
      />
    </Command>
  );
});
