import * as React from "react";
import { countRender } from "@/core/util/render-stats";
import { IsolatedAppFrame } from "@/ui/shell/windows/IsolatedAppFrame";
import { useAppChrome } from "@/ui/components/elements/app-chrome";
import { type DesktopWindowInstance } from "@/ui/context/DesktopStateContext";
import type { BrowserTab } from "@/ui/context/WindowsContext";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { WaylandAppSurface } from "@/ui/shell/windows/WaylandAppSurface";
import { AppModuleSurface, isAppModuleWindow } from "@/ui/shell/windows/AppModuleSurface";
import { BrowserTabsSurface } from "@/ui/shell/windows/BrowserTabsSurface";

const CalculatorApp = React.lazy(() =>
  import("@/ui/apps/calculator/ShellCalculatorApp").then((m) => ({
    default: m.ShellCalculatorApp,
  }))
);

const HelloWorldApp = React.lazy(() =>
  import("@/ui/apps/hello/HelloWorldApp").then((m) => ({
    default: m.HelloWorldApp,
  }))
);

const PilotiDemoApp = React.lazy(() =>
  import("@/ui/apps/piloti-demo/PilotiDemoApp").then((m) => ({
    default: m.PilotiDemoApp,
  }))
);

const SelfiesApp = React.lazy(() =>
  import("@/ui/apps/selfies/SelfiesApp").then((m) => ({
    default: m.SelfiesApp,
  }))
);

const SystemMonitorApp = React.lazy(() =>
  import("@/ui/apps/system-monitor/SystemMonitorApp").then((m) => ({
    default: m.SystemMonitorApp,
  }))
);

const ConsoleApp = React.lazy(() =>
  import("@/ui/apps/console/ConsoleApp").then((m) => ({
    default: m.ConsoleApp,
  }))
);

const FilesApp = React.lazy(() =>
  import("@/ui/apps/files/FilesApp").then((m) => ({
    default: m.FilesApp,
  }))
);

const TextsApp = React.lazy(() =>
  import("@/ui/apps/texts/shell-host").then((m) => ({
    default: m.ShellTextsApp,
  }))
);

const ImageViewerApp = React.lazy(() =>
  import("@/ui/apps/image-viewer/ImageViewerApp").then((m) => ({
    default: m.ImageViewerApp,
  }))
);

const TerminalApp = React.lazy(() =>
  import("@/ui/apps/terminal/XtermTerminalApp").then((m) => ({
    default: m.XtermTerminalApp,
  }))
);

const AppStoreApp = React.lazy(() =>
  import("@/ui/apps/app-store/AppStoreApp").then((m) => ({
    default: m.AppStoreApp,
  }))
);

const SettingsApp = React.lazy(() =>
  import("@/ui/apps/settings/SettingsApp").then((m) => ({
    default: m.SettingsApp,
  }))
);

const LoginScreenApp = React.lazy(() =>
  import("@/ui/apps/login/LoginScreenApp").then((m) => ({
    default: m.LoginScreenApp,
  }))
);

/** The app shown in a window, by `builtinComponent`. */
const BUILTIN_APPS: Partial<
  Record<
    NonNullable<DesktopWindowInstance["builtinComponent"]>,
    (win: DesktopWindowInstance) => React.ReactNode
  >
> = {
  "app-store": (win) => <AppStoreApp windowId={win.id} initialPayload={win.payload} />,
  calculator: (win) => <CalculatorApp windowId={win.id} />,
  console: (win) => <ConsoleApp initialModule={win.payload} />,
  files: (win) => <FilesApp initialPath={win.payload} windowId={win.id} />,
  "hello-world": () => <HelloWorldApp />,
  "image-viewer": (win) => <ImageViewerApp initialPath={win.payload} windowId={win.id} />,
  "login-screen": (win) => <LoginScreenApp windowId={win.id} />,
  "piloti-demo": () => <PilotiDemoApp />,
  selfies: (win) => <SelfiesApp windowId={win.id} />,
  settings: (win) => <SettingsApp initialPane={win.payload} />,
  "system-monitor": (win) => <SystemMonitorApp windowId={win.id} />,
  terminal: (win) => <TerminalApp initialPath={win.payload} windowId={win.id} />,
  texts: (win) => <TextsApp initialPath={win.payload} windowId={win.id} />,
};

