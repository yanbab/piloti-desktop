import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  useSettings,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import {
  discoverPlugins,
  injectPluginCss,
  loadPluginScript,
  PLUGINS_REL_DIR,
  removePluginCss,
  syncManagedGtkCssFile,
} from "@/lib/plugins/loader";
import { parseIniText, serializeIniText } from "@/lib/ini";
import { consumeLegacyLocalStorageValue } from "@/lib/web-vfs";
import {
  readVfsStateJson,
  readVfsStateText,
  removeVfsStateFile,
  writeVfsStateText,
} from "@/lib/vfs-state";
import type {
  DiscoveredPlugin,
  LauncherProvider,
  MenuBarStatusItem,
  MenuBarStatusItemInput,
  PilotiPluginContext,
  PluginCommandEntry,
} from "@/lib/plugins/types";

interface PluginsContextValue {
  plugins: DiscoveredPlugin[];
  statusItems: MenuBarStatusItem[];
  pluginCommands: PluginCommandEntry[];
  launcherProviders: LauncherProvider[];
  safeMode: boolean;
  loading: boolean;
  togglePlugin: (id: string, enabled?: boolean) => void;
  reloadPlugin: (id: string) => Promise<void>;
  refreshPlugins: () => Promise<void>;
  createSamplePlugin: (kind: "css" | "js") => Promise<string | null>;
}

const PluginsContext = React.createContext<PluginsContextValue | null>(null);

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
  const domicile = useDomicile();
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
  const [loading, setLoading] = React.useState(false);

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

  // Expose global shell bridge for top-level JS plugins / monkey-patching
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = {
      domicile,
      windows: {
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
        get: () => shellActionsRef.current.settings,
        update: (patch: Parameters<typeof updateSettings>[0]) =>
          shellActionsRef.current.updateSettings(patch),
      },
      plugins: {
        get list() {
          return pluginsRef.current;
        },
      },
    };
    (window as unknown as Record<string, unknown>).__PILOTI__ = bridge;
  }, [domicile]);

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
    activeSignatureRef.current.delete(pluginId);
  }, []);

  const buildPluginContext = React.useCallback(
    (pluginId: string, disposables: Array<() => void>): PilotiPluginContext => {
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
        windows: {
          openWebUrl: (url, title) =>
            shellActionsRef.current.openWebUrl(url, title ? { title } : undefined),
          launchApp: (appId) => shellActionsRef.current.launchApp(appId),
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
              const pluginIniFile = `/home/user/.config/piloti/plugins/${pluginId}.ini`;
              const legacyJsonFile = `/home/user/.config/piloti/plugins/${pluginId}.state.json`;
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
              const pluginIniFile = `/home/user/.config/piloti/plugins/${pluginId}.ini`;
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
        domicile,
        onCleanup: (fn) => {
          disposables.push(fn);
        },
      };
    },
    [domicile]
  );

  const activateDiscoveredPlugin = React.useCallback(
    async (plugin: DiscoveredPlugin): Promise<string | undefined> => {
      disposePlugin(plugin.id);
      const disposables: Array<() => void> = [];
      disposablesRef.current.set(plugin.id, disposables);

      const ctx = buildPluginContext(plugin.id, disposables);

      try {
        if (plugin.stylePath) {
          const res = await domicile.files.readText(plugin.stylePath);
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
                void domicile.processes.spawn(cmd.exec).catch(() => undefined);
              }
            },
          });
        }

        if (plugin.scriptPath && !safeMode) {
          const res = await domicile.files.readText(plugin.scriptPath);
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
          `${plugin.stylePath ?? ""}|${plugin.scriptPath ?? ""}|${plugin.commands.length}`
        );
        return undefined;
      } catch (err) {
        disposePlugin(plugin.id);
        return err instanceof Error ? err.message : String(err);
      }
    },
    [buildPluginContext, disposePlugin, domicile, safeMode]
  );

  const syncPlugins = React.useCallback(
    async (enabledIds: readonly string[], forceReloadId?: string) => {
      setLoading(true);
      try {
        const list = await discoverPlugins(domicile.files, enabledIds);
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
          const sig = `${plugin.stylePath ?? ""}|${plugin.scriptPath ?? ""}|${plugin.commands.length}`;
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
              const res = await domicile.files.readText(relPath);
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
        await syncManagedGtkCssFile(domicile.files, ".config/gtk-4.0", gtk4Blocks).catch(
          () => undefined
        );
        await syncManagedGtkCssFile(domicile.files, ".config/gtk-3.0", gtk3Blocks).catch(
          () => undefined
        );
      } finally {
        setLoading(false);
      }
    },
    [activateDiscoveredPlugin, disposePlugin, domicile.files, settings.interfaceTheme]
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
        await domicile.files.createDir(".config").catch(() => undefined);
        await domicile.files.createDir(".config/piloti").catch(() => undefined);
        await domicile.files.createDir(PLUGINS_REL_DIR).catch(() => undefined);

        const id = kind === "css" ? "sample-accent" : "sample-status";
        const fileName = kind === "css" ? `${id}.css` : `${id}.js`;
        const relPath = `${PLUGINS_REL_DIR}/${fileName}`;
        const content =
          kind === "css"
            ? `/* Piloti CSS Plugin — edit me in ~/.config/piloti/plugins/${fileName} */\n:root {\n  --adw-accent: #9141ac;\n}\n`
            : `// Piloti JS Plugin — no manifest.json required\nexport function activate(ctx) {\n  let clicks = 0;\n  const item = ctx.menubar.addStatusItem({\n    id: "hello",\n    label: "★ 0",\n    tooltip: "Sample plugin status item",\n    onClick() {\n      clicks += 1;\n      item.update({ label: \`★ \${clicks}\` });\n      ctx.notifications.push({\n        summary: "Sample Plugin",\n        body: \`Clicked \${clicks} time(s)\`,\n      });\n    },\n  });\n}\n`;

        await domicile.files.write(relPath, content);
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
    [domicile.files, settings.enabledPluginIds, syncPlugins, updateSettings]
  );

  const value = React.useMemo<PluginsContextValue>(
    () => ({
      plugins,
      statusItems,
      pluginCommands,
      launcherProviders,
      safeMode,
      loading,
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
