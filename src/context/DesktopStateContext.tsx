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
  const systemBackendsValue = useSystemBackendsValue(settingsValue);
  const appsValue = useAppsValue(
    settingsValue,
    systemBackendsValue,
    handleEssentialIconsReady
  );
  const windowsValue = useWindowsValue(
    settingsValue,
    systemBackendsValue,
    appsValue
  );

  return (
    <SettingsContext.Provider value={settingsValue}>
      <SystemBackendsContext.Provider value={systemBackendsValue}>
        <AppsContext.Provider value={appsValue}>
          <WindowsContext.Provider value={windowsValue}>
            {children}
          </WindowsContext.Provider>
        </AppsContext.Provider>
      </SystemBackendsContext.Provider>
    </SettingsContext.Provider>
  );
}
