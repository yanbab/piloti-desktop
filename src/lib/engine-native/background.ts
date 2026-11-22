import type { WallpaperOption } from "@/data/catalog";

export type GnomePictureOptions =
  | "none"
  | "wallpaper"
  | "centered"
  | "scaled"
  | "stretched"
  | "zoom"
  | "spanned";

export type GnomeColorShadingType = "solid" | "horizontal" | "vertical";
export type WallpaperColorMode = "solid" | "linear" | "circular";

export interface GnomeBackgroundSettings {
  pictureUri: string;
  pictureUriDark: string;
  pictureOptions: GnomePictureOptions;
  primaryColor: string;
  secondaryColor: string;
  colorShadingType: GnomeColorShadingType;
  pictureOpacity: number;
}

export const DEFAULT_GNOME_BACKGROUND: GnomeBackgroundSettings = {
  pictureUri: "",
  pictureUriDark: "",
  pictureOptions: "zoom",
  primaryColor: "#023c88",
  secondaryColor: "#5789ca",
  colorShadingType: "solid",
  pictureOpacity: 100,
};

export const GNOME_PICTURE_OPTIONS: readonly {
  value: GnomePictureOptions;
  label: string;
}[] = [
  { value: "zoom", label: "Zoom" },
  { value: "scaled", label: "Scaled (Fit)" },
  { value: "centered", label: "Centered" },
  { value: "stretched", label: "Stretched" },
  { value: "wallpaper", label: "Wallpaper (Tiled)" },
  { value: "spanned", label: "Spanned" },
  { value: "none", label: "None (Color Only)" },
];

export const GNOME_SHADING_TYPES: readonly {
  value: GnomeColorShadingType;
  label: string;
}[] = [
  { value: "solid", label: "Solid" },
  { value: "horizontal", label: "Horizontal Gradient" },
  { value: "vertical", label: "Vertical Gradient" },
];

const PICTURE_STYLE_CSS: Record<
  Exclude<GnomePictureOptions, "none">,
  {
    backgroundSize: string;
    backgroundPosition: string;
    backgroundRepeat: string;
  }
