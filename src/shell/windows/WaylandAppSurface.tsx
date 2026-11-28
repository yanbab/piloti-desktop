/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import { usePiloti } from "@/lib/engine/piloti";
import { useWindowContext } from "@/components/ui/window";
import { type DesktopWindowInstance } from "@/context/DesktopStateContext";

/**
 * Wraps the native Domicile `<app>` element and reports its exact viewport CSS
 * pixel box (`getBoundingClientRect()`) to `domicile.windows.setBounds` so
 * Wayland pointer coordinates and surface scaling match 1:1 to the pixel.
 */
export function WaylandAppSurface({ win }: { win: DesktopWindowInstance }) {
  const piloti = usePiloti();
  const windowCtx = useWindowContext();
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const syncBounds = React.useCallback(() => {
    if (!win.waylandAppId) return;
    if (win.minimized) {
      piloti.windows.setBounds(win.waylandAppId, {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    piloti.windows.setBounds(win.waylandAppId, {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, [piloti.windows, win.minimized, win.waylandAppId]);

  React.useLayoutEffect(() => {
    syncBounds();
  }, [
    syncBounds,
    win.position.x,
    win.position.y,
    win.size.width,
    win.size.height,
    win.maximized,
  ]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncBounds());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncBounds]);

  return (
    <div
      ref={containerRef}
      onWheel={(e) => e.stopPropagation()}
      className="h-full w-full flex-1 overflow-hidden overscroll-none"
    >
      <app
        app-id={win.waylandAppId ?? ""}
        frame={
          win.syncedFrame !== undefined ? String(win.syncedFrame) : undefined
        }
        resizing={windowCtx?.resizing ? "" : undefined}
        style={win.cursor ? { cursor: win.cursor } : undefined}
        className="block h-full w-full"
      />
    </div>
  );
}
