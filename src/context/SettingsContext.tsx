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
import { WEB_VFS_CHANGED_EVENT } from "@/lib/web-vfs";
import {
  installWebAppDesktopEntry,
  loadWebAppsFromDesktopEntries,
  XDG_WEBAPPS_CHANGED_EVENT,
} from "@/lib/xdg-web-apps";
import {
  DEFAULT_GNOME_BACKGROUND,
  type BackgroundRenderSpec,
  type GnomeBackgroundSettings,
  fileUriToLocalPath,
  localPathToFileUri,
  resolveBackgroundRenderSpec,
  selectGnomePictureUri,
} from "@/lib/gnome-background";
import { clampHistoryLimit } from "@/lib/notifications";
import {
  readGnomeBackgroundBlob,
  setSystemAudio,
  setSystemBrightness,
  setSystemPowerProfile,
  setSystemWifiEnabled,
  syncGnomeBackgroundSettings,
  syncGnomeInterfaceKey,
  syncGnomeNotificationSettings,
  syncGtkIconTheme,
  DEFAULT_HIDDEN_GNOME_PANELS,
  type GtkFontAntialiasing,
  type GtkFontHinting,
  type GtkFontRgbaOrder,
} from "@/lib/gnome-bridge";
import { startBootPhase } from "@/lib/perf-log";
import { subscribeLocale } from "@/lib/i18n";
import type { DesktopIconAlign } from "@/lib/desktop-icons";
import type { SavedWindowBounds } from "@/lib/spatial-window-bounds";

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

export type { InstalledWebApp, SavedWindowBounds };

export type InterfaceThemeId = "piloti" | "adwaita" | (string & {});

export interface DesktopSettings {
  interfaceTheme: InterfaceThemeId;
  themeMode: "dark" | "light" | "system";
  accentColor: AccentColorId;
  wallpaperId: string;
  customWallpaperUrl: string;
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
  enabledPluginIds: string[];
  computerModel: "mac" | "pc";
  desktopIconPositions: Record<string, { col: number; row: number }>;
  pinnedAppIds: string[];
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
  wallpaperId: "piloti-aurora",
  customWallpaperUrl: "",
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
  showBatteryPercentage: true,
  reduceMotion: false,
  moreTransparency: true,
  windowDecorationMode: "auto",
  windowButtonLayout: ":close",
  iconTheme: "Papirus",
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
  fileActivationMode: "double",
  showFileExtensionBadges: true,
  demoExtensionEnabled: true,
  enabledPluginIds: [],
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

function loadSeparatedRecord<T>(key: string): Record<string, T> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, T>)
      : null;
  } catch {
    return null;
  }
}

export function isBrowserDevRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__PILOTI_BROWSER_HOST__);
}

export const WEB_DEFAULTS_VERSION = 6;

const DEFAULT_WEB_PINNED_APP_IDS = [
  "nautilus",
  "terminal",
  "text-editor",
  "calculator",
  "image-viewer",
  "app-store",
  "console",
  "settings",
];

