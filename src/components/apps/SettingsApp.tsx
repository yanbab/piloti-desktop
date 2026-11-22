import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  BellIcon,
  DockIcon as LucideDockIcon,
  ImageIcon,
  MonitorIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  TypeIcon,
  WrenchIcon,
} from "lucide-react";
import { AdwSplitView, type AdwSplitSidebarItem } from "@/components/ui/adw-split-view";
import { Button } from "@/components/ui/button";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  useSettings,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import type { GnomeSettingsPanel } from "@/lib/engine-native";
import { _ } from "@/lib/core/i18n";
import {
  getCachedPilotiAppIni,
  getPilotiAppIniVfsPath,
  parseIniText,
  readPilotiAppIni,
  writePilotiAppIni,
} from "@/lib/config/piloti-ini";
import {
  readVfsStateText,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateText,
} from "@/lib/engine/vfs-state";
import { cn } from "@/lib/core/utils";
import { AdvancedPane } from "./settings/AdvancedPane";
import { AppearancePane } from "./settings/AppearancePane";
import { DisplaysPane } from "./settings/DisplaysPane";
import { DockPane } from "./settings/DockPane";
import { FontsPane } from "./settings/FontsPane";
import { NotificationsPane } from "./settings/NotificationsPane";
import { TopBarPane } from "./settings/TopBarPane";
import { WallpaperPane } from "./settings/WallpaperPane";

type SettingsPaneId =
  | "appearance"
  | "fonts"
  | "dock"
  | "topbar"
  | "displays"
  | "notifications"
  | "wallpaper"
  | "advanced";

const PANES: {
  id: SettingsPaneId;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "appearance",
    label: "Appearance",
    subtitle: "Theme, accent color, desktop",
    icon: <PaletteIcon />,
  },
  {
    id: "fonts",
    label: "Fonts",
    subtitle: "Typeface, size, style & rendering",
    icon: <TypeIcon />,
  },
  {
    id: "dock",
    label: "Dock",
    subtitle: "Size, position, zoom",
    icon: <LucideDockIcon />,
  },
  {
    id: "topbar",
    label: "Control Panel",
    subtitle: "Clock, date, seconds, battery",
    icon: <SlidersHorizontalIcon />,
  },
  {
    id: "displays",
    label: "Displays",
    subtitle: "Monitors, virtual cast & workspaces",
    icon: <MonitorIcon />,
  },
  {
    id: "notifications",
    label: "Notifications",
    subtitle: "Banners, previews & history",
    icon: <BellIcon />,
  },
  {
    id: "wallpaper",
    label: "Wallpaper",
    subtitle: "Dynamic meshes & custom backgrounds",
    icon: <ImageIcon />,
  },
  {
    id: "advanced",
    label: "System",
    subtitle: "Language, extensions, plugins & testing",
    icon: <WrenchIcon />,
  },
];

const PANE_TO_GNOME: Partial<Record<SettingsPaneId, GnomeSettingsPanel>> = {
  appearance: "appearance",
  wallpaper: "background",
};

const SETTINGS_ACTIVE_PANE_KEY = "piloti.settings.activePane.v1";

function isSettingsPaneId(
  value: string | null | undefined
): value is SettingsPaneId {
  return Boolean(value && PANES.some((p) => p.id === value));
}

