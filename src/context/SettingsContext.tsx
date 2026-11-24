import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { usePortalWallpaper } from "@domicile-desktop/react/portals";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  ACCENT_COLORS,
  APP_CATALOG,
  type AccentColorId,
  WALLPAPERS,
  type WallpaperOption,
  resolveDynamicWallpaperCss,
} from "@/data/catalog";
import {
  DEFAULT_LAUNCHER_WEB_APPS,
  type InstalledWebApp,
} from "@/data/web-apps";
import {
  WEB_VFS_HOME,
  getVfsEntry,
  subscribeWebVfs,
  writeVfsTextFile,
} from "@/lib/engine-web/web-vfs";
import { toDomicilePath } from "@/lib/engine/fs-bridge";
import {
  readVfsStateJson,
  readVfsStateText,
  registerVfsHostSync,
  runVfsStateMigrations,
  removeVfsStateFile,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateJson,
  writeVfsStateText,
} from "@/lib/engine/vfs-state";
import {
  parseDesktopSettingsRaw,
  serializeDesktopSettingsIni,
} from "@/lib/config/piloti-settings-ini";
import {
  installWebAppDesktopEntry,
  loadWebAppsFromDesktopEntries,
  XDG_WEBAPPS_CHANGED_EVENT,
} from "@/lib/xdg/xdg-web-apps";
import {
  DEFAULT_GNOME_BACKGROUND,
  type BackgroundRenderSpec,
  type GnomeBackgroundSettings,
  type WallpaperColorMode,
  fileUriToLocalPath,
  localPathToFileUri,
  parseGnomeBackgroundXml,
  resolveBackgroundRenderSpec,
  selectGnomePictureUri,
} from "@/lib/engine-native/background";
import { clampHistoryLimit } from "@/lib/shell/notifications";
import {
  readGnomeBackgroundBlob,
  setSystemAudio,
  setSystemBrightness,
  setSystemPowerProfile,
  setSystemBluetoothPowered,
  setSystemWifiEnabled,
  syncGnomeBackgroundSettings,
  syncGnomeInterfaceKey,
  syncGnomeNotificationSettings,
  syncGtkIconTheme,
  DEFAULT_HIDDEN_GNOME_PANELS,
  type GtkFontAntialiasing,
  type GtkFontHinting,
  type GtkFontRgbaOrder,
} from "@/lib/engine-native";
import { startBootPhase } from "@/lib/core/perf-log";
import { subscribeLocale } from "@/lib/core/i18n";
import type { DesktopIconAlign } from "@/lib/shell/desktop-icons";
import type { SavedWindowBounds } from "@/lib/shell/spatial-window-bounds";
import { isWebEngine } from "@/lib/engine/engine";

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

export type { InstalledWebApp, SavedWindowBounds, WallpaperColorMode };

export type InterfaceThemeId = "piloti" | "adwaita" | (string & {});

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
  enabledPluginIds: string[];
  computerModel: "mac" | "pc";
  desktopIconPositions: Record<string, { col: number; row: number }>;
  pinnedAppIds: string[];
  /** Folders docked next to Trash; `undefined` = default (Downloads). */
  dockFolders?: string[];
  installedWebApps: InstalledWebApp[];
  webAppsSeeded?: boolean;
  webDefaultsVersion?: number;
  savedWindowBounds: Record<string, SavedWindowBounds>;
}

const DEFAULT_SETTINGS: DesktopSettings = {
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
  fontSansFamily: "Cantarell",
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
  enabledPluginIds: ["aurora-drift", "app-indicator", "picture-in-picture", "app-dark-mode"],
  computerModel:
    typeof navigator !== "undefined" &&
      /mac/i.test(navigator.platform || navigator.userAgent || "")
      ? "mac"
      : "pc",
  desktopIconPositions: {},
  pinnedAppIds: APP_CATALOG.filter((a) => a.pinnedByDefault).map((a) => a.id),
  installedWebApps: [],
  savedWindowBounds: {},
};

const STORAGE_KEY = "piloti.desktop.settings.v1";
const WINDOW_BOUNDS_STORAGE_KEY = "piloti.window-bounds.v1";
const DESKTOP_ICONS_STORAGE_KEY = "piloti.desktop-icon-positions.v1";

