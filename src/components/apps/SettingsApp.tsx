import * as React from "react";
import {
  ArrowLeftIcon,
  BellIcon,
  DockIcon as LucideDockIcon,
  ImageIcon,
  InfoIcon,
  MonitorIcon,
  PaletteIcon,
  TypeIcon,
  Volume2Icon,
  WifiIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import type { GnomeSettingsPanel } from "@/lib/gnome-bridge";
import { cn } from "@/lib/utils";
import { AboutPane } from "./settings/AboutPane";
import { AppearancePane } from "./settings/AppearancePane";
import { DisplaysPane } from "./settings/DisplaysPane";
import { DockPane } from "./settings/DockPane";
import { FontsPane } from "./settings/FontsPane";
import { NetworkPane } from "./settings/NetworkPane";
import { NotificationsPane } from "./settings/NotificationsPane";
import { SoundPane } from "./settings/SoundPane";
import { WallpaperPane } from "./settings/WallpaperPane";

type SettingsPaneId =
  | "appearance"
  | "fonts"
  | "dock"
  | "notifications"
  | "wallpaper"
  | "network"
  | "sound"
  | "displays"
  | "about";

const PANES: {
  id: SettingsPaneId;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "appearance",
    label: "Appearance",
    subtitle: "Theme, accent color, frames",
    icon: <PaletteIcon />,
  },
  {
    id: "fonts",
    label: "Fonts & Rendering",
    subtitle: "Chromium CSS & GTK4 typography",
    icon: <TypeIcon />,
  },
  {
    id: "dock",
    label: "Dock & Menu Bar",
    subtitle: "Size, magnification, clock",
    icon: <LucideDockIcon />,
  },
  {
    id: "notifications",
    label: "Notifications",
    subtitle: "Do Not Disturb, banners, lock screen & history",
    icon: <BellIcon />,
  },
  {
    id: "wallpaper",
    label: "Wallpaper",
    subtitle: "Dynamic meshes & custom backgrounds",
    icon: <ImageIcon />,
  },
  {
    id: "network",
    label: "Wi-Fi & Network",
    subtitle: "Wireless connections & IP status",
    icon: <WifiIcon />,
  },
  {
    id: "sound",
    label: "Sound",
    subtitle: "Volume, output & input devices",
    icon: <Volume2Icon />,
  },
  {
    id: "displays",
    label: "Displays",
    subtitle: "Resolution, virtual cast & Night Light",
    icon: <MonitorIcon />,
  },
  {
    id: "about",
    label: "About Piloti",
    subtitle: "GNOME integration & shortcuts",
    icon: <InfoIcon />,
  },
];

