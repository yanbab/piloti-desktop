import { loadAppCatalog } from "./lib/engine/app-catalog";
import { attachConsoleDiskSink, installConsoleCapture } from "./lib/core/console-store";
import { createShellLogWriter } from "./lib/engine/shell-log";
import { profileStartup } from "./lib/core/startup-profile";
import { startBootPhase } from "./lib/core/perf-log";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { DomicileProvider } from "@domicile-desktop/react/domicile-provider";
import "./styles/globals.css";
import { setEngine, webEngine } from "./lib/engine/engine";
import { demoVfsSeed } from "./lib/engine-web/vfs-seed";
import { loadDataFiles } from "./lib/engine-web/data-files";
import { setVfsSeed } from "./lib/engine-web/web-vfs";
import { useWebCapture } from "./lib/engine-web/capture";
import { setDemoCapture } from "./lib/ports/capture";
import { installDynamicFavicon } from "./lib/engine-web/dynamic-favicon";
import { createWebVfs } from "./lib/engine-web/vfs";
import { withVfs } from "./lib/engine/with-vfs";

setEngine(webEngine);
setDemoCapture(useWebCapture);
setVfsSeed(demoVfsSeed);
installDynamicFavicon();
import { AppChromeProvider } from "./components/elements/app-chrome";
import { PilotiQueryProvider } from "./lib/engine/query-client";
import { ShellErrorBoundary } from "./shell/desktop/ShellErrorBoundary";

const TextEditorApp = React.lazy(() =>
  import("./lib/engine/text-editor-host-shell").then((m) => ({
    default: m.ShellTextEditorApp,
  })),
);
const ImageViewerApp = React.lazy(() =>
  import("./apps/image-viewer/ImageViewerApp").then((m) => ({
    default: m.ImageViewerApp,
  })),
);

const root = document.getElementById("root");
if (root) void start(root);

async function start(root: HTMLElement) {
  // The shipped files first: a new demo's home folder is made from them.
  const finishFiles = startBootPhase("shipped files");
  await loadDataFiles().catch((error) => console.error("[piloti] no shipped files", error));
  finishFiles("home and etc");
  const params = new URLSearchParams(window.location.search);
  const isolatedApp = params.get("piloti_app");
  if (isolatedApp === "text-editor") {
    // The frame's own desktop, over the same demo VFS as the shell's.
    const { createBrowserDomicile } = await import("./lib/engine-web");
    const domicile = createBrowserDomicile();
    const windowId = params.get("windowId") ?? "";
    const isCsd = params.get("csd") !== "0";
    const initialPath = params.get("path") ?? undefined;
    createRoot(root).render(
      <ShellErrorBoundary>
        <PilotiQueryProvider>
        <AppChromeProvider value={{ appId: "text-editor", windowId, decorations: isCsd ? "client" : "server" }}>
          <DomicileProvider domicile={withVfs(domicile, createWebVfs(domicile))}>
            <React.Suspense fallback={null}>
              <TextEditorApp initialPath={initialPath} windowId={windowId} />
            </React.Suspense>
          </DomicileProvider>
        </AppChromeProvider>
        </PilotiQueryProvider>
      </ShellErrorBoundary>,
    );
  } else if (isolatedApp === "image-viewer") {
    const { createBrowserDomicile } = await import("./lib/engine-web");
    const domicile = createBrowserDomicile();
    const windowId = params.get("windowId") ?? "";
    const isCsd = params.get("csd") !== "0";
    const initialPath = params.get("path") ?? undefined;
    createRoot(root).render(
      <ShellErrorBoundary>
        <PilotiQueryProvider>
        <AppChromeProvider value={{ appId: "image-viewer", windowId, decorations: isCsd ? "client" : "server" }}>
          <DomicileProvider domicile={withVfs(domicile, createWebVfs(domicile))}>
            <React.Suspense fallback={null}>
              <ImageViewerApp
                initialPath={initialPath}
                windowId={windowId}
              />
            </React.Suspense>
          </DomicileProvider>
        </AppChromeProvider>
        </PilotiQueryProvider>
      </ShellErrorBoundary>,
    );
  } else {
    const finishImport = startBootPhase("desktop module");
    void import("./lib/engine-web").then(async ({ createBrowserDomicile }) => {
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
