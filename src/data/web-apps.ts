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
 * Extracts and normalizes `<meta name="description">` (or `og:description`)
 * from an HTML document string.
 */
export function parseHtmlDescription(html: string): string | null {
  if (!html) return null;
  let rawDescription = "";
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      rawDescription =
        doc
          .querySelector('meta[name="description" i]')
          ?.getAttribute("content") ??
        doc
          .querySelector('meta[property="og:description" i]')
          ?.getAttribute("content") ??
        "";
    } catch {
      rawDescription = "";
    }
  }
  if (!rawDescription) {
    const match =
      html.match(
        /<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i
      ) ??
      html.match(
        /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\bname\s*=\s*["']description["'][^>]*>/i
      ) ??
      html.match(
        /<meta\b[^>]*\bproperty\s*=\s*["']og:description["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i
      ) ??
      html.match(
        /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\bproperty\s*=\s*["']og:description["'][^>]*>/i
      );
    if (match?.[1]) {
      rawDescription = decodeHtmlEntities(match[1]);
    }
  }
  const normalized = rawDescription.replace(/\s+/g, " ").trim();
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

import { createLocalStorageCache } from "@/lib/storage-cache";

const THEME_COLOR_CACHE_KEY = "piloti.web-theme-colors.v1";
const themeColorCache = createLocalStorageCache<string | null>(
  THEME_COLOR_CACHE_KEY,
  (v): v is string | null => typeof v === "string" || v === null
);

function makeThemeColorCacheKey(rawUrl: string, prefersDark: boolean): string {
  const canonical = canonicalizeWebUrl(rawUrl) ?? rawUrl.trim();
  return `${canonical}|${prefersDark ? "dark" : "light"}`;
}

export function getCachedWebThemeColor(
  rawUrl?: string,
  prefersDark = false
): string | null | undefined {
  if (!rawUrl) return undefined;
  return themeColorCache.get(makeThemeColorCacheKey(rawUrl, prefersDark));
}

export function setCachedWebThemeColor(
  rawUrl: string | undefined,
  themeColor: string | null,
  prefersDark = false
) {
  if (!rawUrl) return;
  themeColorCache.set(makeThemeColorCacheKey(rawUrl, prefersDark), themeColor);
}

const WEB_DESCRIPTION_CACHE_KEY = "piloti.web-descriptions.v1";
const webDescriptionCache = createLocalStorageCache<string | null>(
  WEB_DESCRIPTION_CACHE_KEY,
  (v): v is string | null => typeof v === "string" || v === null
);

function makeWebDescriptionCacheKey(rawUrl: string): string {
  return canonicalizeWebUrl(rawUrl) ?? rawUrl.trim();
}

export function getCachedWebDescription(
  rawUrl?: string
): string | null | undefined {
  if (!rawUrl) return undefined;
  return webDescriptionCache.get(makeWebDescriptionCacheKey(rawUrl));
}

export function setCachedWebDescription(
  rawUrl: string | undefined,
  description: string | null
) {
  if (!rawUrl) return;
  webDescriptionCache.set(makeWebDescriptionCacheKey(rawUrl), description);
}

/**
 * Best-effort CORS fetch of an HTML document to extract `<title>`,
 * `<meta name="theme-color">`, and `<meta name="description">` when running in
 * the browser backend.
 */
export interface ParsedWebManifest {
  title: string | null;
  iconUrl: string | null;
  startUrl: string | null;
}

export function parseHtmlManifestHref(html: string, baseUrl: string): string | null {
  const match =
    html.match(
      /<link\b[^>]*\brel\s*=\s*["']manifest["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i
    ) ??
    html.match(
      /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\brel\s*=\s*["']manifest["'][^>]*>/i
    );
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

export function parseWebAppManifest(
  rawJson: unknown,
  manifestUrl: string
): ParsedWebManifest {
  if (!rawJson || typeof rawJson !== "object") {
    return { title: null, iconUrl: null, startUrl: null };
  }
  const obj = rawJson as {
    name?: unknown;
    short_name?: unknown;
    start_url?: unknown;
    icons?: Array<{ src?: unknown; sizes?: unknown; type?: unknown }>;
  };
  const title =
    typeof obj.short_name === "string" && obj.short_name.trim()
      ? obj.short_name.trim()
      : typeof obj.name === "string" && obj.name.trim()
        ? obj.name.trim()
        : null;
  let startUrl: string | null = null;
  if (typeof obj.start_url === "string" && obj.start_url.trim()) {
    try {
      startUrl = new URL(obj.start_url.trim(), manifestUrl).href;
    } catch {
      startUrl = null;
    }
  }
  let iconUrl: string | null = null;
  if (Array.isArray(obj.icons)) {
    let bestScore = -1;
    for (const icon of obj.icons) {
      if (!icon || typeof icon.src !== "string" || !icon.src.trim()) continue;
      let resolved: string;
      try {
        resolved = new URL(icon.src.trim(), manifestUrl).href;
      } catch {
        continue;
      }
      const sizesStr = typeof icon.sizes === "string" ? icon.sizes : "";
      const maxDim = sizesStr
        .split(/\s+/)
        .map((s) => Number.parseInt(s.split("x")[0] ?? "0", 10))
        .reduce((a, b) => (Number.isFinite(b) ? Math.max(a, b) : a), 0);
      const svgBonus = resolved.toLowerCase().endsWith(".svg") ? 512 : 0;
      const score = Math.max(maxDim, svgBonus);
      if (score > bestScore) {
        bestScore = score;
        iconUrl = resolved;
      }
    }
  }
  return { title, iconUrl, startUrl };
}

export async function fetchWebPageMetadata(
  rawUrl: string,
  signal?: AbortSignal,
  prefersDark = false
): Promise<{
  title: string | null;
  themeColor: string | null;
  description: string | null;
  iconUrl?: string | null;
  startUrl?: string | null;
}> {
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed || !isPublicHttpUrl(parsed)) {
    return { title: null, themeColor: null, description: null };
  }

  const cachedColor = getCachedWebThemeColor(parsed.href, prefersDark);
  const cachedDescription = getCachedWebDescription(parsed.href);

  if (
    typeof window !== "undefined" &&
    (window.location?.hostname === "localhost" ||
      window.location?.hostname === "127.0.0.1")
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
          description?: string | null;
          iconUrl?: string | null;
          startUrl?: string | null;
        };
        if (data.title || data.themeColor || data.description || data.iconUrl) {
          const resolvedColor = data.themeColor ?? null;
          const resolvedDescription = data.description
            ? decodeHtmlEntities(data.description).replace(/\s+/g, " ").trim() ||
              null
            : null;
          setCachedWebThemeColor(parsed.href, resolvedColor, prefersDark);
          if (resolvedDescription !== null) {
            setCachedWebDescription(parsed.href, resolvedDescription);
          }
          return {
            title: data.title ?? null,
            themeColor: resolvedColor,
            description: resolvedDescription ?? cachedDescription ?? null,
            iconUrl: data.iconUrl ?? null,
            startUrl: data.startUrl ?? null,
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
    if (!res.ok) {
      return {
        title: null,
        themeColor: cachedColor ?? null,
        description: cachedDescription ?? null,
      };
    }
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return {
        title: null,
        themeColor: cachedColor ?? null,
        description: cachedDescription ?? null,
      };
    }
    const html = (await res.text()).slice(0, 131072);
    const resolvedColor = parseHtmlThemeColor(html, prefersDark);
    const resolvedDescription = parseHtmlDescription(html);
    let manifestMeta: ParsedWebManifest = { title: null, iconUrl: null, startUrl: null };
    const manifestHref = parseHtmlManifestHref(html, parsed.href);
    if (manifestHref) {
      try {
        const mRes = await fetch(manifestHref, { mode: "cors", credentials: "omit", signal });
        if (mRes.ok) {
          manifestMeta = parseWebAppManifest(await mRes.json(), manifestHref);
        }
      } catch {
        // ignore CORS/fetch errors on manifest
      }
    }
    setCachedWebThemeColor(parsed.href, resolvedColor, prefersDark);
    if (resolvedDescription !== null) {
      setCachedWebDescription(parsed.href, resolvedDescription);
    }
    return {
      title: manifestMeta.title ?? parseHtmlTitle(html),
      themeColor: resolvedColor,
      description: resolvedDescription ?? cachedDescription ?? null,
      iconUrl: manifestMeta.iconUrl,
      startUrl: manifestMeta.startUrl,
    };
  } catch {
    return {
      title: null,
      themeColor: cachedColor ?? null,
      description: cachedDescription ?? null,
    };
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
