/** `AppHost` for an app running in the shell, or in its demo iframe. */
import { createInstalledApps } from "@/lib/apps/installed-apps";
import { emitShellEvent } from "@/lib/core/shell-events";
import { getEngine } from "@/lib/engine/engine";
import type { Piloti } from "@/lib/engine/piloti";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import { readVfsStateJson, writeVfsStateJson } from "@/lib/engine/vfs-state";
import type { AppHost } from "@/lib/ports/app-host";

const stateFile = (key: string) => `${VFS_HOME}/.local/state/piloti/${key}.json`;

export function createShellAppHost(piloti: Piloti): AppHost {
  return {
    vfs: piloti.vfs,
    apps: {
      list: (options) =>
        createInstalledApps(piloti, { session: getEngine().capabilities.systemServices }).list(options),
      launch: (appId, options) => piloti.desktop.apps.launch(appId, options),
    },
    readState: (key, isValid) => readVfsStateJson(stateFile(key), undefined, isValid),
    writeState: (key, value) => void writeVfsStateJson(stateFile(key), value, false),
    close: (windowId) => emitShellEvent("piloti:request-animated-close", { windowId }),
  };
}
