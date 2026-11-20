import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { PluginsProvider } from "@/context/PluginsContext";
import { attachConsoleDiskSink } from "@/lib/console-store";
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
  const actionsValue = React.useMemo<WindowActionsValue>(
    () => ({
      launchApp: windowsValue.launchApp,
      launchXdgApp: windowsValue.launchXdgApp,
      markWindowReady: windowsValue.markWindowReady,
      openGnomeSettings: windowsValue.openGnomeSettings,
      openWebUrl: windowsValue.openWebUrl,
      focusWindow: windowsValue.focusWindow,
      closeWindow: windowsValue.closeWindow,
      forceQuitApp: windowsValue.forceQuitApp,
      toggleMinimizeWindow: windowsValue.toggleMinimizeWindow,
      minimizeWindow: windowsValue.minimizeWindow,
      toggleMaximizeWindow: windowsValue.toggleMaximizeWindow,
      tileWindow: windowsValue.tileWindow,
      updateWindowGeometry: windowsValue.updateWindowGeometry,
      handleMenuAction: windowsValue.handleMenuAction,
      setLauncherOpen: windowsValue.setLauncherOpen,
      setControlPanelOpen: windowsValue.setControlPanelOpen,
      setAboutOpen: windowsValue.setAboutOpen,
      setOverviewOpen: windowsValue.setOverviewOpen,
      toggleOverview: windowsValue.toggleOverview,
      moveWindowToWorkspace: windowsValue.moveWindowToWorkspace,
      removeWorkspace: windowsValue.removeWorkspace,
    }),
    [
      windowsValue.closeWindow,
      windowsValue.focusWindow,
      windowsValue.forceQuitApp,
      windowsValue.handleMenuAction,
      windowsValue.launchApp,
      windowsValue.launchXdgApp,
      windowsValue.markWindowReady,
      windowsValue.minimizeWindow,
      windowsValue.moveWindowToWorkspace,
      windowsValue.openGnomeSettings,
      windowsValue.openWebUrl,
      windowsValue.removeWorkspace,
      windowsValue.setAboutOpen,
      windowsValue.setControlPanelOpen,
      windowsValue.setLauncherOpen,
      windowsValue.setOverviewOpen,
      windowsValue.tileWindow,
      windowsValue.toggleMaximizeWindow,
      windowsValue.toggleMinimizeWindow,
      windowsValue.toggleOverview,
      windowsValue.updateWindowGeometry,
    ]
  );
  return (
    <WindowActionsContext.Provider value={actionsValue}>
      <WindowsContext.Provider value={windowsValue}>
        <PluginsProvider getWindows={getWindows}>{children}</PluginsProvider>
      </WindowsContext.Provider>
    </WindowActionsContext.Provider>
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
  children,
}: {
  onEssentialIconsReady: () => void;
  children: React.ReactNode;
}) {
  const settingsValue = useSettings();
  const systemBackendsValue = useSystemBackendsValue(settingsValue);
  return (
    <SystemBackendsContext.Provider value={systemBackendsValue}>
      <AppsLayer onEssentialIconsReady={onEssentialIconsReady}>
        {children}
      </AppsLayer>
    </SystemBackendsContext.Provider>
  );
}

export function DesktopStateProvider({
  children,
}: {
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

  return (
    <SettingsContext.Provider value={settingsValue}>
      <SystemBackendsLayer onEssentialIconsReady={handleEssentialIconsReady}>
        {children}
      </SystemBackendsLayer>
    </SettingsContext.Provider>
  );
}
