import { spawnProgram } from "@/lib/engine/system-commands";
import { hostFiles } from "@/lib/engine/host-files";
import { startBootPhase } from "@/lib/core/perf-log";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import * as React from "react";
import { extendDomicile, type PilotiShellApi, usePiloti } from "@/lib/engine/piloti";
import { listSettingsSchemas, settingsFor } from "@/lib/engine/settings";
import {
  useSettings,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import {
  discoverPlugins,
  injectPluginCss,
  loadPluginScript,
  activatePluginModule,
  PLUGINS_REL_DIR,
  removePluginCss,
  syncManagedGtkCssFile,
} from "@/lib/plugins/loader";
import { BUNDLED_PLUGINS } from "@/lib/plugins/bundled";
import { _ } from "@/lib/core/i18n";
import { useCapabilities } from "@/hooks/use-capabilities";
import { parseIniText, serializeIniText } from "@/lib/config/ini";
import { getAppSetting, setAppSetting } from "@/lib/core/app-settings";
import { consumeLegacyLocalStorageValue } from "@/lib/engine-web/web-vfs";
import {
  readVfsStateJson,
  readVfsStateText,
  removeVfsStateFile,
  writeVfsStateText,
} from "@/lib/engine/vfs-state";
import type {
  DiscoveredPlugin,
  LauncherProvider,
  MenuBarStatusItem,
  MenuBarStatusItemInput,
  PilotiPluginContext,
  PluginCommandEntry,
  PluginWallpaperEntry,
  PluginWindowInfo,
} from "@/lib/plugins/types";
import type { DesktopWindowInstance } from "@/context/WindowsContext";
import {
  addWindowMenuItem,
  getWindowPresentation,
  getWorkArea,
  setWindowPresentation,
} from "@/lib/windows/window-presentation";

interface PluginsContextValue {
  plugins: DiscoveredPlugin[];
  statusItems: MenuBarStatusItem[];
  pluginCommands: PluginCommandEntry[];
  launcherProviders: LauncherProvider[];
  pluginWallpapers: PluginWallpaperEntry[];
  safeMode: boolean;
  loading: boolean;
  /** True once the enabled plugins were discovered and activated at least once. */
  ready: boolean;
  togglePlugin: (id: string, enabled?: boolean) => void;
  reloadPlugin: (id: string) => Promise<void>;
  refreshPlugins: () => Promise<void>;
  createSamplePlugin: (kind: "css" | "js") => Promise<string | null>;
}

const PluginsContext = React.createContext<PluginsContextValue | null>(null);

function listPluginWindows(raw: unknown[] | undefined): PluginWindowInfo[] {
  return ((raw ?? []) as DesktopWindowInstance[]).map((w) => ({
    id: w.id,
    appId: w.appId,
    title: w.title,
    workspace: w.workspace,
    position: { ...w.position },
    size: { ...w.size },
    minimized: w.minimized,
    maximized: w.maximized,
  }));
}

/** Wraps a plugin predicate so a throwing plugin cannot break a menu. */
function guardPluginCallback(
  pluginId: string,
  fn: ((windowId: string) => boolean) | undefined,
  fallback: boolean
): ((windowId: string) => boolean) | undefined {
  if (!fn) return undefined;
  return (windowId) => {
    try {
      return Boolean(fn(windowId));
    } catch (err) {
      console.error(`[plugin ${pluginId}] window menu callback failed`, err);
      return fallback;
    }
  };
}

const PLUGIN_STORAGE_PREFIX = "piloti.plugin.storage.v1.";

function isSafeModeRequested(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("safe-mode") === "1";
  } catch {
    return false;
  }
}

