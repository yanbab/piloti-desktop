import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { emitShellEvent, onShellEvent } from "@/lib/core/shell-events";
import { countRender } from "@/lib/core/render-stats";
import { usePiloti } from "@/lib/engine/piloti";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  GlobalTitleTooltip,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DesktopStateProvider,
  useSystemBackends,
  useWindowActions,
  useWindowManagerSelector,
  useDesktopSettings,
  useSettingsSelector,
  useUpdateSettings,
} from "@/context/DesktopStateContext";
import {
  canonicalizeWebUrl,
  getHostnameFallbackTitle,
  getWebAppFaviconUrl,
} from "@/data/web-apps";
import {
  dispatchPilotiShellCommand,
  type IncomingShellCommand,
  PILOTI_SHELL_COMMAND_HELP,
  shellCommandAnswer,
  shellCommandNumber,
  shellCommandWords,
  type PilotiShellCommandHandlers,
} from "@/shell/desktop/shell-commands";
import { receiveModuleCommand } from "@/lib/engine/module-ipc";
import {
  installWebAppDesktopEntry,
  removeWebAppDesktopEntry,
} from "@/lib/xdg/xdg-web-apps";
import { AltTabSwitcher } from "@/shell/overview/AltTabSwitcher";
const AboutComputerDialog = React.lazy(() =>
  import("@/shell/dialogs/AboutComputerDialog").then((m) => ({
    default: m.AboutComputerDialog,
  }))
);
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";
import { Dock } from "@/shell/dock/Dock";
const LockScreen = React.lazy(() =>
  import("@/shell/session/LockScreen").then((m) => ({
    default: m.LockScreen,
  }))
);
import { MenuBar } from "@/shell/menubar/MenuBar";
import { NotificationToasts } from "@/shell/notifications/NotificationToasts";
import { OsdOverlay } from "@/shell/notifications/OsdOverlay";
const Overview = React.lazy(() =>
  import("@/shell/overview/Overview").then((m) => ({
    default: m.Overview,
  }))
);
const PortalDialogs = React.lazy(() =>
  import("@/shell/dialogs/PortalDialogs").then((m) => ({
    default: m.PortalDialogs,
  }))
);
const PowerActionDialog = React.lazy(() =>
  import("@/shell/session/PowerActionDialog").then((m) => ({
    default: m.PowerActionDialog,
  }))
);
import { WindowManager } from "@/shell/windows/WindowManager";
import { installConsoleCapture } from "@/lib/core/console-store";
import { _ } from "@/lib/core/i18n";
import { bootElapsedMs, logBootEvent } from "@/lib/core/perf-log";
import { getVfsClipboard, subscribeVfsClipboard } from "@/lib/core/vfs-clipboard";
import { useTemplatesDirPath } from "@/hooks/use-desktop-dir";
import { type WebVfsEntry } from "@/lib/core/vfs-paths";
import { listFsTemplates } from "@/lib/engine/fs-bridge";
import { useVfsQuery } from "@/hooks/use-vfs";
import { vfsKeys } from "@/lib/engine/vfs-query";

const NO_TEMPLATES: WebVfsEntry[] = [];

installConsoleCapture();
logBootEvent("starting shell");

