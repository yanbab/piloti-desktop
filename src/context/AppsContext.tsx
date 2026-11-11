import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { watchIconTheme } from "@domicile-desktop/sdk/icon-theme";
import {
  APP_CATALOG,
  type AppDefinition,
} from "@/data/catalog";
import { launchWithGnomeEnv } from "@/lib/gnome-bridge";
import {
  buildXdgIconThemeIndex,
  discoverInstalledXdgApps,
  resolveXdgIconUrl,
  resolveXdgVisualStyle,
  type XdgDesktopEntry,
  type XdgIconThemeIndex,
} from "xdg-desktop";
import { useSettings } from "./SettingsContext";
import { useSystemBackends } from "./SystemBackendsContext";

export function matchAppFromWayland(
  desktopId: string,
  title: string
): AppDefinition {
  const lower = `${desktopId} ${title}`.toLowerCase();
  if (lower.includes("nautilus") || lower.includes("files")) {
    return APP_CATALOG.find((a) => a.id === "nautilus")!;
  }
  if (
    lower.includes("kitty") ||
    lower.includes("kgx") ||
    lower.includes("console") ||
    lower.includes("alacritty") ||
    lower.includes("foot") ||
    lower.includes("term")
  ) {
    return APP_CATALOG.find((a) => a.id === "terminal")!;
  }
  if (
    lower.includes("firefox") ||
    lower.includes("epiphany") ||
    lower.includes("chrom") ||
    lower.includes("browser")
  ) {
    return APP_CATALOG.find((a) => a.id === "browser")!;
  }
  return {
    id: desktopId || "wayland-app",
    name: title || desktopId || "Application",
    shortName: desktopId || "App",
    description: "Wayland Client Application",
    category: "Utilities",
    iconName: "sparkles",
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    pinnedByDefault: false,
    defaultSize: { width: 740, height: 480 },
    menus: [],
  };
}

interface AppsContextValue {
  installedXdgApps: XdgDesktopEntry[];
  activeIconTheme: string;
  getAppIconUrl: (appIdOrName: string | undefined) => string | undefined;
  ensureWaylandIcons: (ids: readonly string[]) => void;
  launchXdgEntry: (entry: XdgDesktopEntry, actionId?: string) => void;
}

const AppsContext = React.createContext<AppsContextValue | null>(null);

export function AppsProvider({ children }: { children: React.ReactNode }) {
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const { gnomeIconThemeOverride } = useSystemBackends();

  const [portalIconTheme, setPortalIconTheme] = React.useState<string>("Adwaita");
  const activeIconTheme = gnomeIconThemeOverride || portalIconTheme;

  const [installedXdgApps, setInstalledXdgApps] = React.useState<
    XdgDesktopEntry[]
  >([]);
  const [appIconsMap, setAppIconsMap] = React.useState<Record<string, string>>(
    {}
  );
  const iconThemeIndexRef = React.useRef<XdgIconThemeIndex | null>(null);

  React.useEffect(() => {
    try {
      return watchIconTheme(domicile, (res) => {
        res.match({
          Ok: (opt) => {
            opt.match({
              Some: (themeName) => {
                if (themeName) setPortalIconTheme(themeName);
              },
              None: () => setPortalIconTheme("Adwaita"),
            });
          },
          Err: () => {},
        });
      });
    } catch {
      return undefined;
    }
  }, [domicile]);

  React.useEffect(() => {
    let cancelled = false;
    const preferredThemes = [activeIconTheme, "Adwaita", "hicolor"];

    (async () => {
      try {
        const iconIndex = await buildXdgIconThemeIndex(
          domicile.files,
          preferredThemes
        );
        if (cancelled) return;
        iconThemeIndexRef.current = iconIndex;

        const apps = await discoverInstalledXdgApps(
          domicile.files,
          { iconThemes: preferredThemes },
          iconIndex
        );
        if (cancelled) return;
        setInstalledXdgApps(apps);

        const nextIcons: Record<string, string> = {};
        for (const entry of apps) {
          if (entry.iconUrl) {
            nextIcons[entry.desktopId] = entry.iconUrl;
            nextIcons[entry.appId] = entry.iconUrl;
            nextIcons[entry.appId.toLowerCase()] = entry.iconUrl;
            if (entry.icon) {
              nextIcons[entry.icon] = entry.iconUrl;
            }
          }
        }

        await Promise.all(
          APP_CATALOG.map(async (app) => {
            const url = await resolveXdgIconUrl(
              domicile.files,
              iconIndex,
              app.xdgIcons ?? [app.id],
              64,
              1
            );
            if (url) {
              nextIcons[app.id] = url;
            }
          })
        );

        if (!cancelled) {
          setAppIconsMap((prev) => ({ ...prev, ...nextIcons }));
        }
      } catch {
        // ignore if locked or unavailable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [domicile.files, activeIconTheme]);

  const ensureWaylandIcons = React.useCallback(
    (ids: readonly string[]) => {
      const iconIndex = iconThemeIndexRef.current;
      if (!iconIndex) return;

      for (const raw of ids) {
        const baseId = raw.replace(/\.desktop$/i, "");
        if (!baseId || appIconsMap[baseId] || appIconsMap[raw]) continue;

        resolveXdgIconUrl(domicile.files, iconIndex, [baseId, raw], 64, 1)
          .then((url) => {
            if (url) {
              setAppIconsMap((prev) => ({
                ...prev,
                [baseId]: url,
                [raw]: url,
              }));
            }
          })
          .catch(() => {});
      }
    },
    [appIconsMap, domicile.files]
  );

  const getAppIconUrl = React.useCallback(
    (appIdOrName: string | undefined): string | undefined => {
      if (!appIdOrName) return undefined;
      const clean = appIdOrName.replace(/\.desktop$/i, "");
      return (
        appIconsMap[appIdOrName] ??
        appIconsMap[clean] ??
        appIconsMap[clean.toLowerCase()]
      );
    },
    [appIconsMap]
  );

  const launchXdgEntry = React.useCallback(
    (entry: XdgDesktopEntry, actionId?: string) => {
      const action = actionId
        ? entry.actions.find((a) => a.id === actionId)
        : undefined;
      const argv =
        action && action.execArgv.length > 0 ? action.execArgv : entry.execArgv;

      if (argv.length > 0) {
        const finalArgv = entry.terminal ? ["kitty", "-e", ...argv] : argv;
        launchWithGnomeEnv(domicile, finalArgv, {
          cwd: isBrowserRuntime ? undefined : entry.workingDirectory,
        });
      }
    },
    [domicile, isBrowserRuntime]
  );

  const value = React.useMemo<AppsContextValue>(
    () => ({
      installedXdgApps,
      activeIconTheme,
      getAppIconUrl,
      ensureWaylandIcons,
      launchXdgEntry,
    }),
    [
      activeIconTheme,
      ensureWaylandIcons,
      getAppIconUrl,
      installedXdgApps,
      launchXdgEntry,
    ]
  );

  return <AppsContext.Provider value={value}>{children}</AppsContext.Provider>;
}

export function useApps() {
  const ctx = React.useContext(AppsContext);
  if (!ctx) {
    throw new Error("useApps must be used within AppsProvider");
  }
  return ctx;
}

export { resolveXdgVisualStyle };

