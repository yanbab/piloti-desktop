import * as React from "react";
import {
  useWindowManager,
  type DesktopWindowInstance,
} from "@/ui/context/DesktopStateContext";
import type { BrowserTab } from "@/ui/context/WindowsContext";
import { BrowserTabBar } from "./BrowserTabBar";
import { cn } from "@/core/util/utils";
import { BrowserNewTabButton } from "@/ui/shell/windows/BrowserNewTabButton";
import { WindowControls, WindowTitlebar } from "@/ui/components/ui/window";
import { HeaderEdgesContext, useAppChrome } from "@/ui/components/elements/app-chrome";
import { WebViewSurface } from "@/ui/shell/windows/WebViewSurface";
import { AppModuleSurface } from "@/ui/shell/windows/AppModuleSurface";
import { followTornTab, TEAR_GRAB_Y } from "@/ui/shell/windows/browser-tab-tear";
import { BROWSER_TAB_RELOAD_EVENT } from "@/ui/shell/windows/browser-shortcuts";
import { TAB_DROP_ATTR } from "@/ui/shell/windows/browser-tab-drop";
import { SurfaceSlot } from "@/ui/shell/windows/surface-host";

/** A web window's tabs (a single page is one tab). */
export function browserTabsOf(win: DesktopWindowInstance): BrowserTab[] {
  return (
    win.browserTabs ?? [
      {
        id: win.browserWindowId!,
        url: win.browserUrl ?? "",
        title: win.title,
        iconUrl: win.iconUrl,
        ...(win.browserIsApp ? { isApp: true } : {}),
      },
    ]
  );
}

/** The view of a tab: rendered once (`surface-host.tsx`), so it survives moving to another window. */
export const browserTabSurfaceId = (tabId: string) => `browser-tab:${tabId}`;

/** What a tab shows: a page, or an app module with the tab bar on top. */
export function BrowserTabContent({
  win,
  tab,
  tabbed,
  darkReaderEnabled,
  onToggleDarkReader,
}: {
  win: DesktopWindowInstance;
  tab: BrowserTab;
  tabbed: boolean;
  darkReaderEnabled: boolean;
  onToggleDarkReader: () => void;
}) {
  const active = tab.id === win.browserWindowId;
  return (
    <HeaderEdgesContext.Provider value={tabbed ? "none" : "both"}>
      {tab.isApp && tab.url.startsWith("domicile://app-") ? (
        // An app module as a tab: its own frame, the tab bar on top.
        <AppModuleSurface
          win={{
            ...win,
            browserWindowId: tab.id,
            browserUrl: tab.url,
            browserIsApp: true,
            title: tab.title,
            iconUrl: tab.iconUrl,
          }}
          tabbed={tabbed}
        />
      ) : (
        <WebViewSurface
          win={
            active
              ? win
              : {
                ...win,
                browserWindowId: tab.id,
                browserUrl: tab.url,
                title: tab.title,
                iconUrl: tab.iconUrl,
              }
          }
          active={active}
          tabbed={tabbed}
          darkReaderEnabled={darkReaderEnabled}
          onToggleDarkReader={onToggleDarkReader}
        />
      )}
    </HeaderEdgesContext.Provider>
  );
}

/**
 * A web window and its tabs. Every tab keeps its page mounted (switching never
 * reloads it); only the active one is shown. The tab bar appears from two
 * tabs on, under the toolbar (Safari).
 */
