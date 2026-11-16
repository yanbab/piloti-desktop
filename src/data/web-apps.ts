import appData from "./app.json";

export interface InstalledWebApp {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
  keywords?: string;
  category?: string;
  launcherDefault?: boolean;
}

function parseHttpUrl(rawUrl?: string): URL | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function isPublicHttpUrl(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  return (
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    host !== "::1" &&
    host !== "[::1]"
  );
}

/**
 * Normalizes an http(s) web app URL into its canonical href form so
 * trailing-slash differences (e.g. `https://excalidraw.com` vs
 * `https://excalidraw.com/`) match reliably.
 */
export function canonicalizeWebUrl(rawUrl?: string): string | undefined {
  return parseHttpUrl(rawUrl)?.href;
}

/**
 * Resolves a high-resolution favicon URL for an http(s) web app so both
 * native `<webview>` and cross-origin web backend iframes render site icons.
 */
export function getWebAppFaviconUrl(rawUrl?: string): string | undefined {
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed || !isPublicHttpUrl(parsed)) return undefined;
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsed.href)}&sz=128`;
}

/**
 * Curated iframe-friendly web apps and games consolidated in `src/data/app.json`.
 */
export const DEFAULT_BROWSER_WEB_APPS: readonly InstalledWebApp[] =
  appData.webApps;

/**
 * Top 10 curated web apps installed by default in the web Launcher; the
 * remaining curated web apps and games are available in Application Store.
 */
export const DEFAULT_LAUNCHER_WEB_APPS: readonly InstalledWebApp[] =
  DEFAULT_BROWSER_WEB_APPS.filter((app) => app.launcherDefault === true);

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
};

function decodeHtmlEntities(raw: string): string {
  return raw.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (full, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower in NAMED_HTML_ENTITIES) {
      return NAMED_HTML_ENTITIES[lower];
    }
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    return full;
  });
}

/**
 * Extracts and normalizes the HTML `<title>` text from a document string.
 */
export function parseHtmlTitle(html: string): string | null {
  if (!html) return null;
  let rawTitle = "";
  if (typeof DOMParser !== "undefined") {
    try {
      rawTitle = new DOMParser().parseFromString(html, "text/html").title;
    } catch {
      rawTitle = "";
    }
  }
  if (!rawTitle) {
    const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (match?.[1]) {
      rawTitle = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, ""));
    }
  }
  const normalized = rawTitle.replace(/\s+/g, " ").trim();
  return normalized || null;
}

/**
 * Extracts the human-readable hostname fallback (without leading `www.`) for a URL.
 */
export function getHostnameFallbackTitle(rawUrl?: string): string {
  if (!rawUrl) return "";
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed) return rawUrl.trim();
  return parsed.hostname.replace(/^www\./i, "") || rawUrl.trim();
}

/**
 * Returns true if `title` is empty or merely a raw hostname fallback for `rawUrl`.
 */
export function isHostnameFallbackTitle(
  title: string | undefined,
  rawUrl?: string
): boolean {
  const normalized = title?.trim().toLowerCase() ?? "";
  if (!normalized) return true;
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed) return rawUrl ? normalized === rawUrl.trim().toLowerCase() : false;
  const host = parsed.hostname.toLowerCase();
  const shortHost = host.replace(/^www\./, "");
  return (
    normalized === host ||
    normalized === shortHost ||
    normalized === parsed.href.toLowerCase()
  );
}

/**
 * Finds the matching installed or curated web app entry using canonicalized URLs.
 */
export function findMatchingWebApp<T extends Pick<InstalledWebApp, "url">>(
  rawUrl: string | undefined,
  apps: readonly T[]
): T | undefined {
  if (!rawUrl) return undefined;
  const targetCanonical = canonicalizeWebUrl(rawUrl);
  return apps.find((app) => {
    if (app.url === rawUrl) return true;
    return Boolean(targetCanonical && canonicalizeWebUrl(app.url) === targetCanonical);
  });
}

/**
 * Resolves the best display title for a web app window, preferring live HTML
 * document titles, then native compositor titles, non-hostname installed titles,
 * curated default app titles, and finally a clean hostname fallback.
 */
export function resolveWebAppTitle(options: {
  rawUrl?: string;
  liveTitle?: string;
  hostTitle?: string;
  installedApps?: readonly InstalledWebApp[];
  fallback?: string;
}): string {
  const live = options.liveTitle?.trim();
  if (live) return live;

  const host = options.hostTitle?.trim();
  const installedMatch = findMatchingWebApp(
    options.rawUrl,
    options.installedApps ?? []
  );
  if (host && !isHostnameFallbackTitle(host, options.rawUrl)) {
    return host;
  }

  const installedTitle = installedMatch?.title?.trim();
  if (installedTitle && !isHostnameFallbackTitle(installedTitle, options.rawUrl)) {
    return installedTitle;
  }

  const defaultMatch = findMatchingWebApp(options.rawUrl, DEFAULT_BROWSER_WEB_APPS);
  if (defaultMatch?.title) {
    return defaultMatch.title;
  }

  if (host) return host;
  if (installedTitle) return installedTitle;
  return getHostnameFallbackTitle(options.rawUrl) || options.fallback || "Web View";
}

/**
 * Extracts `<meta name="theme-color">` from an HTML document string, honoring
 * `(prefers-color-scheme: dark|light)` media attributes when present.
 */
export function parseHtmlThemeColor(
  html: string,
  prefersDark = false
): string | null {
  if (!html) return null;

  const candidates: Array<{ content: string; media: string }> = [];
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll('meta[name="theme-color" i]').forEach((el) => {
        const content = el.getAttribute("content")?.trim();
        if (content) {
          candidates.push({
            content,
            media: el.getAttribute("media")?.toLowerCase() ?? "",
          });
        }
      });
    } catch {
      // fall through to regex
    }
  }

  if (candidates.length === 0) {
    const metaRegex = /<meta\b([^>]*\bname\s*=\s*["']theme-color["'][^>]*)>/gi;
    let match: RegExpExecArray | null;
    while ((match = metaRegex.exec(html)) !== null) {
      const attrs = match[1];
      const contentMatch = attrs.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
      if (!contentMatch?.[1]?.trim()) continue;
      const mediaMatch = attrs.match(/\bmedia\s*=\s*["']([^"']+)["']/i);
      candidates.push({
        content: contentMatch[1].trim(),
        media: mediaMatch?.[1]?.toLowerCase() ?? "",
      });
    }
  }

  for (const c of candidates) {
    if (!c.media) return c.content;
    const wantsDark = c.media.includes("prefers-color-scheme: dark");
    const wantsLight = c.media.includes("prefers-color-scheme: light");
    if ((wantsDark && prefersDark) || (wantsLight && !prefersDark)) {
      return c.content;
    }
  }

  return candidates[0]?.content ?? null;
}

/**
 * Parses a CSS hex or rgb(a) color and returns a high-contrast foreground
 * color (`#ffffff` or `#1d1d20`) for tinting headerbars.
 */
