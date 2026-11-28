/** Connects the public `piloti.desktop`, `.settings` and `.plugins` to the shell. */
import * as React from "react";
import {
  useSystemBackends,
  useUpdateSettings,
  useWindowActions,
} from "@/ui/context/DesktopStateContext";
import { WindowManagerStoreContext } from "@/ui/context/windows/window-manager-store";
import { getAppSetting, setAppSetting } from "@/core/config/app-settings";
import { usePiloti } from "@/platform/shared/piloti";
import { listSettingsSchemas, settingsFor } from "@/platform/shared/settings";
import { bindShellApi, publishPlugins, publishWindows } from "@/platform/shared/shell-api";
import type { PilotiWindow } from "@/core/ports/shell-api";
import type { DiscoveredPlugin } from "@/core/plugins/types";
import { getWorkArea } from "@/core/windows/window-presentation";
import type { DesktopWindowInstance } from "@/ui/context/WindowsContext";

/** Only what the API promises: the shell's window type stays private. */
export const toPilotiWindow = (w: DesktopWindowInstance): PilotiWindow => ({
  id: w.id,
  appId: w.appId,
  title: w.title,
  workspace: w.workspace,
  position: { x: w.position.x, y: w.position.y },
  size: { width: w.size.width, height: w.size.height },
  minimized: w.minimized,
  maximized: w.maximized,
});

export function useShellApi(plugins: readonly DiscoveredPlugin[]): void {
  const piloti = usePiloti();
  const store = React.useContext(WindowManagerStoreContext);
  const windowActions = useWindowActions();
  const { pushNotification } = useSystemBackends();
  const updateSettings = useUpdateSettings();
  // Plugin callbacks outlive renders: read the latest actions through a ref.
  const latest = React.useRef({ windowActions, pushNotification, updateSettings });
  latest.current = { windowActions, pushNotification, updateSettings };

  // Layout effects, so the API answers before plugins are activated.
  React.useLayoutEffect(() => {
    const act = () => latest.current.windowActions;
    bindShellApi({
      windows: {
        focus: (id) => act().focusWindow(id),
        close: (id) => act().closeWindow(id),
        minimize: (id) => act().minimizeWindow(id),
        toggleMaximize: (id) => act().toggleMaximizeWindow(id),
        workArea: getWorkArea,
      },
      apps: {
        launch: (appId, options) => act().launchApp(appId, options),
        getSetting: getAppSetting,
        setSetting: setAppSetting,
      },
      desktop: {
        openUrl: (url, options) => act().openWebUrl(url, options),
        notify: ({ appName = "Piloti", summary, body = "", urgency }) =>
          latest.current.pushNotification({ appName, summary, body, urgency }),
        toggleLauncher: () => act().setLauncherOpen((open) => !open),
        toggleOverview: () => act().toggleOverview(),
      },
      settings: {
        get: (schema, key) => settingsFor(schema).get(key),
        set: (schema, key, value) => settingsFor(schema).set(key, value),
        reset: (schema, key) => settingsFor(schema).reset(key),
        watch: (schema, key, onChange) => {
          const settings = settingsFor(schema);
          return settings.subscribe(key, () => onChange(settings.get(key)));
        },
        schemas: listSettingsSchemas,
      },
    });
    // The `piloti` global, for scripts, top-level JS plugins and the console.
    window.piloti = piloti;
  }, [piloti]);

  React.useLayoutEffect(() => {
    if (!store) return;
    let last: DesktopWindowInstance[] | undefined;
    const publish = () => {
      const { windows } = store.get();
      if (windows === last) return;
      last = windows;
      publishWindows(windows.map(toPilotiWindow));
    };
    publish();
    return store.subscribe(publish);
  }, [store]);

  React.useLayoutEffect(() => {
    publishPlugins(
      plugins.map(({ id, name, kind = "plugin", version, enabled, error }) => ({
        id,
        name,
        kind,
        version,
        enabled,
        error,
      })),
    );
  }, [plugins]);
}
