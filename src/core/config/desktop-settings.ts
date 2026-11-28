/** The desktop's settings as one object (`org.piloti.desktop.*`). */
import { type AccentColorId, APP_CATALOG } from "@/core/data/catalog";
import type { InstalledWebApp } from "@/core/data/web-apps";
import type { DesktopIconAlign } from "@/core/files/desktop-icons";
import {
  DEFAULT_GNOME_BACKGROUND,
  type GnomeBackgroundSettings,
  type WallpaperColorMode,
} from "@/core/system/gnome-background";
import { DEFAULT_HIDDEN_GNOME_PANELS } from "@/core/system/gnome-panels";
import type { SavedWindowBounds } from "@/core/windows/spatial-window-bounds";

export type GtkFontAntialiasing = "none" | "grayscale" | "rgba";
export type GtkFontHinting = "none" | "slight" | "medium" | "full";
export type GtkFontRgbaOrder = "rgb" | "bgr" | "vrgb" | "vbgr";
export type WindowDecorationMode = "auto" | "csd" | "ssd";
export type CssFontSmoothing = "antialiased" | "subpixel-antialiased" | "auto";
export type CssTextRendering =
  | "auto"
  | "optimizeLegibility"
  | "optimizeSpeed"
  | "geometricPrecision";
export type CssFontOpticalSizing = "auto" | "none";
export type CssFontKerning = "auto" | "normal" | "none";
export type CssFontSynthesis = "auto" | "none";
export type CssFontStyle = "regular" | "light" | "medium" | "semibold" | "italic";

export type InterfaceThemeId = "piloti" | "adwaita" | "cupertino" | (string & {});

