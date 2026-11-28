import * as React from "react";
import {
  useWindowManager,
  type DesktopWindowInstance,
} from "@/ui/context/DesktopStateContext";
import type { BrowserTab } from "@/ui/context/WindowsContext";
import { BrowserTabBar } from "./BrowserTabBar";
import { cn } from "@/core/util/utils";
import { WebViewSurface } from "@/ui/shell/windows/WebViewSurface";
import { followTornTab, TEAR_GRAB_Y } from "@/ui/shell/windows/browser-tab-tear";

/**
 * A web window and its tabs. Every tab keeps its page mounted (switching never
 * reloads it); only the active one is shown. The tab bar appears from two
 * tabs on, under the toolbar (Safari).
 */
export function BrowserTabsSurface({
  win,
  darkReaderEnabled,
  onToggleDarkReader,
}: {
  win: DesktopWindowInstance;
  darkReaderEnabled: boolean;
  onToggleDarkReader: () => void;
}) {
  const {
    selectBrowserTab,
    closeBrowserTab,
    reorderBrowserTabs,
    detachBrowserTab,
    pinBrowserTab,
    updateWindowGeometry,
  } = useWindowManager();
  const tabs: BrowserTab[] = win.browserTabs ?? [
    {
      id: win.browserWindowId!,
      url: win.browserUrl ?? "",
      title: win.title,
      iconUrl: win.iconUrl,
    },
  ];
  const showTabBar = tabs.length > 1;
  // One tab bar for the window, always mounted and only shown or hidden. Each
  // page keeps an empty slot of the bar's height under its toolbar; the bar is
  // laid over the active page's slot.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [tabBarTop, setTabBarTop] = React.useState(0);
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !showTabBar) return;
    const measure = () => {
      const slot = container.querySelector<HTMLElement>(
        '[data-active-tab] [data-slot="browser-tab-slot"]'
      );
      if (slot) setTabBarTop(slot.offsetTop);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [showTabBar, win.browserWindowId]);
  // A tab pulled off the bar: a window of its own, under the pointer, that
  // follows it until release.
  const geometryRef = React.useRef(updateWindowGeometry);
  geometryRef.current = updateWindowGeometry;
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
    followTornTab(newId, at, pointer, (position) =>
      geometryRef.current(newId, { position })
    );
  };
  const tabSlot = (
    <div
      data-slot="browser-tab-slot"
      className={cn("h-ui-control-large shrink-0", !showTabBar && "hidden")}
    />
  );
  return (
    <div ref={containerRef} className="relative flex h-full w-full flex-1 overflow-hidden">
      <BrowserTabBar
        hidden={!showTabBar}
        top={tabBarTop}
        tabs={tabs}
        activeId={win.browserWindowId}
        onSelect={(id) => selectBrowserTab(win.id, id)}
        onClose={(id) => closeBrowserTab(win.id, id)}
        onReorder={(ids) => reorderBrowserTabs(win.id, ids)}
        onDetach={(id) => detachBrowserTab(win.id, id)}
        onTearOff={tearOff}
        onPin={(id, pinned) => pinBrowserTab(win.id, id, pinned)}
      />
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
              tabBar={tabSlot}
              darkReaderEnabled={darkReaderEnabled}
              onToggleDarkReader={onToggleDarkReader}
            />
          </div>
        );
      })}
    </div>
  );
}
