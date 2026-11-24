import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useApps, useSettings, useWindowActions } from "@/context/DesktopStateContext";
import {
  buildVfsEntryWebAppUrl,
  extractVfsZip,
  getVfsEntry,
  incrementVfsAccessCount,
  type WebVfsEntry,
} from "@/lib/engine-web/web-vfs";
import { launchDesktopCommand } from "@/lib/engine-native";
import { recordFsRecentFile } from "@/lib/engine/fs-bridge";
import {
  type OpenAction,
  actionForApp,
  resolveOpenAction,
} from "@/lib/shell/open-file";
import {
  type MimeAppOption,
  type MimeAppsConfig,
  inferMimeType,
  loadMimeAppsConfig,
  MIMEAPPS_PATH,
  parseMimeAppsList,
  resolveAppsForMime,
} from "@/lib/xdg/xdg-mimeapps";
import { subscribeVfsPath } from "@/lib/engine/vfs-state";

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
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const { installedXdgApps } = useApps();
  const { launchApp, launchXdgApp, openWebUrl } = useWindowActions();
  const configRef = React.useRef<MimeAppsConfig | null>(null);

  React.useEffect(() => {
    configRef.current = null;
    return subscribeVfsPath(MIMEAPPS_PATH, () => {
      configRef.current = null;
    });
  }, [isBrowserRuntime]);

  const getConfig = React.useCallback(async (): Promise<MimeAppsConfig> => {
    if (!configRef.current) {
      try {
        configRef.current = await loadMimeAppsConfig(domicile);
      } catch {
        configRef.current = parseMimeAppsList("");
      }
    }
    return configRef.current;
  }, [domicile, isBrowserRuntime]);

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
          const entry = isBrowserRuntime ? getVfsEntry(action.path) : undefined;
          if (action.appId === "browser" || action.appId === "web-browser") {
            return perform({ type: "web-file", path: action.path }, options);
          }
          if (action.appId === "nautilus") {
            launchApp("nautilus", { payload: action.path, forceNew: true });
            return;
          }
          if (entry?.kind === "file") incrementVfsAccessCount(entry.path);
          launchApp(action.appId, { payload: action.path, forceNew: action.appId !== "app-store" });
          return;
        }
        case "xdg": {
          const argv0 = action.entry.execArgv[0];
          if (isBrowserRuntime || argv0 === "piloti-webapp") {
            launchXdgApp(action.entry);
            return;
          }
          launchDesktopCommand(domicile, [...action.entry.execArgv, action.path], {
            cwd: action.entry.workingDirectory,
          });
          return;
        }
        case "launch-entry":
          launchXdgApp(action.entry);
          return;
        case "extract":
          if (isBrowserRuntime) {
            const folder = await extractVfsZip(action.path);
            if (folder) options.onExtracted?.(folder);
          } else {
            launchDesktopCommand(domicile, ["xdg-open", action.path]);
          }
          return;
        case "install-package":
          launchApp("app-store", { payload: `install:${action.format}:${action.path}`, forceNew: true });
          return;
        case "web-file": {
          if (!isBrowserRuntime) {
            launchDesktopCommand(domicile, ["xdg-open", action.path]);
            return;
          }
          const entry = getVfsEntry(action.path);
          if (!entry || entry.kind !== "file") return;
          const url =
            entry.name.toLowerCase().endsWith(".pdf") &&
            entry.content?.trimStart().startsWith("%PDF-")
              ? URL.createObjectURL(new Blob([entry.content], { type: "application/pdf" }))
              : buildVfsEntryWebAppUrl(entry);
          openWebUrl(url, { asApp: true, appId: `file:${entry.path}`, title: entry.name });
          return;
        }
      }
    },
    [domicile, isBrowserRuntime, launchApp, launchXdgApp, openWebUrl],
  );

  const openPathInternal = React.useCallback(
    async (path: string, options: OpenPathOptions): Promise<void> => {
      const vfsEntry = isBrowserRuntime ? getVfsEntry(path) : undefined;
      // Browser VFS symlinks have no children of their own: open what they point to.
      if (vfsEntry?.isSymlink && vfsEntry.symlinkTarget && vfsEntry.symlinkTarget !== path) {
        return openPathInternal(vfsEntry.symlinkTarget, { ...options, kind: undefined, name: undefined });
      }
      const kind = options.kind ?? (vfsEntry?.kind === "directory" ? "directory" : "file");
      const name = options.name ?? vfsEntry?.name ?? path.split("/").filter(Boolean).pop() ?? path;
      const config = await getConfig();
      const mime = inferMimeType(name, kind);
      if (kind === "file") {
        void recordFsRecentFile(domicile, path, mime);
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
    [domicile, getConfig, installedXdgApps, isBrowserRuntime, perform],
  );

  const openPath = React.useCallback(
    (path: string, options: OpenPathOptions = {}) => openPathInternal(path, options),
    [openPathInternal],
  );

  /** Open with a specific application chosen from `getOpenWithApps`. */
  const openPathWith = React.useCallback(
    (path: string, app: MimeAppOption, options: OpenPathOptions = {}) => {
      const action = actionForApp(app, path);
      const entry = isBrowserRuntime ? getVfsEntry(path) : undefined;
      if (entry?.kind === "file" && action.type !== "xdg") incrementVfsAccessCount(path);
      return perform(action, options);
    },
    [isBrowserRuntime, perform],
  );

  return { openPath, openPathWith, getOpenWithApps };
}
