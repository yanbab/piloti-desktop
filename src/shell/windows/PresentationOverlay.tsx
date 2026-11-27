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
} from "@/lib/windows/floating-window";
import { startPointerDrag } from "@/lib/dnd/pointer-drag";
import { useDesktopSettings } from "@/context/DesktopStateContext";
import { useWindowActions } from "@/context/WindowsContext";
import { isCloseOnLeft } from "@/components/ui/window";
import { _ } from "@/lib/core/i18n";
import { HoverCloseButton } from "./HoverCloseButton";
import {
  setWindowPresentation,
  type WindowPresentation,
  type WorkArea,
} from "@/lib/windows/window-presentation";

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
  const settings = useDesktopSettings(["fileActivationMode", "windowButtonLayout"]);
  const singleClickActivates = settings.fileActivationMode !== "double";
  const { closeWindow } = useWindowActions();
  const closeOnLeft = isCloseOnLeft(settings.windowButtonLayout);
  const scale =
    naturalSize.width > 0 ? Math.max(0.05, presentation.width / naturalSize.width) : 1;

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
    if (e.button !== 0) return;
    if (!floating) {
      if (singleClickActivates) {
        startPointerDrag(e, {
          onMove: () => undefined,
          onEnd: (_ev, { moved }) => {
            if (!moved) presentation.onActivate?.();
          },
        });
      }
      return;
    }

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

    startPointerDrag(e, {
      onMove: (_ev, { dx, dy }) => {
        if (edge) {
          rect = resizeFloatingRect(start, edge, dx, dy, limits);
        } else {
          const moved = { ...start, x: start.x + dx, y: start.y + dy };
          rect = { ...moved, ...floatingDragPosition(moved, bounds) };
        }
        show(rect, false);
      },
      onEnd: (_ev, { moved }) => {
        if (!moved) {
          // A click, not a drag: "open" it if single click opens.
          if (singleClickActivates) presentation.onActivate?.();
          return;
        }
        rect = { ...rect, ...settleFloatingPosition(rect, bounds) };
        show(rect, true);
        presentation.onChange?.({ x: rect.x, y: rect.y, width: rect.width });
      },
    });
  };

  return (
    <div
      data-slot="window-presentation-overlay"
      className="group absolute inset-0 z-50 cursor-default"
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (!floating?.resizable || e.buttons) return;
        const edge = edgeUnder(e);
        e.currentTarget.style.cursor = edge ? FLOATING_EDGE_CURSORS[edge] : "";
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        presentation.onDoubleClick?.(e.nativeEvent);
        if (!singleClickActivates) presentation.onActivate?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {floating && (
        <HoverCloseButton
          inset
          closeOnLeft={closeOnLeft}
          // The window is drawn scaled down: undo it so the button keeps the
          // Overview size, 6px inside the corner.
          style={{
            transform: `scale(${1 / scale})`,
            transformOrigin: closeOnLeft ? "top left" : "top right",
            top: 6 / scale,
            [closeOnLeft ? "left" : "right"]: 6 / scale,
          }}
          aria-label={_("Close")}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            closeWindow(windowId);
          }}
        />
      )}
    </div>
  );
}