export interface DesktopSettings {
  interfaceTheme: InterfaceThemeId;
  themeMode: "dark" | "light" | "system";
  accentColor: AccentColorId;
  wallpaperId: string;
  customWallpaperUrl: string;
  customWallpaperColors?: string[];
  wallpaperColorMode?: WallpaperColorMode;
  gnomeBackground: GnomeBackgroundSettings;
  dockSize: number;
  dockPosition: "bottom" | "left" | "right";
  dockMagnification: boolean;
  dockMagnificationSize: number;
  dockAutoHide: boolean;
  clock24Hour: boolean;
  clockShowSeconds: boolean;
  clockShowDay: boolean;
  clockShowDate: boolean;
  showBatteryPercentage: boolean;
  reduceMotion: boolean;
  moreTransparency: boolean;
  customAccentHex?: string;
  highContrast: boolean;
  windowDecorationMode: WindowDecorationMode;
  windowButtonLayout: string;
  showWindowMenu: boolean;
  iconTheme: string;
  syncGnomeSettings: boolean;
  preferGnomeControlCenter: boolean;
  hiddenGnomePanels: string[];
  fontSansFamily: string;
  fontMonoFamily: string;
  fontScale: number;
  fontSansStyle: CssFontStyle;
  cssFontSmoothing: CssFontSmoothing;
  cssTextRendering: CssTextRendering;
  cssFontOpticalSizing: CssFontOpticalSizing;
  cssFontKerning: CssFontKerning;
  cssFontSynthesis: CssFontSynthesis;
  cssLetterSpacingEm: number;
  cssTextStrokePx: number;
  gtkFontName: string;
  gtkDocumentFontName: string;
  gtkMonospaceFontName: string;
  gtkTextScalingFactor: number;
  gtkFontAntialiasing: GtkFontAntialiasing;
  gtkFontHinting: GtkFontHinting;
  gtkFontRgbaOrder: GtkFontRgbaOrder;
  volume: number;
  muted: boolean;
  brightness: number;
  nightLight: boolean;
  wifiEnabled: boolean;
  connectedWifi: string;
  bluetoothEnabled: boolean;
  doNotDisturb: boolean;
  notificationsEnabled: boolean;
  notificationBannersEnabled: boolean;
  notificationShowOnLockScreen: boolean;
  notificationShowPreviews: boolean;
  notificationAllowCriticalInDnd: boolean;
  notificationBannerTimeoutMs: number;
  notificationHistoryLimit: number;
  powerMode: "balanced" | "performance" | "power-saver";
  activeWorkspace: number;
  workspaceCount: number;
  restoreWindowsOnLogin: boolean;
  desktopIconsEnabled: boolean;
  desktopIconAlign: DesktopIconAlign;
  fileActivationMode: "single" | "double";
  showFileExtensionBadges: boolean;
  demoExtensionEnabled: boolean;
  /** Extension ids pinned to the browser toolbar. */
  pinnedExtensionIds: string[];
  darkReaderWebEnabled: boolean;
  /** Show the desktop as it loads (no ready gates or entrances), to profile startup. */
  debugMode: boolean;
  /** Expose Chrome DevTools on localhost:9222 on next login. */
  remoteDevtools: boolean;
  enabledPluginIds: string[];
  computerModel: "mac" | "pc";
  /** Keymap name chosen in Settings; empty leaves the compositor's. */
  keyboardLayout: string;
  desktopIconPositions: Record<string, { col: number; row: number }>;
  pinnedAppIds: string[];
  /** Folders docked next to Trash; `undefined` = default (Downloads). */
  dockFolders?: string[];
  installedWebApps: InstalledWebApp[];
  webAppsSeeded?: boolean;
  webDefaultsVersion?: number;
  savedWindowBounds: Record<string, SavedWindowBounds>;
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  interfaceTheme: "piloti",
  themeMode: "system",
  accentColor: "teal",
  customAccentHex: "",
  highContrast: false,
  wallpaperId: "aurora-drift:aurora-drift",
  customWallpaperUrl: "",
  customWallpaperColors: [],
  wallpaperColorMode: "solid",
  gnomeBackground: { ...DEFAULT_GNOME_BACKGROUND },
  dockSize: 52,
  dockPosition: "bottom",
  dockMagnification: false,
  dockMagnificationSize: 76,
  dockAutoHide: false,
  clock24Hour: true,
  clockShowSeconds: false,
  clockShowDay: false,
  clockShowDate: false,
  showBatteryPercentage: false,
  reduceMotion: false,
  moreTransparency: true,
  windowDecorationMode: "auto",
  windowButtonLayout: ":close",
  showWindowMenu: true,
  iconTheme: "Piloti",
  syncGnomeSettings: true,
  preferGnomeControlCenter: false,
  hiddenGnomePanels: [...DEFAULT_HIDDEN_GNOME_PANELS],
  fontSansFamily: "Adwaita Sans",
  fontMonoFamily: "Adwaita Mono",
  fontScale: 1,
  fontSansStyle: "regular",
  cssFontSmoothing: "antialiased",
  cssTextRendering: "auto",
  cssFontOpticalSizing: "auto",
  cssFontKerning: "auto",
  cssFontSynthesis: "auto",
  cssLetterSpacingEm: 0,
  cssTextStrokePx: 0,
  gtkFontName: "Adwaita Sans 11",
  gtkDocumentFontName: "Sans 11",
  gtkMonospaceFontName: "Adwaita Mono 11",
  gtkTextScalingFactor: 1,
  gtkFontAntialiasing: "grayscale",
  gtkFontHinting: "slight",
  gtkFontRgbaOrder: "rgb",
  volume: 78,
  muted: false,
  brightness: 95,
  nightLight: false,
  wifiEnabled: true,
  connectedWifi: "Piloti-5G-Ultra",
  bluetoothEnabled: true,
  doNotDisturb: false,
  notificationsEnabled: true,
  notificationBannersEnabled: true,
  notificationShowOnLockScreen: true,
  notificationShowPreviews: true,
  notificationAllowCriticalInDnd: true,
  notificationBannerTimeoutMs: 5000,
  notificationHistoryLimit: 50,
  powerMode: "balanced",
  activeWorkspace: 1,
  workspaceCount: 2,
  restoreWindowsOnLogin: true,
  desktopIconsEnabled: true,
  desktopIconAlign: "left",
  fileActivationMode: "single",
  showFileExtensionBadges: true,
  demoExtensionEnabled: true,
  pinnedExtensionIds: [],
  darkReaderWebEnabled: false,
  debugMode: false,
  remoteDevtools: false,
  enabledPluginIds: ["aurora-drift", "app-indicator", "picture-in-picture", "app-dark-mode"],
  keyboardLayout: "",
  computerModel:
    typeof navigator !== "undefined" &&
      /mac/i.test(navigator.platform || navigator.userAgent || "")
      ? "mac"
      : "pc",
  desktopIconPositions: {},
  // A getter: the catalog is read from files before the shell starts.
  get pinnedAppIds() {
    return APP_CATALOG.filter((a) => a.pinnedByDefault).map((a) => a.id);
  },
  installedWebApps: [],
  savedWindowBounds: {},
};
