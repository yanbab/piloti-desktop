import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { PluginsProvider } from "@/context/PluginsContext";
import { attachConsoleDiskSink } from "@/lib/core/console-store";
import { AppsContext, useApps, useAppsValue } from "./AppsContext";
import {
  type DesktopSettings,
  type InstalledWebApp,
  type SavedWindowBounds,
  SettingsContext,
  type WindowDecorationMode,
  useSettings,
  useSettingsValue,
} from "./SettingsContext";
import {
  type PowerAction,
  type ShellNotification,
  SystemBackendsContext,
  useSystemBackends,
  useSystemBackendsValue,
} from "./SystemBackendsContext";
import {
  type DesktopWindowInstance,
  normalizeWebUrl,
  type ResolvedPopupWindow,
  useWindowActions,
  useWindowManager,
  useWindowsValue,
  WindowActionsContext,
  type WindowActionsValue,
  WindowsContext,
} from "./WindowsContext";
import {
  createSelectorStore,
  createWindowManagerStore,
  type SelectorStore,
  useStoreSelector,
  useWindowManagerSelector,
  WindowManagerStoreContext,
} from "./windows/window-manager-store";
import type { SettingsContextValue } from "./SettingsContext";

const SettingsStoreContext = React.createContext<SelectorStore<SettingsContextValue> | null>(
  null,
);

/** Settings minus fields that change on every window drag / icon move. */
export type ChromeSettings = Omit<DesktopSettings, "savedWindowBounds" | "desktopIconPositions">;

function selectChromeSettings(v: SettingsContextValue) {
  const { savedWindowBounds: _bounds, desktopIconPositions: _icons, ...settings } = v.settings;
  return {
    isBrowserRuntime: v.isBrowserRuntime,
    updateSettings: v.updateSettings,
    settings: settings as ChromeSettings,
  };
}

/**
 * `useSettings()` for shell chrome (MenuBar, Dock, Launcher, window buttons):
 * same `settings` object shape but without `savedWindowBounds` /
 * `desktopIconPositions`, so dragging a window or an icon doesn't re-render it.
 */
export function useChromeSettings(): ReturnType<typeof selectChromeSettings> {
  const store = React.useContext(SettingsStoreContext);
  if (!store) throw new Error("useChromeSettings must be used within DesktopStateProvider");
  return useStoreSelector(store, selectChromeSettings);
}

export type {
  DesktopSettings,
  DesktopWindowInstance,
  InstalledWebApp,
  PowerAction,
  ResolvedPopupWindow,
  SavedWindowBounds,
  ShellNotification,
  WindowActionsValue,
  WindowDecorationMode,
};

export {
  normalizeWebUrl,
  useApps,
  useSettings,
  useSystemBackends,
  useWindowActions,
  useWindowManager,
  useWindowManagerSelector,
};