const PANE_TO_GNOME: Partial<Record<SettingsPaneId, GnomeSettingsPanel>> = {
  appearance: "appearance",
  notifications: "notifications",
  wallpaper: "background",
  network: "wifi",
  sound: "sound",
  displays: "display",
  about: "system",
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
  const { isBrowserRuntime } = useSettings();
  const { gnomeCapabilities } = useSystemBackends();
  const { openGnomeSettings, closeWindow } = useWindowManager();

  const [activePane, setActivePane] = React.useState<SettingsPaneId>(() => {
    if (isSettingsPaneId(initialPane)) {
      return initialPane;
    }
    try {
      const saved = localStorage.getItem(SETTINGS_ACTIVE_PANE_KEY);
      if (isSettingsPaneId(saved)) return saved;
    } catch {
      // ignore storage errors
    }
    return "appearance";
  });

  React.useEffect(() => {
    if (isSettingsPaneId(initialPane)) {
      setActivePane(initialPane);
    }
  }, [initialPane]);

  React.useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_ACTIVE_PANE_KEY, activePane);
    } catch {
      // ignore storage errors
    }
  }, [activePane]);

  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isCompact, setIsCompact] = React.useState(false);
  const [compactShowDetail, setCompactShowDetail] = React.useState(
    () => Boolean(initialPane)
  );

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => setIsCompact(el.clientWidth < 640);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (initialPane && isCompact) {
      setCompactShowDetail(true);
    }
  }, [initialPane, isCompact]);

  const showSidebar = !isCompact || !compactShowDetail;
  const showDetail = !isCompact || compactShowDetail;

  const filteredPanes = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PANES;
    return PANES.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q)
    );
  }, [search]);

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
    itemIds: filteredPanes.map((p) => p.id),
    activeId: activePane,
    onActivate: (id) => setActivePane(id),
    sidebarRef: sidebarNavRef,
    contentRef: detailContentRef,
  });

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full overflow-hidden bg-adw-window text-adw-label"
    >
      {/* Left Sidebar (collapses to full-width navigation view when < 640px) */}
      {showSidebar && (
        <aside
          className={cn(
            "flex shrink-0 flex-col bg-adw-sidebar",
            isCompact ? "w-full" : "w-[230px] border-r border-adw-separator"
          )}
        >
        {isCsd && (
          <WindowTitlebar
            data-window-drag-region
            className="border-b-0 bg-transparent"
          >
            <div className="flex items-center gap-1.5" data-window-no-drag>
              {windowId && <WindowControls side="left" />}
              <WindowMenuButton
                windowId={windowId}
                appId="settings"
                iconName="settings"
              />
            </div>
            <span className="text-[14px] font-bold tracking-tight text-adw-label">
              Settings (Web)
            </span>
            <div className="w-7" />
          </WindowTitlebar>
        )}

        <div className={cn("px-3 pb-2", isCsd ? "pt-0.5" : "pt-3")}>
          <SearchField
            placeholder="Search Desktop Settings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <nav
          ref={sidebarNavRef}
          onKeyDown={onSidebarKeyDown}
          onKeyUp={onSidebarKeyUp}
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-1"
        >
          {filteredPanes.map((pane) => {
            const selected = highlightedPane === pane.id;
            return (
              <button
                key={pane.id}
                type="button"
                data-sidebar-item={pane.id}
                onClick={() => {
                  setActivePane(pane.id);
                  if (isCompact) setCompactShowDetail(true);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-[9px] px-3 py-2 text-left text-[14px] font-normal transition-colors outline-none",
                  selected
                    ? "bg-adw-sidebar-selection font-medium text-adw-label"
                    : "text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6"
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center opacity-85 [&_svg]:size-4">
                  {pane.icon}
                </span>
                <span className="truncate">{pane.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="m-2.5 rounded-[10px] bg-black/5 p-2.5 text-[11px] dark:bg-white/5">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span>
              {isBrowserRuntime ? "Browser Dev Mode" : "Domicile Wayland"}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-adw-label-secondary">
            GNOME Adwaita · Tailwind v4
          </div>
        </div>
        </aside>
      )}

      {/* Right Content Area */}
      {showDetail && (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-adw-window">
        {isCsd ? (
          <WindowTitlebar
            data-window-drag-region
            className="rounded-tl-none border-b border-adw-separator bg-adw-titlebar"
          >
            <div className="flex items-center gap-1.5" data-window-no-drag>
              {windowId && <WindowMenuButton windowId={windowId} />}
              {isCompact && (
                <button
                  type="button"
                  aria-label="Back to settings sidebar"
                  onClick={() => setCompactShowDetail(false)}
                  className="flex size-6 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-28 flex items-center justify-center">
              <h2 className="truncate text-[13px] font-semibold text-adw-label">
                {currentPaneMeta?.label}
              </h2>
            </div>
            <div className="flex items-center gap-2" data-window-no-drag>
              {matchingGnomePanel &&
                (gnomeCapabilities.gnomeControlCenter || isBrowserRuntime) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openGnomeSettings(matchingGnomePanel)}
                    className="h-6 text-[11px]"
                  >
                    System Settings…
                  </Button>
                )}
              {windowId && <WindowControls side="right" />}
            </div>
          </WindowTitlebar>
        ) : (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-adw-separator bg-adw-window px-6 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {isCompact && (
                <button
                  type="button"
                  aria-label="Back to settings sidebar"
                  onClick={() => setCompactShowDetail(false)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black/8 text-adw-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-bold tracking-tight">
                  {currentPaneMeta?.label}
                </h2>
                <p className="truncate text-[11.5px] text-adw-label-secondary">
                  {currentPaneMeta?.subtitle}
                </p>
              </div>
            </div>
            {matchingGnomePanel &&
              (gnomeCapabilities.gnomeControlCenter || isBrowserRuntime) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openGnomeSettings(matchingGnomePanel)}
                  className="text-[11px]"
                >
                  Open in System Settings…
                </Button>
              )}
          </div>
        )}

        <div
          ref={detailContentRef}
          onKeyDown={onContentKeyDown}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {activePane === "appearance" && <AppearancePane />}
          {activePane === "fonts" && <FontsPane />}
          {activePane === "dock" && <DockPane />}
          {activePane === "notifications" && <NotificationsPane />}
          {activePane === "wallpaper" && <WallpaperPane />}
          {activePane === "network" && <NetworkPane />}
          {activePane === "sound" && <SoundPane />}
          {activePane === "displays" && <DisplaysPane />}
          {activePane === "about" && <AboutPane />}
        </div>
      </div>
      )}
    </div>
  );
}
