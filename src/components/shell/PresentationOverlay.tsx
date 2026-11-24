import * as React from "react";
import {
  FLOATING_EDGE_CURSORS,
  floatingBounds,
  floatingDragPosition,
  floatingEdgeAt,
  resizeFloatingRect,
  settleFloatingPosition,
  type FloatingEdge,
  type FloatingRect,
} from "@/lib/shell/floating-window";
import {
  setWindowPresentation,
  type WindowPresentation,
  type WorkArea,
} from "@/lib/shell/window-presentation";

const DRAG_THRESHOLD = 4;
const DEFAULT_MIN_WIDTH = 160;

/**
 * Covers a window shown through a non-interactive presentation. Floating
 * presentations are moved and resized here; other pointer events go to the
 * presenter (the plugin).
 */
export function PresentationOverlay({
  windowId,
  presentation,
  naturalSize,
  workArea,
}: {
  windowId: string;
  presentation: WindowPresentation;
  /** Unscaled window size, for the aspect ratio. */
  naturalSize: { width: number; height: number };
  workArea: WorkArea;
}) {
  const floating = presentation.floating;

  const presentedRect = (p: WindowPresentation): FloatingRect => ({
    x: p.x,
    y: p.y,
    width: p.width,
    height:
      naturalSize.width > 0 ? (p.width * naturalSize.height) / naturalSize.width : p.width,
  });

  const edgeUnder = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    if (!floating?.resizable) return null;
    const r = e.currentTarget.getBoundingClientRect();
    return floatingEdgeAt(
      { x: r.left, y: r.top, width: r.width, height: r.height },
      e.clientX,
      e.clientY
    );
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    presentation.onPointerDown?.(e.nativeEvent);
    if (!floating || e.button !== 0) return;

    const edge: FloatingEdge | null = edgeUnder(e);
    const start = presentedRect(presentation);
    const bounds = floatingBounds(workArea);
    const limits = {
      minWidth: floating.minWidth ?? DEFAULT_MIN_WIDTH,
      maxWidth: Math.min(
        floating.maxWidth ?? Number.POSITIVE_INFINITY,
        bounds.width,
        (bounds.height * start.width) / Math.max(1, start.height)
      ),
    };
    const origin = { x: e.clientX, y: e.clientY };
    let active = false;
    let rect = start;

    const show = (next: FloatingRect, animate: boolean) => {
      setWindowPresentation(windowId, {
        ...presentation,
        x: next.x,
        y: next.y,
        width: next.width,
        animate,
      });
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      if (!active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      active = true;
      if (edge) {
        rect = resizeFloatingRect(start, edge, dx, dy, limits);
      } else {
        const moved = { ...start, x: start.x + dx, y: start.y + dy };
        rect = { ...moved, ...floatingDragPosition(moved, bounds) };
      }
      show(rect, false);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      if (!active) return;
      rect = { ...rect, ...settleFloatingPosition(rect, bounds) };
      show(rect, true);
      presentation.onChange?.({ x: rect.x, y: rect.y, width: rect.width });
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  };

  return (
    <div
      data-slot="window-presentation-overlay"
      className="absolute inset-0 z-50 cursor-default"
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (!floating?.resizable || e.buttons) return;
        const edge = edgeUnder(e);
        e.currentTarget.style.cursor = edge ? FLOATING_EDGE_CURSORS[edge] : "";
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        presentation.onDoubleClick?.(e.nativeEvent);
      }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
