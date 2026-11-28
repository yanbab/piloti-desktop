/**
 * The objects behind `piloti.desktop`, `.settings` and `.plugins`. They exist
 * as soon as `piloti` does; the shell gives them their actions and publishes
 * its state once it renders (`context/use-shell-api.ts`). Until then lists are
 * empty and calls do nothing.
 *
 * No VFS import here: this loads before the native entry knows `$HOME`.
 */
import type {
  OnChange,
  PilotiDesktop,
  PilotiPlugin,
  PilotiSettings,
  PilotiShellApi,
  PilotiWindow,
  WorkArea,
} from "@/core/ports/shell-api";

/** What the shell does for the calls. */
export interface ShellApiActions {
  windows: Pick<PilotiDesktop["windows"], "focus" | "close" | "minimize" | "toggleMaximize"> & {
    workArea: () => WorkArea;
  };
  apps: PilotiDesktop["apps"];
  desktop: Pick<PilotiDesktop, "openUrl" | "notify" | "toggleLauncher" | "toggleOverview">;
  settings: Omit<PilotiSettings, "schemas"> & { schemas: () => readonly string[] };
}

/** A list kept as the same array until its content changes, as `useWatch` needs. */
function liveList<T>() {
  let list: readonly T[] = [];
  let signature = "[]";
  const listeners = new Set<() => void>();
  const on: OnChange = (_type, listener) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    get: () => list,
    on,
    publish(next: readonly T[]) {
      const nextSignature = JSON.stringify(next);
      if (nextSignature === signature) return;
      signature = nextSignature;
      list = next;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (err) {
          console.error("[piloti] change listener failed", err);
        }
      }
    },
  };
}

const windows = liveList<PilotiWindow>();
const plugins = liveList<PilotiPlugin>();
let actions: ShellApiActions | null = null;

export function bindShellApi(next: ShellApiActions): void {
  actions = next;
}

export const publishWindows = windows.publish;
export const publishPlugins = plugins.publish;

const NO_AREA: WorkArea = { x: 0, y: 0, width: 0, height: 0 };

export const shellApi: PilotiShellApi = {
  desktop: {
    windows: {
      get list() {
        return windows.get();
      },
      get: (id) => windows.get().find((w) => w.id === id),
      focus: (id) => actions?.windows.focus(id),
      close: (id) => actions?.windows.close(id),
      minimize: (id) => actions?.windows.minimize(id),
      toggleMaximize: (id) => actions?.windows.toggleMaximize(id),
      get workArea() {
        return actions?.windows.workArea() ?? NO_AREA;
      },
      on: windows.on,
    },
    apps: {
      launch: (appId, options) => actions?.apps.launch(appId, options),
      getSetting: (appId, key) => actions?.apps.getSetting(appId, key),
      setSetting: (appId, key, value) => actions?.apps.setSetting(appId, key, value),
    },
    openUrl: (url, options) => actions?.desktop.openUrl(url, options),
    notify: (notification) => actions?.desktop.notify(notification),
    toggleLauncher: () => actions?.desktop.toggleLauncher(),
    toggleOverview: () => actions?.desktop.toggleOverview(),
  },
  settings: {
    get: (schema, key) => actions?.settings.get(schema, key),
    set: (schema, key, value) => actions?.settings.set(schema, key, value),
    reset: (schema, key) => actions?.settings.reset(schema, key),
    watch: (schema, key, onChange) =>
      actions?.settings.watch(schema, key, onChange) ?? (() => {}),
    get schemas() {
      return actions?.settings.schemas() ?? [];
    },
  },
  plugins: {
    get list() {
      return plugins.get();
    },
    on: plugins.on,
  },
};
