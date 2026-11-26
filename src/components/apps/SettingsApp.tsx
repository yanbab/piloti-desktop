import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePiloti } from "@/lib/engine/piloti";
import {
  BellIcon,
  DockIcon as LucideDockIcon,
  ImageIcon,
  KeyboardIcon,
  MonitorIcon,
  PaletteIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TypeIcon,
  WrenchIcon,
} from "lucide-react";
import { HeaderBar, HeaderHeading } from "@/components/elements/header-bar";
import { AppSplitView, type SidebarItem } from "@/components/elements/split-view";
import { Button } from "@/components/ui/button";
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
  parseVfsStateString,
  readVfsStateString,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateString,
} from "@/lib/engine/vfs-state";
import { cn } from "@/lib/core/utils";
import { AdvancedPane } from "./settings/AdvancedPane";
import { AppearancePane } from "./settings/AppearancePane";
import { DisplaysPane } from "./settings/DisplaysPane";
import { DockPane } from "./settings/DockPane";
import { FontsPane } from "./settings/FontsPane";
import { KeyboardPane } from "./settings/KeyboardPane";
import { NotificationsPane } from "./settings/NotificationsPane";
import { SecurityPane } from "./settings/SecurityPane";
import { TopBarPane } from "./settings/TopBarPane";
import { WallpaperPane } from "./settings/WallpaperPane";

type SettingsPaneId =
  | "appearance"
  | "fonts"
  | "dock"
  | "topbar"
  | "displays"
  | "notifications"
  | "keyboard"
  | "security"
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
    id: "keyboard",
    label: "Keyboard",
    subtitle: "Language & shortcut keys",
    icon: <KeyboardIcon />,
  },
  {
    id: "notifications",
    label: "Notifications",
    subtitle: "Banners, previews & history",
    icon: <BellIcon />,
  },
  {
    id: "security",
    label: "Permissions",
    subtitle: "Flatpak permissions, notifications & search",
    icon: <ShieldCheckIcon />,
  },
  {
    id: "wallpaper",
    label: "Wallpaper",
    subtitle: "Dynamic meshes & custom backgrounds",
    icon: <ImageIcon />,
  },
  {
    id: "advanced",
    label: "Advanced",
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
}: {
  initialPane?: string;
}) {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
  const { gnomeCapabilities } = useSystemBackends();
  const { openGnomeSettings } = useWindowActions();

  const [activePane, setActivePane] = React.useState<SettingsPaneId>(() => {
    if (isSettingsPaneId(initialPane)) {
      return initialPane;
    }
    const iniPane = getCachedPilotiAppIni("settings").General?.lastPane;
    if (isSettingsPaneId(iniPane)) return iniPane;
    try {
      const saved = readVfsStateString(
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
    readPilotiAppIni(piloti, "settings").then((ini) => {
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
      const pane = parseVfsStateString(raw);
      if (isSettingsPaneId(pane)) {
        setActivePane(pane);
      }
    });
    return () => {
      cancelled = true;
      unsubIni();
      unsubPane();
    };
  }, [piloti, initialPane]);

  React.useEffect(() => {
    try {
      writeVfsStateString(VFS_STATE_PATHS.settingsPane, activePane);
    } catch {
      // ignore storage errors
    }
    void writePilotiAppIni(piloti, "settings", "General", {
      lastPane: activePane,
    });
  }, [activePane, piloti]);

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

  const sidebarItems: SidebarItem[] = PANES.map((pane) => ({
    id: pane.id,
    label: _(pane.label),
    icon: pane.icon,
    selected: highlightedPane === pane.id,
    onClick: () => setActivePane(pane.id),
  }));

  return (
    <AppSplitView
      title={_("Settings")}
      iconName="settings"
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-[176px]"
      sidebarId="settings-sidebar"
      sidebarDensity="tall"
      sidebarRef={sidebarNavRef}
      onSidebarKeyDown={onSidebarKeyDown}
      onSidebarKeyUp={onSidebarKeyUp}
      contentClassName="bg-shell-window"
      header={({ contentScrolled }) => (
        <HeaderBar
          className={cn(
            "transition-colors",
            contentScrolled ? "border-shell-separator" : "border-transparent",
          )}
        >
          <HeaderBar.Start>
            <HeaderHeading>{currentPaneMeta ? _(currentPaneMeta.label) : ""}</HeaderHeading>
          </HeaderBar.Start>
          <HeaderBar.End className="min-w-0 shrink">
            {/* Panes add their controls here with HeaderBar.Portal. */}
            <HeaderBar.Outlet />
            {matchingGnomePanel &&
              systemServices &&
              gnomeCapabilities.gnomeControlCenter && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openGnomeSettings(matchingGnomePanel)}
                  className="h-6 text-shell-subheadline"
                >
                  {_("System Settings…")}
                </Button>
              )}
          </HeaderBar.End>
        </HeaderBar>
      )}
    >
      {({ onContentScroll }) => (
        <div
          ref={detailContentRef}
          onKeyDown={onContentKeyDown}
          onScroll={onContentScroll}
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            activePane === "wallpaper" || activePane === "displays"
              ? "overflow-hidden"
              : "overflow-y-auto",
          )}
        >
          {activePane === "appearance" && <AppearancePane />}
          {activePane === "fonts" && <FontsPane />}
          {activePane === "dock" && <DockPane />}
          {activePane === "topbar" && <TopBarPane />}
          {activePane === "displays" && <DisplaysPane />}
          {activePane === "keyboard" && <KeyboardPane />}
          {activePane === "notifications" && <NotificationsPane />}
          {activePane === "security" && <SecurityPane />}
          {activePane === "wallpaper" && <WallpaperPane />}
          {activePane === "advanced" && <AdvancedPane />}
        </div>
      )}
    </AppSplitView>
  );
}
