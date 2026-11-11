import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DesktopStateProvider,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { AltTabSwitcher } from "./AltTabSwitcher";
import { CommandPalette } from "./CommandPalette";
import { ControlCenterPanel } from "./ControlCenterPanel";
import { DesktopDock } from "./DesktopDock";
import { LockScreen } from "./LockScreen";
import { PilotiLogo } from "./PilotiLogo";
import { PortalDialogs } from "./PortalDialogs";
import { TopMenuBar } from "./TopMenuBar";
import { WindowManager } from "./WindowManager";

function DesktopSurface() {
  const { isBrowserRuntime, settings, activeWallpaper } = useSettings();
  const {
    lockSession,
    idleWarningMs,
    takeScreenshot,
    pendingPowerAction,
    cancelPowerAction,
    confirmPowerAction,
  } = useSystemBackends();
  const {
    launchApp,
    openGnomeSettings,
    setCommandPaletteOpen,
    openAltTab,
    aboutOpen,
    setAboutOpen,
    openUrlOpen,
    setOpenUrlOpen,
    openWebUrl,
  } = useWindowManager();

  const [urlInput, setUrlInput] = React.useState("");

  React.useEffect(() => {
    if (openUrlOpen) {
      setUrlInput("");
    }
  }, [openUrlOpen]);

  const brightnessFilter =
    settings.brightness < 100
      ? `brightness(${0.45 + (settings.brightness / 100) * 0.55})`
      : undefined;

  return (
    <div
      style={{
        background: settings.customWallpaperUrl
          ? `url(${settings.customWallpaperUrl}) center/cover no-repeat`
          : activeWallpaper.backgroundCss,
        filter: brightnessFilter,
      }}
      className="relative flex h-screen w-screen flex-col overflow-hidden select-none"
    >
      {/* Dynamic Wallpaper Accent Glow */}
      {!settings.customWallpaperUrl && activeWallpaper.overlayCss && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: activeWallpaper.overlayCss }}
        />
      )}

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

      {/* Top Menubar */}
      <TopMenuBar />

      {/* Desktop Canvas + Right-Click Context Menu + Floating Windows */}
      <ContextMenu>
        <ContextMenuTrigger className="flex min-h-0 flex-1 flex-col">
          <WindowManager />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-60">
          <ContextMenuItem onClick={() => setCommandPaletteOpen(true)}>
            Command Palette…
            <ContextMenuShortcut>Alt+Space</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openAltTab()}>
            Switch Windows
            <ContextMenuShortcut>Alt+Tab</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void takeScreenshot()}>
            Take Screenshot…
            <ContextMenuShortcut>Print</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => launchApp("terminal", { forceNew: true })}>
            Launch Terminal
            <ContextMenuShortcut>Meta+↵</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => launchApp("nautilus", { forceNew: true })}>
            Open Files (Nautilus)
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => launchApp("settings", { payload: "wallpaper" })}
          >
            Change Wallpaper…
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => launchApp("settings", { payload: "appearance" })}
          >
            System Settings…
            <ContextMenuShortcut>Alt+,</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openGnomeSettings()}>
            GNOME Settings…
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => lockSession()}>
            Lock Screen
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Bottom Dock */}
      <DesktopDock />

      {/* Right-Side Notifications & Quick Settings Panel */}
      <ControlCenterPanel />

      {/* Alt+Space Command Palette */}
      <CommandPalette />

      {/* Alt+Tab Switcher */}
      <AltTabSwitcher />

      {/* XDG Desktop Portal Dialogs (Screenshot, ScreenCast, Access, PickColor) */}
      <PortalDialogs />

      {/* About Piloti Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-[360px] text-center">
          <DialogHeader className="items-center text-center">
            <PilotiLogo className="mx-auto mb-2 size-20 drop-shadow-lg" />
            <DialogTitle className="text-[17px] font-bold">
              Piloti Desktop
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Version 1.0 · Wayland Web Shell for Domicile
            </DialogDescription>
          </DialogHeader>
          <div className="my-2 space-y-1.5 rounded-[12px] bg-black/5 p-3 text-left text-[11.5px] dark:bg-white/6">
            <div className="flex justify-between">
              <span className="text-mac-label-secondary">Compositor</span>
              <span className="font-medium">
                {isBrowserRuntime ? "Browser Harness (macOS)" : "Domicile Wayland"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mac-label-secondary">UI Theme</span>
              <span className="font-medium capitalize">{settings.uiTheme}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mac-label-secondary">Launcher</span>
              <span className="font-mono">Alt + Space</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mac-label-secondary">Task Switcher</span>
              <span className="font-mono">Alt + Tab</span>
            </div>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAboutOpen(false);
                launchApp("settings");
              }}
            >
              System Settings…
            </Button>
            <Button onClick={() => setAboutOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Open URL Dialog */}
      <Dialog open={openUrlOpen} onOpenChange={setOpenUrlOpen}>
        <DialogContent className="max-w-[400px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Open URL</DialogTitle>
            <DialogDescription>
              Enter a web address to open in a native webview window.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!urlInput.trim()) return;
              openWebUrl(urlInput);
              setOpenUrlOpen(false);
            }}
          >
            <Input
              autoFocus
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com"
              aria-label="URL"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpenUrlOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!urlInput.trim()}>
                Open
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Session & Power Confirmation Dialog */}
      <Dialog
        open={pendingPowerAction !== null}
        onOpenChange={(open) => {
          if (!open) cancelPowerAction();
        }}
      >
        <DialogContent className="max-w-[360px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {pendingPowerAction === "logout"
                ? "Log Out of Piloti?"
                : pendingPowerAction === "restart"
                  ? "Restart Computer?"
                  : "Turn Off Computer?"}
            </DialogTitle>
            <DialogDescription>
              {pendingPowerAction === "logout"
                ? "All open applications will close and unsaved changes may be lost."
                : pendingPowerAction === "restart"
                  ? "All open applications will close and the system will restart."
                  : "All open applications will close and the system will power off."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => cancelPowerAction()}>
              Cancel
            </Button>
            <Button
              variant={
                pendingPowerAction === "poweroff" ? "destructive" : "default"
              }
              onClick={() => void confirmPowerAction()}
            >
              {pendingPowerAction === "logout"
                ? "Log Out"
                : pendingPowerAction === "restart"
                  ? "Restart"
                  : "Turn Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAM / Compositor Lock Screen */}
      <LockScreen />
    </div>
  );
}

export function PilotiShell() {
  return (
    <DesktopStateProvider>
      <DesktopSurface />
    </DesktopStateProvider>
  );
}

