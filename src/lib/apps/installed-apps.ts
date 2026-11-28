/** The installed applications, from the session's `.desktop` files. */
import type { AppsHost, ListAppsOptions } from "@/lib/ports/apps";
import { applicationDirsFor, XDG_APPLICATION_DIRS } from "@/lib/xdg/xdg-basedir";
import {
  discoverInstalledXdgApps,
  type XdgDesktopEntry,
} from "@/lib/xdg/xdg-desktop-entry";
import type { XdgIconThemeIndex } from "@/lib/xdg/xdg-icon-theme";

/**
 * The session's application folders. Domicile puts folders of its own on
 * `XDG_DATA_DIRS` (copies of the entries listed in `electron.apps`), so the
 * fixed XDG list is not enough.
 */
async function sessionDirs(host: AppsHost): Promise<readonly string[]> {
  try {
    const ran = await host.processes.run(["printenv", "XDG_DATA_DIRS"]);
    return applicationDirsFor(
      ran.match({ Ok: (r) => (r.code === 0 ? r.stdout : null), Err: () => null }),
    );
  } catch {
    return applicationDirsFor(null);
  }
}

/** `session: false` where there is no session to ask (the browser demo). */
export function createInstalledApps(host: AppsHost, { session = true } = {}) {
  // `XDG_DATA_DIRS` does not change while the session runs.
  let dirs: Promise<readonly string[]> | null = null;
  const directories = () =>
    (dirs ??= session ? sessionDirs(host) : Promise.resolve(XDG_APPLICATION_DIRS));
  return {
    directories,
    async list(
      options: ListAppsOptions = {},
      iconIndex?: Promise<XdgIconThemeIndex>,
    ): Promise<XdgDesktopEntry[]> {
      return discoverInstalledXdgApps(
        host.files,
        { ...options, applicationDirs: await directories() },
        iconIndex,
      );
    },
  };
}
