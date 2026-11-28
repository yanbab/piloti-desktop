/** Installing and reading the web apps' `.desktop` files (format: `core/xdg/xdg-web-apps.ts`). */
import {
  WEB_APPS_XDG_DIR,
  notifyWebAppsChanged,
  webAppDesktopFileName,
  serializeWebAppDesktopEntry,
  parseWebAppDesktopEntry,
} from "@/core/xdg/xdg-web-apps";
import {
  canonicalizeWebUrl,
  type InstalledWebApp,
  findMatchingWebApp,
  getHostnameFallbackTitle,
} from "@/core/data/web-apps";
import { hostFiles } from "@/core/files/host-files";
import { getEngine } from "@/core/ports/engine";
import type { Piloti } from "@/core/ports/piloti";
import {
  listFsDir,
  readFsTextFile,
  removeFsFile,
  writeFsTextFile,
} from "@/platform/shared/fs-bridge";

export async function ensureXdgApplicationsDir(
  piloti: Piloti,
): Promise<void> {
  if (!getEngine().capabilities.realFilesystem) return;
  await hostFiles(piloti).createDir(".local").catch(() => undefined);
  await hostFiles(piloti).createDir(".local/share").catch(() => undefined);
  await hostFiles(piloti)
    .createDir(".local/share/applications")
    .catch(() => undefined);
}

export async function installWebAppDesktopEntry(
  piloti: Piloti,
  app: InstalledWebApp,
): Promise<void> {
  await ensureXdgApplicationsDir(piloti);
  const filePath = `${WEB_APPS_XDG_DIR}/${webAppDesktopFileName(app)}`;
  await writeFsTextFile(piloti, filePath,
    serializeWebAppDesktopEntry(app),
  );
  notifyWebAppsChanged();
}

export async function removeWebAppDesktopEntry(
  piloti: Piloti,
  app: Pick<InstalledWebApp, "id" | "url">,
): Promise<void> {
  const targetCanonical = canonicalizeWebUrl(app.url) ?? app.url;
  const entries = await listFsDir(piloti, WEB_APPS_XDG_DIR);
  const desktopFiles = entries.filter(
    (e) => e.kind === "file" && e.name.endsWith(".desktop"),
  );

  const removedPaths = new Set<string>();
  for (const file of desktopFiles) {
    const content = await readFsTextFile(piloti, file.path);
    const parsed = parseWebAppDesktopEntry(content, file.path);
    if (!parsed) continue;
    const parsedCanonical = canonicalizeWebUrl(parsed.url) ?? parsed.url;
    if (parsed.id === app.id || parsedCanonical === targetCanonical) {
      await removeFsFile(piloti, file.path);
      removedPaths.add(file.path);
    }
  }

  const expectedPath = `${WEB_APPS_XDG_DIR}/${webAppDesktopFileName(app)}`;
  if (!removedPaths.has(expectedPath)) {
    await removeFsFile(piloti, expectedPath);
  }
  notifyWebAppsChanged();
}

export async function loadWebAppsFromDesktopEntries(
  piloti: Piloti,
): Promise<InstalledWebApp[]> {
  const entries = await listFsDir(piloti, WEB_APPS_XDG_DIR);
  const desktopFiles = entries.filter(
    (e) => e.kind === "file" && e.name.endsWith(".desktop"),
  );

  const apps: InstalledWebApp[] = [];
  const seenUrls = new Set<string>();
  for (const file of desktopFiles) {
    const content = await readFsTextFile(piloti, file.path);
    if (!content) continue;
    const parsed = parseWebAppDesktopEntry(content, file.path);
    if (!parsed) continue;
    const canonical = canonicalizeWebUrl(parsed.url) ?? parsed.url;
    if (seenUrls.has(canonical)) continue;
    seenUrls.add(canonical);
    apps.push(parsed);
  }
  return apps;
}

/**
 * Installs or removes a Web App both in settings state and as a persistent FreeDesktop `.desktop` entry.
 */
export function toggleWebAppInstall(params: {
  piloti: Piloti;
  installedWebApps: readonly InstalledWebApp[];
  pinnedAppIds: readonly string[];
  updateSettings: (patch: {
    installedWebApps?: InstalledWebApp[];
    pinnedAppIds?: string[];
  }) => void;
  url: string;
  title?: string;
  iconUrl?: string;
}): "installed" | "removed" | null {
  const canonicalUrl = canonicalizeWebUrl(params.url) ?? params.url;
  if (!canonicalUrl) return null;

  const existing = findMatchingWebApp(canonicalUrl, params.installedWebApps);
  if (existing) {
    params.updateSettings({
      installedWebApps: params.installedWebApps.filter(
        (a) =>
          a.url !== params.url &&
          a.url !== canonicalUrl &&
          canonicalizeWebUrl(a.url) !== canonicalUrl
      ),
      pinnedAppIds: params.pinnedAppIds.filter((id) => id !== existing.id),
    });
    void removeWebAppDesktopEntry(params.piloti, existing
    );
    return "removed";
  }

  const fallbackTitle = getHostnameFallbackTitle(canonicalUrl) || canonicalUrl;
  const cleanTitle = params.title?.trim();
  const appTitle =
    cleanTitle && cleanTitle !== "Web" && cleanTitle !== "Web View"
      ? cleanTitle
      : fallbackTitle;
  const newApp: InstalledWebApp = {
    id: `web:${canonicalUrl}`,
    title: appTitle,
    url: canonicalUrl,
    ...(params.iconUrl ? { iconUrl: params.iconUrl } : {}),
  };
  params.updateSettings({
    installedWebApps: [...params.installedWebApps, newApp],
  });
  void installWebAppDesktopEntry(params.piloti, newApp
  );
  return "installed";
}
