// First: modules below may read files or state as they load.
import "./platform/web/install";
import { loadAppCatalog } from "./platform/shared/app-catalog";
import { attachConsoleDiskSink, installConsoleCapture } from "./core/util/console-store";
import { createShellLogWriter } from "./platform/shared/shell-log";
import { profileStartup } from "./core/util/startup-profile";
import { startBootPhase } from "./core/util/perf-log";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { DomicileProvider } from "@domicile-desktop/react/domicile-provider";
import "./ui/styles/globals.css";
import { setEngine, webEngine } from "./core/ports/engine";
import { demoVfsSeed } from "./platform/web/vfs-seed";
import { canRunIsolated } from "./core/windows/run-mode";
import { loadDataFiles } from "./platform/web/data-files";
import { setVfsSeed } from "./platform/web/web-vfs";
import { useWebCapture } from "./platform/web/capture";
import { setHardware } from "./platform/shared/hardware";
import { webHardware } from "./platform/web/hardware";
import { setDemoCapture } from "./core/ports/capture";
import { installDynamicFavicon } from "./platform/web/dynamic-favicon";
import { createWebVfs } from "./platform/web/vfs";
import { withVfs } from "./platform/shared/with-vfs";
import { ensureLocale } from "./core/util/i18n";

setEngine(webEngine);
setDemoCapture(useWebCapture);
setHardware(webHardware);
setVfsSeed(demoVfsSeed);
installDynamicFavicon();
import { AppChromeProvider } from "./ui/components/elements/app-chrome";
import { PilotiQueryProvider } from "./platform/shared/query-client";
import { ShellErrorBoundary } from "./ui/shell/desktop/ShellErrorBoundary";

const TextsApp = React.lazy(() =>
  import("./ui/apps/texts/shell-host").then((m) => ({
    default: m.ShellTextsApp,
  })),
);

const CalculatorApp = React.lazy(() =>
  import("./ui/apps/calculator/FrameCalculatorApp").then((m) => ({
    default: m.FrameCalculatorApp,
  })),
);

const ImageViewerApp = React.lazy(() =>
  import("./ui/apps/image-viewer/shell-host").then((m) => ({ default: m.ShellImageViewerApp })),
);
const SelfiesApp = React.lazy(() =>
  import("./ui/apps/selfies/shell-host").then((m) => ({ default: m.ShellSelfiesApp })),
);
const TerminalApp = React.lazy(() =>
  import("./ui/apps/terminal/shell-host").then((m) => ({ default: m.FrameTerminalApp })),
);
const FilesApp = React.lazy(() =>
  import("./ui/apps/files/frame-host").then((m) => ({ default: m.FrameFilesApp })),
);
const SystemMonitorApp = React.lazy(() =>
  import("./ui/apps/system-monitor/shell-host").then((m) => ({ default: m.FrameSystemMonitorApp })),
);

const root = document.getElementById("root");
if (root) void start(root);

async function start(root: HTMLElement) {
  // The shipped files first: a new demo's home folder is made from them.
  const finishFiles = startBootPhase("shipped files");
  await loadDataFiles().catch((error) => console.error("[piloti] no shipped files", error));
  finishFiles("home and etc");
  // The language's strings before the first drawing.
  await ensureLocale();
  const params = new URLSearchParams(window.location.search);
  const isolatedApp = params.get("piloti_app");
  if (isolatedApp && canRunIsolated(isolatedApp)) {
    // The frame's own desktop, over the same demo VFS as the shell's.
    const { createBrowserDomicile } = await import("./platform/web");
    const domicile = createBrowserDomicile();
    const windowId = params.get("windowId") ?? "";
    const isCsd = params.get("csd") !== "0";
    const initialPath = params.get("path") ?? undefined;
    createRoot(root).render(
      <ShellErrorBoundary>
        <PilotiQueryProvider>
        <AppChromeProvider value={{ appId: isolatedApp, windowId, decorations: isCsd ? "client" : "server" }}>
          <DomicileProvider domicile={withVfs(domicile, createWebVfs(domicile))}>
            <React.Suspense fallback={null}>
              {isolatedApp === "calculator" ? (
                <CalculatorApp windowId={windowId} isCsd={isCsd} />
              ) : isolatedApp === "image-viewer" ? (
                <ImageViewerApp initialPath={initialPath} windowId={windowId} />
              ) : isolatedApp === "selfies" ? (
                <SelfiesApp windowId={windowId} />
              ) : isolatedApp === "terminal" ? (
                <TerminalApp windowId={windowId} />
              ) : isolatedApp === "files" ? (
                <FilesApp windowId={windowId} initialPath={initialPath} />
              ) : isolatedApp === "system-monitor" ? (
                <SystemMonitorApp windowId={windowId} />
              ) : (
                <TextsApp initialPath={initialPath} windowId={windowId} />
              )}
            </React.Suspense>
          </DomicileProvider>
        </AppChromeProvider>
        </PilotiQueryProvider>
      </ShellErrorBoundary>,
    );
  } else {
    const finishImport = startBootPhase("desktop module");
    void import("./platform/web").then(async ({ createBrowserDomicile }) => {
      const host = createBrowserDomicile();
      installConsoleCapture();
      attachConsoleDiskSink(createShellLogWriter(host));
      const timed = profileStartup(host);
      const piloti = withVfs(timed, createWebVfs(timed));
      // The apps first: the shell's modules expect the catalog.
      await loadAppCatalog(piloti);
      const { Shell } = await import("./piloti-desktop-app");
      finishImport();
      const finishRender = startBootPhase("first render");
      Shell(root, piloti);
      finishRender();
    });
  }
}