export function getContrastForeground(cssColor?: string | null): string | null {
  if (!cssColor) return null;
  const raw = cssColor.trim();
  let r: number;
  let g: number;
  let b: number;

  const hex3 = raw.match(/^#([\da-f]{3})$/i);
  const hex6 = raw.match(/^#([\da-f]{6})$/i);
  const rgb = raw.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i
  );

  if (hex3) {
    r = Number.parseInt(hex3[1][0] + hex3[1][0], 16);
    g = Number.parseInt(hex3[1][1] + hex3[1][1], 16);
    b = Number.parseInt(hex3[1][2] + hex3[1][2], 16);
  } else if (hex6) {
    r = Number.parseInt(hex6[1].slice(0, 2), 16);
    g = Number.parseInt(hex6[1].slice(2, 4), 16);
    b = Number.parseInt(hex6[1].slice(4, 6), 16);
  } else if (rgb) {
    if (rgb[4] !== undefined && Number.parseFloat(rgb[4]) <= 0.05) return null;
    r = Math.min(255, Number.parseInt(rgb[1], 10));
    g = Math.min(255, Number.parseInt(rgb[2], 10));
    b = Math.min(255, Number.parseInt(rgb[3], 10));
  } else {
    return null;
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#1d1d20" : "#ffffff";
}

const THEME_COLOR_CACHE_KEY = "piloti.web-theme-colors.v1";
const themeColorMemoryCache = new Map<string, string | null>();
let themeColorStorageLoaded = false;

function ensureThemeColorCacheLoaded() {
  if (themeColorStorageLoaded || typeof localStorage === "undefined") return;
  themeColorStorageLoaded = true;
  try {
    const raw = localStorage.getItem(THEME_COLOR_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" || v === null) {
          themeColorMemoryCache.set(k, v);
        }
      }
    }
  } catch {
    // ignore storage errors
  }
}