> = {
  zoom: {
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  scaled: {
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  centered: {
    backgroundSize: "auto",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  stretched: {
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  wallpaper: {
    backgroundSize: "auto",
    backgroundPosition: "top left",
    backgroundRepeat: "repeat",
  },
  spanned: {
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
};

const VALID_PICTURE_OPTIONS = new Set<GnomePictureOptions>(
  GNOME_PICTURE_OPTIONS.map((o) => o.value)
);

const VALID_SHADING_TYPES = new Set<GnomeColorShadingType>(
  GNOME_SHADING_TYPES.map((s) => s.value)
);

function stripGVariantQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Normalizes a GNOME/GTK color string (`#rgb`, `#rrggbb`, `#rrrrggggbbbb`, or
 * `rgb(...)`) into standard CSS color notation.
 */
export function normalizeGnomeColor(raw: string): string | null {
  const val = raw.trim();
  if (!val) return null;

  // Older GSettings/GdkColor values can use 16-bit per channel hex: #rrrrggggbbbb
  const hex12 = /^#([\da-f]{4})([\da-f]{4})([\da-f]{4})$/i.exec(val);
  if (hex12) {
    return `#${hex12[1].slice(0, 2)}${hex12[2].slice(0, 2)}${hex12[3].slice(0, 2)}`.toLowerCase();
  }

  const hex3 = /^#([\da-f])([\da-f])([\da-f])$/i.exec(val);
  if (hex3) {
    return `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`.toLowerCase();
  }

  if (/^#[\da-f]{6}$/i.test(val)) {
    return val.toLowerCase();
  }

  if (/^(?:rgb|rgba|hsl|hsla)\([^)]+\)$/i.test(val)) {
    return val;
  }

  return null;
}

/**
 * Resolves an `rgb(...)` or hex string into a `#rrggbb` value for HTML color pickers.
 */
export function toHexColorInputValue(color: string, fallback = "#023c88"): string {
  const normalized = normalizeGnomeColor(color);
  if (normalized && /^#[\da-f]{6}$/i.test(normalized)) {
    return normalized;
  }
  if (normalized) {
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(normalized);
    if (rgb) {
      const hex = [rgb[1], rgb[2], rgb[3]]
        .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0"))
        .join("");
      return `#${hex}`;
    }
  }
  return fallback;
}

/**
 * Converts a local filesystem path into a properly encoded `file://` URI.
 */
export function localPathToFileUri(localPath: string): string {
  const trimmed = localPath.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("file://")) return trimmed;
  return `file://${encodeURI(trimmed.startsWith("/") ? trimmed : `/${trimmed}`)}`;
}

/**
 * Extracts a decoded local POSIX path from a `file://` URI or absolute path.
 * Returns `null` for HTTP(S), `data:`, or `blob:` URLs.
 */
export function fileUriToLocalPath(rawUri: string): string | null {
  const trimmed = rawUri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  if (!trimmed.toLowerCase().startsWith("file://")) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "file:") return null;
    if (parsed.hostname && parsed.hostname !== "localhost") return null;
    return decodeURIComponent(parsed.pathname);
  } catch {
    return decodeURIComponent(trimmed.replace(/^file:\/\//i, ""));
  }
}

/**
 * Normalizes a user-entered wallpaper path or URL for `org.gnome.desktop.background`.
 */
export function normalizeBackgroundPictureUri(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return localPathToFileUri(trimmed);
  return trimmed;
}

/**
 * Parses a single key/value pair from `org.gnome.desktop.background`.
 */
export function parseGnomeBackgroundKeyVal(
  key: string,
  rawVal: string
): Partial<GnomeBackgroundSettings> {
  const val = stripGVariantQuotes(rawVal);
  switch (key) {
    case "picture-uri":
      return { pictureUri: val };
    case "picture-uri-dark":
      return { pictureUriDark: val };
    case "picture-options": {
      return VALID_PICTURE_OPTIONS.has(val as GnomePictureOptions)
        ? { pictureOptions: val as GnomePictureOptions }
        : {};
    }
    case "color-shading-type": {
      return VALID_SHADING_TYPES.has(val as GnomeColorShadingType)
        ? { colorShadingType: val as GnomeColorShadingType }
        : {};
    }
    case "primary-color": {
      const color = normalizeGnomeColor(val);
      return color ? { primaryColor: color } : {};
    }
    case "secondary-color": {
      const color = normalizeGnomeColor(val);
      return color ? { secondaryColor: color } : {};
    }
    case "picture-opacity": {
      const parsed = Number(val);
      return Number.isFinite(parsed)
        ? { pictureOpacity: Math.max(0, Math.min(100, Math.round(parsed))) }
        : {};
    }
    default:
      return {};
  }
}

/**
 * Extracts a target image path from a GNOME timed/slideshow `<background>` XML file.
 */
export function parseGnomeBackgroundXml(
  xml: string,
  baseDir?: string
): string | null {
  if (!xml) return null;
  const staticBlock = xml.match(/<static\b[^>]*>([\s\S]*?)<\/static>/i)?.[1] ?? xml;
  const fileMatch = staticBlock.match(/<file\b[^>]*>([\s\S]*?)<\/file>/i);
  if (!fileMatch?.[1]) return null;

  const inner = fileMatch[1];
  let bestPath = "";
  const sizeMatches = Array.from(
    inner.matchAll(/<size\b[^>]*width=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/size>/gi)
  );
  if (sizeMatches.length > 0) {
    sizeMatches.sort((a, b) => Number(b[1]) - Number(a[1]));
    bestPath = sizeMatches[0][2]?.trim() ?? "";
  } else {
    bestPath = inner.replace(/<[^>]+>/g, "").trim();
  }

  if (!bestPath) return null;
  if (bestPath.startsWith("/") || bestPath.startsWith("file://")) {
    return fileUriToLocalPath(bestPath) ?? bestPath;
  }
  if (baseDir) {
    return `${baseDir.replace(/\/+$/, "")}/${bestPath.replace(/^\/+/, "")}`;
  }
  return bestPath;
}

export interface GnomeBackgroundPropertyEntry {
  name: string;
  filename: string;
  filenameDark?: string;
  options?: GnomePictureOptions;
  shadeType?: GnomeColorShadingType;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Parses `/usr/share/gnome-background-properties/*.xml` entries, including
 * GNOME 42+ `<filename-dark>` light/dark adaptive wallpaper pairs.
 */
export function parseGnomeBackgroundPropertiesXml(
  xml: string
): GnomeBackgroundPropertyEntry[] {
  if (!xml) return [];
  const entries: GnomeBackgroundPropertyEntry[] = [];
  const blocks = xml.matchAll(/<wallpaper\b([^>]*)>([\s\S]*?)<\/wallpaper>/gi);
  for (const m of blocks) {
    if (/\bdeleted\s*=\s*["']true["']/i.test(m[1] ?? "")) continue;
    const body = m[2] ?? "";
    const tag = (name: string) =>
      body.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]?.trim() ?? "";
    const filename = tag("filename");
    if (!filename) continue;
    const name = tag("name") || filename.split("/").pop() || "Wallpaper";
    const filenameDark = tag("filename-dark") || undefined;
    const rawOpts = tag("options") as GnomePictureOptions;
    const rawShade = tag("shade_type") as GnomeColorShadingType;
    const pcolor = normalizeGnomeColor(tag("pcolor")) ?? undefined;
    const scolor = normalizeGnomeColor(tag("scolor")) ?? undefined;
    entries.push({
      name,
      filename,
      ...(filenameDark ? { filenameDark } : {}),
      ...(VALID_PICTURE_OPTIONS.has(rawOpts) ? { options: rawOpts } : {}),
      ...(VALID_SHADING_TYPES.has(rawShade) ? { shadeType: rawShade } : {}),
      ...(pcolor ? { primaryColor: pcolor } : {}),
      ...(scolor ? { secondaryColor: scolor } : {}),
    });
  }
  return entries;
}

/**
 * Returns true if an initial `org.gnome.desktop.background` snapshot explicitly
 * sets a wallpaper image, solid/gradient shading mode, or non-default colors.
 */
export function isGnomeBackgroundConfigured(
  snap: Partial<GnomeBackgroundSettings>
): boolean {
  if ((snap.pictureUri || snap.pictureUriDark) && snap.pictureOptions !== "none") {
    return true;
  }
  if (snap.pictureOptions === "none") return true;
  if (snap.colorShadingType && snap.colorShadingType !== "solid") return true;
  if (
    snap.primaryColor &&
    snap.primaryColor.toLowerCase() !== DEFAULT_GNOME_BACKGROUND.primaryColor
  ) {
    return true;
  }
  if (
    snap.secondaryColor &&
    snap.secondaryColor.toLowerCase() !== DEFAULT_GNOME_BACKGROUND.secondaryColor
  ) {
    return true;
  }
  return false;
}

/**
 * Selects the active image URI for the current theme (`color-scheme`) per GNOME 42+ rules.
 */
export function selectGnomePictureUri(
  bg: GnomeBackgroundSettings,
  resolvedTheme: "dark" | "light"
): string {
  if (bg.pictureOptions === "none") return "";
  if (resolvedTheme === "dark" && bg.pictureUriDark.trim()) {
    return bg.pictureUriDark.trim();
  }
  return bg.pictureUri.trim();
}

/**
 * Builds the CSS background string for GNOME `color-shading-type`,
 * `primary-color`, and `secondary-color`.
 */
export function buildGnomeShadingCss(bg: GnomeBackgroundSettings): string {
  const primary = bg.primaryColor || DEFAULT_GNOME_BACKGROUND.primaryColor;
  const secondary = bg.secondaryColor || DEFAULT_GNOME_BACKGROUND.secondaryColor;
  switch (bg.colorShadingType) {
    case "horizontal":
      return `linear-gradient(to right, ${primary}, ${secondary})`;
    case "vertical":
      return `linear-gradient(to bottom, ${primary}, ${secondary})`;
    default:
      return primary;
  }
}

function mixHexChannel(a: number, b: number, t: number): number {
  return Math.max(0, Math.min(255, Math.round(a + (b - a) * t)));
}

function mixHexColor(
  r: number,
  g: number,
  b: number,
  targetR: number,
  targetG: number,
  targetB: number,
  t: number
): string {
  const nr = mixHexChannel(r, targetR, t).toString(16).padStart(2, "0");
  const ng = mixHexChannel(g, targetG, t).toString(16).padStart(2, "0");
  const nb = mixHexChannel(b, targetB, t).toString(16).padStart(2, "0");
  return `#${nr}${ng}${nb}`;
}

/**
 * Builds a flat, angled linear gradient, or radial/circular gradient CSS
 * background derived from a single base color.
 */
export function buildWallpaperColorCss(
  color: string,
  mode: WallpaperColorMode = "solid"
): string {
  if (mode === "solid") return color;
  const hex = toHexColorInputValue(color, "");
  if (!/^#[\da-f]{6}$/i.test(hex)) return color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighter = mixHexColor(r, g, b, 255, 255, 255, 0.22);
  const darker = mixHexColor(r, g, b, 0, 0, 0, 0.26);
  if (mode === "linear") {
    return `linear-gradient(145deg, ${lighter} 0%, ${hex} 52%, ${darker} 100%)`;
  }
  return `radial-gradient(circle at 50% 45%, ${lighter} 0%, ${hex} 58%, ${darker} 100%)`;
}

export interface BackgroundRenderSpec {
  baseCss: string;
  overlayCss?: string;
  animatedCss?: {
    id: string;
    cssText: string;
  };
  htmlLayer?: {
    srcDoc?: string;
    src?: string;
  };
  pictureLayer?: {
    backgroundImage: string;
    backgroundSize: string;
    backgroundPosition: string;
    backgroundRepeat: string;
    opacity: number;
  };
}

/**
 * Computes the layered CSS/HTML/animated background representation used across
 * desktop, lock screen, workspace thumbnails, and wallpaper preview per GNOME &
 * Piloti animated wallpaper specs.
 */
export function resolveBackgroundRenderSpec(options: {
  wallpaperId: string;
  customWallpaperUrl?: string;
  wallpaperColorMode?: WallpaperColorMode;
  gnomeBackground: GnomeBackgroundSettings;
  activeWallpaper: WallpaperOption;
  resolvedTheme: "dark" | "light";
  resolvedPictureSrc?: string;
  resolvedAnimatedCssText?: string;
  resolvedHtmlSrcDoc?: string;
}): BackgroundRenderSpec {
  const {
    wallpaperId,
    customWallpaperUrl,
    wallpaperColorMode = "solid",
    gnomeBackground,
    activeWallpaper,
    resolvedTheme,
    resolvedPictureSrc,
    resolvedAnimatedCssText,
    resolvedHtmlSrcDoc,
  } = options;

  const activePicture = selectGnomePictureUri(gnomeBackground, resolvedTheme);
  const hasPicture =
    gnomeBackground.pictureOptions !== "none" &&
    Boolean(customWallpaperUrl || activePicture);

  const isGnomeOrCustom =
    wallpaperId === "gnome" ||
    wallpaperId.startsWith("#") ||
    Boolean(customWallpaperUrl) ||
    Boolean(activePicture);

  const isOpaqueFullBleedPicture =
    hasPicture &&
    (gnomeBackground.pictureOpacity ?? 100) >= 100 &&
    gnomeBackground.pictureOptions !== "scaled" &&
    gnomeBackground.pictureOptions !== "centered";

  const isUntouchedSolidDefault =
    gnomeBackground.colorShadingType === "solid" &&
    gnomeBackground.primaryColor.toLowerCase() ===
      DEFAULT_GNOME_BACKGROUND.primaryColor;

  const presetBaseCss =
    resolvedTheme === "dark" && activeWallpaper.backgroundCssDark
      ? activeWallpaper.backgroundCssDark
      : activeWallpaper.backgroundCss;

  const baseCss = hasPicture && (isUntouchedSolidDefault || isOpaqueFullBleedPicture)
    ? "transparent"
    : isGnomeOrCustom
      ? gnomeBackground.colorShadingType === "solid"
        ? buildWallpaperColorCss(
            wallpaperId.startsWith("#") && isUntouchedSolidDefault
              ? wallpaperId
              : gnomeBackground.primaryColor || DEFAULT_GNOME_BACKGROUND.primaryColor,
            wallpaperColorMode
          )
        : buildGnomeShadingCss(gnomeBackground)
      : activeWallpaper.category === "Solid"
        ? buildWallpaperColorCss(presetBaseCss, wallpaperColorMode)
        : presetBaseCss;

  const overlayCss = isGnomeOrCustom ? undefined : activeWallpaper.overlayCss;

  if (resolvedAnimatedCssText) {
    return {
      baseCss,
      overlayCss,
      animatedCss: { id: wallpaperId || "custom", cssText: resolvedAnimatedCssText },
    };
  }

  if (resolvedHtmlSrcDoc) {
    return {
      baseCss,
      overlayCss,
      htmlLayer: { srcDoc: resolvedHtmlSrcDoc },
    };
  }

  if (!isGnomeOrCustom && activeWallpaper.kind === "css") {
    const cssText =
      resolvedTheme === "dark" && activeWallpaper.cssAnimationDark
        ? activeWallpaper.cssAnimationDark
        : activeWallpaper.cssAnimation;
    if (cssText) {
      return {
        baseCss,
        overlayCss,
        animatedCss: { id: activeWallpaper.id, cssText },
      };
    }
  }

  if (!isGnomeOrCustom && activeWallpaper.kind === "html") {
    const srcDoc =
      resolvedTheme === "dark" && activeWallpaper.htmlSrcDocDark
        ? activeWallpaper.htmlSrcDocDark
        : activeWallpaper.htmlSrcDoc;
    if (srcDoc) {
      return {
        baseCss,
        overlayCss,
        htmlLayer: { srcDoc },
      };
    }
  }

  const styleKey = gnomeBackground.pictureOptions;
  const effectiveSrc =
    resolvedPictureSrc ??
    (selectGnomePictureUri(gnomeBackground, resolvedTheme) ||
      customWallpaperUrl ||
      "");

  if (styleKey === "none" || !effectiveSrc) {
    return { baseCss, overlayCss };
  }

  if (/\.html?(?:$|[?#])/i.test(activePicture || effectiveSrc)) {
    return {
      baseCss,
      overlayCss,
      htmlLayer: { src: effectiveSrc },
    };
  }

  const styleCss = PICTURE_STYLE_CSS[styleKey] ?? PICTURE_STYLE_CSS.zoom;
  const escaped = effectiveSrc.replace(/["\\]/g, "\\$&");
  const opacity = Math.max(
    0,
    Math.min(1, (gnomeBackground.pictureOpacity ?? 100) / 100)
  );

  return {
    baseCss,
    overlayCss,
    pictureLayer: {
      backgroundImage: `url("${escaped}")`,
      ...styleCss,
      opacity,
    },
  };
}

