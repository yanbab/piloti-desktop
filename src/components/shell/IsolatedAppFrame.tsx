import * as React from "react";
import { emitShellEvent, onShellEvent } from "@/lib/shell/shell-events";
import { createRoot, type Root } from "react-dom/client";
import {
  useSettings,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import {
  type AppToShellMessage,
  applyThemeToDocument,
  type ShellToAppMessage,
} from "@/lib/engine/app-bridge";
import { PilotiQueryProvider } from "@/lib/engine/query-client";

export interface IsolatedAppFrameProps {
  appId: string;
  windowId: string;
  title: string;
  isCsd?: boolean;
  initialPath?: string;
  initialHash?: string;
  fallbackElement?: React.ReactNode;
}

export const IsolatedAppFrame: React.FC<IsolatedAppFrameProps> = ({
  appId,
  windowId,
  title,
  isCsd = true,
  initialPath,
  initialHash,
  fallbackElement,
}) => {
  const { settings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const {
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    updateWindowGeometry,
    markWindowReady,
  } = useWindowActions();

  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const portalRootRef = React.useRef<Root | null>(null);
  const fallbackElementRef = React.useRef<React.ReactNode>(fallbackElement);
  fallbackElementRef.current = fallbackElement;

  const isHttpRuntime =
    typeof window !== "undefined" &&
    (window.location.protocol === "http:" ||
      window.location.protocol === "https:");

  const iframeSrc = React.useMemo(() => {
    if (!isHttpRuntime) return undefined;
    const url = new URL(window.location.href);
    url.searchParams.set("piloti_app", appId);
    url.searchParams.set("windowId", windowId);
    url.searchParams.set("csd", isCsd ? "1" : "0");
    if (initialPath) {
      url.searchParams.set("path", initialPath);
    }
    const hash = initialHash ? `#${initialHash.replace(/^#/, "")}` : "";
    return `${url.pathname}${url.search}${hash}`;
  }, [appId, initialHash, initialPath, isCsd, isHttpRuntime, windowId]);

  const sendThemeSync = React.useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const msg: ShellToAppMessage = {
      type: "piloti:theme-sync",
      themeMode: settings.themeMode,
      accentColor: settings.accentColor,
      fontSansFamily: settings.fontSansFamily,
      fontMonoFamily: settings.fontMonoFamily,
      fontScale: settings.fontScale,
      isCsd,
      windowId,
    };
    win.postMessage(msg, "*");
  }, [
    isCsd,
    settings.accentColor,
    settings.fontMonoFamily,
    settings.fontSansFamily,
    settings.fontScale,
    settings.themeMode,
    windowId,
  ]);

  React.useEffect(() => {
    sendThemeSync();
  }, [sendThemeSync]);

  React.useEffect(() => {
    const onAppAction = (e: Event) => {
      const detail = (e as CustomEvent<{ windowId?: string; actionId?: string }>)
        .detail;
      if (!detail || detail.windowId !== windowId || !detail.actionId) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      const msg: ShellToAppMessage = {
        type: "piloti:app-action",
        actionId: detail.actionId,
      };
      win.postMessage(msg, "*");
    };
    const onFileDropWindow = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          windowId?: string;
          item?: { path?: string };
          items?: Array<{ path?: string }>;
        }>
      ).detail;
      if (!detail || detail.windowId !== windowId) return;
      const path = detail.items?.[0]?.path ?? detail.item?.path;
      if (!path) return;
      const actionId = `piloti:open-path:${path}`;
      if (isHttpRuntime) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "piloti:app-action", actionId } satisfies ShellToAppMessage,
          "*",
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("piloti:app-action", {
            detail: { windowId, actionId },
          }),
        );
      }
    };
    window.addEventListener("piloti:app-action", onAppAction);
    window.addEventListener("residence:file-drop-window", onFileDropWindow);
    return () => {
      window.removeEventListener("piloti:app-action", onAppAction);
      window.removeEventListener("residence:file-drop-window", onFileDropWindow);
    };
  }, [isHttpRuntime, windowId]);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as AppToShellMessage | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.windowId && data.windowId !== windowId) return;

      if (data.type === "piloti:ready") {
        sendThemeSync();
        markWindowReady(windowId);
      } else if (data.type === "piloti:focus-window") {
        focusWindow(windowId);
      } else if (data.type === "piloti:window-control") {
        if (data.action === "close") {
          emitShellEvent("piloti:request-animated-close", { windowId: windowId });
        } else if (data.action === "minimize") minimizeWindow(windowId);
        else if (data.action === "maximize") toggleMaximizeWindow(windowId);
      } else if (data.type === "piloti:resize-window") {
        updateWindowGeometry(windowId, {
          size: { width: data.width, height: data.height },
        });
      } else if (data.type === "piloti:notify") {
        pushNotification({
          appName: title,
          summary: data.summary,
          body: data.body ?? "",
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    closeWindow,
    focusWindow,
    markWindowReady,
    minimizeWindow,
    pushNotification,
    sendThemeSync,
    title,
    toggleMaximizeWindow,
    updateWindowGeometry,
    windowId,
  ]);

  // Fallback isolated DOM mount when running under file:// (Domicile standalone bundle)
  React.useEffect(() => {
    if (isHttpRuntime || !fallbackElementRef.current) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8" /></head><body class="m-0 h-full w-full overflow-hidden bg-ui-window"><div id="isolated-root" class="h-full w-full"></div></body></html>',
    );
    doc.close();

    for (const node of Array.from(
      document.head.querySelectorAll('style, link[rel="stylesheet"]'),
    )) {
      doc.head.appendChild(node.cloneNode(true));
    }
    applyThemeToDocument(doc, settings);

    const mountNode = doc.getElementById("isolated-root");
    if (mountNode) {
      const root = createRoot(mountNode);
      portalRootRef.current = root;
      root.render(<PilotiQueryProvider>{fallbackElementRef.current}</PilotiQueryProvider>);
      markWindowReady(windowId);
    }

    return () => {
      portalRootRef.current?.unmount();
      portalRootRef.current = null;
    };
  }, [appId, isHttpRuntime, markWindowReady, windowId]);

  React.useEffect(() => {
    if (isHttpRuntime || !portalRootRef.current || !fallbackElement) return;
    portalRootRef.current.render(<PilotiQueryProvider>{fallbackElement}</PilotiQueryProvider>);
  }, [fallbackElement, isHttpRuntime]);

  return (
    <div
      data-drop-window-id={windowId}
      className="relative h-full w-full overflow-hidden bg-ui-window"
    >
      {isCsd && (
        <div
          data-window-drag-region=""
          onMouseEnter={() =>
            iframeRef.current?.contentWindow?.postMessage(
              { type: "piloti:app-action", actionId: "piloti:header-enter" },
              "*",
            )
          }
          onMouseLeave={() =>
            iframeRef.current?.contentWindow?.postMessage(
              { type: "piloti:app-action", actionId: "piloti:header-leave" },
              "*",
            )
          }
          className="absolute top-0 right-24 left-10 z-10 h-9"
        />
      )}
      {/* Focus shield: while unfocused, capture pointer events above the iframe so click-to-focus and edge resize work */}
      <div
        aria-hidden="true"
        data-window-focus-shield=""
        onPointerDown={() => focusWindow(windowId)}
        className="absolute inset-0 z-20 hidden group-data-[inactive]/window:block"
      />
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title={title}
        onLoad={() => {
          sendThemeSync();
          markWindowReady(windowId);
        }}
        className="h-full w-full border-0 bg-ui-window"
      />
    </div>
  );
};

