/**
 * Accent-colored icons.
 *
 * An icon follows the desktop accent color when it marks the shapes to
 * recolor (see docs/_ICONS.md):
 *   - SVG: `class="accent"`, `"accent-darker"` or `"accent-lighter"` (fill), or
 *     the same names with a `-stroke` suffix (stroke).
 *   - Lottie: a fill or stroke item whose `cl` is one of those names.
 *
 * Icons from inherited themes (stock Papirus) carry no markers. The icon theme
 * lists them in its `[X-Piloti Accent]` group, with the colors they use for
 * the accent; `markInheritedAccentIcon` adds the markers when they are loaded.
 */

import type { XdgIconThemeIndex } from "@/lib/xdg/xdg-icon-theme";

type Rgb = [number, number, number];

export interface IconAccentConfig {
  /** Colors that mean "accent" in unmarked inherited icons. */
  accent: string;
  darker: string;
  lighter: string;
  /** Darker shade = accent × (1 − darkerFactor). */
  darkerFactor: number;
  /** Lighter shade = accent mixed with white by lighterMix. */
  lighterMix: number;
  /** Inherited icon names to mark; a trailing `*` matches any suffix. */
  inheritedIcons: readonly string[];
}

export const DEFAULT_ICON_ACCENT_CONFIG: IconAccentConfig = {
  accent: "#5294e2",
  darker: "#4877b1",
  lighter: "#8bbcf6",
  darkerFactor: 0.22,
  lighterMix: 0.4,
  inheritedIcons: [],
};

const SHADES = ["accent", "accent-darker", "accent-lighter"] as const;
type Shade = (typeof SHADES)[number];

function parseHexRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const n = Number.parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function shadesFor(accentHex: string, config: IconAccentConfig): Record<Shade, Rgb> | null {
  const rgb = parseHexRgb(accentHex);
  if (!rgb) return null;
  const k = 1 - config.darkerFactor;
  const m = config.lighterMix;
  return {
    accent: rgb,
    "accent-darker": [rgb[0] * k, rgb[1] * k, rgb[2] * k],
    "accent-lighter": [
      rgb[0] + (255 - rgb[0]) * m,
      rgb[1] + (255 - rgb[1]) * m,
      rgb[2] + (255 - rgb[2]) * m,
    ],
  };
}

// ── Data URL helpers ─────────────────────────────────────────────────────────

type IconPayload = { kind: "svg" | "json"; text: string };

function decodeIconDataUrl(dataUrl: string): IconPayload | null {
  const kind = dataUrl.startsWith("data:image/svg+xml")
    ? "svg"
    : dataUrl.startsWith("data:application/json")
      ? "json"
      : null;
  if (!kind) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma).toLowerCase();
  const body = dataUrl.slice(comma + 1);
  try {
    if (header.includes(";base64")) {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { kind, text: new TextDecoder().decode(bytes) };
    }
    return { kind, text: decodeURIComponent(body) };
  } catch {
    return null;
  }
}

