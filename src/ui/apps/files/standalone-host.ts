/**
 * Folders' host on its own: a Domicile app module, or the demo's iframe. It
 * reads the settings, apps and icons itself and asks the shell, over the
 * module's channel or `postMessage`, to launch and open.
 */
import * as React from "react";
import { appIconThemes } from "@/core/apps/describe-apps";
import type { AppDragEvent } from "@/core/apps/module-channel";
import type { DesktopSettings } from "@/core/config/desktop-settings";
import type { Apps } from "@/core/ports/apps";
import type { ShellHost, ShellWindow } from "@/core/ports/shell-host";
import type { XdgDesktopEntry } from "@/core/xdg/xdg-desktop-entry";
import {
  buildXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
} from "@/core/xdg/xdg-icon-theme";
import type { MimeAppOption } from "@/core/xdg/xdg-mimeapps";
import { droppedPathsAction } from "@/core/files/dropped-paths";
import {
  broadcastItemDrag,
  endItemDragBroadcast,
  pathItems,
  resolveTopDropTarget,
} from "@/ui/dnd/item-drop";
import { discoverXdgUserDirs, type XdgUserDir } from "@/core/xdg/xdg-user-dirs";
import type { FilesActions, FilesApps, FilesHost, FilesNotify } from "@/ui/components/files-host";

type IconFiles = Parameters<typeof buildXdgIconThemeIndex>[0];
type UserDirFiles = Parameters<typeof discoverXdgUserDirs>[0];

export interface StandaloneFilesPort {
  /** This window's name for the shell. */
  windowId: string;
  desktop: {
    current(): DesktopSettings;
    watch(listener: (settings: DesktopSettings) => void): () => void;
    update(patch: Partial<DesktopSettings>): void;
  };
  apps: Pick<Apps, "list">;
  /** Reads the icon themes and `~/.config/user-dirs.dirs`. */
  files: IconFiles & UserDirFiles;
  shell: Pick<ShellHost, "watchWindows">;
  launch(appId: string, payload?: string): void;
  open(path: string, options: { kind?: "file" | "directory"; preferApp?: MimeAppOption }): void;
  notify(notification: { summary: string; body?: string }): void;
  /** Items released outside the window, at `point` in its coordinates. */
  dropOut(paths: readonly string[], point: { x: number; y: number; copy: boolean }): void;
  /** Tells the shell about a drag in this window (none: it ended here). */
  dragItems(paths: readonly string[], icon?: string): void;
  /** What the shell did with that drag. Returns stop. */
  watchDrag(listener: (event: AppDragEvent) => void): () => void;
  /** Whether this window has the focus, at once and on each change. Returns stop. */
  watchFocus(listener: (focused: boolean) => void): () => void;
}

/** A value with listeners, for `useSyncExternalStore`. */
function store<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export function createStandaloneFilesHost(port: StandaloneFilesPort): FilesHost {
  const settings = store(port.desktop.current());
  port.desktop.watch((next) => settings.set(next));

  // Apps, user folders and icons: read once, then the hooks draw again.
  const apps = store<{ installedXdgApps: XdgDesktopEntry[]; xdgUserDirs: XdgUserDir[]; icons: number }>({
    installedXdgApps: [],
    xdgUserDirs: [],
    icons: 0,
  });
  void port.apps
    .list()
    .then((installedXdgApps) => apps.set({ ...apps.get(), installedXdgApps }))
    .catch(() => undefined);
  void discoverXdgUserDirs(port.files).then((xdgUserDirs) => apps.set({ ...apps.get(), xdgUserDirs }));

  let index: ReturnType<typeof buildXdgIconThemeIndex> | null = null;
  const icons = new Map<string, string | null>();
  const loadIcon = (name: string) => {
    if (icons.has(name)) return;
    icons.set(name, null);
    void (async () => {
      const themes = await (index ??= buildXdgIconThemeIndex(port.files, appIconThemes(settings.get())));
      const path = lookupXdgIconPath(themes, name, 64, 1);
      const url = path ? await loadXdgIconDataUrl(port.files, path) : undefined;
      if (!url) return;
      icons.set(name, url);
      apps.set({ ...apps.get(), icons: apps.get().icons + 1 });
    })().catch(() => undefined);
  };
  const getAppIconUrl = (name: string | undefined) => {
    if (!name) return undefined;
    if (!icons.has(name)) loadIcon(name);
    return icons.get(name) ?? undefined;
  };
  const ensureWaylandIcons = (ids: readonly string[]) => ids.forEach(loadIcon);

  // A drag the shell owns, over this window: light the folder under it, and
  // take a drop as the shell's own drops on this window (`dropped-paths.ts`).
  port.watchDrag((event) => {
    if (event.state === "over") {
      const items = pathItems(event.paths);
      broadcastItemDrag(items[0]!, items, event.x, event.y);
    } else if (event.state === "leave") {
      endItemDragBroadcast();
    } else if (event.state === "drop") {
      endItemDragBroadcast();
      const target = resolveTopDropTarget(event.x, event.y, event.paths);
      const dest = target?.kind === "vfs" ? target.destPath : undefined;
      const actionId = droppedPathsAction(event.paths, event.copy, dest);
      dispatchEvent(new CustomEvent("piloti:app-action", { detail: { windowId: port.windowId, actionId } }));
    }
  });

  const windows = store<readonly ShellWindow[]>([]);
  port.shell.watchWindows((next) => windows.set(next));
  const focused = store(false);
  port.watchFocus((next) => focused.set(next));

  const notify: FilesNotify = ({ summary, body }) => port.notify({ summary, body });
  const actions: FilesActions = {
    launchApp: (appId, options) => port.launch(appId, options?.payload),
    launchXdgApp: (entry) => port.launch(entry.desktopId),
    openWebUrl: (url) => port.launch("browser", url),
    updateSettings: (patch) => port.desktop.update(patch),
    notify,
  };
  const openPath = {
    openPath: async (path: string, options: { kind?: "file" | "directory" } = {}) =>
      port.open(path, { kind: options.kind }),
    openPathWith: async (path: string, app: MimeAppOption, options: { kind?: "file" | "directory" } = {}) =>
      port.open(path, { kind: options.kind, preferApp: app }),
  };

  return {
    // Settings change seldom here: every view draws again then.
    useDesktopSettings: () => React.useSyncExternalStore(settings.subscribe, settings.get),
    useApps() {
      const { installedXdgApps, xdgUserDirs, icons: version } = React.useSyncExternalStore(
        apps.subscribe,
        apps.get,
      );
      return React.useMemo<FilesApps>(
        () => ({
          installedXdgApps,
          xdgUserDirs,
          // A new function once more icons are in: views that use it draw again.
          getAppIconUrl: (name) => (version >= 0 ? getAppIconUrl(name) : undefined),
          ensureWaylandIcons,
        }),
        [installedXdgApps, xdgUserDirs, version],
      );
    },
    dropOutside: (paths, point) => port.dropOut(paths, point),
    appDrag: { report: (paths, icon) => port.dragItems(paths, icon), watch: (listener) => port.watchDrag(listener) },
    useActions: () => actions,
    useOpenPath: () => openPath,
    useWindows() {
      const list = React.useSyncExternalStore(windows.subscribe, windows.get);
      const hasFocus = React.useSyncExternalStore(focused.subscribe, focused.get);
      return React.useMemo(
        () => ({
          windows: list.map((w) => ({ appId: w.appId, payload: w.path })),
          focusedWindowId: hasFocus ? port.windowId : null,
        }),
        [list, hasFocus],
      );
    },
  };
}
