/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import {
  WEBVIEW_LOADING_CHANGE_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import { initAppModules, resolveAppModuleByUrl } from "@/core/data/app-modules";
import { useAppChrome } from "@/ui/components/elements/app-chrome";
import { HeaderBar } from "@/ui/components/elements/header-bar";
import { useWindowContext, WindowControls } from "@/ui/components/ui/window";
import {
  useWindowManager,
  type DesktopWindowInstance,
} from "@/ui/context/DesktopStateContext";

void initAppModules();

/** A Domicile app module window (`domicile open --app <entry.js>`). */
export function isAppModuleWindow(win: DesktopWindowInstance) {
  return Boolean(win.browserIsApp && win.browserUrl?.startsWith("domicile://app-"));
}

/**
 * Our own frame around an isolated app module: standard titlebar (controls,
 * window menu, title), no address bar; the module's page fills the rest.
 */
export function AppModuleSurface({
  win,
  tabbed = false,
}: {
  win: DesktopWindowInstance;
  /** As a tab: the tab bar above holds the window controls. */
  tabbed?: boolean;
}) {
  const isCsd = useAppChrome().decorations === "client";
  const windowCtx = useWindowContext();
  const { setBrowserTitle, markWindowReady } = useWindowManager();
  const viewRef = React.useRef<HTMLWebViewElement | null>(null);
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view || !win.browserWindowId) return;
    const id = win.browserWindowId;
    const sync = () => {
      const t = view.title?.trim();
      if (t && !t.startsWith("domicile://")) setBrowserTitle(id, t);
      if (view.url && !view.loading) markWindowReady(win.id);
    };
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, sync);
    view.addEventListener(WEBVIEW_LOADING_CHANGE_EVENT, sync);
    sync();
    return () => {
      view.removeEventListener(WEBVIEW_PAGE_CHANGE_EVENT, sync);
      view.removeEventListener(WEBVIEW_LOADING_CHANGE_EVENT, sync);
    };
  }, [win.browserWindowId, win.id, setBrowserTitle, markWindowReady]);
  const mod = resolveAppModuleByUrl(win.browserUrl);
  const isModule = Boolean(mod);
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view || !isModule) return;
    // A module that refuses to close asks in its own window: answer "stay".
    const onDialog = (event: Event) => {
      const dialog = event as Event & { dialogType: string; dismiss: () => void };
      if (dialog.dialogType !== "beforeunload") return;
      event.preventDefault();
      dialog.dismiss();
    };
    view.addEventListener("domicile-dialog", onDialog);
    return () => view.removeEventListener("domicile-dialog", onDialog);
  }, [isModule, win.browserWindowId]);
  if (mod?.csd) {
    // The module draws its own header. The webview swallows pointer events, so
    // the shell lays window controls and a drag strip over the header area.
    const drag = mod.drag ?? { left: 96, right: 96, height: 36 };
    return (
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-ui-window">
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <webview
          ref={viewRef}
          window={win.browserWindowId}
          resizing={windowCtx?.resizing ? "" : undefined}
          className="block h-full w-full bg-ui-window"
        />
        {isCsd && !tabbed && (
          <>
            <div
              className="absolute top-0 left-0 z-10 flex items-center gap-1.5 pl-2.5"
              style={{ height: drag.height }}
              data-window-no-drag
            >
              <WindowControls side="left" />
            </div>
            <div
              className="absolute top-0 right-0 z-10 flex items-center gap-1.5 pr-2.5"
              style={{ height: drag.height }}
              data-window-no-drag
            >
              <WindowControls side="right" />
            </div>
          </>
        )}
        <div
          data-window-drag-region=""
          className="absolute top-0 z-10"
          style={{ left: drag.left, right: drag.right, height: drag.height }}
        />
      </div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-ui-window">
      <HeaderBar>
        <HeaderBar.Title>{win.title}</HeaderBar.Title>
      </HeaderBar>
      <webview
        ref={viewRef}
        window={win.browserWindowId}
        resizing={windowCtx?.resizing ? "" : undefined}
        className="block min-h-0 w-full flex-1 bg-ui-window"
      />
    </div>
  );
}
