import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { usePortalWallpaper } from "@domicile-desktop/react/portals";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  ACCENT_COLORS,
  APP_CATALOG,
  type AccentColorId,
  type UiThemeId,
  WALLPAPERS,
  type WallpaperOption,
} from "@/data/catalog";
import {
  setSystemAudio,
  setSystemBrightness,
  setSystemPowerProfile,
  setSystemWifiEnabled,
  syncGnomeInterfaceKey,
  DEFAULT_HIDDEN_GNOME_PANELS,
} from "@/lib/gnome-bridge";

export type WindowDecorationMode = "auto" | "csd" | "ssd";

export interface SavedWindowBounds {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface InstalledWebApp {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
}

export interface DesktopSettings {
  uiTheme: UiThemeId;
  themeMode: "dark" | "light" | "system";
  accentColor: AccentColorId;
  wallpaperId: string;
  customWallpaperUrl: string;
  dockSize: number;
  dockMagnification: boolean;
  dockMagnificationSize: number;
  dockAutoHide: boolean;
  clock24Hour: boolean;
  clockShowSeconds: boolean;
  clockShowDate: boolean;
  windowTranslucency: boolean;
  windowDecorationMode: WindowDecorationMode;
  csdClipShadow: boolean;
  csdShowGrabBar: boolean;
  syncGnomeSettings: boolean;
  preferGnomeControlCenter: boolean;
  hiddenGnomePanels: string[];
  volume: number;
  muted: boolean;
  brightness: number;
  nightLight: boolean;
  wifiEnabled: boolean;
  connectedWifi: string;
  bluetoothEnabled: boolean;
  doNotDisturb: boolean;
  powerMode: "balanced" | "performance" | "power-saver";
  activeWorkspace: number;
  workspaceCount: number;
  pinnedAppIds: string[];
  installedWebApps: InstalledWebApp[];
  savedWindowBounds: Record<string, SavedWindowBounds>;
}

const DEFAULT_SETTINGS: DesktopSettings = {
  uiTheme: "cupertino",
  themeMode: "dark",
  accentColor: "blue",
  wallpaperId: "piloti-aurora",
  customWallpaperUrl: "",
  dockSize: 52,
  dockMagnification: true,
  dockMagnificationSize: 76,
  dockAutoHide: false,
  clock24Hour: true,
  clockShowSeconds: false,
  clockShowDate: false,
  windowTranslucency: true,
  windowDecorationMode: "auto",
  csdClipShadow: true,
  csdShowGrabBar: true,
  syncGnomeSettings: true,
  preferGnomeControlCenter: false,
  hiddenGnomePanels: [...DEFAULT_HIDDEN_GNOME_PANELS],
  volume: 78,
  muted: false,
  brightness: 95,
  nightLight: false,
  wifiEnabled: true,
  connectedWifi: "Piloti-5G-Ultra",
  bluetoothEnabled: true,
  doNotDisturb: false,
  powerMode: "balanced",
  activeWorkspace: 1,
  workspaceCount: 2,
  pinnedAppIds: APP_CATALOG.filter((a) => a.pinnedByDefault).map((a) => a.id),
  installedWebApps: [],
  savedWindowBounds: {},
};

const STORAGE_KEY = "piloti.desktop.settings.v1";

export function isBrowserDevRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__PILOTI_BROWSER_HOST__);
}

interface SettingsContextValue {
  isBrowserRuntime: boolean;
  settings: DesktopSettings;
  updateSettings: (patch: Partial<DesktopSettings>) => void;
  applySettingsState: (patch: Partial<DesktopSettings>) => void;
  applyingGnomeSyncRef: React.MutableRefObject<boolean>;
  resolvedTheme: "dark" | "light";
  reducedMotion: boolean;
  activeWallpaper: WallpaperOption;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const domicile = useDomicile();
  const isBrowserRuntime = isBrowserDevRuntime();
  const portalWallpaper = usePortalWallpaper();