function makeThemeColorCacheKey(rawUrl: string, prefersDark: boolean): string {
  const canonical = canonicalizeWebUrl(rawUrl) ?? rawUrl.trim();
  return `${canonical}|${prefersDark ? "dark" : "light"}`;
}

export function getCachedWebThemeColor(
  rawUrl?: string,
  prefersDark = false
): string | null | undefined {
  if (!rawUrl) return undefined;
  ensureThemeColorCacheLoaded();
  return themeColorMemoryCache.get(makeThemeColorCacheKey(rawUrl, prefersDark));
}

export function setCachedWebThemeColor(
  rawUrl: string | undefined,
  themeColor: string | null,
  prefersDark = false
) {
  if (!rawUrl) return;
  ensureThemeColorCacheLoaded();
  const key = makeThemeColorCacheKey(rawUrl, prefersDark);
  themeColorMemoryCache.set(key, themeColor);
  if (typeof localStorage === "undefined") return;
  try {
    const obj: Record<string, string | null> = {};
    for (const [k, v] of themeColorMemoryCache.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(THEME_COLOR_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage errors
  }
}

/**
 * Best-effort CORS fetch of an HTML document to extract `<title>` and
 * `<meta name="theme-color">` when running in the browser backend.
 */
export async function fetchWebPageMetadata(
  rawUrl: string,
  signal?: AbortSignal,
  prefersDark = false
): Promise<{ title: string | null; themeColor: string | null }> {
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed || !isPublicHttpUrl(parsed)) {
    return { title: null, themeColor: null };
  }

  const cachedColor = getCachedWebThemeColor(parsed.href, prefersDark);

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    try {
      const proxyRes = await fetch(
        `/__web_meta?url=${encodeURIComponent(parsed.href)}&dark=${prefersDark ? "1" : "0"}`,
        { signal }
      );
      const ct = proxyRes.headers.get("content-type")?.toLowerCase() ?? "";
      if (proxyRes.ok && ct.includes("application/json")) {
        const data = (await proxyRes.json()) as {
          title?: string | null;
          themeColor?: string | null;
        };
        if (data.title || data.themeColor) {
          const resolvedColor = data.themeColor ?? null;
          setCachedWebThemeColor(parsed.href, resolvedColor, prefersDark);
          return {
            title: data.title ?? null,
            themeColor: resolvedColor,
          };
        }
      }
    } catch {
      // fall through to direct CORS fetch
    }
  }

  try {
    const res = await fetch(parsed.href, {
      mode: "cors",
      credentials: "omit",
      signal,
    });
    if (!res.ok) return { title: null, themeColor: cachedColor ?? null };
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return { title: null, themeColor: cachedColor ?? null };
    }
    const html = (await res.text()).slice(0, 131072);
    const resolvedColor = parseHtmlThemeColor(html, prefersDark);
    setCachedWebThemeColor(parsed.href, resolvedColor, prefersDark);
    return {
      title: parseHtmlTitle(html),
      themeColor: resolvedColor,
    };
  } catch {
    return { title: null, themeColor: cachedColor ?? null };
  }
}

/**
 * Best-effort CORS fetch of an HTML document to extract its `<title>` when
 * running in the browser backend (cross-origin iframes block `contentDocument`).
 */
export async function fetchWebPageTitle(
  rawUrl: string,
  signal?: AbortSignal
): Promise<string | null> {
  const { title } = await fetchWebPageMetadata(rawUrl, signal);
  return title;
}