export function PluginsProvider({
  children,
  getWindows,
}: {
  children: React.ReactNode;
  getWindows?: () => unknown[];
}) {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
  const { settings, updateSettings } = useSettings();
  const {
    openWebUrl,
    launchApp,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
  } = useWindowActions();
  const { pushNotification } = useSystemBackends();

  const [safeMode] = React.useState(() => isSafeModeRequested());
  const [plugins, setPlugins] = React.useState<DiscoveredPlugin[]>([]);
  const [statusItems, setStatusItems] = React.useState<MenuBarStatusItem[]>([]);
  const [pluginCommands, setPluginCommands] = React.useState<
    PluginCommandEntry[]
  >([]);
  const [launcherProviders, setLauncherProviders] = React.useState<
    LauncherProvider[]
  >([]);
  const [pluginWallpapers, setPluginWallpapers] = React.useState<
    PluginWallpaperEntry[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  const disposablesRef = React.useRef<Map<string, Array<() => void>>>(
    new Map()
  );
  const activeSignatureRef = React.useRef<Map<string, string>>(new Map());
  const pluginsRef = React.useRef<DiscoveredPlugin[]>([]);
  pluginsRef.current = plugins;

  // Keep latest shell actions in refs so plugin callbacks never go stale
  const shellActionsRef = React.useRef({
    getWindows,
    openWebUrl,
    launchApp,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    pushNotification,
    settings,
    updateSettings,
  });
  shellActionsRef.current = {
    getWindows,
    openWebUrl,
    launchApp,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    pushNotification,
    settings,
    updateSettings,
  };

  // The `piloti` global, for scripts, top-level JS plugins and the console
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.piloti = extendDomicile(piloti, {
      desktop: {
        get list() {
          return shellActionsRef.current.getWindows?.() ?? [];
        },
        openWebUrl: (url: string, title?: string) =>
          shellActionsRef.current.openWebUrl(url, title ? { title } : undefined),
        launchApp: (appId: string) =>
          shellActionsRef.current.launchApp(appId),
        focus: (id: string) => shellActionsRef.current.focusWindow(id),
        close: (id: string) => shellActionsRef.current.closeWindow(id),
        minimize: (id: string) => shellActionsRef.current.minimizeWindow(id),
        toggleMaximize: (id: string) =>
          shellActionsRef.current.toggleMaximizeWindow(id),
      },
      notifications: {
        push: (opts: {
          summary: string;
          body?: string;
          urgency?: "low" | "normal" | "critical";
        }) =>
          shellActionsRef.current.pushNotification({
            appName: "Piloti Plugin",
            summary: opts.summary,
            body: opts.body ?? "",
            urgency: opts.urgency,
          }),
      },
      settings: {
        get: ((schema?: string, key?: string) =>
          schema === undefined || key === undefined
            ? shellActionsRef.current.settings
            : settingsFor(schema).get(key)) as PilotiShellApi["settings"]["get"],
        set: (schema, key, value) => settingsFor(schema).set(key, value),
        reset: (schema, key) => settingsFor(schema).reset(key),
        watch: (schema, key, onChange) => {
          const settings = settingsFor(schema);
          return settings.subscribe(key, () => onChange(settings.get(key)));
        },
        get schemas() {
          return listSettingsSchemas();
        },
        update: (patch) =>
          shellActionsRef.current.updateSettings(patch as Parameters<typeof updateSettings>[0]),
      },
      plugins: {
        get list() {
          return pluginsRef.current;
        },
      },
    });
  }, [piloti]);

  const disposePlugin = React.useCallback((pluginId: string) => {
    const cbs = disposablesRef.current.get(pluginId);
    if (cbs) {
      for (const fn of cbs.reverse()) {
        try {
          fn();
        } catch (err) {
          console.error(`[Plugin:${pluginId}] cleanup error:`, err);
        }
      }
      disposablesRef.current.delete(pluginId);
    }
    removePluginCss(pluginId);
    setStatusItems((prev) => prev.filter((item) => item.pluginId !== pluginId));
    setPluginCommands((prev) =>
      prev.filter((cmd) => cmd.pluginId !== pluginId)
    );
    setLauncherProviders((prev) =>
      prev.filter((prov) => prov.pluginId !== pluginId)
    );
    setPluginWallpapers((prev) =>
      prev.filter((wp) => wp.pluginId !== pluginId)
    );
    activeSignatureRef.current.delete(pluginId);
  }, []);

  const buildPluginContext = React.useCallback(
    (pluginId: string, disposables: Array<() => void>): PilotiPluginContext => {
      const presentedIds = new Set<string>();
      return {
        pluginId,
        menubar: {
          addStatusItem: (input: MenuBarStatusItemInput) => {
            const fullId = `${pluginId}:${input.id}`;
            const entry: MenuBarStatusItem = {
              ...input,
              pluginId,
              fullId,
            };
            setStatusItems((prev) => [
              ...prev.filter((i) => i.fullId !== fullId),
              entry,
            ]);
            const remove = () => {
              setStatusItems((prev) => prev.filter((i) => i.fullId !== fullId));
            };
            disposables.push(remove);
            return {
              update: (patch) => {
                setStatusItems((prev) =>
                  prev.map((i) =>
                    i.fullId === fullId ? { ...i, ...patch } : i
                  )
                );
              },
              remove,
            };
          },
        },
        launcher: {
          registerProvider: (provider) => {
            const full: LauncherProvider = { ...provider, pluginId };
            setLauncherProviders((prev) => [
              ...prev.filter(
                (p) => !(p.pluginId === pluginId && p.id === provider.id)
              ),
              full,
            ]);
            const remove = () => {
              setLauncherProviders((prev) =>
                prev.filter(
                  (p) => !(p.pluginId === pluginId && p.id === provider.id)
                )
              );
            };
            disposables.push(remove);
            return remove;
          },
        },
        commands: {
          register: (cmd) => {
            const full: PluginCommandEntry = { ...cmd, pluginId };
            setPluginCommands((prev) => [
              ...prev.filter(
                (c) => !(c.pluginId === pluginId && c.id === cmd.id)
              ),
              full,
            ]);
            const remove = () => {
              setPluginCommands((prev) =>
                prev.filter(
                  (c) => !(c.pluginId === pluginId && c.id === cmd.id)
                )
              );
            };
            disposables.push(remove);
            return remove;
          },
        },
        wallpapers: {
          register: (wp) => {
            const fullId = wp.id.includes(":") ? wp.id : `${pluginId}:${wp.id}`;
            const entry: PluginWallpaperEntry = {
              ...wp,
              pluginId,
              fullId,
            };
            setPluginWallpapers((prev) => [
              ...prev.filter((w) => w.fullId !== fullId),
              entry,
            ]);
            const remove = () => {
              setPluginWallpapers((prev) =>
                prev.filter((w) => w.fullId !== fullId)
              );
            };
            disposables.push(remove);
            return remove;
          },
        },
        windows: {
          openWebUrl: (url, title) =>
            shellActionsRef.current.openWebUrl(url, title ? { title } : undefined),
          launchApp: (appId) => shellActionsRef.current.launchApp(appId),
          list: () => listPluginWindows(shellActionsRef.current.getWindows?.()),
          get: (windowId) =>
            listPluginWindows(shellActionsRef.current.getWindows?.()).find(
              (w) => w.id === windowId
            ),
          focus: (windowId) => shellActionsRef.current.focusWindow(windowId),
          getWorkArea,
          getPresentation: getWindowPresentation,
          setPresentation: (windowId, presentation) => {
            if (presentation && !presentedIds.has(windowId)) {
              presentedIds.add(windowId);
              if (presentedIds.size === 1) {
                // Restore every window this plugin presented when it stops.
                disposables.push(() => {
                  for (const id of presentedIds) setWindowPresentation(id, null);
                  presentedIds.clear();
                });
              }
            } else if (!presentation) {
              presentedIds.delete(windowId);
            }
            setWindowPresentation(windowId, presentation);
          },
          addMenuItem: (item) => {
            const remove = addWindowMenuItem({
              ...item,
              id: `${pluginId}:${item.id}`,
              checked: guardPluginCallback(pluginId, item.checked, false),
              visible: guardPluginCallback(pluginId, item.visible, true),
              onSelect: (windowId) => {
                try {
                  item.onSelect(windowId);
                } catch (err) {
                  console.error(`[plugin ${pluginId}] window menu item failed`, err);
                }
              },
            });
            disposables.push(remove);
            return remove;
          },
        },
        apps: {
          getSetting: getAppSetting,
          setSetting: setAppSetting,
        },
        notifications: {
          push: (opts) =>
            shellActionsRef.current.pushNotification({
              appName: pluginId,
              summary: opts.summary,
              body: opts.body ?? "",
              urgency: opts.urgency,
            }),
        },
        storage: {
          get: <T = unknown,>(key: string) => {
            try {
              const pluginIniFile = `${VFS_HOME}/.config/piloti/plugins/${pluginId}.ini`;
              const legacyJsonFile = `${VFS_HOME}/.config/piloti/plugins/${pluginId}.state.json`;
              const rawIni = readVfsStateText(pluginIniFile);
              let entries: Record<string, string> =
                rawIni !== null
                  ? (parseIniText(rawIni)["org.piloti.plugin"] ?? {})
                  : {};
              if (rawIni === null) {
                const legacyObj =
                  readVfsStateJson<Record<string, unknown>>(legacyJsonFile);
                if (legacyObj && typeof legacyObj === "object") {
                  entries = Object.fromEntries(
                    Object.entries(legacyObj).map(([k, v]) => [
                      k,
                      JSON.stringify(v),
                    ])
                  );
                  writeVfsStateText(
                    pluginIniFile,
                    serializeIniText({ "org.piloti.plugin": entries })
                  );
                  removeVfsStateFile(legacyJsonFile);
                }
              }
              if (key in entries) {
                try {
                  return JSON.parse(entries[key]) as T;
                } catch {
                  return entries[key] as unknown as T;
                }
              }
              const legacyRaw = consumeLegacyLocalStorageValue(
                `${PLUGIN_STORAGE_PREFIX}${pluginId}.${key}`
              );
              if (legacyRaw !== null) {
                const parsed = JSON.parse(legacyRaw) as T;
                writeVfsStateText(
                  pluginIniFile,
                  serializeIniText({
                    "org.piloti.plugin": {
                      ...entries,
                      [key]: JSON.stringify(parsed),
                    },
                  })
                );
                return parsed;
              }
              return undefined;
            } catch {
              return undefined;
            }
          },
          set: (key, value) => {
            try {
              const pluginIniFile = `${VFS_HOME}/.config/piloti/plugins/${pluginId}.ini`;
              const rawIni = readVfsStateText(pluginIniFile);
              const existing =
                rawIni !== null
                  ? (parseIniText(rawIni)["org.piloti.plugin"] ?? {})
                  : {};
              writeVfsStateText(
                pluginIniFile,
                serializeIniText({
                  "org.piloti.plugin": {
                    ...existing,
                    [key]: JSON.stringify(value),
                  },
                })
              );
            } catch {
              // ignore storage quota errors
            }
          },
        },
        piloti,
        onCleanup: (fn) => {
          disposables.push(fn);
        },
      };
    },
    [piloti]
  );

  const activateDiscoveredPlugin = React.useCallback(
    async (plugin: DiscoveredPlugin): Promise<string | undefined> => {
      disposePlugin(plugin.id);
      const disposables: Array<() => void> = [];
      disposablesRef.current.set(plugin.id, disposables);

      const ctx = buildPluginContext(plugin.id, disposables);

      try {
        if (plugin.stylePath) {
          const res = await hostFiles(piloti).readText(plugin.stylePath);
          res.match({
            Ok: (css) => injectPluginCss(plugin.id, css),
            Err: () => undefined,
          });
        }

        for (const cmd of plugin.commands) {
          ctx.commands.register({
            id: cmd.id,
            title: cmd.title,
            keywords: cmd.keywords,
            run: () => {
              if (cmd.url) {
                shellActionsRef.current.openWebUrl(cmd.url, { title: cmd.title });
              } else if (cmd.appId) {
                shellActionsRef.current.launchApp(cmd.appId);
              } else if (cmd.exec && cmd.exec.length > 0) {
                spawnProgram(piloti, cmd.exec);
              }
            },
          });
        }

        if (plugin.wallpapers && plugin.wallpapers.length > 0) {
          const readOpt = async (rel?: string) => {
            if (!rel) return undefined;
            const res = await hostFiles(piloti).readText(rel);
            return res.match({ Ok: (t) => t, Err: () => undefined });
          };
          for (const wp of plugin.wallpapers) {
            const [cssAnimation, cssAnimationDark, htmlSrcDoc, htmlSrcDocDark] =
              await Promise.all([
                readOpt(wp.style),
                readOpt(wp.darkStyle),
                readOpt(wp.html),
                readOpt(wp.darkHtml),
              ]);
            const kind =
              wp.type === "html" || htmlSrcDoc || htmlSrcDocDark
                ? "html"
                : wp.type === "css" || cssAnimation || cssAnimationDark
                  ? "css"
                  : "static";
            ctx.wallpapers.register({
              id: wp.id,
              name: wp.name,
              subtitle: wp.subtitle,
              kind,
              backgroundCss:
                wp.backgroundCss ??
                "linear-gradient(175deg, #050811 0%, #0c1424 100%)",
              ...(cssAnimation ? { cssAnimation } : {}),
              ...(cssAnimationDark ? { cssAnimationDark } : {}),
              ...(htmlSrcDoc ? { htmlSrcDoc } : {}),
              ...(htmlSrcDocDark ? { htmlSrcDocDark } : {}),
              ...(wp.image
                ? { imageUrl: `file://${VFS_HOME}/${wp.image.replace(/^\/+/, "")}` }
                : {}),
              ...(wp.darkImage
                ? {
                    imageUrlDark: `file://${VFS_HOME}/${wp.darkImage.replace(/^\/+/, "")}`,
                  }
                : {}),
            });
          }
        }

        const bundled = plugin.scope === "system" ? BUNDLED_PLUGINS[plugin.id] : undefined;
        if (plugin.scriptPath && !safeMode && bundled) {
          await activatePluginModule(bundled, ctx, disposables);
        } else if (plugin.scriptPath && !safeMode) {
          // The shell's security policy on Linux refuses scripts read from disk.
          if (systemServices) {
            throw new Error(_("Can't run on Linux: only the scripts that come with Piloti do."));
          }
          const res = await hostFiles(piloti).readText(plugin.scriptPath);
          const scriptText = res.match({
            Ok: (text) => text,
            Err: () => null,
          });
          if (scriptText !== null) {
            await loadPluginScript(scriptText, ctx, disposables);
          }
        }

        activeSignatureRef.current.set(
          plugin.id,
          `${plugin.stylePath ?? ""}|${plugin.scriptPath ?? ""}|${plugin.commands.length}|${plugin.wallpapers?.length ?? 0}`
        );
        return undefined;
      } catch (err) {
        console.warn(`[Plugin:${plugin.id}] not loaded:`, err);
        disposePlugin(plugin.id);
        return err instanceof Error ? err.message : String(err);
      }
    },
    [buildPluginContext, disposePlugin, piloti, safeMode, systemServices]
  );

  const syncPlugins = React.useCallback(
    async (enabledIds: readonly string[], forceReloadId?: string) => {
      setLoading(true);
      const finishPlugins = startBootPhase("plugins");
      try {
        const list = await discoverPlugins(hostFiles(piloti), enabledIds);
        const enabledSet = new Set(enabledIds);

        // Dispose plugins that were disabled or removed
        const discoveredIds = new Set(list.map((p) => p.id));
        const isThemeActive = (p: DiscoveredPlugin) =>
          p.kind === "theme" && settings.interfaceTheme === p.id;
        for (const activeId of Array.from(disposablesRef.current.keys())) {
          const item = list.find((p) => p.id === activeId);
          if (!discoveredIds.has(activeId) || (!enabledSet.has(activeId) && !(item && isThemeActive(item)))) {
            disposePlugin(activeId);
          }
        }

        const withErrors: DiscoveredPlugin[] = [];
        for (const plugin of list) {
          if (!plugin.enabled && !isThemeActive(plugin)) {
            withErrors.push(plugin);
            continue;
          }
          const sig = `${plugin.stylePath ?? ""}|${plugin.scriptPath ?? ""}|${plugin.commands.length}|${plugin.wallpapers?.length ?? 0}`;
          const alreadyLoaded =
            activeSignatureRef.current.get(plugin.id) === sig &&
            forceReloadId !== plugin.id;
          if (alreadyLoaded) {
            withErrors.push(plugin);
            continue;
          }
          const err = await activateDiscoveredPlugin(plugin);
          withErrors.push(err ? { ...plugin, error: err } : plugin);
        }

        setPlugins(withErrors);

        // Sync GTK4/GTK3 CSS shipped by active themes/plugins
        const readBlocks = async (
          key: "gtk4StylePath" | "gtk3StylePath"
        ): Promise<Array<{ id: string; css: string }>> => {
          const blocks: Array<{ id: string; css: string }> = [];
          for (const plugin of withErrors) {
            const relPath = plugin[key];
            if (!relPath) continue;
            const activeBySetting =
              plugin.kind === "theme" && settings.interfaceTheme === plugin.id;
            if (!plugin.enabled && !activeBySetting) continue;
            try {
              const res = await hostFiles(piloti).readText(relPath);
              const css = res.match({ Ok: (t) => t, Err: () => "" });
              if (css.trim()) blocks.push({ id: plugin.id, css });
            } catch {
              // ignore unreadable CSS
            }
          }
          return blocks;
        };

        const [gtk4Blocks, gtk3Blocks] = await Promise.all([
          readBlocks("gtk4StylePath"),
          readBlocks("gtk3StylePath"),
        ]);
        await syncManagedGtkCssFile(hostFiles(piloti), ".config/gtk-4.0", gtk4Blocks).catch(
          () => undefined
        );
        await syncManagedGtkCssFile(hostFiles(piloti), ".config/gtk-3.0", gtk3Blocks).catch(
          () => undefined
        );
      } finally {
        finishPlugins(`${enabledIds.length} enabled`);
        setLoading(false);
        setReady(true);
      }
    },
    [activateDiscoveredPlugin, disposePlugin, piloti, settings.interfaceTheme]
  );

  React.useEffect(() => {
    void syncPlugins(settings.enabledPluginIds ?? []);
  }, [settings.enabledPluginIds, settings.interfaceTheme, syncPlugins]);

  React.useEffect(() => {
    return () => {
      for (const id of Array.from(disposablesRef.current.keys())) {
        disposePlugin(id);
      }
    };
  }, [disposePlugin]);

  const togglePlugin = React.useCallback(
    (id: string, nextEnabled?: boolean) => {
      const current = settings.enabledPluginIds ?? [];
      const isEnabled = current.includes(id);
      const target = nextEnabled ?? !isEnabled;
      if (target === isEnabled) return;
      const updated = target
        ? [...current, id]
        : current.filter((item) => item !== id);
      updateSettings({ enabledPluginIds: updated });
    },
    [settings.enabledPluginIds, updateSettings]
  );

  const reloadPlugin = React.useCallback(
    async (id: string) => {
      await syncPlugins(settings.enabledPluginIds ?? [], id);
    },
    [settings.enabledPluginIds, syncPlugins]
  );

  const refreshPlugins = React.useCallback(async () => {
    await syncPlugins(settings.enabledPluginIds ?? []);
  }, [settings.enabledPluginIds, syncPlugins]);

  const createSamplePlugin = React.useCallback(
    async (kind: "css" | "js"): Promise<string | null> => {
      try {
        await hostFiles(piloti).createDir(".config").catch(() => undefined);
        await hostFiles(piloti).createDir(".config/piloti").catch(() => undefined);
        await hostFiles(piloti).createDir(PLUGINS_REL_DIR).catch(() => undefined);

        const id = kind === "css" ? "sample-accent" : "sample-status";
        const fileName = kind === "css" ? `${id}.css` : `${id}.js`;
        const relPath = `${PLUGINS_REL_DIR}/${fileName}`;
        const content =
          kind === "css"
            ? `/* Piloti CSS Plugin — edit me in ~/.config/piloti/plugins/${fileName} */\n:root {\n  --ui-accent: #9141ac;\n}\n`
            : `// Piloti JS Plugin — no manifest.json required\nexport function activate(ctx) {\n  let clicks = 0;\n  const item = ctx.menubar.addStatusItem({\n    id: "hello",\n    label: "★ 0",\n    tooltip: "Sample plugin status item",\n    onClick() {\n      clicks += 1;\n      item.update({ label: \`★ \${clicks}\` });\n      ctx.notifications.push({\n        summary: "Sample Plugin",\n        body: \`Clicked \${clicks} time(s)\`,\n      });\n    },\n  });\n}\n`;

        await hostFiles(piloti).write(relPath, content);
        const current = settings.enabledPluginIds ?? [];
        if (!current.includes(id)) {
          updateSettings({ enabledPluginIds: [...current, id] });
        } else {
          await syncPlugins(current, id);
        }
        return relPath;
      } catch {
        return null;
      }
    },
    [piloti, settings.enabledPluginIds, syncPlugins, updateSettings]
  );

  const value = React.useMemo<PluginsContextValue>(
    () => ({
      plugins,
      statusItems,
      pluginCommands,
      launcherProviders,
      pluginWallpapers,
      safeMode,
      loading,
      ready,
      togglePlugin,
      reloadPlugin,
      refreshPlugins,
      createSamplePlugin,
    }),
    [
      createSamplePlugin,
      launcherProviders,
      loading,
      pluginCommands,
      ready,
      pluginWallpapers,
      plugins,
      refreshPlugins,
      reloadPlugin,
      safeMode,
      statusItems,
      togglePlugin,
    ]
  );

  return (
    <PluginsContext.Provider value={value}>{children}</PluginsContext.Provider>
  );
}

export function useOptionalPlugins(): PluginsContextValue | null {
  return React.useContext(PluginsContext);
}

export function usePlugins(): PluginsContextValue {
  const ctx = React.useContext(PluginsContext);
  if (!ctx) {
    throw new Error("usePlugins must be used within PluginsProvider");
  }
  return ctx;
}
