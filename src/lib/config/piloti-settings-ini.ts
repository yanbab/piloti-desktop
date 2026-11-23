import type { DesktopSettings } from "@/context/SettingsContext";
import { type IniRecord, parseIniText, serializeIniText } from "./ini";

type FieldKind = "string" | "boolean" | "number" | "string[]";

type SchemaEntry = readonly [
  section: string,
  iniKey: string,
  prop: Exclude<
    keyof DesktopSettings,
    | "gnomeBackground"
    | "installedWebApps"
    | "savedWindowBounds"
    | "desktopIconPositions"
  >,
  kind: FieldKind,
];

const SETTINGS_INI_SCHEMA: readonly SchemaEntry[] = [
  ["org.piloti.desktop.interface", "interface-theme", "interfaceTheme", "string"],
  ["org.piloti.desktop.interface", "color-scheme", "themeMode", "string"],
  ["org.piloti.desktop.interface", "accent-color", "accentColor", "string"],
  ["org.piloti.desktop.interface", "custom-accent-hex", "customAccentHex", "string"],
  ["org.piloti.desktop.interface", "high-contrast", "highContrast", "boolean"],
  ["org.piloti.desktop.interface", "icon-theme", "iconTheme", "string"],
  ["org.piloti.desktop.interface", "reduce-motion", "reduceMotion", "boolean"],
  ["org.piloti.desktop.interface", "more-transparency", "moreTransparency", "boolean"],

  ["org.piloti.desktop.fonts", "font-name", "fontSansFamily", "string"],
  ["org.piloti.desktop.fonts", "monospace-font-name", "fontMonoFamily", "string"],
  ["org.piloti.desktop.fonts", "text-scaling-factor", "fontScale", "number"],
  ["org.piloti.desktop.fonts", "font-sans-style", "fontSansStyle", "string"],
  ["org.piloti.desktop.fonts", "css-font-smoothing", "cssFontSmoothing", "string"],
  ["org.piloti.desktop.fonts", "css-text-rendering", "cssTextRendering", "string"],
  ["org.piloti.desktop.fonts", "css-font-optical-sizing", "cssFontOpticalSizing", "string"],
  ["org.piloti.desktop.fonts", "css-font-kerning", "cssFontKerning", "string"],
  ["org.piloti.desktop.fonts", "css-font-synthesis", "cssFontSynthesis", "string"],
  ["org.piloti.desktop.fonts", "css-letter-spacing-em", "cssLetterSpacingEm", "number"],
  ["org.piloti.desktop.fonts", "css-text-stroke-px", "cssTextStrokePx", "number"],
  ["org.piloti.desktop.fonts", "gtk-font-name", "gtkFontName", "string"],
  ["org.piloti.desktop.fonts", "gtk-document-font-name", "gtkDocumentFontName", "string"],
  ["org.piloti.desktop.fonts", "gtk-monospace-font-name", "gtkMonospaceFontName", "string"],
  ["org.piloti.desktop.fonts", "gtk-text-scaling-factor", "gtkTextScalingFactor", "number"],
  ["org.piloti.desktop.fonts", "gtk-font-antialiasing", "gtkFontAntialiasing", "string"],
  ["org.piloti.desktop.fonts", "gtk-font-hinting", "gtkFontHinting", "string"],
  ["org.piloti.desktop.fonts", "gtk-font-rgba-order", "gtkFontRgbaOrder", "string"],

  ["org.piloti.desktop.background", "wallpaper-id", "wallpaperId", "string"],
  ["org.piloti.desktop.background", "custom-wallpaper-url", "customWallpaperUrl", "string"],
  ["org.piloti.desktop.background", "custom-wallpaper-colors", "customWallpaperColors", "string[]"],
  ["org.piloti.desktop.background", "wallpaper-color-mode", "wallpaperColorMode", "string"],

  ["org.piloti.desktop.dock", "icon-size", "dockSize", "number"],
  ["org.piloti.desktop.dock", "position", "dockPosition", "string"],
  ["org.piloti.desktop.dock", "magnification", "dockMagnification", "boolean"],
  ["org.piloti.desktop.dock", "magnification-size", "dockMagnificationSize", "number"],
  ["org.piloti.desktop.dock", "auto-hide", "dockAutoHide", "boolean"],
  ["org.piloti.desktop.dock", "pinned-apps", "pinnedAppIds", "string[]"],
  ["org.piloti.desktop.dock", "docked-folders", "dockFolders", "string[]"],

  ["org.piloti.desktop.topbar", "clock-24-hour", "clock24Hour", "boolean"],
  ["org.piloti.desktop.topbar", "clock-show-seconds", "clockShowSeconds", "boolean"],
  ["org.piloti.desktop.topbar", "clock-show-day", "clockShowDay", "boolean"],
  ["org.piloti.desktop.topbar", "clock-show-date", "clockShowDate", "boolean"],
  ["org.piloti.desktop.topbar", "show-battery-percentage", "showBatteryPercentage", "boolean"],

  ["org.piloti.desktop.wm", "decoration-mode", "windowDecorationMode", "string"],
  ["org.piloti.desktop.wm", "button-layout", "windowButtonLayout", "string"],
  ["org.piloti.desktop.wm", "show-window-menu", "showWindowMenu", "boolean"],
  ["org.piloti.desktop.wm", "active-workspace", "activeWorkspace", "number"],
  ["org.piloti.desktop.wm", "workspace-count", "workspaceCount", "number"],

  ["org.piloti.desktop.notifications", "enabled", "notificationsEnabled", "boolean"],
  ["org.piloti.desktop.notifications", "show-banners", "notificationBannersEnabled", "boolean"],
  ["org.piloti.desktop.notifications", "show-in-lock-screen", "notificationShowOnLockScreen", "boolean"],
  ["org.piloti.desktop.notifications", "show-previews", "notificationShowPreviews", "boolean"],
  ["org.piloti.desktop.notifications", "allow-critical-in-dnd", "notificationAllowCriticalInDnd", "boolean"],
  ["org.piloti.desktop.notifications", "do-not-disturb", "doNotDisturb", "boolean"],
  ["org.piloti.desktop.notifications", "banner-timeout-ms", "notificationBannerTimeoutMs", "number"],
  ["org.piloti.desktop.notifications", "history-limit", "notificationHistoryLimit", "number"],

  ["org.piloti.desktop.files", "desktop-icons-enabled", "desktopIconsEnabled", "boolean"],
  ["org.piloti.desktop.files", "desktop-icon-align", "desktopIconAlign", "string"],
  ["org.piloti.desktop.files", "file-activation-mode", "fileActivationMode", "string"],
  ["org.piloti.desktop.files", "show-extension-badges", "showFileExtensionBadges", "boolean"],

  ["org.piloti.desktop.system", "volume", "volume", "number"],
  ["org.piloti.desktop.system", "muted", "muted", "boolean"],
  ["org.piloti.desktop.system", "brightness", "brightness", "number"],
  ["org.piloti.desktop.system", "night-light", "nightLight", "boolean"],
  ["org.piloti.desktop.system", "wifi-enabled", "wifiEnabled", "boolean"],
  ["org.piloti.desktop.system", "connected-wifi", "connectedWifi", "string"],
  ["org.piloti.desktop.system", "bluetooth-enabled", "bluetoothEnabled", "boolean"],
  ["org.piloti.desktop.system", "power-mode", "powerMode", "string"],
  ["org.piloti.desktop.system", "restore-windows-on-login", "restoreWindowsOnLogin", "boolean"],
  ["org.piloti.desktop.system", "computer-model", "computerModel", "string"],
  ["org.piloti.desktop.system", "sync-gnome-settings", "syncGnomeSettings", "boolean"],
  ["org.piloti.desktop.system", "prefer-gnome-control-center", "preferGnomeControlCenter", "boolean"],
  ["org.piloti.desktop.system", "hidden-gnome-panels", "hiddenGnomePanels", "string[]"],
  ["org.piloti.desktop.system", "demo-extension-enabled", "demoExtensionEnabled", "boolean"],
  ["org.piloti.desktop.system", "pinned-extensions", "pinnedExtensionIds", "string[]"],
  ["org.piloti.desktop.system", "dark-reader-web-enabled", "darkReaderWebEnabled", "boolean"],
  ["org.piloti.desktop.system", "enabled-plugins", "enabledPluginIds", "string[]"],
  ["org.piloti.desktop.system", "web-apps-seeded", "webAppsSeeded", "boolean"],
  ["org.piloti.desktop.system", "web-defaults-version", "webDefaultsVersion", "number"],
];