function loadSeparatedRecord<T>(
  vfsPath: string,
  legacyKey: string,
): Record<string, T> | null {
  try {
    const parsed = readVfsStateJson<Record<string, T>>(vfsPath, legacyKey);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function isBrowserDevRuntime(): boolean {
  return isWebEngine();
}

export const WEB_DEFAULTS_VERSION = 7;

// All our apps except Desktop Console and Image Viewer (and the Login Screen preview).
const DEFAULT_WEB_PINNED_APP_IDS = [
  "nautilus",
  "browser",
  "terminal",
  "text-editor",
  "calculator",
  "camera",
  "piloti-demo",
  "app-store",
  "settings",
];

const WEB_HIDDEN_APP_IDS = new Set([
  "org.gnome.Console.desktop",
  "org.gnome.TextEditor.desktop",
  "org.gnome.Calculator.desktop",
  "org.gnome.Loupe.desktop",
  "org.gnome.Evince.desktop",
  "org.gnome.baobab.desktop",
  "org.gnome.SystemMonitor.desktop",
  "kitty.desktop",
  "firefox-esr.desktop",
  "code.desktop",
  "gimp.desktop",
]);

function normalizeWebPinnedApps(rawPins: unknown): string[] {
  const base = Array.isArray(rawPins)
    ? rawPins.filter(
      (id): id is string =>
        typeof id === "string" && !WEB_HIDDEN_APP_IDS.has(id)
    )
    : [];
  const merged = [...base];
  for (const requiredId of DEFAULT_WEB_PINNED_APP_IDS) {
    if (WEB_HIDDEN_APP_IDS.has(requiredId)) continue;
    if (!merged.includes(requiredId)) {
      merged.push(requiredId);
    }
  }
  return merged;
}

function mergeDefaultBrowserWebApps(
  existing: InstalledWebApp[]
): InstalledWebApp[] {
  const existingUrls = new Set(existing.map((app) => app.url));
  return [
    ...existing,
    ...DEFAULT_LAUNCHER_WEB_APPS.filter((app) => !existingUrls.has(app.url)),
  ];
}

/**
 * Resolves initial desktop settings from serialized storage. When running the
 * web backend (`isBrowserBackend`), pins only Files (Nautilus) and Settings and
 * pre-installs the curated 20 iframe-friendly web apps once per defaults
 * version without overriding subsequent user edits.
 */
export function resolveInitialSettings(
  savedRaw: string | null,
  isBrowserBackend: boolean
): DesktopSettings {
  if (savedRaw) {
    try {
      const parsed = parseDesktopSettingsRaw(savedRaw);
      if (parsed) {
        const workspaceCount =
          typeof parsed.workspaceCount === "number" && parsed.workspaceCount >= 1
            ? parsed.workspaceCount
            : DEFAULT_SETTINGS.workspaceCount;
        const activeWorkspace = Math.max(
          1,
          Math.min(workspaceCount, parsed.activeWorkspace ?? 1)
        );
        const rawWebApps = Array.isArray(parsed.installedWebApps)
          ? parsed.installedWebApps
          : [];
        const needsWebDefaults =
          isBrowserBackend && parsed.webDefaultsVersion !== WEB_DEFAULTS_VERSION;

        const installedWebApps = needsWebDefaults
          ? parsed.webAppsSeeded === true
            ? [...DEFAULT_LAUNCHER_WEB_APPS]
            : mergeDefaultBrowserWebApps(rawWebApps)
          : rawWebApps;

        const pinnedAppIds = needsWebDefaults
          ? normalizeWebPinnedApps(parsed.pinnedAppIds)
          : Array.isArray(parsed.pinnedAppIds)
            ? parsed.pinnedAppIds
            : DEFAULT_SETTINGS.pinnedAppIds;

        const rawGnomeBg =
          parsed.gnomeBackground && typeof parsed.gnomeBackground === "object"
            ? parsed.gnomeBackground
            : {};
        const gnomeBackground: GnomeBackgroundSettings = {
          ...DEFAULT_GNOME_BACKGROUND,
          ...rawGnomeBg,
        };
        if (parsed.customWallpaperUrl && !gnomeBackground.pictureUri) {
          gnomeBackground.pictureUri = parsed.customWallpaperUrl;
        }

        const notificationBannerTimeoutMs =
          typeof parsed.notificationBannerTimeoutMs === "number" &&
            Number.isFinite(parsed.notificationBannerTimeoutMs)
            ? Math.max(0, parsed.notificationBannerTimeoutMs)
            : DEFAULT_SETTINGS.notificationBannerTimeoutMs;
        const notificationHistoryLimit = clampHistoryLimit(
          parsed.notificationHistoryLimit
        );

        const interfaceTheme =
          parsed.interfaceTheme || DEFAULT_SETTINGS.interfaceTheme;
        const iconTheme =
          interfaceTheme === "adwaita"
            ? "Adwaita"
            : !parsed.iconTheme ||
                parsed.iconTheme === "Papirus" ||
                interfaceTheme === "piloti"
              ? "Piloti"
              : parsed.iconTheme;

        const wallpaperColorMode: WallpaperColorMode =
          parsed.wallpaperColorMode === "linear" ||
          parsed.wallpaperColorMode === "circular"
            ? parsed.wallpaperColorMode
            : "solid";
        const customWallpaperColors = Array.isArray(parsed.customWallpaperColors)
          ? parsed.customWallpaperColors.filter(
              (c): c is string => typeof c === "string" && c.trim().length > 0
            )
          : [];

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          customWallpaperColors,
          wallpaperColorMode,
          interfaceTheme,
          iconTheme,
          gnomeBackground,
          notificationBannerTimeoutMs,
          notificationHistoryLimit,
          workspaceCount,
          activeWorkspace,
          pinnedAppIds,
          installedWebApps,
          ...(isBrowserBackend
            ? { webAppsSeeded: true, webDefaultsVersion: WEB_DEFAULTS_VERSION }
            : {}),
          savedWindowBounds: parsed.savedWindowBounds ?? {},
        };
      }
    } catch {
      // ignore storage errors
    }
  }

  if (isBrowserBackend) {
    return {
      ...DEFAULT_SETTINGS,
      pinnedAppIds: [...DEFAULT_WEB_PINNED_APP_IDS],
      installedWebApps: [...DEFAULT_LAUNCHER_WEB_APPS],
      webAppsSeeded: true,
      webDefaultsVersion: WEB_DEFAULTS_VERSION,
    };
  }
  return DEFAULT_SETTINGS;
}

export interface SettingsContextValue {
  isBrowserRuntime: boolean;  // FIXME : Capabilities
  settings: DesktopSettings;
  updateSettings: (patch: Partial<DesktopSettings>) => void;
  applySettingsState: (patch: Partial<DesktopSettings>) => void;
  applyingGnomeSyncRef: React.MutableRefObject<boolean>;
  resolvedTheme: "dark" | "light";
  reducedMotion: boolean;
  activeWallpaper: WallpaperOption;
  backgroundSpec: BackgroundRenderSpec;
}

export const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function useSettingsValue(options?: {
  deferLocalWallpaper?: boolean;
}): SettingsContextValue {
  const deferLocalWallpaper = Boolean(options?.deferLocalWallpaper);
  const domicile = useDomicile();
  const isBrowserRuntime = isBrowserDevRuntime();  // FIXME : Capabilities
  const portalWallpaper = usePortalWallpaper();
  const [wallpaperFallbackReady, setWallpaperFallbackReady] =
    React.useState(false);

  React.useEffect(() => {
    if (!deferLocalWallpaper || wallpaperFallbackReady) return;
    const timer = window.setTimeout(() => {
      setWallpaperFallbackReady(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [deferLocalWallpaper, wallpaperFallbackReady]);

  const allowLocalWallpaper = !deferLocalWallpaper || wallpaperFallbackReady;

  const [settings, setSettings] = React.useState<DesktopSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      let savedRaw = readVfsStateText(VFS_STATE_PATHS.settings, STORAGE_KEY);
      if (savedRaw === null) {
        const legacyJson = readVfsStateText(VFS_STATE_PATHS.legacySettingsJson);
        if (legacyJson !== null) {
          savedRaw = legacyJson;
          removeVfsStateFile(VFS_STATE_PATHS.legacySettingsJson);
        }
      }
      const base = resolveInitialSettings(savedRaw, isBrowserRuntime);  // FIXME : Capabilities
      if (savedRaw !== null && savedRaw.trim().startsWith("{")) {
        writeVfsStateText(
          VFS_STATE_PATHS.settings,
          serializeDesktopSettingsIni(base)
        );
      }
      const separatedBounds = loadSeparatedRecord<SavedWindowBounds>(
        VFS_STATE_PATHS.windowBounds,
        WINDOW_BOUNDS_STORAGE_KEY
      );
      const separatedIcons = loadSeparatedRecord<{ col: number; row: number }>(
        VFS_STATE_PATHS.desktopIcons,
        DESKTOP_ICONS_STORAGE_KEY
      );
      return {
        ...base,
        savedWindowBounds: separatedBounds
          ? { ...base.savedWindowBounds, ...separatedBounds }
          : base.savedWindowBounds,
        desktopIconPositions: separatedIcons
          ? { ...base.desktopIconPositions, ...separatedIcons }
          : base.desktopIconPositions,
      };
    } catch {
      return resolveInitialSettings(null, isBrowserRuntime);  // FIXME : Capabilities
    }
  });

  const applyingGnomeSyncRef = React.useRef(false);
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;
  const sliderTimersRef = React.useRef<{
    audio?: ReturnType<typeof setTimeout>;
    brightness?: ReturnType<typeof setTimeout>;
    boundsStorage?: ReturnType<typeof setTimeout>;
    iconsStorage?: ReturnType<typeof setTimeout>;
    gnomeBg?: ReturnType<typeof setTimeout>;
    gnomeBgPending?: Partial<GnomeBackgroundSettings>;
    xdgWebApps?: ReturnType<typeof setTimeout>;
    settingsIni?: ReturnType<typeof setTimeout>;
  }>({});

  // settings.ini is serialized once per burst (sliders, color pickers) instead
  // of on every update; flushed on page hide so the last change isn't lost.
  const pendingSettingsIniRef = React.useRef<DesktopSettings | null>(null);
  const flushSettingsIni = React.useCallback(() => {
    clearTimeout(sliderTimersRef.current.settingsIni);
    sliderTimersRef.current.settingsIni = undefined;
    const pending = pendingSettingsIniRef.current;
    if (!pending) return;
    pendingSettingsIniRef.current = null;
    try {
      writeVfsStateText(VFS_STATE_PATHS.settings, serializeDesktopSettingsIni(pending));
    } catch {
      // ignore storage errors
    }
  }, []);
  React.useEffect(() => {
    window.addEventListener("pagehide", flushSettingsIni);
    window.addEventListener("beforeunload", flushSettingsIni);
    return () => {
      window.removeEventListener("pagehide", flushSettingsIni);
      window.removeEventListener("beforeunload", flushSettingsIni);
      flushSettingsIni();
    };
  }, [flushSettingsIni]);

  React.useEffect(() => {
    if (isBrowserRuntime) {  // FIXME : Capabilities
      registerVfsHostSync(null);
      return;
    }
    const ensuredDirs = new Set<string>();
    const ensureParentDir = async (vfsPath: string) => {
      const idx = vfsPath.lastIndexOf("/");
      if (idx <= 0) return;
      const relDir = toDomicilePath(vfsPath.slice(0, idx));
      if (!relDir || relDir === "." || ensuredDirs.has(relDir)) return;
      ensuredDirs.add(relDir);
      await domicile.processes.run(["mkdir", "-p", "--", relDir]).catch(() => {
        ensuredDirs.delete(relDir);
      });
    };
    let cancelled = false;
    const writeHostFile = async (vfsPath: string, content: string) => {
      await ensureParentDir(vfsPath);
      const bytes = new TextEncoder().encode(content);
      await domicile.files.write(toDomicilePath(vfsPath), bytes);
    };
    registerVfsHostSync({
      writeText: (vfsPath, content) => {
        void writeHostFile(vfsPath, content).catch(() => undefined);
      },
      removeFile: (vfsPath) => {
        void domicile.processes
          .run(["rm", "-f", "--", toDomicilePath(vfsPath)])
          .catch(() => undefined);
      },
    });

    // Move leftovers of the legacy ~/.config/Piloti directory to ~/.config/piloti.
    void domicile.processes
      .run([
        "sh",
        "-c",
        'd="$HOME/.config/Piloti"; n="$HOME/.config/piloti"; if [ -d "$d" ]; then mkdir -p "$n" && cp -rn "$d"/. "$n"/ && rm -rf "$d"; fi',
      ])
      .catch(() => undefined);

    // Move leftovers of the legacy ~/.config/Piloti directory to ~/.config/piloti.
    void domicile.processes
      .run([
        "sh",
        "-c",
        'd="$HOME/.config/Piloti"; n="$HOME/.config/piloti"; if [ -d "$d" ]; then mkdir -p "$n" && cp -rn "$d"/. "$n"/ && rm -rf "$d"; fi',
      ])
      .catch(() => undefined);

    // Hydrate settings.ini from the real Linux $HOME if present, or seed it on
    // disk when migrated during initial render before hostSync was registered.
    void (async () => {
      const relSettings = toDomicilePath(VFS_STATE_PATHS.settings);
      const res = await domicile.files.readText(relSettings);
      if (cancelled) return;
      const hostRaw = res.match({
        Ok: (text) => (text.trim().length > 0 ? text : null),
        Err: () => null,
      });
      if (hostRaw !== null) {
        if ((getVfsEntry(VFS_STATE_PATHS.settings)?.content ?? "") !== hostRaw) {
          writeVfsTextFile(VFS_STATE_PATHS.settings, hostRaw);
        }
      } else {
        const currentIni =
          getVfsEntry(VFS_STATE_PATHS.settings)?.content ||
          serializeDesktopSettingsIni(settingsRef.current);
        await writeHostFile(VFS_STATE_PATHS.settings, currentIni);
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      registerVfsHostSync(null);
    };
  }, [domicile, isBrowserRuntime]);  // FIXME : Capabilities

  // Seed settings.ini in VFS on first run so users can inspect/edit it in Files or Text Editor,
  // and subscribe to live VFS edits on settings.ini, window-bounds.json, and desktop-icons.json.
  React.useEffect(() => {
    try {
      runVfsStateMigrations();
      if (!getVfsEntry(VFS_STATE_PATHS.settings)) {
        writeVfsStateText(
          VFS_STATE_PATHS.settings,
          serializeDesktopSettingsIni(settingsRef.current)
        );
      }
      if (!getVfsEntry(VFS_STATE_PATHS.windowBounds)) {
        writeVfsStateJson(
          VFS_STATE_PATHS.windowBounds,
          settingsRef.current.savedWindowBounds
        );
      }
      if (!getVfsEntry(VFS_STATE_PATHS.desktopIcons)) {
        writeVfsStateJson(
          VFS_STATE_PATHS.desktopIcons,
          settingsRef.current.desktopIconPositions
        );
      }
    } catch {
      // ignore initial VFS seed errors
    }

    const unsubSettings = subscribeVfsPath(VFS_STATE_PATHS.settings, (raw) => {
      if (!raw || !raw.trim()) return;
      const parsedPatch = parseDesktopSettingsRaw(raw);
      if (!parsedPatch) return;
      const nextBase = resolveInitialSettings(raw, isBrowserRuntime);  // FIXME : Capabilities
      setSettings((prev) => {
        const currentSerialized = serializeDesktopSettingsIni(prev);
        const mergedNext: DesktopSettings = {
          ...nextBase,
          installedWebApps: prev.installedWebApps,
          savedWindowBounds: prev.savedWindowBounds,
          desktopIconPositions: prev.desktopIconPositions,
        };
        if (currentSerialized === serializeDesktopSettingsIni(mergedNext)) {
          return prev;
        }
        return mergedNext;
      });
    });

    const unsubBounds = subscribeVfsPath(VFS_STATE_PATHS.windowBounds, (raw) => {
      if (!raw || !raw.trim()) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
        const incoming = parsed as Record<string, SavedWindowBounds>;
        setSettings((prev) => {
          if (JSON.stringify(prev.savedWindowBounds) === JSON.stringify(incoming)) {
            return prev;
          }
          return { ...prev, savedWindowBounds: incoming };
        });
      } catch {
        // ignore invalid JSON while editing
      }
    });

    const unsubIcons = subscribeVfsPath(VFS_STATE_PATHS.desktopIcons, (raw) => {
      if (!raw || !raw.trim()) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
        const incoming = parsed as Record<string, { col: number; row: number }>;
        setSettings((prev) => {
          if (
            JSON.stringify(prev.desktopIconPositions) === JSON.stringify(incoming)
          ) {
            return prev;
          }
          return { ...prev, desktopIconPositions: incoming };
        });
      } catch {
        // ignore invalid JSON while editing
      }
    });

    return () => {
      unsubSettings();
      unsubBounds();
      unsubIcons();
    };
  }, [isBrowserRuntime]);  // FIXME : Capabilities

  const persist = (next: DesktopSettings, patch?: Partial<DesktopSettings>) => {
    try {
      const patchKeys = patch ? Object.keys(patch) : null;
      const onlyBounds =
        patchKeys !== null &&
        patchKeys.length === 1 &&
        patchKeys[0] === "savedWindowBounds";
      const onlyIcons =
        patchKeys !== null &&
        patchKeys.length === 1 &&
        patchKeys[0] === "desktopIconPositions";

      if (onlyBounds) {
        clearTimeout(sliderTimersRef.current.boundsStorage);
        sliderTimersRef.current.boundsStorage = setTimeout(() => {
          try {
            writeVfsStateJson(VFS_STATE_PATHS.windowBounds, next.savedWindowBounds);
          } catch {
            // ignore
          }
        }, 120);
        return;
      }

      if (onlyIcons) {
        clearTimeout(sliderTimersRef.current.iconsStorage);
        sliderTimersRef.current.iconsStorage = setTimeout(() => {
          try {
            writeVfsStateJson(
              VFS_STATE_PATHS.desktopIcons,
              next.desktopIconPositions
            );
          } catch {
            // ignore
          }
        }, 120);
        return;
      }

      if (patch?.savedWindowBounds !== undefined) {
        writeVfsStateJson(VFS_STATE_PATHS.windowBounds, next.savedWindowBounds);
      }
      if (patch?.desktopIconPositions !== undefined) {
        writeVfsStateJson(VFS_STATE_PATHS.desktopIcons, next.desktopIconPositions);
      }
      pendingSettingsIniRef.current = next;
      clearTimeout(sliderTimersRef.current.settingsIni);
      sliderTimersRef.current.settingsIni = setTimeout(flushSettingsIni, 150);
    } catch {
      // ignore storage errors
    }
  };

  const applySettingsState = React.useCallback((patch: Partial<DesktopSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next, patch);
      return next;
    });
  }, []);

  // Load & sync installed web apps from FreeDesktop .desktop files in ~/.local/share/applications
  React.useEffect(() => {
    let cancelled = false;

    const syncFromXdg = async (seedIfEmpty: boolean) => {
      const fromXdg = await loadWebAppsFromDesktopEntries(domicile);
      if (cancelled) return;
      if (
        seedIfEmpty &&
        fromXdg.length === 0 &&
        settingsRef.current.installedWebApps.length > 0
      ) {
        const toSeed = settingsRef.current.installedWebApps;
        for (const app of toSeed) {
          await installWebAppDesktopEntry(domicile, app);
        }
        return;
      }
      if (
        JSON.stringify(fromXdg) ===
        JSON.stringify(settingsRef.current.installedWebApps)
      ) {
        return;
      }
      setSettings((prev) => {
        if (JSON.stringify(fromXdg) === JSON.stringify(prev.installedWebApps)) {
          return prev;
        }
        return {
          ...prev,
          installedWebApps: fromXdg,
        };
      });
    };

    void syncFromXdg(true);

    const onXdgChanged = () => {
      clearTimeout(sliderTimersRef.current.xdgWebApps);
      sliderTimersRef.current.xdgWebApps = setTimeout(() => {
        void syncFromXdg(false);
      }, 150);
    };
    window.addEventListener(XDG_WEBAPPS_CHANGED_EVENT, onXdgChanged);
    // Web app .desktop files only live here; ignore unrelated VFS writes.
    const unsubVfs = isBrowserRuntime  // FIXME : Capabilities
      ? subscribeWebVfs(() => onXdgChanged(), {
          path: `${WEB_VFS_HOME}/.local/share/applications`,
          mode: "children",
        })
      : undefined;
    return () => {
      cancelled = true;
      clearTimeout(sliderTimersRef.current.xdgWebApps);
      window.removeEventListener(XDG_WEBAPPS_CHANGED_EVENT, onXdgChanged);
      unsubVfs?.();
    };
  }, [domicile, isBrowserRuntime]);  // FIXME : Capabilities

  const updateSettings = React.useCallback(
    (patch: Partial<DesktopSettings>) => {
      setSettings((prev) => {
        const mergedPatch: Partial<DesktopSettings> = { ...patch };
        if (
          patch.interfaceTheme !== undefined &&
          patch.iconTheme === undefined
        ) {
          mergedPatch.iconTheme =
            patch.interfaceTheme === "adwaita" ? "Adwaita" : "Piloti";
        }
        const next = { ...prev, ...mergedPatch };
        persist(next, mergedPatch);

        if (!isBrowserRuntime && !applyingGnomeSyncRef.current) {  // FIXME : Capabilities
          if (
            next.syncGnomeSettings &&
            (mergedPatch.themeMode !== undefined ||
              mergedPatch.accentColor !== undefined ||
              mergedPatch.iconTheme !== undefined ||
              mergedPatch.clock24Hour !== undefined ||
              mergedPatch.clockShowSeconds !== undefined ||
              mergedPatch.gtkFontName !== undefined ||
              mergedPatch.gtkDocumentFontName !== undefined ||
              mergedPatch.gtkMonospaceFontName !== undefined ||
              mergedPatch.gtkTextScalingFactor !== undefined ||
              mergedPatch.gtkFontAntialiasing !== undefined ||
              mergedPatch.gtkFontHinting !== undefined ||
              mergedPatch.gtkFontRgbaOrder !== undefined)
          ) {
            void syncGnomeInterfaceKey(domicile, {
              ...(mergedPatch.themeMode !== undefined ? { themeMode: next.themeMode } : {}),
              ...(mergedPatch.accentColor !== undefined ? { accentColor: next.accentColor } : {}),
              ...(mergedPatch.iconTheme !== undefined ? { iconTheme: next.iconTheme } : {}),
              ...(mergedPatch.clock24Hour !== undefined ? { clock24Hour: next.clock24Hour } : {}),
              ...(mergedPatch.clockShowSeconds !== undefined
                ? { clockShowSeconds: next.clockShowSeconds }
                : {}),
              ...(mergedPatch.gtkFontName !== undefined ? { gtkFontName: next.gtkFontName } : {}),
              ...(mergedPatch.gtkDocumentFontName !== undefined
                ? { gtkDocumentFontName: next.gtkDocumentFontName }
                : {}),
              ...(mergedPatch.gtkMonospaceFontName !== undefined
                ? { gtkMonospaceFontName: next.gtkMonospaceFontName }
                : {}),
              ...(mergedPatch.gtkTextScalingFactor !== undefined
                ? { gtkTextScalingFactor: next.gtkTextScalingFactor }
                : {}),
              ...(mergedPatch.gtkFontAntialiasing !== undefined
                ? { gtkFontAntialiasing: next.gtkFontAntialiasing }
                : {}),
              ...(mergedPatch.gtkFontHinting !== undefined
                ? { gtkFontHinting: next.gtkFontHinting }
                : {}),
              ...(mergedPatch.gtkFontRgbaOrder !== undefined
                ? { gtkFontRgbaOrder: next.gtkFontRgbaOrder }
                : {}),
            });
            if (mergedPatch.iconTheme !== undefined) {
              void syncGtkIconTheme(domicile, next.iconTheme);
            }
          }

          if (next.syncGnomeSettings && patch.gnomeBackground) {
            const bgDiff: Partial<GnomeBackgroundSettings> = {};
            const keys = Object.keys(
              patch.gnomeBackground
            ) as (keyof GnomeBackgroundSettings)[];
            for (const key of keys) {
              if (next.gnomeBackground[key] !== prev.gnomeBackground[key]) {
                (bgDiff as Record<string, unknown>)[key] =
                  next.gnomeBackground[key];
              }
            }
            if (Object.keys(bgDiff).length > 0) {
              sliderTimersRef.current.gnomeBgPending = {
                ...sliderTimersRef.current.gnomeBgPending,
                ...bgDiff,
              };
              clearTimeout(sliderTimersRef.current.gnomeBg);
              sliderTimersRef.current.gnomeBg = setTimeout(() => {
                const pending = sliderTimersRef.current.gnomeBgPending;
                sliderTimersRef.current.gnomeBgPending = undefined;
                if (pending && Object.keys(pending).length > 0) {
                  void syncGnomeBackgroundSettings(domicile, pending);
                }
              }, 120);
            }
          }

          if (
            next.syncGnomeSettings &&
            (patch.doNotDisturb !== undefined ||
              patch.notificationShowOnLockScreen !== undefined)
          ) {
            void syncGnomeNotificationSettings(domicile, {
              ...(patch.doNotDisturb !== undefined
                ? { doNotDisturb: next.doNotDisturb }
                : {}),
              ...(patch.notificationShowOnLockScreen !== undefined
                ? { showInLockScreen: next.notificationShowOnLockScreen }
                : {}),
            });
          }

          if (patch.nightLight !== undefined) {
            domicile.displays
              .setColorTemperature(next.nightLight ? 4200 : 6500)
              .catch(() => { });
          }

          if (patch.volume !== undefined || patch.muted !== undefined) {
            clearTimeout(sliderTimersRef.current.audio);
            sliderTimersRef.current.audio = setTimeout(() => {
              void setSystemAudio(domicile, next.volume, next.muted);
            }, 60);
          }

          if (patch.brightness !== undefined) {
            clearTimeout(sliderTimersRef.current.brightness);
            sliderTimersRef.current.brightness = setTimeout(() => {
              void setSystemBrightness(domicile, next.brightness);
            }, 90);
          }

          if (patch.wifiEnabled !== undefined) {
            void setSystemWifiEnabled(domicile, next.wifiEnabled);
          }

          if (patch.bluetoothEnabled !== undefined) {
            void setSystemBluetoothPowered(domicile, next.bluetoothEnabled);
          }

          if (patch.powerMode !== undefined) {
            void setSystemPowerProfile(domicile, next.powerMode);
          }
        }

        return next;
      });
    },
    [domicile, isBrowserRuntime]  // FIXME : Capabilities
  );

  // Sync portal-requested background wallpaper path into GNOME background spec
  React.useEffect(() => {
    const bgPath = portalWallpaper?.background;
    if (!bgPath || isBrowserRuntime) return;  // FIXME : Capabilities
    const fileUri = localPathToFileUri(bgPath);
    const curBg = settingsRef.current.gnomeBackground;
    updateSettings({
      wallpaperId: "gnome",
      customWallpaperUrl: "",
      gnomeBackground: {
        ...curBg,
        pictureUri: fileUri,
        pictureUriDark: fileUri,
        pictureOptions: curBg.pictureOptions === "none" ? "zoom" : curBg.pictureOptions,
      },
    });
  }, [isBrowserRuntime, portalWallpaper?.background, updateSettings]);  // FIXME : Capabilities

  const [systemDark, setSystemDark] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const [osReducedMotion, setOsReducedMotion] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const domicileReducedMotion = useWatch(
    domicile.appearance,
    "change",
    () => domicile.appearance.reducedMotion
  );
  const reducedMotion = Boolean(
    settings.reduceMotion || domicileReducedMotion || osReducedMotion
  );

  React.useLayoutEffect(() => {
    document.documentElement.dataset.interfaceTheme =
      settings.interfaceTheme || "piloti";
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
    document.documentElement.dataset.moreTransparency = settings.moreTransparency
      ? "true"
      : "false";
  }, [reducedMotion, settings.interfaceTheme, settings.moreTransparency]);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const formatFontList = (raw: string, fallback: string) => {
      const cleaned = raw.trim();
      if (!cleaned) return fallback;
      const parts = cleaned
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) =>
          p.includes(" ") && !/^["'].*["']$/.test(p) ? `"${p}"` : p
        );
      return parts.length > 0 ? `${parts.join(", ")}, ${fallback}` : fallback;
    };

    root.style.setProperty(
      "--font-adw",
      formatFontList(
        settings.fontSansFamily,
        '"Cantarell", "Adwaita Sans", "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
      )
    );
    root.style.setProperty(
      "--font-adw-mono",
      formatFontList(
        settings.fontMonoFamily,
        '"Adwaita Mono", "Source Code Pro", "JetBrains Mono", ui-monospace, monospace'
      )
    );
    root.style.setProperty("--piloti-font-smoothing", settings.cssFontSmoothing);
    root.style.setProperty("--piloti-text-rendering", settings.cssTextRendering);
    root.style.setProperty(
      "--piloti-font-optical-sizing",
      settings.cssFontOpticalSizing
    );
    root.style.setProperty("--piloti-font-kerning", settings.cssFontKerning);
    root.style.setProperty(
      "--piloti-font-synthesis",
      settings.cssFontSynthesis === "none" ? "none" : "weight style"
    );
    root.style.setProperty(
      "--piloti-letter-spacing",
      `${settings.cssLetterSpacingEm}em`
    );
    root.style.setProperty(
      "--piloti-text-stroke-width",
      `${settings.cssTextStrokePx}px`
    );
    const fontStyleMap: Record<
      CssFontStyle,
      { weight: string; medium: string; bold: string; style: string }
    > = {
      light: { weight: "300", medium: "400", bold: "500", style: "normal" },
      regular: { weight: "400", medium: "500", bold: "500", style: "normal" },
      medium: { weight: "500", medium: "600", bold: "600", style: "normal" },
      semibold: { weight: "600", medium: "600", bold: "700", style: "normal" },
      italic: { weight: "400", medium: "500", bold: "500", style: "italic" },
    };
    const styleSpec = fontStyleMap[settings.fontSansStyle] ?? fontStyleMap.regular;
    root.style.setProperty("--piloti-font-weight", styleSpec.weight);
    root.style.setProperty("--piloti-font-weight-medium", styleSpec.medium);
    root.style.setProperty("--piloti-font-weight-semibold", styleSpec.bold);
    root.style.setProperty("--piloti-font-style", styleSpec.style);
    root.style.setProperty("--font-weight-normal", styleSpec.weight);
    root.style.setProperty("--font-weight-medium", styleSpec.medium);
    root.style.setProperty("--font-weight-semibold", styleSpec.bold);
    root.style.setProperty("--font-weight-bold", styleSpec.bold);

    const scale = Math.max(0.8, Math.min(1.5, settings.fontScale || 1));
    root.style.setProperty("--piloti-font-scale", String(scale));
    if (Math.abs(scale - 1) < 0.001) {
      root.style.fontSize = "";
      root.style.removeProperty("--text-adw-large-title");
      root.style.removeProperty("--text-adw-large-title--line-height");
      root.style.removeProperty("--text-adw-title-1");
      root.style.removeProperty("--text-adw-title-1--line-height");
      root.style.removeProperty("--text-adw-title-2");
      root.style.removeProperty("--text-adw-title-2--line-height");
      root.style.removeProperty("--text-adw-title-3");
      root.style.removeProperty("--text-adw-title-3--line-height");
      root.style.removeProperty("--text-adw-headline");
      root.style.removeProperty("--text-adw-headline--line-height");
      root.style.removeProperty("--text-adw-body");
      root.style.removeProperty("--text-adw-body--line-height");
      root.style.removeProperty("--text-adw-callout");
      root.style.removeProperty("--text-adw-callout--line-height");
      root.style.removeProperty("--text-adw-subheadline");
      root.style.removeProperty("--text-adw-subheadline--line-height");
      root.style.removeProperty("--text-adw-footnote");
      root.style.removeProperty("--text-adw-footnote--line-height");
      root.style.removeProperty("--text-adw-caption");
      root.style.removeProperty("--text-adw-caption--line-height");
    } else {
      const px = (base: number) => `${Math.round(base * scale * 10) / 10}px`;
      root.style.fontSize = `${Math.round(16 * scale * 100) / 100}px`;
      root.style.setProperty("--text-adw-large-title", px(26));
      root.style.setProperty("--text-adw-large-title--line-height", px(32));
      root.style.setProperty("--text-adw-title-1", px(22));
      root.style.setProperty("--text-adw-title-1--line-height", px(26));
      root.style.setProperty("--text-adw-title-2", px(17));
      root.style.setProperty("--text-adw-title-2--line-height", px(22));
      root.style.setProperty("--text-adw-title-3", px(15));
      root.style.setProperty("--text-adw-title-3--line-height", px(20));
      root.style.setProperty("--text-adw-headline", px(13));
      root.style.setProperty("--text-adw-headline--line-height", px(16));
      root.style.setProperty("--text-adw-body", px(13));
      root.style.setProperty("--text-adw-body--line-height", px(16));
      root.style.setProperty("--text-adw-callout", px(12));
      root.style.setProperty("--text-adw-callout--line-height", px(15));
      root.style.setProperty("--text-adw-subheadline", px(11));
      root.style.setProperty("--text-adw-subheadline--line-height", px(14));
      root.style.setProperty("--text-adw-footnote", px(10));
      root.style.setProperty("--text-adw-footnote--line-height", px(13));
      root.style.setProperty("--text-adw-caption", px(10));
      root.style.setProperty("--text-adw-caption--line-height", px(13));
    }
  }, [
    settings.cssFontKerning,
    settings.cssFontOpticalSizing,
    settings.cssFontSmoothing,
    settings.cssFontSynthesis,
    settings.cssLetterSpacingEm,
    settings.cssTextRendering,
    settings.cssTextStrokePx,
    settings.fontMonoFamily,
    settings.fontSansFamily,
    settings.fontSansStyle,
    settings.fontScale,
  ]);

  const [isNightTime, setIsNightTime] = React.useState(() => {
    const h = new Date().getHours();
    return h < 7 || h >= 19;
  });

  React.useEffect(() => {
    if (isBrowserRuntime || settings.themeMode !== "system") return;  // FIXME : Capabilities
    const updateTime = () => {
      const h = new Date().getHours();
      setIsNightTime(h < 7 || h >= 19);
    };
    updateTime();
    const timer = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(timer);
  }, [isBrowserRuntime, settings.themeMode]);  // FIXME : Capabilities

  const resolvedTheme: "dark" | "light" =
    settings.themeMode === "system"
      ? isBrowserRuntime  // FIXME : Capabilities
        ? systemDark
          ? "dark"
          : "light"
        : isNightTime
          ? "dark"
          : "light"
      : settings.themeMode;

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
    root.dataset.highContrast = settings.highContrast ? "true" : "false";
    const customHex = settings.customAccentHex?.trim();
    if (customHex && /^#[0-9a-f]{6}$/i.test(customHex)) {
      root.style.setProperty("--adw-active-accent", customHex);
    } else {
      const accent = ACCENT_COLORS.find((a) => a.id === settings.accentColor);
      if (accent && accent.id !== "blue") {
        root.style.setProperty("--adw-active-accent", accent.cssVar);
      } else {
        root.style.removeProperty("--adw-active-accent");
      }
    }
    try {
      domicile.theme.set(resolvedTheme);
    } catch {
      // ignore if compositor not ready
    }
  }, [
    resolvedTheme,
    settings.accentColor,
    settings.customAccentHex,
    settings.highContrast,
    domicile.theme,
  ]);

  React.useEffect(() => {
    if (isBrowserRuntime) return;  // FIXME : Capabilities
    const applyTemp = () => {
      domicile.displays
        .setColorTemperature(settings.nightLight ? 4200 : 6500)
        .catch(() => { });
    };
    applyTemp();
    return domicile.on("compositorreplaced", applyTemp);
  }, [domicile, isBrowserRuntime, settings.nightLight]);  // FIXME : Capabilities

  const activeWallpaper = React.useMemo(() => {
    if (settings.wallpaperId?.startsWith("#")) {
      return {
        id: settings.wallpaperId,
        name: "Custom Color",
        subtitle: settings.wallpaperId,
        category: "Solid" as const,
        backgroundCss: settings.wallpaperId,
      };
    }
    return WALLPAPERS.find((w) => w.id === settings.wallpaperId) ?? WALLPAPERS[0];
  }, [settings.wallpaperId]);

  const activePictureUri =
    selectGnomePictureUri(settings.gnomeBackground, resolvedTheme) ||
    settings.customWallpaperUrl ||
    (resolvedTheme === "dark" && activeWallpaper?.imageUrlDark
      ? activeWallpaper.imageUrlDark
      : activeWallpaper?.imageUrl) ||
    "";
  const localPicturePath = fileUriToLocalPath(activePictureUri);
  const isLocalPictureUri = Boolean(localPicturePath);
  const [resolvedLocalPicture, setResolvedLocalPicture] = React.useState<{
    raw: string;
    blobUrl: string;
    cssText?: string;
    htmlText?: string;
  }>({ raw: "", blobUrl: "" });
  const activeBlobUrlRef = React.useRef("");

  React.useEffect(() => {
    if (!activePictureUri || !localPicturePath) {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = "";
      }
      setResolvedLocalPicture({ raw: "", blobUrl: "" });
      return;
    }
    if (!allowLocalWallpaper && !isBrowserRuntime) return;  // FIXME : Capabilities

    let cancelled = false;
    const finishBg = startBootPhase("bg");

    const loadLocal = async () => {
      let targetPath = localPicturePath;
      const lower = targetPath.toLowerCase();

      if (lower.endsWith(".html") || lower.endsWith(".htm")) {
        const res = await domicile.files.readText(targetPath);
        const htmlText = res.match({ Ok: (t) => t, Err: () => "" });
        if (cancelled) return;
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
          activeBlobUrlRef.current = "";
        }
        setResolvedLocalPicture({ raw: activePictureUri, blobUrl: "", htmlText });
        finishBg(htmlText ? `${Math.round(htmlText.length / 1024)} KB html` : "empty");
        return;
      }

      if (lower.endsWith(".css")) {
        const res = await domicile.files.readText(targetPath);
        const cssText = res.match({ Ok: (t) => t, Err: () => "" });
        if (cancelled) return;
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
          activeBlobUrlRef.current = "";
        }
        setResolvedLocalPicture({ raw: activePictureUri, blobUrl: "", cssText });
        finishBg(cssText ? `${Math.round(cssText.length / 1024)} KB css` : "empty");
        return;
      }

      let blob: Blob | null = null;
      if (!isBrowserRuntime) {  // FIXME : Capabilities
        blob = await readGnomeBackgroundBlob(domicile, activePictureUri);
      } else {
        if (lower.endsWith(".xml")) {
          const xmlRes = await domicile.files.readText(targetPath);
          const xml = xmlRes.match({ Ok: (t) => t, Err: () => "" });
          const lastSlash = targetPath.lastIndexOf("/");
          const baseDir = lastSlash > 0 ? targetPath.slice(0, lastSlash) : "/";
          const extracted = parseGnomeBackgroundXml(xml, baseDir);
          if (extracted) targetPath = extracted;
        }
        const bytesRes = await domicile.files.read(targetPath);
        const bytes = bytesRes.match({
          Ok: (b) => (b.length > 0 ? b : null),
          Err: () => null,
        });
        if (bytes) {
          const ext = targetPath.split(".").pop()?.toLowerCase() ?? "";
          const mime =
            ext === "svg"
              ? "image/svg+xml"
              : ext === "png"
                ? "image/png"
                : ext === "webp"
                  ? "image/webp"
                  : ext === "gif"
                    ? "image/gif"
                    : ext === "avif"
                      ? "image/avif"
                      : "image/jpeg";
          blob = new Blob([new Uint8Array(bytes)], { type: mime });
        }
      }

      if (cancelled || !blob) {
        if (!cancelled) finishBg("empty");
        return;
      }
      const nextUrl = URL.createObjectURL(blob);
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = nextUrl;
      setResolvedLocalPicture({ raw: activePictureUri, blobUrl: nextUrl });
      finishBg(`${Math.round(blob.size / 1024)} KB`);
    };

    void loadLocal();

    return () => {
      cancelled = true;
    };
  }, [
    activePictureUri,
    allowLocalWallpaper,
    domicile,
    isBrowserRuntime,  // FIXME : Capabilities
    localPicturePath,
  ]);

  React.useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = "";
      }
    };
  }, []);

  const resolvedPictureSrc = isLocalPictureUri
    ? resolvedLocalPicture.raw === activePictureUri
      ? resolvedLocalPicture.blobUrl
      : ""
    : activePictureUri;

  const resolvedAnimatedCssText =
    isLocalPictureUri && resolvedLocalPicture.raw === activePictureUri
      ? resolvedLocalPicture.cssText
      : undefined;

  const resolvedHtmlSrcDoc =
    isLocalPictureUri && resolvedLocalPicture.raw === activePictureUri
      ? resolvedLocalPicture.htmlText
      : undefined;

  const resolvedActiveWallpaper = React.useMemo(() => {
    const accentHex =
      ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.hex ?? "#3584e4";
    const dynamicCss = resolveDynamicWallpaperCss(activeWallpaper.id, accentHex);
    return dynamicCss
      ? { ...activeWallpaper, backgroundCss: dynamicCss }
      : activeWallpaper;
  }, [activeWallpaper, settings.accentColor]);

  const backgroundSpec = React.useMemo(
    () =>
      resolveBackgroundRenderSpec({
        wallpaperId: settings.wallpaperId,
        customWallpaperUrl:
          settings.customWallpaperUrl || resolvedActiveWallpaper?.imageUrl || "",
        wallpaperColorMode: settings.wallpaperColorMode ?? "solid",
        gnomeBackground: settings.gnomeBackground,
        activeWallpaper: resolvedActiveWallpaper,
        resolvedTheme,
        resolvedPictureSrc:
          resolvedPictureSrc ||
          (resolvedTheme === "dark" && resolvedActiveWallpaper?.imageUrlDark
            ? resolvedActiveWallpaper.imageUrlDark
            : resolvedActiveWallpaper?.imageUrl) ||
          "",
        resolvedAnimatedCssText,
        resolvedHtmlSrcDoc,
      }),
    [
      resolvedActiveWallpaper,
      resolvedAnimatedCssText,
      resolvedHtmlSrcDoc,
      resolvedPictureSrc,
      resolvedTheme,
      settings.customWallpaperUrl,
      settings.gnomeBackground,
      settings.wallpaperColorMode,
      settings.wallpaperId,
    ]
  );

  const [localeTick, setLocaleTick] = React.useState(0);
  React.useEffect(
    () => subscribeLocale(() => setLocaleTick((t) => t + 1)),
    []
  );

  return React.useMemo<SettingsContextValue>(
    () => ({
      isBrowserRuntime,  // FIXME : Capabilities
      settings,
      updateSettings,
      applySettingsState,
      applyingGnomeSyncRef,
      resolvedTheme,
      reducedMotion,
      activeWallpaper,
      backgroundSpec,
    }),
    [
      isBrowserRuntime,  // FIXME : Capabilities
      settings,
      updateSettings,
      applySettingsState,
      resolvedTheme,
      reducedMotion,
      activeWallpaper,
      backgroundSpec,
      localeTick,
    ]
  );
}

export function useSettings() {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within DesktopStateProvider");
  }
  return ctx;
}

