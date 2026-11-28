import * as React from "react";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { emitShellEvent, onShellEvent } from "@/core/windows/shell-events";
import { countRender } from "@/core/util/render-stats";
import { usePiloti } from "@/platform/shared/piloti";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/ui/components/ui/context-menu";
import {
  GlobalTitleTooltip,
  TooltipProvider,
} from "@/ui/components/ui/tooltip";
import {
  DesktopStateProvider,
  useApps,
  useSystemBackends,
  useWindowActions,
  useWindowManagerSelector,
  useDesktopSettings,
  useSettingsSelector,
  useUpdateSettings,
} from "@/ui/context/DesktopStateContext";
import {
  canonicalizeWebUrl,
  getHostnameFallbackTitle,
  getWebAppFaviconUrl,
} from "@/core/data/web-apps";
import {
  dispatchPilotiShellCommand,
  type IncomingShellCommand,
  PILOTI_SHELL_COMMAND_HELP,
  shellCommandAnswer,
  shellCommandNumber,
  shellCommandWords,
  type PilotiShellCommandHandlers,
} from "@/ui/shell/desktop/shell-commands";
import { receiveModuleCommand } from "@/platform/shared/module-ipc";
import {
  installWebAppDesktopEntry,
  removeWebAppDesktopEntry,
} from "@/platform/shared/web-apps-store";
import { AltTabSwitcher } from "@/ui/shell/overview/AltTabSwitcher";
const AboutComputerDialog = React.lazy(() =>
  import("@/ui/shell/dialogs/AboutComputerDialog").then((m) => ({
    default: m.AboutComputerDialog,
  }))
);
import { DesktopBackgroundLayers } from "./DesktopBackgroundLayers";
import { Dock } from "@/ui/shell/dock/Dock";
const LockScreen = React.lazy(() =>
  import("@/ui/shell/session/LockScreen").then((m) => ({
    default: m.LockScreen,
  }))
);
import { MenuBar } from "@/ui/shell/menubar/MenuBar";
import { NotificationToasts } from "@/ui/shell/notifications/NotificationToasts";
import { OsdOverlay } from "@/ui/shell/notifications/OsdOverlay";
import { useOnScreenKeyboardOpen } from "@/ui/shell/osk/osk-store";
import { useSlidePresence } from "@/ui/fx/slide";
const OnScreenKeyboard = React.lazy(() =>
  import("@/ui/shell/osk/OnScreenKeyboard").then((m) => ({
    default: m.OnScreenKeyboard,
  }))
);
const Overview = React.lazy(() =>
  import("@/ui/shell/overview/Overview").then((m) => ({
    default: m.Overview,
  }))
);
const PortalDialogs = React.lazy(() =>
  import("@/ui/shell/dialogs/PortalDialogs").then((m) => ({
    default: m.PortalDialogs,
  }))
);
const PowerActionDialog = React.lazy(() =>
  import("@/ui/shell/session/PowerActionDialog").then((m) => ({
    default: m.PowerActionDialog,
  }))
);
import { WindowManager } from "@/ui/shell/windows/WindowManager";
import { installConsoleCapture } from "@/core/util/console-store";
import { _ } from "@/core/util/i18n";
import { bootElapsedMs, logBootEvent } from "@/core/util/perf-log";
import { getVfsClipboard, subscribeVfsClipboard } from "@/core/files/vfs-clipboard";
import { useTemplatesDirPath } from "@/ui/hooks/use-desktop-dir";
import { type WebVfsEntry } from "@/core/files/vfs-paths";
import { listFsTemplates } from "@/platform/shared/fs-bridge";
import { useVfsQuery } from "@/ui/hooks/use-vfs";
import { vfsKeys } from "@/platform/shared/vfs-query";

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

  const { xdgUserDirs } = useApps();
  const templatesDir = useTemplatesDirPath(xdgUserDirs);
  const templates =
    useVfsQuery(vfsKeys.templates(templatesDir), templatesDir, () =>
      listFsTemplates(piloti, templatesDir),
    ).data ?? NO_TEMPLATES;

  const brightnessFilter =
    settings.brightness < 100
      ? `brightness(${0.45 + (settings.brightness / 100) * 0.55})`
      : undefined;

  const overviewMounted = useSlidePresence(overviewOpen);
  const oskOpen = useOnScreenKeyboardOpen();
  const oskMounted = useSlidePresence(oskOpen);

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

      {/* On-screen keyboard (Keyboard menu) */}
      {oskMounted && (
        <React.Suspense fallback={null}>
          <OnScreenKeyboard open={oskOpen} />
        </React.Suspense>
      )}

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

