import * as React from "react";
import {
  DockIcon as LucideDockIcon,
  ImageIcon,
  InfoIcon,
  MonitorIcon,
  PaletteIcon,
  Volume2Icon,
  WifiIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { SearchField } from "@/components/ui/search-field";
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
import { NetworkPane } from "./settings/NetworkPane";
import { SoundPane } from "./settings/SoundPane";
import { WallpaperPane } from "./settings/WallpaperPane";

type SettingsPaneId =
  | "appearance"
  | "dock"
  | "wallpaper"
  | "network"
  | "sound"
  | "displays"
  | "about";

const PANES: {
  id: SettingsPaneId;
  label: string;
  subtitle: string;
  color: "blue" | "purple" | "pink" | "orange" | "teal" | "red";
  icon: React.ReactNode;
}[] = [
  {
    id: "appearance",
    label: "Appearance",
    subtitle: "Theme, accent color, vibrancy",
    color: "purple",
    icon: <PaletteIcon />,
  },
  {
    id: "dock",
    label: "Dock & Menu Bar",
    subtitle: "Size, magnification, clock",
    color: "blue",
    icon: <LucideDockIcon />,
  },
  {
    id: "wallpaper",
    label: "Wallpaper",
    subtitle: "Dynamic meshes & custom backgrounds",
    color: "pink",
    icon: <ImageIcon />,
  },
  {
    id: "network",
    label: "Wi-Fi & Network",
    subtitle: "Wireless connections & IP status",
    color: "blue",
    icon: <WifiIcon />,
  },
  {
    id: "sound",
    label: "Sound",
    subtitle: "Volume, output & input devices",
    color: "red",
    icon: <Volume2Icon />,
  },
  {
    id: "displays",
    label: "Displays",
    subtitle: "Resolution, virtual cast & Night Light",
    color: "orange",
    icon: <MonitorIcon />,
  },
  {
    id: "about",
    label: "About Piloti",
    subtitle: "GNOME integration & shortcuts",
    color: "teal",
    icon: <InfoIcon />,
  },
];

const PANE_TO_GNOME: Partial<Record<SettingsPaneId, GnomeSettingsPanel>> = {
  appearance: "appearance",
  wallpaper: "background",
  network: "wifi",
  sound: "sound",
  displays: "display",
  about: "system",
};

export function SettingsApp({
  initialPane,
  isCsd = false,
  windowId,
}: {
  initialPane?: string;
  isCsd?: boolean;
  windowId?: string;
}) {
  const { isBrowserRuntime, settings } = useSettings();
  const { gnomeCapabilities } = useSystemBackends();
  const { openGnomeSettings, closeWindow } = useWindowManager();
  const isAdwaita = settings.uiTheme === "adwaita";

  const [activePane, setActivePane] = React.useState<SettingsPaneId>(() => {
    if (
      initialPane &&
      PANES.some((p) => p.id === (initialPane as SettingsPaneId))
    ) {
      return initialPane as SettingsPaneId;
    }
    return "appearance";
  });

  React.useEffect(() => {
    if (
      initialPane &&
      PANES.some((p) => p.id === (initialPane as SettingsPaneId))
    ) {
      setActivePane(initialPane as SettingsPaneId);
    }
  }, [initialPane]);

  const [search, setSearch] = React.useState("");

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

  return (
    <div className="flex h-full w-full overflow-hidden bg-mac-window text-mac-label">
      {/* Left Sidebar */}
      <aside className="flex w-[230px] shrink-0 flex-col border-r border-mac-separator bg-mac-sidebar">
        {isCsd && (
          <div
            data-window-drag-region
            className="relative flex h-[46px] shrink-0 items-center justify-center px-3.5 select-none"
          >
            <span className="text-[14px] font-bold tracking-tight text-mac-label">
              Settings
            </span>
          </div>
        )}

        <div className={cn("px-3 pb-2", isCsd ? "pt-0.5" : "pt-3")}>
          <SearchField
            placeholder="Search Settings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-1">
          {filteredPanes.map((pane) => {
            const selected = activePane === pane.id;
            return (
              <button
                key={pane.id}
                type="button"
                onClick={() => setActivePane(pane.id)}
                className={cn(
                  "flex items-center gap-3 text-left transition-colors outline-none",
                  isAdwaita
                    ? cn(
                        "rounded-[9px] px-3 py-2 text-[14px] font-normal",
                        selected
                          ? "bg-mac-sidebar-selection font-medium text-mac-label"
                          : "text-mac-label/85 hover:bg-black/5 dark:hover:bg-white/6"
                      )
                    : cn(
                        "rounded-[8px] px-2.5 py-1.5 text-[13px] font-medium",
                        selected
                          ? "bg-mac-accent text-white shadow-xs"
                          : "text-mac-label hover:bg-black/6 dark:hover:bg-white/8"
                      )
                )}
              >
                {isAdwaita ? (
                  <span className="flex size-4 shrink-0 items-center justify-center opacity-85 [&_svg]:size-4">
                    {pane.icon}
                  </span>
                ) : (
                  <IconTile
                    color={pane.color}
                    className="size-6 shrink-0 rounded-[6px] [&_svg]:size-3.5"
                  >
                    {pane.icon}
                  </IconTile>
                )}
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
          <div className="mt-0.5 text-[10px] text-mac-label-secondary">
            {isAdwaita
              ? "GNOME Adwaita · Tailwind v4"
              : "CupertinoUI · Tailwind v4"}
          </div>
        </div>
      </aside>

      {/* Right Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-mac-window">
        {isCsd ? (
          <div
            data-window-drag-region
            className="relative flex h-[46px] shrink-0 items-center justify-end gap-2 px-3.5 select-none"
          >
            <div className="pointer-events-none absolute inset-x-28 flex items-center justify-center">
              <h2 className="truncate text-[14px] font-bold text-mac-label">
                {currentPaneMeta?.label}
              </h2>
            </div>
            {matchingGnomePanel &&
              (gnomeCapabilities.gnomeControlCenter || isBrowserRuntime) && (
                <Button
                  size="sm"
                  variant="secondary"
                  data-window-no-drag
                  onClick={() => openGnomeSettings(matchingGnomePanel)}
                  className="h-7 text-[11px]"
                >
                  GNOME Settings…
                </Button>
              )}
            {windowId && (
              <div className="flex items-center gap-2" data-window-no-drag>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => closeWindow(windowId)}
                  className="flex size-6 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
                >
                  <XIcon className="size-3.5" strokeWidth={2.25} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-mac-separator bg-mac-window px-6 py-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">
                {currentPaneMeta?.label}
              </h2>
              <p className="text-[11.5px] text-mac-label-secondary">
                {currentPaneMeta?.subtitle}
              </p>
            </div>
            {matchingGnomePanel &&
              (gnomeCapabilities.gnomeControlCenter || isBrowserRuntime) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openGnomeSettings(matchingGnomePanel)}
                  className="text-[11px]"
                >
                  Open in GNOME Settings…
                </Button>
              )}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {activePane === "appearance" && <AppearancePane />}
          {activePane === "dock" && <DockPane />}
          {activePane === "wallpaper" && <WallpaperPane />}
          {activePane === "network" && <NetworkPane />}
          {activePane === "sound" && <SoundPane />}
          {activePane === "displays" && <DisplaysPane />}
          {activePane === "about" && <AboutPane />}
        </div>
      </div>
    </div>
  );
}
