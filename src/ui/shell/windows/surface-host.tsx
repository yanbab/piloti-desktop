/**
 * Views rendered once, placed in whichever window holds them.
 *
 * A view's React tree lives at a stable place (`SurfacePortal`, in a flat list
 * the window manager renders), portalled into a host element of its own. A
 * window shows it by putting that host in a `SurfaceSlot`. Moving a view to
 * another window moves the host: its React state stays, a Linux app's `<app>`
 * finds its surface again by id. An iframe still reloads when moved between
 * windows; switching tabs inside one window moves nothing.
 *
 * React events of a portalled view reach the portal's parents, not the
 * window's: `SurfacePortal` hands presses and double-clicks to the window.
 */
import * as React from "react";
import { createPortal } from "react-dom";

const hosts = new Map<string, HTMLDivElement>();
const holders = new Map<string, number>();

const HOST_CLASS = "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col";

/** The element view `surfaceId` is rendered into (made on first use). */
export function surfaceHost(surfaceId: string): HTMLDivElement {
  let host = hosts.get(surfaceId);
  if (!host) {
    host = document.createElement("div");
    host.className = HOST_CLASS;
    host.dataset.surfaceId = surfaceId;
    hosts.set(surfaceId, host);
  }
  return host;
}

function hold(surfaceId: string): () => void {
  holders.set(surfaceId, (holders.get(surfaceId) ?? 0) + 1);
  return () => {
    holders.set(surfaceId, (holders.get(surfaceId) ?? 1) - 1);
    // Let a remount in the same commit (Strict Mode) keep it.
    queueMicrotask(() => {
      if ((holders.get(surfaceId) ?? 0) > 0) return;
      holders.delete(surfaceId);
      hosts.get(surfaceId)?.remove();
      hosts.delete(surfaceId);
    });
  };
}

/** Where a window shows view `surfaceId`. */
export function SurfaceSlot({ surfaceId, className }: { surfaceId: string; className?: string }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    const host = surfaceHost(surfaceId);
    if (host.parentNode !== slot) slot.appendChild(host);
  }, [surfaceId]);
  return <div ref={ref} data-surface-slot={surfaceId} className={className} />;
}

export interface SurfaceEvents {
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
}

/** View `surfaceId`'s content, rendered here and shown in its slot. */
export function SurfacePortal({
  surfaceId,
  events,
  children,
}: {
  surfaceId: string;
  events: SurfaceEvents;
  children: React.ReactNode;
}) {
  const host = surfaceHost(surfaceId);
  React.useLayoutEffect(() => hold(surfaceId), [surfaceId]);
  return createPortal(
    <div
      className={HOST_CLASS}
      onPointerDown={events.onPointerDown}
      onDoubleClick={events.onDoubleClick}
      onContextMenu={events.onContextMenu}
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    host,
  );
}