const BG_SCHEMA = [
  ["picture-uri", "pictureUri", "string"],
  ["picture-uri-dark", "pictureUriDark", "string"],
  ["picture-options", "pictureOptions", "string"],
  ["color-shading-type", "colorShadingType", "string"],
  ["primary-color", "primaryColor", "string"],
  ["secondary-color", "secondaryColor", "string"],
  ["picture-opacity", "pictureOpacity", "number"],
] as const;

function parseField(raw: string, kind: FieldKind): unknown {
  if (kind === "boolean") {
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    return undefined;
  }
  if (kind === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (kind === "string[]") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    return trimmed
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw;
}

/**
 * Serializes `DesktopSettings` to GNOME GSettings-style INI keyfile text.
 */
export function serializeDesktopSettingsIni(settings: DesktopSettings): string {
  const rec: IniRecord = {};
  for (const [section, iniKey, prop, kind] of SETTINGS_INI_SCHEMA) {
    const val = settings[prop];
    if (val === undefined) continue;
    if (!rec[section]) rec[section] = {};
    rec[section][iniKey] =
      kind === "string[]" && Array.isArray(val) ? val.join(";") : String(val);
  }
  const bgSec = "org.piloti.desktop.background";
  if (!rec[bgSec]) rec[bgSec] = {};
  for (const [iniKey, prop] of BG_SCHEMA) {
    const val = settings.gnomeBackground[prop];
    if (val !== undefined) {
      rec[bgSec][iniKey] = String(val);
    }
  }
  return serializeIniText(rec);
}

/**
 * Parses either GSettings-style `.ini` or legacy JSON desktop settings into a partial object.
 */
export function parseDesktopSettingsRaw(
  raw: string,
): Partial<DesktopSettings> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object"
        ? (parsed as Partial<DesktopSettings>)
        : null;
    } catch {
      return null;
    }
  }
  const ini = parseIniText(trimmed);
  if (Object.keys(ini).length === 0) return null;
  const out: Record<string, unknown> = {};
  for (const [section, iniKey, prop, kind] of SETTINGS_INI_SCHEMA) {
    const rawVal = ini[section]?.[iniKey];
    if (rawVal === undefined) continue;
    const decoded = parseField(rawVal, kind);
    if (decoded !== undefined) {
      out[prop] = decoded;
    }
  }
  const bgSec = ini["org.piloti.desktop.background"];
  if (bgSec) {
    const bgPatch: Record<string, unknown> = {};
    for (const [iniKey, prop, kind] of BG_SCHEMA) {
      const rawVal = bgSec[iniKey];
      if (rawVal === undefined) continue;
      const decoded = parseField(rawVal, kind);
      if (decoded !== undefined) {
        bgPatch[prop] = decoded;
      }
    }
    if (Object.keys(bgPatch).length > 0) {
      out.gnomeBackground = bgPatch;
    }
  }
  return out as Partial<DesktopSettings>;
}

