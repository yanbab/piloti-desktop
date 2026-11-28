import { canonicalizeWebUrl } from "@/core/data/web-apps";

export interface SavedWindowBounds {
  position: { x: number; y: number };
  size: { width: number; height: number };
  workspace?: number;
  maximized?: boolean;
  monitor?: string;
}

export const DOCUMENT_SCOPED_APP_IDS = new Set([
  "nautilus",
  "texts",
  "image-viewer",
  "terminal",
]);

export interface SpatialBoundsTarget {
  appId: string;
  payload?: string;
  browserUrl?: string;
  desktopId?: string;
  shortId?: string;
}

function normalizeSpatialUrlKey(rawUrl?: string): string | undefined {
  const canonical = canonicalizeWebUrl(rawUrl);
  if (!canonical) return undefined;
  try {
    const parsed = new URL(canonical);
    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    return `url:${parsed.origin}${cleanPath}`;
  } catch {
    return `url:${canonical}`;
  }
}

/**
 * Resolves the canonical spatial storage key for a window so geometry (position,
 * size, workspace) is remembered per application and per document/folder/URL.
 */
export function resolveSpatialBoundsKey(target: SpatialBoundsTarget): string {
  if (target.browserUrl) {
    const urlKey = normalizeSpatialUrlKey(target.browserUrl);
    if (urlKey) return urlKey;
  }
  if (DOCUMENT_SCOPED_APP_IDS.has(target.appId) && target.payload) {
    return `${target.appId}:${target.payload}`;
  }
  return target.desktopId || target.appId;
}

/**
 * Looks up saved window bounds using ordered specificity:
 * primary spatial key (`url:` or `appId:payload`) -> `desktopId` -> `appId` -> `shortId` -> generic `"webview"`.
 */
export function lookupSpatialWindowBounds(
  saved: Readonly<Record<string, SavedWindowBounds>> | undefined,
  target: SpatialBoundsTarget,
): SavedWindowBounds | undefined {
  if (!saved) return undefined;
  const primary = resolveSpatialBoundsKey(target);
  if (saved[primary]) return saved[primary];

  const candidates = [
    target.desktopId,
    target.appId,
    target.shortId,
    target.browserUrl ? "webview" : undefined,
  ];
  for (const key of candidates) {
    if (key && saved[key]) {
      return saved[key];
    }
  }
  return undefined;
}
