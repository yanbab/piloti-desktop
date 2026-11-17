import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
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
  useWindowManager,
  useWindowsValue,
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
  WindowDecorationMode,
};

export {
  normalizeWebUrl,
  useApps,
  useSettings,
  useSystemBackends,
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
  return (
    <WindowsContext.Provider value={windowsValue}>
      {children}
    </WindowsContext.Provider>
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
