import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DesktopStateProvider,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
const AltTabSwitcher = React.lazy(() =>
  import("./AltTabSwitcher").then((m) => ({
    default: m.AltTabSwitcher,
  }))
);
const AboutComputerDialog = React.lazy(() =>
  import("./AboutComputerDialog").then((m) => ({
    default: m.AboutComputerDialog,
  }))
);
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";
import { Dock } from "./Dock";
const LockScreen = React.lazy(() =>
  import("./LockScreen").then((m) => ({
    default: m.LockScreen,
  }))
);
import { MenuBar } from "./MenuBar";
import { NotificationToasts } from "./NotificationToasts";
import { OsdOverlay } from "./OsdOverlay";
const Overview = React.lazy(() =>
  import("./Overview").then((m) => ({
    default: m.Overview,
  }))
);
import { PortalDialogs } from "./PortalDialogs";
const PowerActionDialog = React.lazy(() =>
  import("./PowerActionDialog").then((m) => ({
    default: m.PowerActionDialog,
  }))
);
import { WindowManager } from "./WindowManager";
import { installConsoleCapture } from "@/lib/console-store";
import { _ } from "@/lib/i18n";
import { bootElapsedMs, logBootEvent } from "@/lib/perf-log";

installConsoleCapture();
logBootEvent("starting shell");

function DesktopSurface() {
  const { isBrowserRuntime, settings, updateSettings } = useSettings();

  React.useEffect(() => {
    logBootEvent(`finish load shell in ${bootElapsedMs()}ms`);
  }, []);
  const {
    locked,
    lockSession,
    idleWarningMs,
    pendingPowerAction,
    takeScreenshot,
  } = useSystemBackends();
  const {
    aboutOpen,
    altTabOpen,
    overviewOpen,
    launchApp,
    openGnomeSettings,
    setLauncherOpen,
    openAltTab,
    toggleOverview,
  } = useWindowManager();

  const brightnessFilter =
    settings.brightness < 100
      ? `brightness(${0.45 + (settings.brightness / 100) * 0.55})`
      : undefined;

  return (
    <div
      style={{
        filter: brightnessFilter,
      }}
      className="relative flex h-screen w-screen flex-col overflow-hidden select-none"
    >
      {/* GNOME Spec / Curated Background Layers */}
      <DesktopBackgroundLayers />

      {/* Subtle Night Light Warmth Filter in Browser Dev Mode (Domicile uses hardware LUT on Linux) */}
      {settings.nightLight && isBrowserRuntime && (
        <div className="pointer-events-none fixed inset-0 z-[45] bg-amber-500/12 mix-blend-multiply" />
      )}

      {/* Idle Blank Warning Toast */}
      {idleWarningMs !== undefined && (
        <div className="pointer-events-none fixed top-11 left-1/2 z-[460] -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md">
          Screen will dim in {Math.max(1, Math.ceil(idleWarningMs / 1000))}s due to inactivity
        </div>
      )}

      {/* Top Menu Bar */}
      <MenuBar />

      {/* Desktop Canvas + Right-Click Context Menu + Floating Windows */}
      <ContextMenu>
        <ContextMenuTrigger className="flex min-h-0 flex-1 flex-col">
          <WindowManager />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-max min-w-60">
          <ContextMenuItem onClick={() => setLauncherOpen(true)}>
            {_("Launcher")}
            <ContextMenuShortcut>Alt+Space</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openAltTab()}>
            {_("Switch Windows")}
            <ContextMenuShortcut>Alt+Tab</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => toggleOverview()}>
            {_("Overview")}
            <ContextMenuShortcut>Meta+↑</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void takeScreenshot()}>
            {_("Take Screenshot")}
            <ContextMenuShortcut>Print</ContextMenuShortcut>
          </ContextMenuItem>
          {!isBrowserRuntime && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => launchApp("terminal", { forceNew: true })}>
                {_("Launch Terminal")}
                <ContextMenuShortcut>Meta+↵</ContextMenuShortcut>
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          {settings.desktopIconsEnabled && (
            <>
              <ContextMenuItem
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("piloti:desktop-new-folder")
                  )
                }
              >
                {_("New Folder")}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("piloti:desktop-new-file")
                  )
                }
              >
                {_("New Text File")}
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem
            onClick={() =>
              updateSettings({
                desktopIconsEnabled: !settings.desktopIconsEnabled,
              })
            }
          >
            {settings.desktopIconsEnabled
              ? _("Hide Desktop Icons")
              : _("Show Desktop Icons")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => launchApp("settings", { payload: "wallpaper" })}
          >
            {_("Change Wallpaper")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => launchApp("settings", { payload: "appearance" })}
          >
            {_("Desktop Settings")}
            <ContextMenuShortcut>Alt+,</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openGnomeSettings()}>
            {_("System Settings")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => lockSession()}>
            {_("Lock Screen")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Bottom Dock */}
      <Dock />

      {/* Volume & Brightness OSD Pill */}
      <OsdOverlay />

      {/* Alt+Tab Switcher */}
      {altTabOpen && (
        <React.Suspense fallback={null}>
          <AltTabSwitcher />
        </React.Suspense>
      )}

      {/* Overview (Workspaces & Window Spread) */}
      {overviewOpen && (
        <React.Suspense fallback={null}>
          <Overview />
        </React.Suspense>
      )}

      {/* XDG Desktop Portal Dialogs (Screenshot, ScreenCast, Access, PickColor) */}
      <PortalDialogs />

      {/* About Computer Dialog */}
      {aboutOpen && (
        <React.Suspense fallback={null}>
          <AboutComputerDialog />
        </React.Suspense>
      )}

      {/* Session & Power Confirmation Dialog */}
      {pendingPowerAction !== null && (
        <React.Suspense fallback={null}>
          <PowerActionDialog />
        </React.Suspense>
      )}

      {/* PAM / Compositor Lock Screen */}
      {locked && (
        <React.Suspense fallback={null}>
          <LockScreen />
        </React.Suspense>
      )}

      {/* Notification Toast Banners */}
      <NotificationToasts />
    </div>
  );
}

export function Desktop() {
  return (
    <DesktopStateProvider>
      <DesktopSurface />
    </DesktopStateProvider>
  );
}

