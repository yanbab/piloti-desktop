/**
 * `AppHost` for a Domicile app module: its own process, with only Domicile's
 * `files`, `processes` and `dbus`. Paths are relative to the home folder, so
 * nothing here needs to know where it is.
 */
import {
  documentHash,
  MODULE_MOVES_DIR,
  MODULE_MOVES_FILE,
  type ModuleMove,
} from "@/core/data/app-modules";
import { baseName, joinPath, parentPath } from "@/core/ports/vfs";
import { Bus } from "@domicile-desktop/sdk/system";
import type { AppDomicile } from "@domicile-desktop/sdk/desktop/app-desktop";
import { createModuleApps } from "@/core/apps/module-apps";
import { createModuleShell } from "@/core/apps/module-shell";
import {
  type ChannelHost,
  createModuleChannel,
  newModuleId,
  type ModuleRequest,
  type ModuleWindowState,
} from "@/core/apps/module-channel";
import { parseIniText, serializeIniText } from "@/core/config/ini";
import { MENU_STATE_EVENT } from "@/platform/shared/app-bridge";
import { openDesktopSettings, type ModuleSettingsHost } from "@/platform/shared/app-module-desktop";
import { createNativeVfs, type NativeVfsHost } from "@/platform/shared/app-module-vfs";
import { setSettingsBackend } from "@/core/state/settings";
import { retainVfsWatch } from "@/platform/shared/vfs-query";
import type { AppHost, DocumentHost } from "@/core/ports/app-host";
import type { SettingsBackend } from "@/core/ports/settings";

const STATE_DIR = ".local/state/piloti";
const APP_SETTINGS = ".config/piloti/apps";

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

export type ModuleDomicile = NativeVfsHost &
  ModuleSettingsHost &
  ChannelHost & { dbus: Pick<AppDomicile["dbus"], "call" | "match"> };

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
    userDir: () => `${home}/Desktop`,
    // Domicile is the notification server: the standard call reaches it.
    notify: ({ summary, body = "" }) =>
      void domicile.dbus.call({
        bus: Bus.Session,
        destination: "org.freedesktop.Notifications",
        path: "/org/freedesktop/Notifications",
        interface: "org.freedesktop.Notifications",
        member: "Notify",
        signature: "susssasa{sv}i",
        body: ["Piloti", 0, "", summary, body, [], {}, -1],
      }),
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

  const desktop = await openDesktopSettings(domicile, home, watchDir);
  // The real Desktop folder from ~/.config/user-dirs.dirs (e.g. "Bureau").
  const userDirs = await readModuleText(files, ".config/user-dirs.dirs");
  const desktopDir =
    /^XDG_DESKTOP_DIR="?\$HOME\/([^"\n]+)"?/m.exec(userDirs ?? "")?.[1]?.replace(/\/+$/, "") ?? "Desktop";
  host.userDir = () => `${home}/${desktopDir}`;

  return {
    host,
    home,
    /** This window's name in the shell. */
    instance,
    publish: (patch: ModuleWindowState) => void channel.publish(patch),
    /** The shell says whether its window controls lie over this window's titlebar. */
    onOverlay: (listener: (visible: boolean) => void) => channel.onOverlay(listener),
    /** The desktop's windows, through the shell. */
    shell: createModuleShell(channel),
    /** Asks the shell to launch an app or open a file. */
    request: (request: ModuleRequest) => void channel.request(request),
    processes: domicile.processes,
    desktop,
    watchDir,
    /** The file the shell asked this window to open, once. */
    async takeOpenFile(): Promise<string | null> {
      const request = `.cache/piloti/${appId}-open`;
      const path = (await readModuleText(files, request))?.trim() || null;
      if (path) await files.write(request, "").catch(() => {});
      return path;
    },
  };
}

/** `DocumentHost` for a module holding a file: names, renames and closing. */
export async function createModuleDocumentHost(
  module: Awaited<ReturnType<typeof createAppModuleHost>>,
  files: ModuleFiles,
  untitled: () => string,
): Promise<DocumentHost> {
  const { host, instance, watchDir } = module;
  const general = parseIniText((await readModuleText(files, ".config/piloti/general.ini")) ?? "");
  await files.createDir(MODULE_MOVES_DIR).catch(() => {});
  const readMoves = async (): Promise<ModuleMove[]> => {
    try {
      return JSON.parse((await readModuleText(files, MODULE_MOVES_FILE)) || "[]") as ModuleMove[];
    } catch {
      return [];
    }
  };
  // Moves made before this window opened are not for it.
  let seen = Math.max(0, ...(await readMoves()).map((m) => m.seq));

  return {
    ...host,
    normalizePath: (path) => path.replace(/\/+/g, "/"),
    async rename(path, name) {
      const to = joinPath(parentPath(path), name);
      return host.vfs.move(path, to).then(
        () => to,
        () => null,
      );
    },
    opened(path) {
      history.replaceState(null, "", documentHash(path ?? "", instance));
      document.title = path ? baseName(path) : untitled();
    },
    onRenamed: (listener) =>
      // The folder: a watch on a replaced file reports only once.
      watchDir(MODULE_MOVES_DIR, () => {
        void readMoves().then((moves) => {
          for (const move of moves) {
            if (move.seq <= seen) continue;
            seen = move.seq;
            listener({ oldPath: move.from, newPath: move.to });
          }
        });
      }),
    confirmUnsavedOnClose: () => {
      const v = general.Windows?.["confirm-unsaved-on-close"];
      return v === "true" || v === "1";
    },
    guardClose(mustAsk, ask) {
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!mustAsk()) return;
        // The shell answers "stay"; the app then asks in its own window.
        event.preventDefault();
        event.returnValue = "";
        ask();
      };
      addEventListener("beforeunload", onBeforeUnload);
      return () => removeEventListener("beforeunload", onBeforeUnload);
    },
    onBeforeClose: () => () => {},
    close: () => window.close(),
    bridge: {
      setTitle: (title) => {
        document.title = title;
      },
      closeWindow: () => window.close(),
    },
  };
}