  const [settings, setSettings] = React.useState<DesktopSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DesktopSettings>;
        const workspaceCount =
          typeof parsed.workspaceCount === "number" && parsed.workspaceCount >= 1
            ? parsed.workspaceCount
            : DEFAULT_SETTINGS.workspaceCount;
        const activeWorkspace = Math.max(
          1,
          Math.min(workspaceCount, parsed.activeWorkspace ?? 1)
        );
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          workspaceCount,
          activeWorkspace,
          installedWebApps: Array.isArray(parsed.installedWebApps)
            ? parsed.installedWebApps
            : [],
          savedWindowBounds: parsed.savedWindowBounds ?? {},
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const applyingGnomeSyncRef = React.useRef(false);
  const sliderTimersRef = React.useRef<{
    audio?: ReturnType<typeof setTimeout>;
    brightness?: ReturnType<typeof setTimeout>;
  }>({});

  const persist = (next: DesktopSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const applySettingsState = React.useCallback((patch: Partial<DesktopSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const updateSettings = React.useCallback(
    (patch: Partial<DesktopSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);

        if (!isBrowserRuntime && !applyingGnomeSyncRef.current) {
          if (
            next.syncGnomeSettings &&
            (patch.themeMode !== undefined ||
              patch.accentColor !== undefined ||
              patch.clock24Hour !== undefined ||
              patch.clockShowSeconds !== undefined)
          ) {
            void syncGnomeInterfaceKey(domicile, {
              ...(patch.themeMode !== undefined ? { themeMode: next.themeMode } : {}),
              ...(patch.accentColor !== undefined ? { accentColor: next.accentColor } : {}),
              ...(patch.clock24Hour !== undefined ? { clock24Hour: next.clock24Hour } : {}),
              ...(patch.clockShowSeconds !== undefined
                ? { clockShowSeconds: next.clockShowSeconds }
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

  // Sync portal-requested background wallpaper path into customWallpaperUrl
  React.useEffect(() => {
    const bgPath = portalWallpaper?.background;
    if (!bgPath || isBrowserRuntime) return;
    let cancelled = false;

    (async () => {
      const res = await domicile.files.read(bgPath);
      res.match({
        Ok: (bytes) => {
          if (cancelled || bytes.length === 0) return;
          const lower = bgPath.toLowerCase();
          const mime = lower.endsWith(".png")
            ? "image/png"
            : lower.endsWith(".webp")
              ? "image/webp"
              : "image/jpeg";
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          }
          updateSettings({ customWallpaperUrl: `data:${mime};base64,${btoa(bin)}` });
        },
        Err: () => {},
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [domicile.files, isBrowserRuntime, portalWallpaper?.background, updateSettings]);

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
  const reducedMotion = Boolean(domicileReducedMotion || osReducedMotion);

  React.useLayoutEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
  }, [reducedMotion]);

  const resolvedTheme: "dark" | "light" =
    settings.themeMode === "system" ? (systemDark ? "dark" : "light") : settings.themeMode;

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.uiTheme = settings.uiTheme ?? "cupertino";
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
    const accent = ACCENT_COLORS.find((a) => a.id === settings.accentColor);
    if (accent && accent.id !== "blue") {
      root.style.setProperty("--mac-accent", accent.cssVar);
      root.style.setProperty("--adw-active-accent", accent.cssVar);
    } else {
      root.style.removeProperty("--mac-accent");
      root.style.removeProperty("--adw-active-accent");
    }
    try {
      domicile.theme.set(resolvedTheme);
    } catch {
      // ignore if compositor not ready
    }
  }, [resolvedTheme, settings.accentColor, settings.uiTheme, domicile.theme]);

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

  const activeWallpaper = React.useMemo(
    () => WALLPAPERS.find((w) => w.id === settings.wallpaperId) ?? WALLPAPERS[0],
    [settings.wallpaperId]
  );

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      isBrowserRuntime,
      settings,
      updateSettings,
      applySettingsState,
      applyingGnomeSyncRef,
      resolvedTheme,
      reducedMotion,
      activeWallpaper,
    }),
    [
      isBrowserRuntime,
      settings,
      updateSettings,
      applySettingsState,
      resolvedTheme,
      reducedMotion,
      activeWallpaper,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}