export function SettingsApp({
  initialPane,
  isCsd = false,
  windowId,
}: {
  initialPane?: string;
  isCsd?: boolean;
  windowId?: string;
}) {
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const { gnomeCapabilities } = useSystemBackends();
  const { openGnomeSettings } = useWindowActions();

  const [activePane, setActivePane] = React.useState<SettingsPaneId>(() => {
    if (isSettingsPaneId(initialPane)) {
      return initialPane;
    }
    const iniPane = getCachedPilotiAppIni("settings").General?.lastPane;
    if (isSettingsPaneId(iniPane)) return iniPane;
    try {
      const saved = readVfsStateText(
        VFS_STATE_PATHS.settingsPane,
        SETTINGS_ACTIVE_PANE_KEY
      )?.trim();
      if (isSettingsPaneId(saved)) return saved;
    } catch {
      // ignore storage errors
    }
    return "appearance";
  });

  React.useEffect(() => {
    if (isSettingsPaneId(initialPane)) {
      setActivePane(initialPane);
      return;
    }
    let cancelled = false;
    readPilotiAppIni(domicile, "settings").then((ini) => {
      if (cancelled) return;
      const pane = ini.General?.lastPane;
      if (isSettingsPaneId(pane)) {
        setActivePane(pane);
      }
    });
    const unsubIni = subscribeVfsPath(
      getPilotiAppIniVfsPath("settings"),
      (raw) => {
        if (!raw) return;
        const pane = parseIniText(raw).General?.lastPane;
        if (isSettingsPaneId(pane)) {
          setActivePane(pane);
        }
      }
    );
    const unsubPane = subscribeVfsPath(VFS_STATE_PATHS.settingsPane, (raw) => {
      const pane = raw?.trim();
      if (isSettingsPaneId(pane)) {
        setActivePane(pane);
      }
    });
    return () => {
      cancelled = true;
      unsubIni();
      unsubPane();
    };
  }, [domicile, initialPane]);

  React.useEffect(() => {
    try {
      writeVfsStateText(VFS_STATE_PATHS.settingsPane, `${activePane}\n`);
    } catch {
      // ignore storage errors
    }
    void writePilotiAppIni(domicile, "settings", "General", {
      lastPane: activePane,
    });
  }, [activePane, domicile]);

  const matchingGnomePanel = PANE_TO_GNOME[activePane];
  const currentPaneMeta = PANES.find((p) => p.id === activePane);
  const sidebarNavRef = React.useRef<HTMLElement | null>(null);
  const detailContentRef = React.useRef<HTMLDivElement | null>(null);
  const {
    highlightedId: highlightedPane,
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: PANES.map((p) => p.id),
    activeId: activePane,
    onActivate: (id) => setActivePane(id),
    sidebarRef: sidebarNavRef,
    contentRef: detailContentRef,
  });

  const sidebarItems: AdwSplitSidebarItem[] = PANES.map((pane) => ({
    id: pane.id,
    label: _(pane.label),
    icon: pane.icon,
    selected: highlightedPane === pane.id,
    onClick: () => setActivePane(pane.id),
  }));

  return (
    <AdwSplitView
      title={_("Settings")}
      appId="settings"
      iconName="settings"
      windowId={windowId}
      isCsd={isCsd}
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-[176px]"
      sidebarDensity="tall"
      sidebarRef={sidebarNavRef}
      onSidebarKeyDown={onSidebarKeyDown}
      onSidebarKeyUp={onSidebarKeyUp}
      contentClassName="bg-adw-window"
      header={({ contentScrolled }) =>
        isCsd ? (
          <WindowTitlebar
            data-window-drag-region
            className={cn(
              "rounded-tl-none bg-adw-titlebar transition-colors",
              contentScrolled
                ? "border-b border-adw-separator"
                : "border-b border-transparent",
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5" data-window-no-drag>
              <h2 className="truncate px-2 text-[13.5px] font-medium text-adw-label">
                {currentPaneMeta ? _(currentPaneMeta.label) : ""}
              </h2>
            </div>
            <div className="flex items-center gap-2" data-window-no-drag>
              {matchingGnomePanel &&
                !isBrowserRuntime &&
                gnomeCapabilities.gnomeControlCenter && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openGnomeSettings(matchingGnomePanel)}
                    className="h-6 text-[11px]"
                  >
                    {_("System Settings…")}
                  </Button>
                )}
              {windowId && <WindowControls side="right" />}
            </div>
          </WindowTitlebar>
        ) : (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-adw-separator bg-adw-window px-6 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-bold tracking-tight">
                  {currentPaneMeta ? _(currentPaneMeta.label) : ""}
                </h2>
                <p className="truncate text-[11.5px] text-adw-label-secondary">
                  {currentPaneMeta ? _(currentPaneMeta.subtitle) : ""}
                </p>
              </div>
            </div>
            {matchingGnomePanel &&
              !isBrowserRuntime &&
              gnomeCapabilities.gnomeControlCenter && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openGnomeSettings(matchingGnomePanel)}
                  className="text-[11px]"
                >
                  {_("Open in System Settings…")}
                </Button>
              )}
          </div>
        )
      }
    >
      {({ onContentScroll }) => (
        <div
          ref={detailContentRef}
          onKeyDown={onContentKeyDown}
          onScroll={onContentScroll}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {activePane === "appearance" && <AppearancePane />}
          {activePane === "fonts" && <FontsPane />}
          {activePane === "dock" && <DockPane />}
          {activePane === "topbar" && <TopBarPane />}
          {activePane === "displays" && <DisplaysPane />}
          {activePane === "notifications" && <NotificationsPane />}
          {activePane === "wallpaper" && <WallpaperPane />}
          {activePane === "advanced" && <AdvancedPane />}
        </div>
      )}
    </AdwSplitView>
  );
}
