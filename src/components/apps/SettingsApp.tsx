import * as React from "react";
import {
  ArrowLeftIcon,
  DockIcon as LucideDockIcon,
  ImageIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  TypeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  useSettings,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import type { GnomeSettingsPanel } from "@/lib/gnome-bridge";
import { cn } from "@/lib/utils";
import { AppearancePane } from "./settings/AppearancePane";
import { DockPane } from "./settings/DockPane";
import { FontsPane } from "./settings/FontsPane";
import { TopBarPane } from "./settings/TopBarPane";
import { WallpaperPane } from "./settings/WallpaperPane";

type SettingsPaneId =
  | "appearance"
  | "fonts"
  | "dock"
  | "topbar"
  | "wallpaper";

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
    subtitle: "Size, position, magnification, widgets",
    icon: <LucideDockIcon />,
  },
  {
    id: "topbar",
    label: "Control Panel",
    subtitle: "Clock, date, seconds, battery",
    icon: <SlidersHorizontalIcon />,
  },
  {
    id: "wallpaper",
    label: "Wallpaper",
    subtitle: "Dynamic meshes & custom backgrounds",
    icon: <ImageIcon />,
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
  const { isBrowserRuntime } = useSettings();
  const { gnomeCapabilities } = useSystemBackends();
  const { openGnomeSettings, closeWindow } = useWindowActions();

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

  const showSidebar = true;
  const showDetail = true;

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

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full overflow-hidden bg-adw-window text-adw-label"
    >
      {/* Left Sidebar (collapses to VS Code-style icon activity bar when < 640px) */}
      {showSidebar && (
        <aside
          className={cn(
            "flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-adw-separator bg-adw-sidebar transition-[width] duration-150",
            isCompact ? "w-[52px]" : "w-[176px]"
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
            {!isCompact && (
              <span className="truncate whitespace-nowrap text-[14px] font-bold tracking-tight text-adw-label">
                Desktop Settings
              </span>
            )}
            <div className="w-7" />
          </WindowTitlebar>
        )}

        <TooltipProvider delay={450}>
          <nav
            ref={sidebarNavRef}
            onKeyDown={onSidebarKeyDown}
            onKeyUp={onSidebarKeyUp}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2",
              isCsd ? "pt-0.5" : "pt-2.5"
            )}
          >
            {PANES.map((pane) => {
              const selected = highlightedPane === pane.id;
              const btn = (
                <button
                  key={pane.id}
                  type="button"
                  aria-label={pane.label}
                  data-sidebar-item={pane.id}
                  onClick={() => {
                    setActivePane(pane.id);
                  }}
                  className={cn(
                    "flex w-full shrink-0 items-center gap-3 rounded-[9px] px-2.5 py-2 text-left text-[14px] font-normal transition-colors outline-none",
                    selected
                      ? "bg-adw-sidebar-selection font-medium text-adw-label"
                      : "text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6"
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center opacity-85 [&_svg]:size-4">
                    {pane.icon}
                  </span>
                  <span
                    className={cn(
                      "truncate transition-opacity duration-150",
                      isCompact ? "opacity-0" : "opacity-100"
                    )}
                  >
                    {pane.label}
                  </span>
                </button>
              );

              if (!isCompact) return btn;
              return (
                <Tooltip key={pane.id}>
                  <TooltipTrigger render={btn} />
                  <TooltipContent
                    side="right"
                    sideOffset={-36}
                    className={cn(
                      "pointer-events-none h-[37px] gap-3 rounded-[9px] border border-adw-separator px-2.5 py-2 text-[14px] shadow-md",
                      selected
                        ? "bg-adw-sidebar-selection font-medium text-adw-label"
                        : "bg-adw-sidebar font-normal text-adw-label"
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center opacity-85 [&_svg]:size-4">
                      {pane.icon}
                    </span>
                    <span className="whitespace-nowrap">{pane.label}</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>
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
            <div className="flex items-center gap-1.5" data-window-no-drag />
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
                    disabled={isBrowserRuntime}
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
                  disabled={isBrowserRuntime}
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
          {activePane === "topbar" && <TopBarPane />}
          {activePane === "wallpaper" && <WallpaperPane />}
        </div>
      </div>
      )}
    </div>
  );
}