function WindowDomReadySignal({
  windowId,
  onReady,
}: {
  windowId: string;
  onReady: (id: string) => void;
}) {
  React.useLayoutEffect(() => {
    onReady(windowId);
  }, [onReady, windowId]);
  return null;
}

export const WindowBody = React.memo(
  function WindowBody({
    win,
    onDomReady,
    darkReaderEnabled,
    onToggleDarkReader,
  }: {
    win: DesktopWindowInstance;
    onDomReady: (id: string) => void;
    darkReaderEnabled: boolean;
    onToggleDarkReader: () => void;
  }) {
    const isCsd = useAppChrome().decorations === "client";
    const { compositor } = useCapabilities();
    countRender("WindowBody");

    if (win.waylandAppId && compositor) {
      return <WaylandAppSurface win={win} />;
    }

    if (win.browserWindowId && isAppModuleWindow(win)) {
      return <AppModuleSurface win={win} />;
    }

    if (win.browserWindowId) {
      return (
        <BrowserTabsSurface
          win={win}
          darkReaderEnabled={darkReaderEnabled}
          onToggleDarkReader={onToggleDarkReader}
        />
      );
    }

    if (win.builtinComponent && win.isolated) {
      return (
        <>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          <IsolatedAppFrame
            appId={win.builtinComponent}
            windowId={win.id}
            title={win.title}
            isCsd={isCsd}
            initialPath={win.payload}
          />
        </>
      );
    }

    const renderBuiltin = win.builtinComponent && BUILTIN_APPS[win.builtinComponent];
    if (renderBuiltin) {
      return (
        <React.Suspense fallback={null}>
          <WindowDomReadySignal windowId={win.id} onReady={onDomReady} />
          {renderBuiltin(win)}
        </React.Suspense>
      );
    }

    // In Browser Dev Mode, simulated non-Settings Wayland windows render a minimal surface card
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ui-window p-6 text-center text-ui-label">
        <div className="text-ui-body font-semibold">{win.title}</div>
        <div className="text-ui-small text-ui-label-secondary">
          Simulated Wayland surface (`{win.waylandAppId ?? win.appId}`) ·
          Renders native Linux client under Domicile
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.darkReaderEnabled === next.darkReaderEnabled &&
    prev.win.id === next.win.id &&
    prev.win.builtinComponent === next.win.builtinComponent &&
    prev.win.payload === next.win.payload &&
    prev.win.waylandAppId === next.win.waylandAppId &&
    prev.win.browserWindowId === next.win.browserWindowId &&
    prev.win.browserUrl === next.win.browserUrl &&
    prev.win.browserIsApp === next.win.browserIsApp &&
    sameBrowserTabs(prev.win.browserTabs, next.win.browserTabs) &&
    prev.win.syncedFrame === next.win.syncedFrame &&
    prev.win.cursor === next.win.cursor &&
    prev.win.title === next.win.title &&
    prev.win.position.x === next.win.position.x &&
    prev.win.position.y === next.win.position.y &&
    prev.win.size.width === next.win.size.width &&
    prev.win.size.height === next.win.size.height &&
    prev.win.maximized === next.win.maximized &&
    prev.win.minimized === next.win.minimized
);

/** Tabs of a web window: same order, titles and icons. */
function sameBrowserTabs(a?: BrowserTab[], b?: BrowserTab[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (tab, i) =>
      tab.id === b[i].id &&
      tab.title === b[i].title &&
      tab.iconUrl === b[i].iconUrl &&
      tab.url === b[i].url
  );
}
