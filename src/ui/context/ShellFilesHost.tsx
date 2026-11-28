/**
 * Folders' host in the shell: its contexts. Every shell view gets it, so the
 * Desktop's icons, Folders windows and path labels share the same one.
 */
import * as React from "react";
import { FilesHostProvider, type FilesHost } from "@/ui/components/files-host";
import { useApps } from "@/ui/context/AppsContext";
import {
  useDesktopSettings,
  useSystemBackends,
  useUpdateSettings,
  useWindowActions,
  useWindowManagerSelector,
} from "@/ui/context/DesktopStateContext";
import { useModuleOpenRequests } from "@/ui/context/windows/use-module-open-requests";
import { useOpenPath } from "@/ui/hooks/use-open-path";

const SHELL_FILES_HOST: FilesHost = {
  useDesktopSettings,
  useApps: () => {
    const { installedXdgApps, getAppIconUrl, ensureWaylandIcons, xdgUserDirs } = useApps();
    return React.useMemo(
      () => ({ installedXdgApps, getAppIconUrl, ensureWaylandIcons, xdgUserDirs }),
      [installedXdgApps, getAppIconUrl, ensureWaylandIcons, xdgUserDirs],
    );
  },
  useActions: () => {
    const { launchApp, launchXdgApp, openWebUrl } = useWindowActions();
    const updateSettings = useUpdateSettings();
    const { pushNotification } = useSystemBackends();
    return React.useMemo(
      () => ({ launchApp, launchXdgApp, openWebUrl, updateSettings, notify: pushNotification }),
      [launchApp, launchXdgApp, openWebUrl, updateSettings, pushNotification],
    );
  },
  useOpenPath,
  useWindows: () =>
    useWindowManagerSelector((wm) => ({
      windows: wm.windows.map((w) => ({ appId: w.appId, payload: w.payload })),
      focusedWindowId: wm.focusedWindowId,
    })),
};

export function ShellFilesHost({ children }: { children: React.ReactNode }) {
  // Folders in its own process opens files through the shell.
  useModuleOpenRequests();
  return <FilesHostProvider value={SHELL_FILES_HOST}>{children}</FilesHostProvider>;
}