const WEB_HIDDEN_APP_IDS = new Set([
  "browser",
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
  savedJson: string | null,
  isBrowserBackend: boolean
): DesktopSettings {
  if (savedJson) {
    try {
      const parsed = JSON.parse(savedJson) as Partial<DesktopSettings>;
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

      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
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
  isBrowserRuntime: boolean;
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
  const isBrowserRuntime = isBrowserDevRuntime();
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
      const base = resolveInitialSettings(
        localStorage.getItem(STORAGE_KEY),
        isBrowserRuntime
      );
      const separatedBounds = loadSeparatedRecord<SavedWindowBounds>(
        WINDOW_BOUNDS_STORAGE_KEY
      );
      const separatedIcons = loadSeparatedRecord<{ col: number; row: number }>(
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
      return resolveInitialSettings(null, isBrowserRuntime);
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
  }>({});

  const persist = (next: DesktopSettings, patch?: Partial<DesktopSettings>) => {
    if (typeof localStorage === "undefined") return;
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
            localStorage.setItem(
              WINDOW_BOUNDS_STORAGE_KEY,
              JSON.stringify(next.savedWindowBounds)
            );
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
            localStorage.setItem(
              DESKTOP_ICONS_STORAGE_KEY,
              JSON.stringify(next.desktopIconPositions)
            );
          } catch {
            // ignore
          }
        }, 120);
        return;
      }

      if (patch?.savedWindowBounds !== undefined) {
        localStorage.setItem(
          WINDOW_BOUNDS_STORAGE_KEY,
          JSON.stringify(next.savedWindowBounds)
        );
      }
      if (patch?.desktopIconPositions !== undefined) {
        localStorage.setItem(
          DESKTOP_ICONS_STORAGE_KEY,
          JSON.stringify(next.desktopIconPositions)
        );
      }
      const { installedWebApps: _ignoredWebApps, ...serializable } = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
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
      const fromXdg = await loadWebAppsFromDesktopEntries(
        domicile,
        isBrowserRuntime,
      );
      if (cancelled) return;
      if (
        seedIfEmpty &&
        fromXdg.length === 0 &&
        settingsRef.current.installedWebApps.length > 0
      ) {
        const toSeed = settingsRef.current.installedWebApps;
        for (const app of toSeed) {
          await installWebAppDesktopEntry(domicile, isBrowserRuntime, app);
        }
        return;
      }
      setSettings((prev) => ({
        ...prev,
        installedWebApps: fromXdg,
      }));
    };

    void syncFromXdg(true);

    const onXdgChanged = () => {
      void syncFromXdg(false);
    };
    window.addEventListener(XDG_WEBAPPS_CHANGED_EVENT, onXdgChanged);
    if (isBrowserRuntime) {
      window.addEventListener(WEB_VFS_CHANGED_EVENT, onXdgChanged);
    }
    return () => {
      cancelled = true;
      window.removeEventListener(XDG_WEBAPPS_CHANGED_EVENT, onXdgChanged);
      if (isBrowserRuntime) {
        window.removeEventListener(WEB_VFS_CHANGED_EVENT, onXdgChanged);
      }
    };
  }, [domicile, isBrowserRuntime]);

  const updateSettings = React.useCallback(
    (patch: Partial<DesktopSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next, patch);

        if (!isBrowserRuntime && !applyingGnomeSyncRef.current) {
          if (
            next.syncGnomeSettings &&
            (patch.themeMode !== undefined ||
              patch.accentColor !== undefined ||
              patch.iconTheme !== undefined ||
              patch.clock24Hour !== undefined ||
              patch.clockShowSeconds !== undefined ||
              patch.gtkFontName !== undefined ||
              patch.gtkDocumentFontName !== undefined ||
              patch.gtkMonospaceFontName !== undefined ||
              patch.gtkTextScalingFactor !== undefined ||
              patch.gtkFontAntialiasing !== undefined ||
              patch.gtkFontHinting !== undefined ||
              patch.gtkFontRgbaOrder !== undefined)
          ) {
            void syncGnomeInterfaceKey(domicile, {
              ...(patch.themeMode !== undefined ? { themeMode: next.themeMode } : {}),
              ...(patch.accentColor !== undefined ? { accentColor: next.accentColor } : {}),
              ...(patch.iconTheme !== undefined ? { iconTheme: next.iconTheme } : {}),
              ...(patch.clock24Hour !== undefined ? { clock24Hour: next.clock24Hour } : {}),
              ...(patch.clockShowSeconds !== undefined
                ? { clockShowSeconds: next.clockShowSeconds }
                : {}),
              ...(patch.gtkFontName !== undefined ? { gtkFontName: next.gtkFontName } : {}),
              ...(patch.gtkDocumentFontName !== undefined
                ? { gtkDocumentFontName: next.gtkDocumentFontName }
                : {}),
              ...(patch.gtkMonospaceFontName !== undefined
                ? { gtkMonospaceFontName: next.gtkMonospaceFontName }
                : {}),
              ...(patch.gtkTextScalingFactor !== undefined
                ? { gtkTextScalingFactor: next.gtkTextScalingFactor }
                : {}),
              ...(patch.gtkFontAntialiasing !== undefined
                ? { gtkFontAntialiasing: next.gtkFontAntialiasing }
                : {}),
              ...(patch.gtkFontHinting !== undefined
                ? { gtkFontHinting: next.gtkFontHinting }
                : {}),
              ...(patch.gtkFontRgbaOrder !== undefined
                ? { gtkFontRgbaOrder: next.gtkFontRgbaOrder }
                : {}),
            });
            if (patch.iconTheme !== undefined) {
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
              void syncGnomeBackgroundSettings(domicile, bgDiff);
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
              .catch(() => {});
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

          if (patch.powerMode !== undefined) {
            void setSystemPowerProfile(domicile, next.powerMode);
          }
        }

        return next;
      });
    },
    [domicile, isBrowserRuntime]
  );

  // Sync portal-requested background wallpaper path into GNOME background spec
  React.useEffect(() => {
    const bgPath = portalWallpaper?.background;
    if (!bgPath || isBrowserRuntime) return;
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
  }, [isBrowserRuntime, portalWallpaper?.background, updateSettings]);

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
    const fontStyleMap: Record<CssFontStyle, { weight: string; style: string }> = {
      light: { weight: "300", style: "normal" },
      regular: { weight: "400", style: "normal" },
      medium: { weight: "500", style: "normal" },
      semibold: { weight: "600", style: "normal" },
      italic: { weight: "400", style: "italic" },
    };
    const styleSpec = fontStyleMap[settings.fontSansStyle] ?? fontStyleMap.regular;
    root.style.setProperty("--piloti-font-weight", styleSpec.weight);
    root.style.setProperty("--piloti-font-style", styleSpec.style);

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
    if (isBrowserRuntime || settings.themeMode !== "system") return;
    const updateTime = () => {
      const h = new Date().getHours();
      setIsNightTime(h < 7 || h >= 19);
    };
    updateTime();
    const timer = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(timer);
  }, [isBrowserRuntime, settings.themeMode]);

  const resolvedTheme: "dark" | "light" =
    settings.themeMode === "system"
      ? isBrowserRuntime
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
    if (isBrowserRuntime) return;
    const applyTemp = () => {
      domicile.displays
        .setColorTemperature(settings.nightLight ? 4200 : 6500)
        .catch(() => {});
    };
    applyTemp();
    return domicile.on("compositorreplaced", applyTemp);
  }, [domicile, isBrowserRuntime, settings.nightLight]);

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
    "";
  const isLocalPictureUri = Boolean(fileUriToLocalPath(activePictureUri));
  const [resolvedLocalPicture, setResolvedLocalPicture] = React.useState<{
    raw: string;
    blobUrl: string;
  }>({ raw: "", blobUrl: "" });
  const activeBlobUrlRef = React.useRef("");

  React.useEffect(() => {
    if (!activePictureUri || !isLocalPictureUri || isBrowserRuntime) {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = "";
      }
      setResolvedLocalPicture({ raw: "", blobUrl: "" });
      return;
    }
    if (!allowLocalWallpaper) return;

    let cancelled = false;
    const finishBg = startBootPhase("bg");
    void readGnomeBackgroundBlob(domicile, activePictureUri).then((blob) => {
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
    });

    return () => {
      cancelled = true;
    };
  }, [
    activePictureUri,
    allowLocalWallpaper,
    domicile,
    isBrowserRuntime,
    isLocalPictureUri,
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
        gnomeBackground: settings.gnomeBackground,
        activeWallpaper: resolvedActiveWallpaper,
        resolvedTheme,
        resolvedPictureSrc:
          resolvedPictureSrc || resolvedActiveWallpaper?.imageUrl || "",
      }),
    [
      resolvedActiveWallpaper,
      resolvedPictureSrc,
      resolvedTheme,
      settings.customWallpaperUrl,
      settings.gnomeBackground,
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
      isBrowserRuntime,
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
      isBrowserRuntime,
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

