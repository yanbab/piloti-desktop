import * as React from "react";
import { AppsProvider, useApps } from "./AppsContext";
import {
  type DesktopSettings,
  type InstalledWebApp,
  SettingsProvider,
  type SavedWindowBounds,
  type WindowDecorationMode,
  useSettings,
} from "./SettingsContext";
import {
  type PowerAction,
  type ShellNotification,
  SystemBackendsProvider,
  useSystemBackends,
} from "./SystemBackendsContext";
import {
  type DesktopWindowInstance,
  normalizeWebUrl,
  type ResolvedPopupWindow,
  WindowsProvider,
  useWindowManager,
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
  return (
    <SettingsProvider>
      <SystemBackendsProvider>
        <AppsProvider>
          <WindowsProvider>{children}</WindowsProvider>
        </AppsProvider>
      </SystemBackendsProvider>
    </SettingsProvider>
  );
}

/**
 * Compatibility facade aggregating all 4 focused shell contexts. Components can
 * also subscribe directly via `useSettings()`, `useSystemBackends()`, `useApps()`,
 * or `useWindowManager()` for narrower re-render scopes.
 */
export function useDesktopState() {
  const settingsSlice = useSettings();
  const backendsSlice = useSystemBackends();
  const appsSlice = useApps();
  const windowsSlice = useWindowManager();

  return React.useMemo(
    () => ({
      ...settingsSlice,
      ...backendsSlice,
      ...appsSlice,
      ...windowsSlice,
    }),
    [appsSlice, backendsSlice, settingsSlice, windowsSlice]
  );
}