function WindowsLayer({ children }: { children: React.ReactNode }) {
  const settingsValue = useSettings();
  const systemBackendsValue = useSystemBackends();
  const appsValue = useApps();
  const windowsValue = useWindowsValue(
    settingsValue,
    systemBackendsValue,
    appsValue
  );
  const windowsRef = React.useRef(windowsValue.windows);
  windowsRef.current = windowsValue.windows;
  const getWindows = React.useCallback(() => windowsRef.current, []);

  // Latest value for the external store + stable action wrappers.
  const latestRef = React.useRef(windowsValue);
  latestRef.current = windowsValue;
  const storeRef = React.useRef<ReturnType<typeof createWindowManagerStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createWindowManagerStore(() => latestRef.current);
  }
  const store = storeRef.current;
  React.useLayoutEffect(() => {
    store.notify();
  }, [store, windowsValue]);

  // Actions never change identity: each wrapper calls the latest implementation,
  // so `useWindowActions()` consumers don't re-render on window changes.
  const actionsValue = React.useMemo<WindowActionsValue>(() => {
    const call =
      <K extends keyof WindowActionsValue>(key: K) =>
      ((...args: unknown[]) =>
        (latestRef.current[key] as (...a: unknown[]) => unknown)(...args)) as WindowActionsValue[K];
    return {
      launchApp: call("launchApp"),
      launchXdgApp: call("launchXdgApp"),
      markWindowReady: call("markWindowReady"),
      openGnomeSettings: call("openGnomeSettings"),
      openWebUrl: call("openWebUrl"),
      focusWindow: call("focusWindow"),
      closeWindow: call("closeWindow"),
      forceQuitApp: call("forceQuitApp"),
      toggleMinimizeWindow: call("toggleMinimizeWindow"),
      minimizeWindow: call("minimizeWindow"),
      toggleMaximizeWindow: call("toggleMaximizeWindow"),
      tileWindow: call("tileWindow"),
      updateWindowGeometry: call("updateWindowGeometry"),
      handleMenuAction: call("handleMenuAction"),
      setLauncherOpen: call("setLauncherOpen"),
      setControlPanelOpen: call("setControlPanelOpen"),
      setAboutOpen: call("setAboutOpen"),
      setOverviewOpen: call("setOverviewOpen"),
      toggleOverview: call("toggleOverview"),
      moveWindowToWorkspace: call("moveWindowToWorkspace"),
      removeWorkspace: call("removeWorkspace"),
      openAltTab: call("openAltTab"),
    };
  }, []);
  return (
    <WindowManagerStoreContext.Provider value={store}>
      <WindowActionsContext.Provider value={actionsValue}>
        <WindowsContext.Provider value={windowsValue}>
          <PluginsProvider getWindows={getWindows}>{children}</PluginsProvider>
        </WindowsContext.Provider>
      </WindowActionsContext.Provider>
    </WindowManagerStoreContext.Provider>
  );
}

function AppsLayer({
  onEssentialIconsReady,
  children,
}: {
  onEssentialIconsReady: () => void;
  children: React.ReactNode;
}) {
  const settingsValue = useSettings();
  const systemBackendsValue = useSystemBackends();
  const appsValue = useAppsValue(
    settingsValue,
    systemBackendsValue,
    onEssentialIconsReady
  );
  return (
    <AppsContext.Provider value={appsValue}>
      <WindowsLayer>{children}</WindowsLayer>
    </AppsContext.Provider>
  );
}

function SystemBackendsLayer({
  onEssentialIconsReady,
  greeterMode,
  children,
}: {
  onEssentialIconsReady: () => void;
  greeterMode?: boolean;
  children: React.ReactNode;
}) {
  const settingsValue = useSettings();
  const systemBackendsValue = useSystemBackendsValue(settingsValue, {
    greeterMode,
  });
  return (
    <SystemBackendsContext.Provider value={systemBackendsValue}>
      <AppsLayer onEssentialIconsReady={onEssentialIconsReady}>
        {children}
      </AppsLayer>
    </SystemBackendsContext.Provider>
  );
}

export function DesktopStateProvider({
  greeterMode = false,
  children,
}: {
  greeterMode?: boolean;
  children: React.ReactNode;
}) {
  const domicile = useDomicile();
  const [essentialIconsReady, setEssentialIconsReady] = React.useState(false);
  const handleEssentialIconsReady = React.useCallback(() => {
    setEssentialIconsReady(true);
  }, []);

  const settingsValue = useSettingsValue({
    deferLocalWallpaper: !essentialIconsReady,
  });

  React.useEffect(() => {
    attachConsoleDiskSink(domicile, settingsValue.isBrowserRuntime);
  }, [domicile, settingsValue.isBrowserRuntime]);

  const latestSettingsRef = React.useRef(settingsValue);
  latestSettingsRef.current = settingsValue;
  const settingsStoreRef = React.useRef<ReturnType<
    typeof createSelectorStore<SettingsContextValue>
  > | null>(null);
  if (!settingsStoreRef.current) {
    settingsStoreRef.current = createSelectorStore(() => latestSettingsRef.current);
  }
  const settingsStore = settingsStoreRef.current;
  React.useLayoutEffect(() => {
    settingsStore.notify();
  }, [settingsStore, settingsValue]);

  return (
    <SettingsStoreContext.Provider value={settingsStore}>
    <SettingsContext.Provider value={settingsValue}>
      <SystemBackendsLayer
        onEssentialIconsReady={handleEssentialIconsReady}
        greeterMode={greeterMode}
      >
        {children}
      </SystemBackendsLayer>
    </SettingsContext.Provider>
    </SettingsStoreContext.Provider>
  );
}
