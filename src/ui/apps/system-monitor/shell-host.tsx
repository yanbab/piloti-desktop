/** System Monitor in a shell window, or in the demo's iframe. */
import * as React from "react";
import type { ShellHost } from "@/core/ports/shell-host";
import { getEngine } from "@/core/ports/engine";
import { appIconThemes, createAppDescriber } from "@/core/apps/describe-apps";
import { hostFiles } from "@/core/files/host-files";
import { DEFAULT_SETTINGS } from "@/core/config/desktop-settings";
import { parseDesktopSettingsRaw } from "@/core/config/piloti-settings-ini";
import { SHELL_SETTINGS_PATH } from "@/core/state/settings";
import { VFS_HOME } from "@/core/state/vfs-home";
import { readVfsStateText } from "@/core/state/vfs-state";
import { createShellAppHost } from "@/platform/shared/app-shell-host";
import { createFrameShellHost } from "@/platform/shared/app-frame-shell";
import { useIsolatedAppBridge } from "@/platform/shared/app-bridge";
import { usePiloti, type Piloti } from "@/platform/shared/piloti";
import { readSystemSample } from "@/platform/shared/system-commands";
import {
  carryOverSettings,
  FORMER_SETTINGS,
  type MonitorAppInfo,
  type SystemMonitorHost,
} from "@/ui/apps/system-monitor/host";
import { SystemMonitorApp } from "@/ui/apps/system-monitor/SystemMonitorApp";
import { useOptionalApps } from "@/ui/context/AppsContext";
import { useShellHost } from "@/ui/hooks/use-shell-host";

type Describe = SystemMonitorHost["describeApps"];

function createHost(
  piloti: Piloti,
  shell: ShellHost,
  apps: Pick<SystemMonitorHost, "describeApps" | "onAppsChanged">,
): SystemMonitorHost {
  carryOverSettings(readVfsStateText(`${VFS_HOME}/${FORMER_SETTINGS}`));
  return {
    shell,
    readSample: () => readSystemSample(piloti),
    ...apps,
    simulatedProcesses: !getEngine().capabilities.systemServices,
  };
}

/** In the shell: its window manager, and the icons it already has. */
export const ShellSystemMonitorApp = () => {
  const piloti = usePiloti();
  const shell = useShellHost();
  const apps = useOptionalApps();
  // Read through a ref: the icons arrive one by one and must not restart sampling.
  const appsRef = React.useRef(apps);
  appsRef.current = apps;
  const changed = React.useRef(new Set<() => void>());
  React.useEffect(() => changed.current.forEach((l) => l()), [apps?.installedXdgApps, apps?.getAppIconUrl]);
  const describeApps = React.useCallback<Describe>(async (appIds) => {
    const current = appsRef.current;
    const info: Record<string, MonitorAppInfo> = {};
    for (const appId of appIds) {
      info[appId] = {
        name: current?.installedXdgApps.find((e) => e.appId === appId)?.name,
        iconUrl: current?.getAppIconUrl(appId),
      };
    }
    return info;
  }, []);
  const host = React.useMemo(
    () =>
      createHost(piloti, shell, {
        describeApps,
        onAppsChanged(listener) {
          changed.current.add(listener);
          return () => void changed.current.delete(listener);
        },
      }),
    [piloti, shell, describeApps],
  );
  return <SystemMonitorApp host={host} />;
};

/** The look the demo's desktop has, for its icons. */
const readDesktopLook = () => {
  const raw = readVfsStateText(SHELL_SETTINGS_PATH);
  return { ...DEFAULT_SETTINGS, ...(raw ? parseDesktopSettingsRaw(raw) : null) };
};

/** In the demo's iframe: the page around it holds the windows. */
export const FrameSystemMonitorApp = ({ windowId }: { windowId: string }) => {
  const piloti = usePiloti();
  // Says it is ready, takes the desktop's theme, and focuses its window on a click.
  useIsolatedAppBridge(windowId, false);
  const host = React.useMemo(() => {
    const apps = createShellAppHost(piloti).apps;
    const files = hostFiles(piloti);
    return createHost(piloti, createFrameShellHost(windowId), {
      describeApps: createAppDescriber({ files }, apps, appIconThemes(readDesktopLook())),
    });
  }, [piloti, windowId]);
  return <SystemMonitorApp host={host} />;
};
