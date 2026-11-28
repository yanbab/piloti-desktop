/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import {
  WEBVIEW_LOADING_CHANGE_EVENT,
  WEBVIEW_PAGE_CHANGE_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import { initAppModules, moduleInstance, resolveAppModuleByUrl } from "@/core/data/app-modules";
import { parseDragRegions, type Rect } from "@/core/apps/window-controls-overlay";
import { moduleState, onModuleState, sendToModule } from "@/platform/shared/module-ipc";
import { usePiloti } from "@/platform/shared/piloti";
import { DRAG_THRESHOLD } from "@/ui/fx/drag-feedback";
import { useAppChrome } from "@/ui/components/elements/app-chrome";
import { HeaderBar } from "@/ui/components/elements/header-bar";
import { useWindowContext, WindowControls } from "@/ui/components/ui/window";
import {
  useWindowManager,
  type DesktopWindowInstance,
} from "@/ui/context/DesktopStateContext";

void initAppModules();

/**
 * Window Controls Overlay with a module (`core/apps/window-controls-overlay.ts`):
 * tells it whether the shell's controls lie over its titlebar (not as a tab),
 * and returns where its titlebar drags the window, once it says.
 */
function useModuleOverlay(url: string | undefined, tabbed: boolean): Rect[] | undefined {
  const piloti = usePiloti();
  const instance = moduleInstance(url);
  const [regions, setRegions] = React.useState<Rect[] | undefined>();
  const told = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    told.current = null;
    if (!instance) return;
    const sync = () => {
      const state = moduleState(instance);
      const next = parseDragRegions(state?.dragRegions);
      setRegions((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      // Told once the module is listening (it has sent a state), and on change.
      if (state && told.current !== tabbed) {
        told.current = tabbed;
        sendToModule(piloti, { to: instance, type: "overlay", visible: !tabbed });
      }
    };
    sync();
    return onModuleState(sync);
  }, [instance, tabbed, piloti]);
  return regions;
}

/** How often a module under a shell drag hears where it is. */
const MODULE_OVER_MS = 33;

/**
 * While the shell drags anything (items, a window, a divider), a layer over
 * the module's view: the engine gives each pointer move to the surface under
 * the pointer, so without it the view would take the drag and its release
 * from the shell. Items dragged over it are reported to the module, which
 * lights the folder under them (it takes the drop through `routeItemDrop`).
 * A drag started in the module itself never shows it: the shell saw no press.
 */
function DropShield({ instance }: { instance: string | null | undefined }) {
  const piloti = usePiloti();
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    let press: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) press = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if ((e.buttons & 1) === 0) {
        press = null;
        setShown(false);
        return;
      }
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_THRESHOLD) setShown(true);
    };
    const onUp = () => {
      press = null;
      setShown(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("blur", onUp);
    };
  }, []);
  // Items dragged over the view: the module lights its folder under them.
  React.useEffect(() => {
    if (!instance) return;
    let over = false;
    let sentAt = 0;
    const leave = () => {
      if (!over) return;
      over = false;
      sendToModule(piloti, { to: instance, type: "drag", state: "leave" });
    };
    const onDrag = (e: Event) => {
      const detail = (e as CustomEvent<{
        active?: boolean;
        clientX?: number;
        clientY?: number;
        items?: readonly { path?: string }[];
      }>).detail;
      const rect = document
        .querySelector(`[data-module-instance="${CSS.escape(instance)}"]`)
        ?.getBoundingClientRect();
      const paths = (detail?.items ?? []).flatMap((i) => (i.path?.startsWith("/") ? [i.path] : []));
      if (!detail?.active || !rect || detail.clientX === undefined || detail.clientY === undefined) {
        leave();
        return;
      }
      const inside =
        detail.clientX >= rect.left && detail.clientX < rect.right &&
        detail.clientY >= rect.top && detail.clientY < rect.bottom;
      if (!inside || paths.length === 0) {
        leave();
        return;
      }
      const now = performance.now();
      if (over && now - sentAt < MODULE_OVER_MS) return;
      over = true;
      sentAt = now;
      sendToModule(piloti, {
        to: instance,
        type: "drag",
        state: "over",
        paths,
        x: detail.clientX - rect.left,
        y: detail.clientY - rect.top,
      });
    };
    window.addEventListener("residence:file-drag", onDrag);
    return () => {
      window.removeEventListener("residence:file-drag", onDrag);
      leave();
    };
  }, [instance, piloti]);
  return shown ? <div data-drop-shield className="absolute inset-0 z-30" /> : null;
}

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
  const regions = useModuleOverlay(win.browserUrl, tabbed);
  if (mod?.csd) {
    // The module draws its own header. The webview swallows pointer events, so
    // the shell lays window controls and drag strips over the header area:
    // where the module says (Window Controls Overlay), else at fixed places.
    const drag = mod.drag ?? { left: 96, right: 96, height: 36 };
    const controlsHeight = regions?.length
      ? Math.min(64, Math.max(...regions.map((r) => r.y + r.height)))
      : drag.height;
    return (
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-ui-window">
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <webview
          ref={viewRef}
          data-module-view={win.id}
          data-module-instance={moduleInstance(win.browserUrl) ?? undefined}
          window={win.browserWindowId}
          resizing={windowCtx?.resizing ? "" : undefined}
          className="block h-full w-full bg-ui-window"
        />
        <DropShield instance={moduleInstance(win.browserUrl)} />
        {isCsd && !tabbed && (
          <>
            <div
              className="absolute top-0 left-0 z-20 flex items-center gap-1.5 pl-2.5"
              style={{ height: controlsHeight }}
              data-window-no-drag
            >
              <WindowControls side="left" />
            </div>
            <div
              className="absolute top-0 right-0 z-20 flex items-center gap-1.5 pr-2.5"
              style={{ height: controlsHeight }}
              data-window-no-drag
            >
              <WindowControls side="right" />
            </div>
          </>
        )}
        {regions?.length ? (
          regions.map((r, i) => (
            <div
              key={i}
              data-window-drag-region=""
              className="absolute z-10"
              style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
            />
          ))
        ) : (
          <div
            data-window-drag-region=""
            className="absolute top-0 z-10"
            style={{ left: drag.left, right: drag.right, height: drag.height }}
          />
        )}
      </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-ui-window">
      <HeaderBar>
        <HeaderBar.Title>{win.title}</HeaderBar.Title>
      </HeaderBar>
      <webview
        ref={viewRef}
        data-module-view={win.id}
          data-module-instance={moduleInstance(win.browserUrl) ?? undefined}
        window={win.browserWindowId}
        resizing={windowCtx?.resizing ? "" : undefined}
        className="block min-h-0 w-full flex-1 bg-ui-window"
      />
      <DropShield instance={moduleInstance(win.browserUrl)} />
    </div>
  );
}