function DesktopSurface() {
  const piloti = usePiloti();
  // Chrome view of settings: window drags (saved bounds) don't re-render the surface.
  const settings = useDesktopSettings(["brightness", "debugMode", "installedWebApps", "nightLight"]);
  const updateSettings = useUpdateSettings();
  const { systemServices, simulatedHardware } = useCapabilities();

  React.useEffect(() => {
    logBootEvent(`finish load shell in ${bootElapsedMs()}ms`);
    // Two frames: the first one with the desktop on it has been painted.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => logBootEvent("first desktop frame"))
    );
  }, []);

  React.useEffect(() => {
    if (settings.debugMode) logBootEvent("debug mode: ready gates and entrances are off");
  }, [settings.debugMode]);
  const {
    locked,
    idleWarningMs,
    pendingPowerAction,
    sessionExiting,
    webPowerPhase,
    powerOnSimulatedMachine,
  } = useSystemBackends();
  const { aboutOpen, overviewOpen } = useWindowManagerSelector((wm) => ({
    aboutOpen: wm.aboutOpen,
    overviewOpen: wm.overviewOpen,
  }));
  const { setOverviewOpen, setLauncherOpen, setControlPanelOpen, launchApp } =
    useWindowActions();

  React.useEffect(() => {
    const onDismissPopups = () => {
      setLauncherOpen(false);
      setControlPanelOpen(false);
      setOverviewOpen(false);
    };
    const offDismissPopups = onShellEvent("piloti:dismiss-popups", onDismissPopups);
    return () => {
      offDismissPopups();
    };
  }, [setControlPanelOpen, setLauncherOpen, setOverviewOpen]);

  const [clipboard, setLocalClipboard] = React.useState(() =>
    getVfsClipboard()
  );
  React.useEffect(() => {
    return subscribeVfsClipboard(() => {
      setLocalClipboard(getVfsClipboard());
    });
  }, []);

  const templatesDir = useTemplatesDirPath();
  const templates =
    useVfsQuery(vfsKeys.templates(templatesDir), templatesDir, () =>
      listFsTemplates(piloti, templatesDir),
    ).data ?? NO_TEMPLATES;

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
      className="relative flex h-dvh w-screen flex-col overflow-hidden select-none"
    >
      {/* GNOME Spec / Curated Background Layers */}
      <DesktopBackgroundLayers />

      {/* Subtle Night Light Warmth Filter in Browser Dev Mode (Domicile uses hardware LUT on Linux) */}
      {settings.nightLight && simulatedHardware && (
        <div className="pointer-events-none fixed inset-0 z-[45] bg-amber-500/12 mix-blend-multiply" />
      )}

      {/* Idle Blank Warning Toast */}
      {idleWarningMs !== undefined && (
        <div className="pointer-events-none fixed top-11 left-1/2 z-[460] -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-ui-body font-medium text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md">
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
          <ContextMenuSub>
            <ContextMenuSubTrigger>{_("New…")}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="min-w-44">
              <ContextMenuItem
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("piloti:desktop-new-file")
                  )
                }
              >
                {_("New Text File")}
              </ContextMenuItem>
              {templates.length > 0 && (
                <>
                  <ContextMenuSeparator />
                  {templates.map((tmpl) => {
                    const label =
                      tmpl.name.replace(/\.[a-z0-9]+$/i, "") || tmpl.name;
                    return (
                      <ContextMenuItem
                        key={tmpl.path}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent(
                              "piloti:desktop-new-from-template",
                              { detail: tmpl }
                            )
                          )
                        }
                      >
                        {_(label)}
                      </ContextMenuItem>
                    );
                  })}
                </>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            disabled={!clipboard || clipboard.paths.length === 0}
            onClick={() =>
              window.dispatchEvent(new CustomEvent("piloti:desktop-paste"))
            }
          >
            {_("Paste")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("piloti:desktop-open-terminal")
              )
            }
          >
            {_("Open in Terminal")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => updateSettings({ desktopIconPositions: {} })}
          >
            {_("Align Icons")}
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
      <AltTabSwitcher />

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
      <DomicileShellCommandBridge />
      <ShellFocusAndContextGuard />
      {/* Fast fade-to-black curtain when quitting/restarting/powering off the Shell */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-150 ease-out ${
          sessionExiting
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />
      {webPowerPhase !== "active" && (
        <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-4 bg-black text-white select-none">
          {webPowerPhase === "restarting" ? (
            <>
              <div className="size-7 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              <div className="text-ui-body font-medium text-white/80">
                {_("Restarting Piloti Desktop…")}
              </div>
            </>
          ) : (
            <>
              <div className="text-ui-body font-medium text-white/70">
                {_("Computer is turned off")}
              </div>
              <button
                type="button"
                onClick={powerOnSimulatedMachine}
                className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-ui-body font-semibold text-white transition-colors hover-fill:bg-white/20 active:bg-white/25"
              >
                {_("Power On")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DomicileShellCommandBridge() {
  const piloti = usePiloti();
  const settings = useDesktopSettings(["brightness", "debugMode", "installedWebApps", "nightLight"]);
  const { systemServices } = useCapabilities();
  const {
    lockSession,
    requestPowerAction,
    takeScreenshot,
    startScreenRecording,
  } = useSystemBackends();
  const { launchApp, openWebUrl, setLauncherOpen, toggleOverview } =
    useWindowActions();

  const resolvedTheme = useSettingsSelector((v) => v.resolvedTheme);
  const updateSettings = useUpdateSettings();
  const handlersRef = React.useRef<PilotiShellCommandHandlers>({
    launchApp,
    openWebUrl,
    setLauncherOpen,
    toggleOverview,
    lockSession,
    requestPowerAction,
    takeScreenshot,
    startScreenRecording,
  });

  handlersRef.current = {
    launchApp,
    openWebUrl,
    setLauncherOpen,
    toggleOverview,
    lockSession,
    requestPowerAction,
    takeScreenshot,
    startScreenRecording,
    setTheme: (mode) => {
      const themeMode = mode !== "toggle" ? mode : resolvedTheme === "dark" ? "light" : "dark";
      updateSettings({ themeMode });
    },
    installWebApp: (rawUrl) => {
      const canonical = canonicalizeWebUrl(rawUrl);
      if (!canonical) return;
      const app = {
        id: `web:${canonical}`,
        title: getHostnameFallbackTitle(canonical) || canonical,
        url: canonical,
        iconUrl: getWebAppFaviconUrl(canonical),
        category: "Internet",
      };
      void installWebAppDesktopEntry(piloti, app);
    },
    removeWebApp: (target) => {
      const canonical = canonicalizeWebUrl(target);
      const match = (settings.installedWebApps ?? []).find(
        (w) =>
          w.id === target ||
          (canonical !== undefined &&
            (canonicalizeWebUrl(w.url) ?? w.url) === canonical)
      );
      const toRemove = match ?? { id: target, url: canonical ?? target };
      void removeWebAppDesktopEntry(piloti, toRemove);
    },
  };

  React.useEffect(() => {
    if (!systemServices) return;
    if (typeof piloti.shell?.commands !== "function") return;
    let stopped = false;
    let stopListening: (() => void) | null = null;

    void piloti.shell
      .commands(PILOTI_SHELL_COMMAND_HELP, [])
      .then((res) => {
        res.match({
          Ok: async (listening) => {
            if (stopped) {
              listening.stop();
              return;
            }
            stopListening = () => listening.stop();
            const reader = listening.items.getReader();
            while (!stopped) {
              const next = await reader.read();
              if (next.done) break;
              const command = next.value as unknown as IncomingShellCommand;
              const words = shellCommandWords(command);
              // App modules report their menus and size this way: not logged.
              const fromModule = receiveModuleCommand(words);
              if (!fromModule) console.info("[Piloti] shellCommand", words);
              const ran = fromModule || dispatchPilotiShellCommand(words, handlersRef.current);
              // `domicile send-shell` waits for the answer (Domicile ≥ 1.3).
              const sent = shellCommandNumber(command);
              if (sent !== undefined && typeof piloti.shell.answer === "function") {
                void piloti.shell
                  .answer(sent, shellCommandAnswer(ran, `Piloti has no command "${words.join(" ")}"`))
                  .catch(() => undefined);
              }
            }
          },
          Err: () => undefined,
        });
      })
      .catch(() => undefined);

    return () => {
      stopped = true;
      stopListening?.();
    };
  }, [piloti, systemServices]);

  return null;
}

function ShellFocusAndContextGuard() {
  const { launcherOpen, controlPanelOpen } = useWindowManagerSelector((wm) => ({
    launcherOpen: wm.launcherOpen,
    controlPanelOpen: wm.controlPanelOpen,
  }));
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
  countRender("Desktop");
  return (
    <DesktopStateProvider>
      <TooltipProvider delay={320}>
        <DesktopSurface />
        <GlobalTitleTooltip />
      </TooltipProvider>
    </DesktopStateProvider>
  );
}

