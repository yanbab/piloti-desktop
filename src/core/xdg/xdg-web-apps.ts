import {
  canonicalizeWebUrl,
  DEFAULT_BROWSER_WEB_APPS,
  getWebAppFaviconUrl,
  type InstalledWebApp,
} from "@/core/data/web-apps";
import {
  WEB_VFS_HOME,
} from "@/core/files/vfs-paths";
import {
  parseDesktopEntry,
} from "./xdg-desktop-entry";

export const WEB_APPS_XDG_DIR = `${WEB_VFS_HOME}/.local/share/applications`;
export const XDG_WEBAPPS_CHANGED_EVENT = "piloti:xdg-webapps-changed";

function sanitizeDesktopSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "webapp";
}

function escapeDesktopValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export function notifyWebAppsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(XDG_WEBAPPS_CHANGED_EVENT));
  }
}

export function webAppDesktopFileName(
  app: Pick<InstalledWebApp, "id" | "url">,
): string {
  const base = app.id || app.url;
  return `piloti-webapp-${sanitizeDesktopSlug(base)}.desktop`;
}

export function serializeWebAppDesktopEntry(app: InstalledWebApp): string {
  const url = canonicalizeWebUrl(app.url) ?? app.url;
  const icon = app.iconUrl || getWebAppFaviconUrl(url) || "web-browser";
  const lines: string[] = [
    "[Desktop Entry]",
    "Version=1.0",
    "Type=Application",
    `Name=${escapeDesktopValue(app.title)}`,
    `Comment=${escapeDesktopValue(app.keywords || url)}`,
    `Exec=piloti-webapp ${url}`,
    `Icon=${escapeDesktopValue(icon)}`,
    `Categories=${escapeDesktopValue(app.category || "Network")};`,
    "StartupNotify=true",
    `X-Piloti-WebApp-Id=${escapeDesktopValue(app.id)}`,
    `X-Piloti-WebApp-URL=${escapeDesktopValue(url)}`,
  ];
  if (app.iconUrl) {
    lines.push(`X-Piloti-WebApp-Icon-URL=${escapeDesktopValue(app.iconUrl)}`);
  }
  if (app.keywords) {
    lines.push(`Keywords=${escapeDesktopValue(app.keywords)};`);
  }
  if (app.launcherDefault) {
    lines.push("X-Piloti-WebApp-Launcher-Default=true");
  }
  return `${lines.join("\n")}\n`;
}

function parseIniKeyValues(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  let inDesktopEntry = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inDesktopEntry = line === "[Desktop Entry]";
      continue;
    }
    if (!inDesktopEntry) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    result[key] = val;
  }
  return result;
}

export function parseWebAppDesktopEntry(
  content: string,
  filePath = "",
): InstalledWebApp | null {
  const rawKv = parseIniKeyValues(content);
  const parsed = parseDesktopEntry(content, {
    filePath: filePath || `${WEB_APPS_XDG_DIR}/webapp.desktop`,
    baseDir: WEB_APPS_XDG_DIR,
  });

  const explicitUrl = rawKv["X-Piloti-WebApp-URL"] || rawKv.URL;
  const execStr = rawKv.Exec || parsed?.exec || "";
  const execMatch =
    execStr.match(/^piloti-webapp\s+(https?:\/\/\S+)/i) ??
    execStr.match(/--app=(https?:\/\/\S+)/i);
  const rawUrl = explicitUrl || execMatch?.[1];
  if (!rawUrl) return null;

  const url = canonicalizeWebUrl(rawUrl) ?? rawUrl;
  const catalogMatch = DEFAULT_BROWSER_WEB_APPS.find(
    (entry) => (canonicalizeWebUrl(entry.url) ?? entry.url) === url,
  );

  const fileStem = filePath
    .split("/")
    .pop()
    ?.replace(/\.desktop$/i, "")
    .replace(/^piloti-webapp-/, "");

  const id =
    rawKv["X-Piloti-WebApp-Id"] ||
    catalogMatch?.id ||
    fileStem ||
    sanitizeDesktopSlug(url);
  const title = parsed?.name || rawKv.Name || catalogMatch?.title || id;
  const iconUrl =
    rawKv["X-Piloti-WebApp-Icon-URL"] ||
    (rawKv.Icon && /^https?:\/\//i.test(rawKv.Icon) ? rawKv.Icon : undefined) ||
    catalogMatch?.iconUrl ||
    getWebAppFaviconUrl(url);
  const category =
    rawKv.Categories?.split(";").find(Boolean) || catalogMatch?.category;
  const keywords =
    rawKv.Keywords?.replace(/;+$/, "") || catalogMatch?.keywords;
  const launcherDefault =
    rawKv["X-Piloti-WebApp-Launcher-Default"] === "true" ||
    catalogMatch?.launcherDefault;

  return {
    id,
    title,
    url,
    ...(iconUrl ? { iconUrl } : {}),
    ...(keywords ? { keywords } : {}),
    ...(category ? { category } : {}),
    ...(launcherDefault ? { launcherDefault } : {}),
  };
}
