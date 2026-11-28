/**
 * `AppHost` for a Domicile app module: its own process, with only Domicile's
 * `files`, `processes` and `dbus`. Paths are relative to the home folder, so
 * nothing here needs to know where it is.
 */
import { documentHash } from "@/core/data/app-modules";
import { createModuleApps } from "@/core/apps/module-apps";
import {
  type ChannelHost,
  createModuleChannel,
  newModuleId,
  type ModuleWindowState,
} from "@/core/apps/module-channel";
import { parseIniText, serializeIniText } from "@/core/config/ini";
import { applyThemeToDocument, MENU_STATE_EVENT } from "@/platform/shared/app-bridge";
import { createNativeVfs, type NativeVfsHost } from "@/platform/shared/app-module-vfs";
import { setSettingsBackend } from "@/core/state/settings";
import { retainVfsWatch } from "@/platform/shared/vfs-query";
import type { AppHost } from "@/core/ports/app-host";
import type { SettingsBackend } from "@/core/ports/settings";

const STATE_DIR = ".local/state/piloti";
const APP_SETTINGS = ".config/piloti/apps";
const DESKTOP_SETTINGS = ".config/piloti/settings.ini";

export type ModuleFiles = NativeVfsHost["files"];

export async function readModuleText(files: ModuleFiles, path: string): Promise<string | null> {
  const r = await files.readText(path).catch(() => null);
  return r ? r.unwrapOr(null as unknown as string) : null;
}

/** The app's own settings file, held in memory, written through and followed. */
async function moduleSettings(
  files: ModuleFiles,
  appId: string,
  watchDir: (dir: string, onChange: () => void) => () => void,
): Promise<SettingsBackend> {
  const path = `${APP_SETTINGS}/${appId}.ini`;
  const raw = await readModuleText(files, path);
  let ini = raw ? parseIniText(raw) : {};
  let known = raw ?? "";
  const listeners = new Map<string, Set<() => void>>();
  const all = new Set<() => void>();

  const change = (schema: string, key: string, value: string | null) => {
    const section = { ...ini[schema] };
    if (value === null) delete section[key];
    else section[key] = value;
    ini[schema] = section;
    known = serializeIniText(ini);
    const text = known;
    void files
      .createDir(APP_SETTINGS)
      .then(() => files.write(path, text))
      .catch((error) => console.warn(`[piloti] could not save ${path}`, error));
    listeners.get(schema)?.forEach((l) => l());
    all.forEach((l) => l());
  };

  // Changed by the shell, or by another window of the app.
  await files.createDir(APP_SETTINGS).catch(() => {});
  watchDir(APP_SETTINGS, () => {
    void readModuleText(files, path).then((text) => {
      if (text === null || text === known) return;
      known = text;
      ini = parseIniText(text);
      listeners.forEach((set) => set.forEach((l) => l()));
      all.forEach((l) => l());
    });
  });

  return {
    read: (schema, key) => ini[schema]?.[key],
    write: (schema, key, value) => change(schema, key, value),
    reset: (schema, key) => change(schema, key, null),
    subscribe(schema, listener) {
      const set = listeners.get(schema) ?? new Set();
      listeners.set(schema, set.add(listener));
      return () => void set.delete(listener);
    },
    subscribeAll(listener) {
      all.add(listener);
      return () => void all.delete(listener);
    },
    writeBatch: (changes) => changes.forEach((c) => change(c.schema, c.key, c.value)),
  };
}

export interface ModuleHostOptions {
  /** Names the app's settings file. */
  appId: string;
  /** The state keys the app reads, loaded before it mounts. */
  stateKeys?: readonly string[];
}

export type ModuleDomicile = NativeVfsHost & Pick<ChannelHost, "dbus">;

export async function createAppModuleHost(
  domicile: ModuleDomicile,
  { appId, stateKeys = [] }: ModuleHostOptions,
) {
  const { files } = domicile;
  const home = (await files.stat(".")).unwrapOr(undefined as never)?.realPath ?? "";

  const state = new Map<string, unknown>();
  await Promise.all(
    stateKeys.map(async (key) => {
      const raw = await readModuleText(files, `${STATE_DIR}/${key}.json`);
      if (!raw) return;
      try {
        state.set(key, JSON.parse(raw));
      } catch {
        /* ignore corrupt state */
      }
    }),
  );

  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    for (const key of pending) {
      const text = JSON.stringify(state.get(key));
      void files
        .createDir(STATE_DIR)
        .then(() => files.write(`${STATE_DIR}/${key}.json`, text))
        .catch((error) => console.warn(`[piloti] could not save ${key}`, error));
    }
    pending.clear();
  };
  addEventListener("pagehide", flush);

  const vfs = createNativeVfs(domicile);
  const watchDir = (dir: string, onChange: () => void) =>
    retainVfsWatch(vfs, `${home}/${dir}`, onChange);
  setSettingsBackend(await moduleSettings(files, appId, watchDir));

  // Menus: the app uses the same window events as in the shell, under the name
  // the shell finds in this module's URL.
  const instance = newModuleId();
  const channel = createModuleChannel(domicile, instance);
  if (typeof window !== "undefined") {
    history.replaceState(null, "", documentHash("", instance));
    window.addEventListener(MENU_STATE_EVENT, (e) => {
      const { windowId, state } = (e as CustomEvent).detail ?? {};
      if (windowId === instance) void channel.publish({ menu: state });
    });
    channel.onAction((actionId) => {
      window.dispatchEvent(
        new CustomEvent("piloti:app-action", { detail: { windowId: instance, actionId } }),
      );
    });
  }

  const host: AppHost = {
    vfs,
    apps: createModuleApps(domicile),
    readState: (key, isValid) => {
      const value = state.get(key);
      return isValid(value) ? value : null;
    },
    writeState: (key, value) => {
      state.set(key, value);
      pending.add(key);
      timer ??= setTimeout(flush, 400);
    },
    close: () => window.close(),
  };

  const readDesktop = async () => {
    const raw = await readModuleText(files, DESKTOP_SETTINGS);
    return raw ? parseIniText(raw) : {};
  };
  return {
    host,
    home,
    /** This window's name in the shell. */
    instance,
    publish: (patch: ModuleWindowState) => void channel.publish(patch),
    desktopSettings: await readDesktop(),
    /** Calls `onChange` once, then whenever `settings.ini` may have changed. */
    watchDesktopSettings: (onChange: (settings: Awaited<ReturnType<typeof readDesktop>>) => void) =>
      watchDir(".config/piloti", () => void readDesktop().then(onChange)),
  };
}

/** Light or dark and the accent, from the desktop's `settings.ini`. */
export function applyDesktopTheme(settings: Record<string, Record<string, string>>): void {
  const iface = settings["org.piloti.desktop.interface"] ?? {};
  applyThemeToDocument(document, {
    themeMode: (iface["color-scheme"] as "dark" | "light" | "system") ?? "system",
    accentColor: (iface["accent-color"] ?? "blue") as never,
    fontSansFamily: "",
    fontMonoFamily: "",
    fontScale: 1,
  });
}
