/** `AppHost` for an app running in the shell, or in its demo iframe. */
import { createInstalledApps } from "@/core/apps/installed-apps";
import { shouldConfirmUnsavedOnClose } from "@/core/config/piloti-ini";
import { normalizeVfsPath } from "@/core/files/vfs-paths";
import type { AppHost, DocumentHost } from "@/core/ports/app-host";
import { getEngine } from "@/core/ports/engine";
import { VFS_HOME } from "@/core/state/vfs-home";
import { readVfsStateJson, writeVfsStateJson } from "@/core/state/vfs-state";
import { emitShellEvent, onShellEvent } from "@/core/windows/shell-events";
import { postToShell } from "@/platform/shared/app-bridge";
import { announceRename, renameFsEntry } from "@/platform/shared/fs-bridge";
import type { Piloti } from "@/platform/shared/piloti";
import { subscribeRenames } from "@/platform/shared/renames";

const stateFile = (key: string) => `${VFS_HOME}/.local/state/piloti/${key}.json`;

export function createShellAppHost(piloti: Piloti): AppHost {
  return {
    vfs: piloti.vfs,
    apps: {
      list: (options) =>
        createInstalledApps(piloti, { session: getEngine().capabilities.systemServices }).list(options),
      launch: (appId, options) => piloti.desktop.apps.launch(appId, options),
    },
    // The demo's folders have fixed names.
    userDir: () => `${VFS_HOME}/Desktop`,
    readState: (key, isValid) => readVfsStateJson(stateFile(key), undefined, isValid),
    writeState: (key, value) => void writeVfsStateJson(stateFile(key), value, false),
    notify: (notification) => piloti.desktop.notify(notification),
    close: (windowId) => {
      // The demo's iframe asks the page around it.
      if (window.parent !== window) {
        postToShell({ type: "piloti:window-control", windowId, action: "close" });
      } else emitShellEvent("piloti:request-animated-close", { windowId });
    },
  };
}

export function createShellDocumentHost(piloti: Piloti): DocumentHost {
  return {
    ...createShellAppHost(piloti),
    normalizePath: normalizeVfsPath,
    // Keeps the file's emblems and updates open views, as Folders does.
    rename: async (path, name) => (await renameFsEntry(piloti, path, name))?.path ?? null,
    moved: announceRename,
    onRenamed: subscribeRenames,
    confirmUnsavedOnClose: shouldConfirmUnsavedOnClose,
    onBeforeClose: (listener) => onShellEvent("piloti:before-close-window", listener),
  };
}
