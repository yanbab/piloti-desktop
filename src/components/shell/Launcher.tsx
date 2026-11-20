import * as React from "react";
import {
  BellRingIcon,
  CalculatorIcon,
  CameraIcon,
  Columns2Icon,
  GlobeIcon,
  LayersIcon,
  LayoutTemplateIcon,
  LockIcon,
  Maximize2Icon,
  MoonIcon,
  PaletteIcon,
  SettingsIcon,
  PuzzleIcon,
  SunIcon,
  VideoIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
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
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { usePlugins } from "@/context/PluginsContext";
import { APP_CATALOG } from "@/data/catalog";
import {
  canonicalizeWebUrl,
  getWebAppFaviconUrl,
  resolveWebAppTitle,
} from "@/data/web-apps";
import { evaluateLauncherMath } from "@/lib/launcher-math";
import { captureLaunchOriginFromElement } from "@/lib/launch-origin";
import {
  loadWorkspaceSnapshots,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from "@/lib/workspace-snapshots";
import { AppSquircleIcon } from "./AppSymbol";

const RECENT_LAUNCHES_KEY = "piloti.launcher.recent.v1";
const LEGACY_RECENT_LAUNCHES_KEY = "piloti.command-palette.recent.v1";
const MAX_RECENT_LAUNCHES = 6;
const QUERY_HISTORY_KEY = "piloti.launcher.query-history.v1";
const MAX_QUERY_HISTORY = 20;

function loadQueryHistory(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUERY_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function saveQueryHistory(query: string, prev: readonly string[]): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [...prev];
  const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(
    0,
    MAX_QUERY_HISTORY
  );
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }
  return next;
}

function loadRecentLaunches(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw =
      localStorage.getItem(RECENT_LAUNCHES_KEY) ??
      localStorage.getItem(LEGACY_RECENT_LAUNCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function saveRecentLaunch(key: string, prev: readonly string[]): string[] {
  const next = [key, ...prev.filter((k) => k !== key)].slice(
    0,
    MAX_RECENT_LAUNCHES
  );
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(RECENT_LAUNCHES_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }
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

export function Launcher() {
  const { settings, updateSettings } = useSettings();
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
    refreshXdgApps,
  } = useApps();
  const {
    launcherOpen,
    setLauncherOpen,
    windows,
    mruWindows,
    focusedWindowId,
    launchApp,
    launchXdgApp,
    openWebUrl,
    openGnomeSettings,
    focusWindow,
    tileWindow,
    toggleMaximizeWindow,
    openAltTab,
  } = useWindowManager();

  const [searchQuery, setSearchQuery] = React.useState("");
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

  const lastXdgRefreshRef = React.useRef(0);

  React.useEffect(() => {
    if (launcherOpen) {
      const now = Date.now();
      if (now - lastXdgRefreshRef.current > 3000) {
        lastXdgRefreshRef.current = now;
        refreshXdgApps();
      }
      setSearchQuery("");
      setSelectedValue("");
      setHistoryIndex(-1);
      const frame = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [launcherOpen, refreshXdgApps]);

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

  const sections = React.useMemo(() => {
    const out: { heading: string; items: PaletteEntry[] }[] = [];

    if (mathResult) {
      out.push({
        heading: "Calculator",
        items: [
          {
            value: `math:copy:${mathResult.result}`,
            score: 1200,
            icon: <CalculatorIcon className="size-4 text-adw-accent" />,
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
      ...APP_CATALOG.filter((app) => Boolean(app.builtinComponent)).map(
        (app) => ({
          value: `builtin:${app.id}`,
          score: scoreMatch(
            tokens,
            app.name,
            `${app.shortName} ${app.description}`
          ),
          icon: (
            <AppSquircleIcon
              iconUrl={getAppIconUrl(app.id)}
              className="size-5 rounded-[5px]"
            />
          ),
          label: app.name,
          onSelect: () => {
            recordLaunch(`builtin:${app.id}`);
            runAndClose(() => launchApp(app.id));
          },
        })
      ),
      ...installedXdgApps
        .filter(
          (entry) =>
            !entry.desktopId.startsWith("piloti-webapp-") &&
            !entry.exec?.startsWith("piloti-webapp ")
        )
        .map((entry) => ({
          value: `app:${entry.desktopId}`,
          score: scoreMatch(
            tokens,
            entry.name,
            `${entry.genericName ?? ""} ${entry.keywords.join(" ")}`
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
          label: entry.name,
          onSelect: () => {
            recordLaunch(`app:${entry.desktopId}`);
            runAndClose(() => launchXdgApp(entry));
          },
        })),
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

    const filteredApps = filterAndSort(nativeAppEntries);
    if (filteredApps.length > 0) {
      out.push({ heading: "Apps", items: filteredApps });
    }

    const filteredWebApps = filterAndSort(webAppEntries);
    if (filteredWebApps.length > 0) {
      out.push({ heading: "Web Apps", items: filteredWebApps });
    }

    const folderItems = filterAndSort(
      xdgUserDirs.map((dir) => ({
        value: `folder:${dir.key}`,
        score: scoreMatch(
          tokens,
          dir.name,
          `folder directory ${dir.displayPath} ${dir.keywords.join(" ")}`
        ),
        icon: (
          <AppSquircleIcon
            iconUrl={getAppIconUrl(`folder:${dir.key}`)}
            className="size-5 shrink-0 rounded-[5px]"
          />
        ),
        label: dir.name,
        hint: dir.displayPath,
        onSelect: () => runAndClose(() => openXdgFolder(dir)),
      }))
    );
    if (folderItems.length > 0) {
      out.push({ heading: "Folders", items: folderItems });
    }

    if (tokens.length > 0) {
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

    return out;
  }, [
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
    try {
      const saved = Number(localStorage.getItem("piloti.launcher.height.v1"));
      if (Number.isFinite(saved) && saved >= 180) return saved;
    } catch {
      // ignore storage errors
    }
    return 360;
  });

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = listHeight;
    const maxAllowed =
      typeof window !== "undefined"
        ? Math.max(240, window.innerHeight - 140)
        : 720;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const next = Math.min(
        maxAllowed,
        Math.max(180, Math.round(startHeight + (moveEvent.clientY - startY)))
      );
      setListHeight(next);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      const finalHeight = Math.min(
        maxAllowed,
        Math.max(180, Math.round(startHeight + (upEvent.clientY - startY)))
      );
      try {
        localStorage.setItem("piloti.launcher.height.v1", String(finalHeight));
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <Command
      shouldFilter={false}
      value={selectedValue}
      onValueChange={setSelectedValue}
      onKeyDown={(e) => {
        if (e.key === "Escape") return;
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
        e.stopPropagation();
      }}
      className="relative w-full"
    >
      <CommandInput
        ref={inputRef}
        autoFocus
        placeholder="Search or URL"
        value={searchQuery}
        onValueChange={(val) => {
          setHistoryIndex(-1);
          setSearchQuery(val);
        }}
        completion={activeCompletionItem?.label}
        onAcceptCompletion={setSearchQuery}
      />
      <CommandList style={{ maxHeight: `${listHeight}px` }}>
        {sections.length === 0 ? (
          <div className="py-6 text-center text-adw-body text-adw-label-secondary">
            No matching apps, folders, settings, or commands.
          </div>
        ) : (
          sections.map((section, idx) => (
            <React.Fragment key={section.heading}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={section.heading}>
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
                      <span className="shrink-0 text-[11px] text-adw-label-tertiary">
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
}
