/**
 * The desktop's look on a document: the shell's page and each app module's.
 * Plain DOM; the values come from the desktop settings.
 */
import type { CssFontStyle, DesktopSettings } from "@/core/config/desktop-settings";
import { ACCENT_COLORS } from "@/core/data/catalog";

export function applyInterface(root: HTMLElement, settings: DesktopSettings, reducedMotion: boolean): void {
  root.dataset.interfaceTheme = settings.interfaceTheme || "piloti";
  root.dataset.reducedMotion = reducedMotion ? "true" : "false";
  root.dataset.moreTransparency = settings.moreTransparency ? "true" : "false";
}

const SANS_FALLBACK =
  '"Adwaita Sans", "Cantarell", "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const MONO_FALLBACK =
  '"Adwaita Mono", "Source Code Pro", "JetBrains Mono", ui-monospace, monospace';

function fontList(raw: string, fallback: string): string {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.includes(" ") && !/^["'].*["']$/.test(p) ? `"${p}"` : p));
  return parts.length > 0 ? `${parts.join(", ")}, ${fallback}` : fallback;
}

const FONT_STYLES: Record<CssFontStyle, { weight: string; medium: string; bold: string; style: string }> = {
  light: { weight: "300", medium: "400", bold: "500", style: "normal" },
  regular: { weight: "400", medium: "500", bold: "500", style: "normal" },
  medium: { weight: "500", medium: "600", bold: "600", style: "normal" },
  semibold: { weight: "600", medium: "600", bold: "700", style: "normal" },
  italic: { weight: "400", medium: "500", bold: "500", style: "italic" },
};

export function applyFonts(root: HTMLElement, settings: DesktopSettings): void {
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  set("--font-ui", fontList(settings.fontSansFamily, SANS_FALLBACK));
  set("--font-ui-mono", fontList(settings.fontMonoFamily, MONO_FALLBACK));
  set("--piloti-font-smoothing", settings.cssFontSmoothing);
  set("--piloti-text-rendering", settings.cssTextRendering);
  set("--piloti-font-optical-sizing", settings.cssFontOpticalSizing);
  set("--piloti-font-kerning", settings.cssFontKerning);
  set("--piloti-font-synthesis", settings.cssFontSynthesis === "none" ? "none" : "weight style");
  set("--piloti-letter-spacing", `${settings.cssLetterSpacingEm}em`);
  set("--piloti-text-stroke-width", `${settings.cssTextStrokePx}px`);
  const style = FONT_STYLES[settings.fontSansStyle] ?? FONT_STYLES.regular;
  set("--piloti-font-weight", style.weight);
  set("--piloti-font-weight-medium", style.medium);
  set("--piloti-font-weight-semibold", style.bold);
  set("--piloti-font-style", style.style);
  set("--font-weight-normal", style.weight);
  set("--font-weight-medium", style.medium);
  set("--font-weight-semibold", style.bold);
  set("--font-weight-bold", style.bold);
  const scale = Math.max(0.8, Math.min(1.5, settings.fontScale || 1));
  set("--piloti-font-scale", String(scale));
  // Type roles scale in CSS from --piloti-font-scale; this scales rem sizes.
  root.style.fontSize = Math.abs(scale - 1) < 0.001 ? "" : `${Math.round(16 * scale * 100) / 100}px`;
}

/**
 * Light or dark. "System" follows the time of day on Linux, and the browser's
 * preference where there are no system services.
 */
export function resolveTheme(
  themeMode: DesktopSettings["themeMode"],
  system: { prefersDark: boolean } | { hour: number },
): "dark" | "light" {
  if (themeMode !== "system") return themeMode;
  if ("prefersDark" in system) return system.prefersDark ? "dark" : "light";
  return system.hour < 7 || system.hour >= 19 ? "dark" : "light";
}

export function applyColors(root: HTMLElement, settings: DesktopSettings, theme: "dark" | "light"): void {
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  root.dataset.highContrast = settings.highContrast ? "true" : "false";
  const custom = settings.customAccentHex?.trim();
  if (custom && /^#[0-9a-f]{6}$/i.test(custom)) {
    root.style.setProperty("--ui-active-accent", custom);
    return;
  }
  const accent = ACCENT_COLORS.find((a) => a.id === settings.accentColor);
  if (accent && accent.id !== "blue") root.style.setProperty("--ui-active-accent", accent.cssVar);
  else root.style.removeProperty("--ui-active-accent");
}
