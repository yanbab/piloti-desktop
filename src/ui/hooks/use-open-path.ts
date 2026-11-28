import { getEngine } from "@/platform/shared/engine";
import * as React from "react";
import { usePiloti } from "@/platform/shared/piloti";
import { useApps, useWindowActions } from "@/ui/context/DesktopStateContext";
import { demoFiles } from "@/core/ports/demo-files";
import { type WebVfsEntry } from "@/core/files/vfs-paths";
import { launchDesktopCommand } from "@/platform/shared/system-commands";
import { recordFsRecentFile } from "@/platform/shared/fs-bridge";
import {
  type OpenAction,
  actionForApp,
  resolveOpenAction,
} from "@/core/files/open-file";
import {
  type MimeAppOption,
  type MimeAppsConfig,
  inferMimeType,
  loadMimeAppsConfig,
  MIMEAPPS_PATH,
  parseMimeAppsList,
  resolveAppsForMime,
} from "@/core/xdg/xdg-mimeapps";
import { subscribeVfsPath } from "@/platform/shared/vfs-state";

export interface OpenPathOptions {
  /** Defaults to the VFS entry's kind (browser) or "file". */
  kind?: "file" | "directory";
  name?: string;
  /** Open with this application ("Open With"). */
  preferApp?: MimeAppOption;
  /** Called after a zip was extracted into the VFS. */
  onExtracted?: (folder: WebVfsEntry) => void;
}

/**
 * One place that knows how to open a file or folder: honours `mimeapps.list`,
 * installed `.desktop` entries (our apps, web apps, .deb apps), link files,
 * launcher files, archives and packages. Used by Folders, Desktop and dock stacks.
 */
export function useOpenPath() {
  const piloti = usePiloti();
  const { realFilesystem, systemServices } = getEngine().capabilities;
  const { installedXdgApps } = useApps();
  const { launchApp, launchXdgApp, openFileWithXdgApp, openWebUrl } = useWindowActions();
  const configRef = React.useRef<MimeAppsConfig | null>(null);

  React.useEffect(() => {
    configRef.current = null;
    return subscribeVfsPath(MIMEAPPS_PATH, () => {
      configRef.current = null;
    });
  }, []);

  const getConfig = React.useCallback(async (): Promise<MimeAppsConfig> => {
    if (!configRef.current) {
      try {
        configRef.current = await loadMimeAppsConfig(piloti);
      } catch {
        configRef.current = parseMimeAppsList("");
      }
    }
    return configRef.current;
  }, [piloti]);

  /** Applications offered by "Open With" for a file (best first). */
  const getOpenWithApps = React.useCallback(
    async (name: string, mimeType?: string): Promise<MimeAppOption[]> => {
      const config = await getConfig();
      return resolveAppsForMime(mimeType ?? inferMimeType(name, "file"), config, installedXdgApps);
    },
    [getConfig, installedXdgApps],
  );

  const perform = React.useCallback(
    async (action: OpenAction, options: OpenPathOptions): Promise<void> => {
      switch (action.type) {
        case "folder":
          launchApp("nautilus", { payload: action.path, forceNew: true });
          return;
        case "app": {
          const entry = realFilesystem ? undefined : demoFiles().entry(action.path);
          if (action.appId === "browser" || action.appId === "web-browser") {
            return perform({ type: "web-file", path: action.path }, options);
          }
          if (action.appId === "nautilus") {
            launchApp("nautilus", { payload: action.path, forceNew: true });
            return;
          }
          if (entry?.kind === "file") demoFiles().recordAccess(entry.path);
          launchApp(action.appId, { payload: action.path, forceNew: action.appId !== "app-store" });
          return;
        }
        case "xdg": {
          const argv0 = action.entry.execArgv[0];
          if (!systemServices || argv0 === "piloti-webapp") {
            launchXdgApp(action.entry);
            return;
          }
          openFileWithXdgApp(action.entry, action.path);
          return;
        }
        case "launch-entry":
          launchXdgApp(action.entry);
          return;
        case "extract":
          if (!systemServices) {
            const folder = await demoFiles().extract(action.path);
            if (folder) options.onExtracted?.(folder);
          } else {
            launchDesktopCommand(piloti, ["xdg-open", action.path]);
          }
          return;
        case "install-package":
          launchApp("app-store", { payload: `install:${action.format}:${action.path}`, forceNew: true });
          return;
        case "web-file": {
          if (systemServices) {
            launchDesktopCommand(piloti, ["xdg-open", action.path]);
            return;
          }
          const entry = demoFiles().entry(action.path);
          if (!entry || entry.kind !== "file") return;
          openWebUrl(demoFiles().pageUrl(entry), { asApp: true, appId: `file:${entry.path}`, title: entry.name });
          return;
        }
      }
    },
    [piloti, realFilesystem, systemServices, launchApp, launchXdgApp, openFileWithXdgApp, openWebUrl],
  );

  const openPathInternal = React.useCallback(
    async (path: string, options: OpenPathOptions): Promise<void> => {
      const vfsEntry = realFilesystem ? undefined : demoFiles().entry(path);
      // Browser VFS symlinks have no children of their own: open what they point to.
      if (vfsEntry?.isSymlink && vfsEntry.symlinkTarget && vfsEntry.symlinkTarget !== path) {
        return openPathInternal(vfsEntry.symlinkTarget, { ...options, kind: undefined, name: undefined });
      }
      const kind = options.kind ?? (vfsEntry?.kind === "directory" ? "directory" : "file");
      const name = options.name ?? vfsEntry?.name ?? path.split("/").filter(Boolean).pop() ?? path;
      const config = await getConfig();
      const mime = inferMimeType(name, kind);
      if (kind === "file") {
        void recordFsRecentFile(piloti, path, mime);
      }
      const action = resolveOpenAction({
        path,
        name,
        kind,
        content: vfsEntry?.kind === "file" ? vfsEntry.content : undefined,
        config,
        installed: installedXdgApps,
        preferApp: options.preferApp,
      });
      await perform(action, options);
    },
    [piloti, getConfig, installedXdgApps, realFilesystem, perform],
  );

  const openPath = React.useCallback(
    (path: string, options: OpenPathOptions = {}) => openPathInternal(path, options),
    [openPathInternal],
  );

  /** Open with a specific application chosen from `getOpenWithApps`. */
  const openPathWith = React.useCallback(
    (path: string, app: MimeAppOption, options: OpenPathOptions = {}) => {
      const action = actionForApp(app, path);
      const entry = realFilesystem ? undefined : demoFiles().entry(path);
      if (entry?.kind === "file" && action.type !== "xdg") demoFiles().recordAccess(path);
      return perform(action, options);
    },
    [realFilesystem, perform],
  );

  return { openPath, openPathWith, getOpenWithApps };
}
