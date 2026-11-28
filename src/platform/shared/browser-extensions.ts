/**
 * Browser (Chrome) extension catalog and `~/.config/domicile/domicile.json` helpers.
 *
 * Native Domicile loads extensions from `extensions.web_store` (Chrome Web Store IDs)
 * and `extensions.unpacked` (absolute paths). Web mode cannot run real extensions, so
 * Dark Reader is simulated there with a CSS filter on web app frames.
 */

export interface ExtensionsConfig {
  unpacked: string[];
  web_store: string[];
}

export interface RecommendedExtension {
  id: "ublock-origin-lite" | "dark-reader";
  name: string;
  description: string;
  /** Chrome Web Store extension ID. */
  webStoreId: string;
  storeUrl: string;
  /** How the extension behaves in browser (Web) mode. */
  webMode: "simulated" | "unavailable";
}

export const RECOMMENDED_EXTENSIONS: readonly RecommendedExtension[] = [
  {
    id: "ublock-origin-lite",
    name: "uBlock Origin Lite",
    description: "Efficient content blocker (Manifest V3).",
    webStoreId: "ddkjiahejlhfcafbddmgiahcphecmpfh",
    storeUrl:
      "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh",
    webMode: "unavailable",
  },
  {
    id: "dark-reader",
    name: "Dark Reader",
    description: "Dark mode for every website.",
    webStoreId: "eimadpbcbfnmbkopoojfekhnkhdbieeh",
    storeUrl:
      "https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh",
    webMode: "simulated",
  },
];

/** Sample unpacked Manifest V3 extension shipped with Piloti (`data/files/usr/share/piloti/extensions`). */
export const SAMPLE_LOCAL_EXTENSION = {
  name: "Piloti Demo Extension",
  path: "/usr/share/piloti/extensions/piloti-demo",
} as const;

export function normalizeExtensionsConfig(raw: unknown): ExtensionsConfig {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
      : [];
  return { unpacked: list(obj.unpacked), web_store: list(obj.web_store) };
}

export function isExtensionEnabled(
  config: ExtensionsConfig,
  kind: keyof ExtensionsConfig,
  value: string,
): boolean {
  return config[kind].includes(value);
}

/** Returns a new config with `value` added to / removed from `kind` (idempotent). */
export function setExtensionEnabled(
  config: ExtensionsConfig,
  kind: keyof ExtensionsConfig,
  value: string,
  enabled: boolean,
): ExtensionsConfig {
  const without = config[kind].filter((v) => v !== value);
  return { ...config, [kind]: enabled ? [...without, value] : without };
}

/** CSS `filter` used to simulate Dark Reader on web (iframe) app frames. */
export const WEB_DARK_READER_FILTER =
  "invert(1) hue-rotate(180deg) contrast(0.92) brightness(0.95)";

export const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/";

/**
 * Extracts a 32-character Chrome Web Store extension ID from a detail URL
 * (`https://chromewebstore.google.com/detail/.../<id>` or legacy `chrome.google.com/webstore/detail/.../<id>`).
 */
export function parseChromeWebStoreExtensionId(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    if (
      u.hostname !== "chromewebstore.google.com" &&
      u.hostname !== "chrome.google.com"
    ) {
      return null;
    }
    const match = u.pathname.match(/\/detail\/(?:[^/]+\/)?([a-p]{32})(?:\/|$)/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}
