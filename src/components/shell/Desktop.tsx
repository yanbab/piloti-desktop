import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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
const PortalDialogs = React.lazy(() =>
  import("./PortalDialogs").then((m) => ({
    default: m.PortalDialogs,
  }))
);
const PowerActionDialog = React.lazy(() =>
  import("./PowerActionDialog").then((m) => ({
    default: m.PowerActionDialog,
  }))
);
import { WindowManager } from "./WindowManager";
import { installConsoleCapture } from "@/lib/console-store";
import { _ } from "@/lib/i18n";
import { bootElapsedMs, logBootEvent } from "@/lib/perf-log";
import {
  copyVfsEntry,
  getVfsClipboard,
  moveVfsEntry,
  setVfsClipboard,
  subscribeVfsClipboard,
  WEB_VFS_HOME,
} from "@/lib/web-vfs";

installConsoleCapture();
logBootEvent("starting shell");

function DesktopSurface() {
  const { isBrowserRuntime, settings, updateSettings } = useSettings();

  React.useEffect(() => {
    logBootEvent(`finish load shell in ${bootElapsedMs()}ms`);
  }, []);
  const {
    locked,
    idleWarningMs,
    pendingPowerAction,
  } = useSystemBackends();
  const {
    aboutOpen,
    altTabOpen,
    overviewOpen,
    launchApp,
  } = useWindowManager();

  const [clipboard, setLocalClipboard] = React.useState(() =>
    getVfsClipboard()
  );
  React.useEffect(() => {
    return subscribeVfsClipboard(() => {
      setLocalClipboard(getVfsClipboard());
    });
  }, []);

  const handlePasteToDesktop = () => {
    const clip = getVfsClipboard();
    if (!clip || clip.paths.length === 0 || !isBrowserRuntime) return;
    const desktopDir = `${WEB_VFS_HOME}/Desktop`;
    for (const srcPath of clip.paths) {
      if (clip.mode === "cut") {
        moveVfsEntry(srcPath, desktopDir);
      } else {
        copyVfsEntry(srcPath, desktopDir);
      }
    }
    if (clip.mode === "cut") {
      setVfsClipboard(null);
    }
  };

  const brightnessFilter =
    settings.brightness < 100
      ? `brightness(${0.45 + (settings.brightness / 100) * 0.55})`
      : undefined;

  const [overviewMounted, setOverviewMounted] = React.useState(overviewOpen);
  React.useEffect(() => {
    if (overviewOpen) {
      setOverviewMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setOverviewMounted(false), 360);
    return () => window.clearTimeout(timer);
  }, [overviewOpen]);

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
          {isBrowserRuntime && clipboard && clipboard.paths.length > 0 && (
            <ContextMenuItem onClick={handlePasteToDesktop}>
              {_("Paste")}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => updateSettings({ desktopIconPositions: {} })}
          >
            {_("Align Icons")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              const nextAlign =
                (settings.desktopIconAlign ?? "left") === "right"
                  ? "left"
                  : "right";
              updateSettings({
                desktopIconAlign: nextAlign,
                desktopIconPositions: {},
              });
            }}
          >
            {(settings.desktopIconAlign ?? "left") === "right"
              ? _("Align Icons Left")
              : _("Align Icons Right")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => launchApp("settings", { payload: "wallpaper" })}
          >
            {_("Change Wallpaper")}
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
      {overviewMounted && (
        <React.Suspense fallback={null}>
          <Overview />
        </React.Suspense>
      )}

      {/* XDG Desktop Portal Dialogs (Screenshot, ScreenCast, Access, PickColor) */}
      <React.Suspense fallback={null}>
        <PortalDialogs />
      </React.Suspense>

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
      <ShellFocusAndContextGuard />
    </div>
  );
}

function ShellFocusAndContextGuard() {
  const { launcherOpen, controlPanelOpen } = useWindowManager();
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const wasPopoverOpenRef = React.useRef(false);

  React.useEffect(() => {
    const isPopoverOpen = launcherOpen || controlPanelOpen;
    if (isPopoverOpen && !wasPopoverOpenRef.current) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) {
        previousFocusRef.current = active;
      }
    } else if (!isPopoverOpen && wasPopoverOpenRef.current) {
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && prev.isConnected) {
        requestAnimationFrame(() => {
          if (prev.isConnected) {
            prev.focus({ preventScroll: true });
          }
        });
      }
    }
    wasPopoverOpenRef.current = isPopoverOpen;
  }, [launcherOpen, controlPanelOpen]);

  React.useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName;
      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return null;
}

export function Desktop() {
  return (
    <DesktopStateProvider>
      <DesktopSurface />
    </DesktopStateProvider>
  );
}

