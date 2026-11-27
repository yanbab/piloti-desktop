import * as React from "react";
import { cn } from "@/lib/core/utils";
import { startPointerDrag } from "@/lib/dnd/pointer-drag";

export interface PanelWidthOptions {
  /** Persistence key, e.g. "files-sidebar". */
  id: string;
  /** Which edge of the panel carries the handle. */
  side: "left" | "right";
  defaultWidth: number;
  min: number;
  max: number;
  /** Dragging narrower than this collapses the panel. */
  collapseBelow: number;
  /** Width within this many px of the default snaps to it. */
  snap?: number;
  /** Width reported while collapsed (a sidebar's icon bar); 0 hides the panel. */
  collapsedWidth?: number;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const STORAGE_PREFIX = "piloti.panel.";

function readStored(id: string): { width: number; collapsed: boolean } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { width?: unknown; collapsed?: unknown };
    if (typeof parsed.width !== "number") return null;
    return { width: parsed.width, collapsed: parsed.collapsed === true };
  } catch {
    return null;
  }
}

function writeStored(id: string, value: { width: number; collapsed: boolean }): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(value));
  } catch {
    // storage unavailable: the width just won't persist
  }
}

/**
 * Width state for a resizable side panel: min / max clamp, snap to the default,
 * collapse when dragged below a threshold, remembered per `id`.
 */
export function usePanelWidth(
  options: PanelWidthOptions & {
    /** Remembers the width somewhere else than this viewer's localStorage. */
    storage?: {
      read: () => { width: number; collapsed: boolean };
      write: (value: { width: number; collapsed: boolean }) => void;
    };
  },
) {
  const { id, side, defaultWidth, min, max, collapseBelow, snap = 10, collapsedWidth = 0 } = options;
  const storageRef = React.useRef(options.storage);
  storageRef.current = options.storage;
  const persist = React.useCallback(
    (value: { width: number; collapsed: boolean }) => {
      if (storageRef.current) storageRef.current.write(value);
      else writeStored(id, value);
    },
    [id],
  );
  const [state, setState] = React.useState(() => {
    const stored = options.storage?.read() ?? readStored(id);
    return {
      width: Math.min(max, Math.max(min, stored?.width ?? defaultWidth)),
      collapsed: stored?.collapsed ?? false,
    };
  });
  const [dragging, setDragging] = React.useState(false);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const onCollapsedRef = React.useRef(options.onCollapsedChange);
  onCollapsedRef.current = options.onCollapsedChange;

  const apply = React.useCallback(
    (next: { width: number; collapsed: boolean }) => {
      if (next.collapsed !== stateRef.current.collapsed) onCollapsedRef.current?.(next.collapsed);
      stateRef.current = next;
      setState(next);
    },
    [],
  );

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const start = stateRef.current;
      const startWidth = start.collapsed ? collapsedWidth : start.width;
      setDragging(true);
      let raf = 0;
      let lastX = startX;
      const compute = () => {
        raf = 0;
        // `side` is the edge carrying the handle: a left-edge handle grows the panel leftwards.
        const raw = startWidth + (side === "left" ? -(lastX - startX) : lastX - startX);
        if (raw < collapseBelow) {
          apply({ width: start.collapsed ? start.width : stateRef.current.width, collapsed: true });
          return;
        }
        let width = Math.min(max, Math.max(min, raw));
        if (Math.abs(width - defaultWidth) <= snap) width = defaultWidth;
        apply({ width, collapsed: false });
      };
      startPointerDrag(e, {
        threshold: 0,
        captureElement: e.currentTarget,
        onMove: (ev) => {
          lastX = ev.clientX;
          if (!raf) raf = requestAnimationFrame(compute);
        },
        onEnd: () => {
          if (raf) cancelAnimationFrame(raf);
          compute();
          setDragging(false);
          persist(stateRef.current);
        },
      });
    },
    [apply, collapseBelow, collapsedWidth, defaultWidth, max, min, persist, side, snap],
  );

  const reset = React.useCallback(() => {
    const next = { width: defaultWidth, collapsed: false };
    apply(next);
    persist(next);
  }, [apply, defaultWidth, persist]);

  const setCollapsed = React.useCallback(
    (collapsed: boolean) => {
      const next = { width: stateRef.current.width, collapsed };
      apply(next);
      persist(next);
    },
    [apply, persist],
  );

  return {
    width: state.collapsed ? collapsedWidth : state.width,
    collapsed: state.collapsed,
    dragging,
    reset,
    setCollapsed,
    handleProps: { onPointerDown, onDoubleClick: reset },
  };
}

/** The draggable edge of a resizable panel (the panel must be `relative`). */
export function PanelResizeHandle({
  side,
  dragging,
  handleProps,
  label,
  style,
}: {
  side: "left" | "right";
  /** Position the handle yourself (e.g. `left` inside a relative parent) instead of on a panel edge. */
  style?: React.CSSProperties;
  dragging: boolean;
  handleProps: ReturnType<typeof usePanelWidth>["handleProps"];
  label: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-window-no-drag
      {...handleProps}
      style={style}
      className={cn(
        "group/resize absolute inset-y-0 z-30 w-2 cursor-col-resize touch-none",
        !style && (side === "right" ? "-right-1" : "-left-1"),
      )}
    >
    </div>
  );
}