export function BrowserTabsSurface({ win }: { win: DesktopWindowInstance }) {
  const {
    selectBrowserTab,
    closeBrowserTab,
    reorderBrowserTabs,
    detachBrowserTab,
    moveBrowserTab,
    pinBrowserTab,
    updateWindowGeometry,
    openBrowserTab,
  } = useWindowManager();
  const tabs = browserTabsOf(win);
  const showTabBar = tabs.length > 1;
  // From two tabs on, the tab bar is the window's titlebar (Chrome): window
  // controls and drag strip stay put whatever the tab; each tab keeps its own
  // header below, without window controls.
  const client = useAppChrome().decorations === "client";
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  // A tab pulled off the bar: a window of its own, under the pointer, that
  // follows it until release.
  const geometryRef = React.useRef(updateWindowGeometry);
  geometryRef.current = updateWindowGeometry;
  const moveRef = React.useRef(moveBrowserTab);
  moveRef.current = moveBrowserTab;
  const tearOff = (tabId: string, pointer: { clientX: number; clientY: number }) => {
    const rect = containerRef.current
      ?.closest<HTMLElement>("[data-window-id]")
      ?.getBoundingClientRect();
    if (!rect || win.maximized) {
      detachBrowserTab(win.id, tabId);
      return;
    }
    // Window positions are offsets from the desktop's origin.
    const originX = rect.left - win.position.x;
    const originY = rect.top - win.position.y;
    const grabX = Math.min(Math.max(pointer.clientX - rect.left, 80), rect.width - 80);
    const at = {
      x: Math.round(pointer.clientX - grabX - originX),
      y: Math.round(pointer.clientY - TEAR_GRAB_Y - originY),
    };
    const newId = detachBrowserTab(win.id, tabId, at);
    if (!newId) return;
    // Committed on release, when the new window is in the latest state.
    followTornTab(
      newId,
      at,
      pointer,
      (position) => geometryRef.current(newId, { position }),
      grabX,
      // Dropped on a Web Browser window's tabs (this one's too): it joins them.
      win.appId === "browser"
        ? ({ windowId, index }) => moveRef.current(newId, tabId, windowId, index)
        : undefined
    );
  };
  return (
    <div
      ref={containerRef}
      {...{ [TAB_DROP_ATTR]: win.appId === "browser" ? win.id : undefined }}
      className="relative flex h-full w-full flex-1 flex-col overflow-hidden"
    >
      <WindowTitlebar
        data-slot="browser-tab-titlebar"
        data-window-drag-region={client ? "" : undefined}
        hidden={!showTabBar}
        className={cn(
          "h-auto min-h-0 shrink-0 items-center gap-1.5 border-b border-ui-separator bg-black/5 py-1 dark:bg-white/4",
          showTabBar ? "flex" : "hidden",
          client ? "px-2.5" : "rounded-none px-1"
        )}
      >
        {client && <WindowControls side="left" data-window-no-drag />}
      <BrowserTabBar
        hidden={!showTabBar}
        tabs={tabs}
        activeId={win.browserWindowId}
        onSelect={(id) => selectBrowserTab(win.id, id)}
        onClose={(id) => closeBrowserTab(win.id, id)}
        onReorder={(ids) => reorderBrowserTabs(win.id, ids)}
        onDetach={(id) => detachBrowserTab(win.id, id)}
        onTearOff={tearOff}
        onDuplicate={(id) => {
          const tab = tabs.find((t) => t.id === id);
          if (tab?.url) openBrowserTab(win.id, tab.url);
        }}
        onReload={(id) => window.dispatchEvent(new CustomEvent(BROWSER_TAB_RELOAD_EVENT, { detail: { tabId: id } }))}
        onCloseOthers={(id) => {
          if (win.browserWindowId !== id) selectBrowserTab(win.id, id);
          for (const t of tabs) if (t.id !== id && !t.pinned) closeBrowserTab(win.id, t.id);
        }}
        onCloseToRight={(id) => {
          const at = tabs.findIndex((t) => t.id === id);
          const right = tabs.slice(at + 1).filter((t) => !t.pinned);
          if (right.some((t) => t.id === win.browserWindowId)) selectBrowserTab(win.id, id);
          for (const t of right) closeBrowserTab(win.id, t.id);
        }}
        onPin={(id, pinned) => pinBrowserTab(win.id, id, pinned)}
      />
        {win.appId === "browser" && <BrowserNewTabButton windowId={win.id} className="text-ui-label-secondary" />}
        {client && <WindowControls side="right" data-window-no-drag />}
      </WindowTitlebar>
      <div className="relative min-h-0 w-full flex-1">
      {tabs.map((tab) => {
        const active = tab.id === win.browserWindowId;
        return (
          <div
            key={tab.id}
            data-active-tab={active || undefined}
            aria-hidden={!active || undefined}
            className={cn(
              "absolute inset-0 flex",
              !active && "invisible pointer-events-none"
            )}
          >
            {/* The tab's view is rendered by the window manager (`BrowserTabContent`). */}
            <SurfaceSlot surfaceId={browserTabSurfaceId(tab.id)} className="flex h-full w-full" />
          </div>
        );
      })}
      </div>
    </div>
  );
}
