import { profileStartup } from "./lib/core/startup-profile";
import { startBootPhase } from "./lib/core/perf-log";
import * as React from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import { setEngine, webEngine } from "./lib/engine/engine";
import { demoVfsSeed } from "./lib/engine-web/vfs-seed";
import { setVfsSeed } from "./lib/engine-web/web-vfs";
import { installDynamicFavicon } from "./lib/engine-web/dynamic-favicon";

setEngine(webEngine);
setVfsSeed(demoVfsSeed);
installDynamicFavicon();
import { ShellErrorBoundary } from "./components/shell/ShellErrorBoundary";

const CalculatorApp = React.lazy(() =>
  import("./components/apps/CalculatorApp").then((m) => ({
    default: m.CalculatorApp,
  })),
);
const TextEditorApp = React.lazy(() =>
  import("./lib/engine/text-editor-host-shell").then((m) => ({
    default: m.ShellTextEditorApp,
  })),
);
const ImageViewerApp = React.lazy(() =>
  import("./components/apps/ImageViewerApp").then((m) => ({
    default: m.ImageViewerApp,
  })),
);

const root = document.getElementById("root");
if (root) {
  const params = new URLSearchParams(window.location.search);
  const isolatedApp = params.get("piloti_app");
  if (isolatedApp === "calculator") {
    const windowId = params.get("windowId") ?? "";
    const isCsd = params.get("csd") !== "0";
    createRoot(root).render(
      <ShellErrorBoundary>
        <React.Suspense fallback={null}>
          <CalculatorApp windowId={windowId} isCsd={isCsd} />
        </React.Suspense>
      </ShellErrorBoundary>,
    );
  } else if (isolatedApp === "text-editor") {
    const windowId = params.get("windowId") ?? "";
    const initialPath = params.get("path") ?? undefined;
    createRoot(root).render(
      <ShellErrorBoundary>
        <React.Suspense fallback={null}>
          <TextEditorApp initialPath={initialPath} windowId={windowId} />
        </React.Suspense>
      </ShellErrorBoundary>,
    );
  } else if (isolatedApp === "image-viewer") {
    const windowId = params.get("windowId") ?? "";
    const isCsd = params.get("csd") !== "0";
    const initialPath = params.get("path") ?? undefined;
    createRoot(root).render(
      <ShellErrorBoundary>
        <React.Suspense fallback={null}>
          <ImageViewerApp
            initialPath={initialPath}
            windowId={windowId}
            isCsd={isCsd}
          />
        </React.Suspense>
      </ShellErrorBoundary>,
    );
  } else {
    const finishImport = startBootPhase("desktop module");
    void Promise.all([
      import("./piloti-desktop-app"),
      import("./lib/engine-web"),
    ]).then(([{ Shell }, { createBrowserDomicile }]) => {
      finishImport();
      const domicile = profileStartup(createBrowserDomicile());
      const finishRender = startBootPhase("first render");
      Shell(root, domicile);
      finishRender();
    });
  }
}
