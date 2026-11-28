/**
 * Names and icons of apps by the id the shell gives their windows, for an app
 * in its own process: the shell's are already loaded, a module reads the
 * `.desktop` files and the icon theme itself.
 */
import type { Apps, AppsHost } from "@/core/ports/apps";
import { iconAccentConfigFromIndex, markInheritedAccentIcon } from "@/core/icons/icon-accent-tint";
import {
  buildXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
} from "@/core/xdg/xdg-icon-theme";
import type { XdgDesktopEntry } from "@/core/xdg/xdg-desktop-entry";

export interface AppInfo {
  name?: string;
  iconUrl?: string;
}

/** The icon themes to look in, as the shell chooses them (without the portal's). */
export function appIconThemes(settings: { interfaceTheme: string; iconTheme: string }): string[] {
  if (settings.interfaceTheme === "adwaita") return ["Adwaita", "hicolor"];
  const chosen =
    settings.iconTheme && settings.iconTheme !== "Papirus" && settings.iconTheme !== "Adwaita"
      ? settings.iconTheme
      : "Piloti";
  return [chosen, "Adwaita", "hicolor"];
}

/** The entry of a window's app: its Piloti id, desktop id, or app id. */
export function findAppEntry(
  entries: readonly XdgDesktopEntry[],
  appId: string,
): XdgDesktopEntry | undefined {
  const clean = appId.replace(/\.desktop$/i, "");
  const lower = clean.toLowerCase();
  return (
    entries.find((e) => e.rawGroups["Desktop Entry"]?.["X-Piloti-AppId"] === clean) ??
    entries.find(
      (e) =>
        e.appId === clean ||
        e.desktopId.replace(/\.desktop$/i, "") === clean ||
        e.appId.toLowerCase() === lower ||
        e.startupWMClass?.toLowerCase() === lower,
    )
  );
}

export function createAppDescriber(
  host: Pick<AppsHost, "files">,
  apps: Pick<Apps, "list">,
  iconThemes: readonly string[],
) {
  let index: ReturnType<typeof buildXdgIconThemeIndex> | null = null;
  let entries: Promise<XdgDesktopEntry[]> | null = null;
  const icons = new Map<string, Promise<string | undefined>>();

  const iconFor = (key: string, candidates: readonly string[]) => {
    let icon = icons.get(key);
    if (!icon) {
      icon = (async () => {
        const themes = await (index ??= buildXdgIconThemeIndex(host.files, [...iconThemes]));
        const path = lookupXdgIconPath(themes, candidates, 64, 1);
        if (!path) return undefined;
        const url = await loadXdgIconDataUrl(host.files, path);
        return markInheritedAccentIcon(url, path, iconAccentConfigFromIndex(themes));
      })().catch(() => undefined);
      icons.set(key, icon);
    }
    return icon;
  };

  return async function describeApps(appIds: readonly string[]): Promise<Record<string, AppInfo>> {
    // Hidden entries too: the shell's own apps are shown only in Piloti.
    const list = await (entries ??= apps
      .list({ currentDesktops: ["Piloti", "Domicile", "GNOME"], deferIconDataLoad: true })
      .catch(() => {
        entries = null;
        return [];
      }));
    const pairs = await Promise.all(
      appIds.map(async (appId) => {
        const entry = findAppEntry(list, appId);
        const piloti = entry?.rawGroups["Desktop Entry"]?.["X-Piloti-XdgIcons"]?.split(";").filter(Boolean);
        const candidates = [...(piloti ?? []), entry?.icon, appId].filter((c): c is string => Boolean(c));
        return [appId, { name: entry?.name, iconUrl: await iconFor(appId, candidates) }] as const;
      }),
    );
    return Object.fromEntries(pairs);
  };
}