function encodeIconDataUrl({ kind, text }: IconPayload): string {
  const mime = kind === "svg" ? "image/svg+xml" : "application/json";
  return `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
}

const SVG_MARKER_RE = /class="[^"]*\baccent(-darker|-lighter)?(-stroke)?\b/;
const LOTTIE_MARKER_RE = /"cl":"accent(-darker|-lighter)?(-stroke)?"/;

function payloadHasMarkers(payload: IconPayload): boolean {
  return payload.kind === "svg"
    ? SVG_MARKER_RE.test(payload.text)
    : LOTTIE_MARKER_RE.test(payload.text);
}

// Icons are recolored on every accent change; remember which ones have markers
// and the recolored result so each icon is decoded once.
const markerCache = new Map<string, boolean>();
const tintCache = new Map<string, string>();
const TINT_CACHE_LIMIT = 600;

export function hasAccentMarkers(dataUrl: string | undefined): boolean {
  if (!dataUrl) return false;
  const cached = markerCache.get(dataUrl);
  if (cached !== undefined) return cached;
  const payload = decodeIconDataUrl(dataUrl);
  const result = payload ? payloadHasMarkers(payload) : false;
  markerCache.set(dataUrl, result);
  return result;
}

// ── Theme configuration ──────────────────────────────────────────────────────

export function parseIconAccentConfig(
  group: Record<string, string> | undefined
): IconAccentConfig | null {
  if (!group) return null;
  const color = (key: string, fallback: string) => {
    const rgb = parseHexRgb(group[key] ?? "");
    return rgb ? toHex(rgb) : fallback;
  };
  const factor = (key: string, fallback: number) => {
    const n = Number.parseFloat(group[key] ?? "");
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
  };
  const d = DEFAULT_ICON_ACCENT_CONFIG;
  return {
    accent: color("Accent", d.accent),
    darker: color("Darker", d.darker),
    lighter: color("Lighter", d.lighter),
    darkerFactor: factor("DarkerFactor", d.darkerFactor),
    lighterMix: factor("LighterMix", d.lighterMix),
    inheritedIcons: (group["InheritedIcons"] ?? "")
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** The `[X-Piloti Accent]` group of the first theme in the chain that has one. */
export function iconAccentConfigFromIndex(
  index: Pick<XdgIconThemeIndex, "themeOrder" | "themes"> | null | undefined
): IconAccentConfig {
  for (const themeId of index?.themeOrder ?? []) {
    const config = parseIconAccentConfig(index?.themes.get(themeId)?.accent);
    if (config) return config;
  }
  return DEFAULT_ICON_ACCENT_CONFIG;
}

function iconNameFromPath(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.(svg|png|xpm|json)$/i, "");
}

function matchesIconPattern(name: string, pattern: string): boolean {
  return pattern.endsWith("*")
    ? name.startsWith(pattern.slice(0, -1))
    : name === pattern;
}

/**
 * Adds accent markers to an unmarked SVG whose name the theme lists in
 * `InheritedIcons`. Other icons are returned unchanged.
 */
export function markInheritedAccentIcon(
  dataUrl: string | undefined,
  iconPath: string,
  config: IconAccentConfig
): string | undefined {
  if (!dataUrl || !dataUrl.startsWith("data:image/svg+xml")) return dataUrl;
  const name = iconNameFromPath(iconPath);
  if (!config.inheritedIcons.some((p) => matchesIconPattern(name, p))) {
    return dataUrl;
  }
  const payload = decodeIconDataUrl(dataUrl);
  if (!payload || payloadHasMarkers(payload)) return dataUrl;

  const colors: [string, Shade][] = [
    [config.accent.slice(1), "accent"],
    [config.darker.slice(1), "accent-darker"],
    [config.lighter.slice(1), "accent-lighter"],
  ];
  let marked = 0;
  const text = payload.text.replace(
    /<(path|rect|circle|ellipse|polygon|line|g)\b([^>]*?)(\/?)>/g,
    (tag, el: string, attrs: string, close: string) => {
      if (/\bclass="/.test(attrs)) return tag;
      const classes: string[] = [];
      for (const [hex, shade] of colors) {
        if (new RegExp(`fill(:|=")#${hex}`, "i").test(attrs)) classes.push(shade);
        if (new RegExp(`stroke(:|=")#${hex}`, "i").test(attrs)) classes.push(`${shade}-stroke`);
      }
      if (classes.length === 0) return tag;
      marked++;
      return `<${el} class="${classes.join(" ")}"${attrs}${close}>`;
    }
  );
  return marked > 0 ? encodeIconDataUrl({ kind: "svg", text }) : dataUrl;
}

// ── Recoloring ───────────────────────────────────────────────────────────────

function tintSvg(text: string, shades: Record<Shade, Rgb>): string {
  // A stylesheet beats presentation attributes and, with !important, inline
  // `style="fill:…"`, so the artwork itself is left untouched.
  const rules = SHADES.map((shade) => {
    const hex = toHex(shades[shade]);
    return `.${shade}{fill:${hex}!important}.${shade}-stroke{stroke:${hex}!important}`;
  }).join("");
  return text.replace(/<svg\b[^>]*>/, (open) => `${open}<style>${rules}</style>`);
}

function tintLottie(text: string, shades: Record<Shade, Rgb>): string {
  const doc = JSON.parse(text) as unknown;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const item = node as { cl?: unknown; c?: { a?: number; k?: unknown } };
    if (typeof item.cl === "string" && item.c && item.c.a === 0) {
      const shade = item.cl.replace(/-stroke$/, "") as Shade;
      const rgb = shades[shade];
      if (rgb) {
        item.c.k = [...rgb.map((v) => Number((v / 255).toFixed(4))), 1];
      }
    }
    Object.values(node).forEach(walk);
  };
  walk(doc);
  return JSON.stringify(doc);
}

/** Recolors the marked shapes of an SVG or Lottie data URL with the accent. */
export function tintIconDataUrl(
  dataUrl: string | undefined,
  accentHex: string,
  config: IconAccentConfig = DEFAULT_ICON_ACCENT_CONFIG
): string | undefined {
  if (!dataUrl || !hasAccentMarkers(dataUrl)) return dataUrl;
  const shades = shadesFor(accentHex, config);
  if (!shades) return dataUrl;

  const key = `${accentHex}|${config.darkerFactor}|${config.lighterMix}|${dataUrl}`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const payload = decodeIconDataUrl(dataUrl);
  if (!payload) return dataUrl;
  let tinted: string;
  try {
    tinted = encodeIconDataUrl({
      kind: payload.kind,
      text: payload.kind === "svg" ? tintSvg(payload.text, shades) : tintLottie(payload.text, shades),
    });
  } catch {
    return dataUrl;
  }
  if (tintCache.size >= TINT_CACHE_LIMIT) tintCache.clear();
  tintCache.set(key, tinted);
  return tinted;
}
