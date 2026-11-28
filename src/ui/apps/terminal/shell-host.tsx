/** The Terminal in a shell window: the shell's own settings, windows and apps. */
import * as React from "react";
import type { DesktopSettings } from "@/core/config/desktop-settings";
import { hostFiles } from "@/core/files/host-files";
import { getEngine } from "@/core/ports/engine";
import { onShellEvent } from "@/core/windows/shell-events";
import { usePiloti } from "@/platform/shared/piloti";
import { readSystemSample } from "@/platform/shared/system-commands";
import type { TerminalHost } from "@/ui/apps/terminal/host";
import { XtermTerminalApp } from "@/ui/apps/terminal/XtermTerminalApp";
import {
  useApps,
  useSettingsSelector,
  useSystemBackends,
  useUpdateSettings,
  useWindowActions,
  useWindowManagerSelector,
} from "@/ui/context/DesktopStateContext";
import { useOpenPath } from "@/ui/hooks/use-open-path";
import { useShellHost } from "@/ui/hooks/use-shell-host";

/** A value React holds, offered to a host as `current` + `watch`. */
function useWatchable<T>(value: T) {
  const ref = React.useRef(value);
  const listeners = React.useRef(new Set<(value: T) => void>());
  React.useEffect(() => {
    ref.current = value;
    listeners.current.forEach((l) => l(value));
  }, [value]);
  return React.useMemo(
    () => ({
      current: () => ref.current,
      watch(listener: (value: T) => void) {
        listeners.current.add(listener);
        listener(ref.current);
        return () => void listeners.current.delete(listener);
      },
    }),
    [],
  );
}

export const ShellTerminalApp = ({ windowId = "" }: { windowId?: string; initialPath?: string }) => {
  const piloti = usePiloti();
  const shell = useShellHost();
  const settings = useSettingsSelector((v) => v.settings);
  const updateSettings = useUpdateSettings();
  const { pushNotification } = useSystemBackends();
  const { launchApp } = useWindowActions();
  const { installedXdgApps } = useApps();
  const { openPath } = useOpenPath();
  const desktop = useWatchable<DesktopSettings>(settings);
  const focus = useWatchable(useWindowManagerSelector((wm) => wm.focusedWindowId === windowId));
  // Read through refs: the host stays the same, so the session does not restart.
  const live = React.useRef({ installedXdgApps, openPath, launchApp, pushNotification, updateSettings });
  live.current = { installedXdgApps, openPath, launchApp, pushNotification, updateSettings };

  const host = React.useMemo<TerminalHost>(
    () => ({
      vfs: piloti.vfs,
      system: { files: hostFiles(piloti), processes: piloti.processes },
      shell,
      apps: { list: async () => live.current.installedXdgApps },
      launch: (appId, payload) => live.current.launchApp(appId, { payload }),
      open: (path, kind) => void live.current.openPath(path, { kind }),
      notify: ({ summary, body = "" }) =>
        live.current.pushNotification({ appName: "Piloti shell", summary, body }),
      desktop: { ...desktop, update: (patch) => live.current.updateSettings(patch) },
      readSample: () => readSystemSample(piloti),
      globals: { piloti, files: hostFiles(piloti) },
      watchFocus: focus.watch,
      onSelectAll: (listener) =>
        onShellEvent("piloti:select-all", (detail, event) => {
          if (detail.windowId !== windowId) return;
          event.preventDefault();
          listener();
        }),
      simulatedProcesses: !getEngine().capabilities.systemServices,
    }),
    [piloti, shell, desktop, focus, windowId],
  );
  return <XtermTerminalApp host={host} />;
};
