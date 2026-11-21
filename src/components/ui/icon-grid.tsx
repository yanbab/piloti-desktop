import * as React from "react";
import { createPortal } from "react-dom";
import {
  AlertCircleIcon,
  BriefcaseIcon,
  HeartIcon,
  TagIcon,
} from "lucide-react";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { captureLaunchOriginFromElement } from "@/lib/launch-origin";
import { useSettings, useWindowManager } from "@/context/DesktopStateContext";
import {
  DynamicFileIcon,
  DynamicFolderIcon,
  getAccentFolderIconUrl,
  getAccentHtmlIconUrl,
  useOpenFolderPaths,
} from "@/data/folder-icons";
import {
  assignGridPositions,
  clientPointToGridCell,
  computeGridMetrics,
  DESKTOP_GRID_PADDING,
  DESKTOP_ICON_CELL_HEIGHT,
  DESKTOP_ICON_CELL_WIDTH,
  type DesktopIconAlign,
  findItemsInRect,
  findNextKeyboardItemId,
  findTypeAheadItemId,
  type GridCoord,
  type GridMetrics,
  type IconGridItem,
  type IconGridMode,
  normalizeRect,
} from "@/lib/desktop-icons";
import { cn } from "@/lib/utils";
import {
  getVfsEntry,
  getVfsImageThumbnailUrl,
  loadVfsEmblemsMap,
  subscribeWebVfs,
  VFS_EMBLEM_META,
  type VfsEmblemId,
} from "@/lib/web-vfs";

function splitFileNameExt(name: string, kind: IconGridItem["kind"]): [string, string] {
  if (kind !== "file") return [name, ""];
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === name.length - 1) return [name, ""];
  return [name.slice(0, dotIdx), name.slice(dotIdx)];
}

type ResolvedDropTarget =
  | { kind: "dock"; appId: string }
  | { kind: "vfs"; destPath: string }
  | { kind: "window"; windowId: string }
  | { kind: "blocked" }
  | null;

function resolveTopDropTarget(
  clientX: number,
  clientY: number,
  draggedPaths: readonly string[],
): ResolvedDropTarget {
  if (typeof document === "undefined") return null;
  const hits = document.elementsFromPoint(clientX, clientY);
  for (const el of hits) {
    if (el.hasAttribute("data-dock-app-id")) {
      const appId = el.getAttribute("data-dock-app-id");
      if (appId) return { kind: "dock", appId };
    }
    if (el.hasAttribute("data-vfs-drop-path")) {
      const destPath = el.getAttribute("data-vfs-drop-path");
      if (destPath) {
        const isSelfOrChild = draggedPaths.some(
          (src) => src === destPath || destPath.startsWith(`${src}/`),
        );
        if (!isSelfOrChild) {
          return { kind: "vfs", destPath };
        }
      }
    }
    if (el.hasAttribute("data-drop-window-id")) {
      const windowId = el.getAttribute("data-drop-window-id");
      if (windowId) return { kind: "window", windowId };
    }
    if (el.getAttribute("data-slot") === "window") {
      return { kind: "blocked" };
    }
  }
  return null;
}

export interface IconGridProps {
  items: readonly IconGridItem[];
  mode?: IconGridMode;
  align?: DesktopIconAlign;
  currentDirPath?: string;
  positions?: Readonly<Record<string, GridCoord>>;
  onMoveItem?: (itemId: string, cell: GridCoord, metrics: GridMetrics) => void;
  onMoveItems?: (
    itemIds: string[],
    primaryId: string,
    cell: GridCoord,
    metrics: GridMetrics,
  ) => void;
  onDropItem?: (item: IconGridItem, clientX: number, clientY: number) => void;
  onDropItems?: (items: IconGridItem[], destPath: string) => void;
  onActivateItem: (item: IconGridItem) => void;
  onContextMenuItem?: (item: IconGridItem, event: React.MouseEvent) => void;
  renamingId?: string | null;
  onCommitRename?: (item: IconGridItem, nextName: string) => void;
  onCancelRename?: () => void;
  selectedIds: readonly string[];
  onSelectIds: (ids: string[]) => void;
  cellWidth?: number;
  cellHeight?: number;
  iconSize?: number;
  padding?: number;
  ariaLabel?: string;
  className?: string;
}

interface DragState {
  itemId: string;
  draggedIds: string[];
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  currentX: number;
  currentY: number;
  active: boolean;
  targetCell: GridCoord | null;
}

interface MarqueeState {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
  initialSelection: readonly string[];
  additive: boolean;
}

export function IconGrid({
  items,
  mode = "spatial",
  align = "left",
  currentDirPath,
  positions,
  onMoveItem,
  onMoveItems,
  onDropItem,
  onDropItems,
  onActivateItem,
  onContextMenuItem,
  renamingId = null,
  onCommitRename,
  onCancelRename,
  selectedIds,
  onSelectIds,
  cellWidth = DESKTOP_ICON_CELL_WIDTH,
  cellHeight = DESKTOP_ICON_CELL_HEIGHT,
  iconSize = 48,
  padding = DESKTOP_GRID_PADDING,
  ariaLabel = "Icon Grid",
  className,
}: IconGridProps) {
  const { settings, isBrowserRuntime } = useSettings();
  const { windows } = useWindowManager();
  const openFolderPaths = useOpenFolderPaths();
  const openFilePaths = React.useMemo(() => {
    const set = new Set<string>();
    for (const w of windows) {
      if (w.payload && w.payload.startsWith("/")) {
        set.add(w.payload.replace(/\/+$/, "") || "/");
      }
      if (w.appId.startsWith("file:")) {
        set.add(w.appId.slice("file:".length).replace(/\/+$/, "") || "/");
      }
    }
    return set;
  }, [windows]);
  const [hoveredDropPath, setHoveredDropPath] = React.useState<string | null>(
    null,
  );
  const [emblemsMap, setEmblemsMap] = React.useState<
    Record<string, VfsEmblemId[]>
  >(() => loadVfsEmblemsMap());
  React.useEffect(() => {
    return subscribeWebVfs(() => {
      setEmblemsMap(loadVfsEmblemsMap());
    });
  }, []);
  const useAccentIcons = isBrowserRuntime || mode === "flow";
  const resolveItemIconUrl = (item: IconGridItem): string | undefined => {
    if (useAccentIcons) {
      if (item.kind === "directory") {
        return getAccentFolderIconUrl(settings.accentColor);
      }
      if (
        item.iconCandidates?.includes("text-html") ||
        /\.(html|htm)$/i.test(item.name)
      ) {
        return getAccentHtmlIconUrl(settings.accentColor);
      }
    }
    return item.iconUrl;
  };
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const dragGhostRef = React.useRef<HTMLDivElement | null>(null);
  const suppressClickRef = React.useRef<string | null>(null);
  const suppressContainerClickRef = React.useRef(false);
  const [size, setSize] = React.useState<{ width: number; height: number }>({
    width: 1200,
    height: 760,
  });
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  dragRef.current = drag;
  const pendingSettleRef = React.useRef<{
    ids: Set<string>;
    oldCoords: Record<string, GridCoord>;
    dropDx: number;
    dropDy: number;
  } | null>(null);
  const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const primarySelectedId =
    selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };
    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const compactHorizontal = iconSize <= 24;
  const effectiveCellWidth = compactHorizontal ? Math.max(cellWidth, 168) : cellWidth;
  const effectiveCellHeight = compactHorizontal ? 30 : cellHeight;
  const emblemSize = Math.max(18, Math.round(iconSize * 0.32));
  const emblemGlyphSize = Math.max(10, Math.round(emblemSize * 0.58));
  const heartSize = Math.max(18, Math.round(iconSize * 0.34));
  const emblemStackOverlap = Math.max(5, Math.round(emblemSize * 0.36));

  const metrics = React.useMemo(
    () =>
      computeGridMetrics(
        size.width,
        size.height,
        effectiveCellWidth,
        effectiveCellHeight,
        padding,
      ),
    [effectiveCellHeight, effectiveCellWidth, padding, size.height, size.width],
  );

  const resolvedPositions = React.useMemo(
    () =>
      assignGridPositions(
        items,
        positions ?? {},
        metrics.cols,
        metrics.rows,
        align,
      ),
    [align, items, metrics.cols, metrics.rows, positions],
  );
  const resolvedPositionsRef = React.useRef(resolvedPositions);
  resolvedPositionsRef.current = resolvedPositions;

  React.useLayoutEffect(() => {
    const pending = pendingSettleRef.current;
    if (!pending || mode !== "spatial") return;
    pendingSettleRef.current = null;
    const timers: number[] = [];
    for (const id of pending.ids) {
      const btn = itemRefs.current.get(id);
      const oldCoord = pending.oldCoords[id];
      const newCoord = resolvedPositions[id];
      if (!btn || !oldCoord || !newCoord) continue;
      const offsetX =
        (oldCoord.col - newCoord.col) * effectiveCellWidth + pending.dropDx;
      const offsetY =
        (oldCoord.row - newCoord.row) * effectiveCellHeight + pending.dropDy;
      btn.style.transition = "none";
      btn.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
      void btn.offsetWidth;
      btn.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
      btn.style.transform = "translate3d(0, 0, 0)";
      const t = window.setTimeout(() => {
        btn.style.transition = "";
        btn.style.transform = "";
      }, 240);
      timers.push(t);
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [effectiveCellHeight, effectiveCellWidth, mode, resolvedPositions]);

  const focusItemButton = React.useCallback((id: string) => {
    const btn = itemRefs.current.get(id);
    if (btn) {
      btn.focus({ preventScroll: true });
      btn.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, []);

  React.useEffect(() => {
    const onGlobalFileDrag = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          active?: boolean;
          item?: { path?: string };
          items?: Array<{ path?: string }>;
          clientX?: number;
          clientY?: number;
        }>
      ).detail;
      if (
        !detail?.active ||
        typeof detail.clientX !== "number" ||
        typeof detail.clientY !== "number"
      ) {
        setHoveredDropPath(null);
        return;
      }
      const draggedPaths = detail.items?.length
        ? detail.items
            .map((d) => d.path)
            .filter((p): p is string => Boolean(p))
        : detail.item?.path
          ? [detail.item.path]
          : [];
      const topTarget = resolveTopDropTarget(
        detail.clientX,
        detail.clientY,
        draggedPaths,
      );
      const found = topTarget?.kind === "vfs" ? topTarget.destPath : null;
      setHoveredDropPath((prev) => (prev === found ? prev : found));
    };
    window.addEventListener("residence:file-drag", onGlobalFileDrag);
    return () =>
      window.removeEventListener("residence:file-drag", onGlobalFileDrag);
  }, []);

  const isDragStarted = Boolean(drag);
  React.useEffect(() => {
    if (!isDragStarted) return;
    let rafId = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur || e.pointerId !== cur.pointerId) return;
      const dx = e.clientX - cur.startX;
      const dy = e.clientY - cur.startY;
      const movedEnough = cur.active || Math.hypot(dx, dy) >= 6;
      if (!movedEnough) return;

      const wasActive = cur.active;
      cur.active = true;
      cur.currentX = e.clientX;
      cur.currentY = e.clientY;

      if (dragGhostRef.current) {
        dragGhostRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }

      const draggedItems = items.filter((i) => cur.draggedIds.includes(i.id));
      const draggedItem =
        items.find((i) => i.id === cur.itemId) ?? draggedItems[0];
      if (draggedItem && !rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const latest = dragRef.current;
          if (!latest?.active) return;
          window.dispatchEvent(
            new CustomEvent("residence:file-drag", {
              detail: {
                active: true,
                item: draggedItem,
                items: draggedItems,
                clientX: latest.currentX,
                clientY: latest.currentY,
              },
            }),
          );
        });
      }

      if (!wasActive) {
        setDrag({ ...cur });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur || e.pointerId !== cur.pointerId) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (cur.active) {
        window.dispatchEvent(
          new CustomEvent("residence:file-drag", {
            detail: { active: false },
          }),
        );
        suppressClickRef.current = cur.itemId;
        const rect = containerRef.current?.getBoundingClientRect();
        const dropCell = rect
          ? clientPointToGridCell(
              e.clientX - rect.left,
              e.clientY - rect.top,
              metrics,
            )
          : cur.targetCell;
        const draggedItems = items.filter((i) =>
          cur.draggedIds.includes(i.id),
        );
        const draggedItem =
          items.find((i) => i.id === cur.itemId) ?? draggedItems[0];
        if (draggedItem) {
          const topTarget = resolveTopDropTarget(
            e.clientX,
            e.clientY,
            draggedItems.map((d) => d.path),
          );
          if (topTarget?.kind === "dock") {
            window.dispatchEvent(
              new CustomEvent("residence:file-drop-dock", {
                detail: {
                  appId: topTarget.appId,
                  item: draggedItem,
                  items: draggedItems,
                },
              }),
            );
          } else if (topTarget?.kind === "window") {
            window.dispatchEvent(
              new CustomEvent("residence:file-drop-window", {
                detail: {
                  windowId: topTarget.windowId,
                  item: draggedItem,
                  items: draggedItems,
                },
              }),
            );
          } else if (topTarget?.kind === "vfs") {
            const isSameDir =
              (currentDirPath !== undefined &&
                topTarget.destPath === currentDirPath) ||
              draggedItems.every(
                (d) =>
                  d.path.startsWith(`${topTarget.destPath}/`) &&
                  !d.path
                    .slice(topTarget.destPath.length + 1)
                    .includes("/"),
              );
            if (isSameDir) {
              if (mode === "spatial" && dropCell) {
                pendingSettleRef.current = {
                  ids: new Set(cur.draggedIds),
                  oldCoords: { ...resolvedPositionsRef.current },
                  dropDx: e.clientX - cur.startX,
                  dropDy: e.clientY - cur.startY,
                };
                if (onMoveItems) {
                  onMoveItems(cur.draggedIds, cur.itemId, dropCell, metrics);
                } else {
                  onMoveItem?.(cur.itemId, dropCell, metrics);
                }
              }
            } else {
              window.dispatchEvent(
                new CustomEvent("residence:desktop-drop-position", {
                  detail: {
                    destPath: topTarget.destPath,
                    names: draggedItems.map((d) => d.name),
                    clientX: e.clientX,
                    clientY: e.clientY,
                  },
                }),
              );
              if (onDropItems) {
                onDropItems(draggedItems, topTarget.destPath);
              } else if (onDropItem) {
                onDropItem(draggedItem, e.clientX, e.clientY);
              }
            }
          } else if (!topTarget && mode === "spatial" && dropCell) {
            pendingSettleRef.current = {
              ids: new Set(cur.draggedIds),
              oldCoords: { ...resolvedPositionsRef.current },
              dropDx: e.clientX - cur.startX,
              dropDy: e.clientY - cur.startY,
            };
            if (onMoveItems) {
              onMoveItems(cur.draggedIds, cur.itemId, dropCell, metrics);
            } else {
              onMoveItem?.(cur.itemId, dropCell, metrics);
            }
          }
        }
      }
      dragRef.current = null;
      setDrag(null);
    };

    let cancelTimer = 0;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const cur = dragRef.current;
      if (!cur) return;
      e.preventDefault();
      e.stopPropagation();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (cur.active) {
        window.dispatchEvent(
          new CustomEvent("residence:file-drag", {
            detail: { active: false },
          }),
        );
        const ghost = dragGhostRef.current;
        if (ghost) {
          ghost.style.transition =
            "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
          ghost.style.transform = "translate3d(0px, 0px, 0)";
          cancelTimer = window.setTimeout(() => {
            dragRef.current = null;
            setDrag(null);
          }, 220);
          return;
        }
      }
      dragRef.current = null;
      setDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (cancelTimer) window.clearTimeout(cancelTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    currentDirPath,
    isDragStarted,
    items,
    metrics,
    mode,
    onDropItem,
    onDropItems,
    onMoveItem,
    onMoveItems,
  ]);

  React.useEffect(() => {
    if (!marquee) return;

    const getHitIds = (
      selectionRect: { left: number; top: number; right: number; bottom: number },
      containerRect: DOMRect,
      scrollLeft: number,
      scrollTop: number,
    ): string[] => {
      const hasDomRefs = itemRefs.current.size > 0;
      if (!hasDomRefs) {
        return findItemsInRect(items, resolvedPositions, selectionRect, metrics);
      }
      const inset = 4;
      const hit: string[] = [];
      for (const item of items) {
        const el = itemRefs.current.get(item.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const itemLeft = r.left - containerRect.left + scrollLeft + inset;
        const itemTop = r.top - containerRect.top + scrollTop + inset;
        const itemRight = r.right - containerRect.left + scrollLeft - inset;
        const itemBottom = r.bottom - containerRect.top + scrollTop - inset;
        if (
          selectionRect.left <= itemRight &&
          selectionRect.right >= itemLeft &&
          selectionRect.top <= itemBottom &&
          selectionRect.bottom >= itemTop
        ) {
          hit.push(item.id);
        }
      }
      return hit;
    };

    const applyMarqueeSelection = (e: PointerEvent, commitMove: boolean) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const currentX = Math.max(
        0,
        Math.min(container.scrollWidth, e.clientX - rect.left + container.scrollLeft),
      );
      const currentY = Math.max(
        0,
        Math.min(container.scrollHeight, e.clientY - rect.top + container.scrollTop),
      );
      const movedEnough =
        marquee.active ||
        Math.hypot(currentX - marquee.startX, currentY - marquee.startY) >= 4;
      if (!movedEnough) return;

      const selectionRect = normalizeRect(
        marquee.startX,
        marquee.startY,
        currentX,
        currentY,
      );
      const hitIds = getHitIds(
        selectionRect,
        rect,
        container.scrollLeft,
        container.scrollTop,
      );
      if (marquee.additive) {
        const merged = new Set(marquee.initialSelection);
        for (const id of hitIds) merged.add(id);
        onSelectIds(Array.from(merged));
      } else {
        onSelectIds(hitIds);
      }

      if (commitMove) {
        setMarquee((prev) =>
          prev
            ? {
                ...prev,
                currentX,
                currentY,
                active: true,
              }
            : null,
        );
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== marquee.pointerId) return;
      applyMarqueeSelection(e, true);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== marquee.pointerId) return;
      applyMarqueeSelection(e, false);
      if (marquee.active) {
        suppressContainerClickRef.current = true;
      }
      setMarquee(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [items, marquee, metrics, onSelectIds, resolvedPositions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;

    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      e.preventDefault();
      const nextId = findNextKeyboardItemId(
        items,
        resolvedPositions,
        primarySelectedId,
        e.key,
      );
      if (nextId) {
        onSelectIds([nextId]);
        focusItemButton(nextId);
      }
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      if (!primarySelectedId) return;
      const target = items.find((item) => item.id === primarySelectedId);
      if (target) {
        e.preventDefault();
        onActivateItem(target);
      }
      return;
    }

    if (e.key === "Escape") {
      if (selectedIds.length > 0) {
        e.preventDefault();
        onSelectIds([]);
      }
      return;
    }

    if (
      e.key.length === 1 &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      /^[a-z0-9._-]$/i.test(e.key)
    ) {
      const nextId = findTypeAheadItemId(items, primarySelectedId, e.key);
      if (nextId) {
        e.preventDefault();
        onSelectIds([nextId]);
        focusItemButton(nextId);
      }
    }
  };

  const firstVisibleId = items[0]?.id ?? null;
  const marqueeRect = marquee?.active
    ? normalizeRect(
        marquee.startX,
        marquee.startY,
        marquee.currentX,
        marquee.currentY,
      )
    : null;

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label={ariaLabel}
      tabIndex={items.length > 0 && selectedIds.length === 0 ? 0 : -1}
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const targetEl = e.target as HTMLElement | null;
        if (targetEl?.closest?.('[role="gridcell"], input, textarea, button')) {
          return;
        }
        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        if (!container || !rect) return;
        const startX = e.clientX - rect.left + container.scrollLeft;
        const startY = e.clientY - rect.top + container.scrollTop;
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        if (!additive && selectedIds.length > 0) {
          onSelectIds([]);
        }
        setMarquee({
          pointerId: e.pointerId,
          startX,
          startY,
          currentX: startX,
          currentY: startY,
          active: false,
          initialSelection: selectedIds,
          additive,
        });
      }}
      onClick={(e) => {
        const targetEl = e.target as HTMLElement | null;
        if (
          !targetEl?.closest?.('[role="gridcell"]') &&
          suppressContainerClickRef.current
        ) {
          suppressContainerClickRef.current = false;
        }
      }}
      className={cn(
        "relative h-full w-full overflow-hidden bg-transparent outline-none",
        mode === "flow" &&
          (compactHorizontal
            ? "flex flex-wrap content-start gap-0.5 overflow-y-auto p-3"
            : "flex flex-wrap content-start gap-2 overflow-y-auto p-4"),
        className,
      )}
    >
      {marqueeRect && (
        <div
          aria-hidden="true"
          style={{
            left: `${marqueeRect.left}px`,
            top: `${marqueeRect.top}px`,
            width: `${marqueeRect.right - marqueeRect.left}px`,
            height: `${marqueeRect.bottom - marqueeRect.top}px`,
          }}
          className="pointer-events-none absolute z-40 rounded-[3px] border border-adw-accent/85 bg-adw-accent/20"
        />
      )}

      {items.map((item) => {
        const selected = selectedSet.has(item.id);
        const isHiddenFile = item.name.startsWith(".");
        const isDragging =
          Boolean(drag?.active) && Boolean(drag?.draggedIds.includes(item.id));
        const coord = resolvedPositions[item.id] ?? { col: 0, row: 0 };

        const spatialStyle: React.CSSProperties =
          mode === "spatial"
            ? {
                position: "absolute",
                left: `${padding + coord.col * effectiveCellWidth}px`,
                top: `${padding + coord.row * effectiveCellHeight}px`,
                width: `${effectiveCellWidth}px`,
                height: `${effectiveCellHeight}px`,
                zIndex: isDragging ? 9999 : selected ? 20 : 1,
                opacity: isDragging ? 0.25 : isHiddenFile ? 0.55 : undefined,
              }
            : {
                width: `${effectiveCellWidth}px`,
                height: `${effectiveCellHeight}px`,
                opacity: isDragging ? 0.25 : isHiddenFile ? 0.55 : undefined,
              };

        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) {
                itemRefs.current.set(item.id, node);
              } else {
                itemRefs.current.delete(item.id);
              }
            }}
            type="button"
            role="gridcell"
            aria-selected={selected}
            data-vfs-drop-path={
              item.kind === "directory" ? item.path : undefined
            }
            tabIndex={
              item.id === primarySelectedId ||
              (!primarySelectedId && item.id === firstVisibleId)
                ? 0
                : -1
            }
            style={spatialStyle}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              let nextSelectedIds: string[];
              if (e.metaKey || e.ctrlKey) {
                nextSelectedIds = selectedSet.has(item.id)
                  ? selectedIds.filter((id) => id !== item.id)
                  : [...selectedIds, item.id];
                onSelectIds(nextSelectedIds);
              } else if (e.shiftKey) {
                nextSelectedIds = selectedSet.has(item.id)
                  ? [...selectedIds]
                  : [...selectedIds, item.id];
                if (!selectedSet.has(item.id)) {
                  onSelectIds(nextSelectedIds);
                }
              } else if (!selectedSet.has(item.id)) {
                nextSelectedIds = [item.id];
                onSelectIds(nextSelectedIds);
              } else {
                nextSelectedIds = [...selectedIds];
              }
              const activeDraggedIds = nextSelectedIds.includes(item.id)
                ? nextSelectedIds
                : [item.id];
              if (
                (mode === "spatial" && (onMoveItem || onMoveItems)) ||
                onDropItem ||
                onDropItems
              ) {
                const itemRect = e.currentTarget.getBoundingClientRect();
                setDrag({
                  itemId: item.id,
                  draggedIds: activeDraggedIds,
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  originLeft: itemRect.left,
                  originTop: itemRect.top,
                  currentX: e.clientX,
                  currentY: e.clientY,
                  active: false,
                  targetCell: coord,
                });
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (suppressClickRef.current === item.id) {
                suppressClickRef.current = null;
                return;
              }
              if (e.metaKey || e.ctrlKey || e.shiftKey) {
                return;
              }
              if (selectedIds.length !== 1 || !selectedSet.has(item.id)) {
                onSelectIds([item.id]);
              }
              if (settings.fileActivationMode !== "double" || item.kind === "desktop-entry") {
                captureLaunchOriginFromElement(e.currentTarget);
                onActivateItem(item);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (settings.fileActivationMode === "double" && item.kind !== "desktop-entry") {
                captureLaunchOriginFromElement(e.currentTarget);
                onActivateItem(item);
              }
            }}
            onDragOver={(e) => {
              if (item.kind !== "directory") return;
              e.preventDefault();
              if (hoveredDropPath !== item.path) {
                setHoveredDropPath(item.path);
              }
            }}
            onDragLeave={() => {
              if (hoveredDropPath === item.path) {
                setHoveredDropPath(null);
              }
            }}
            onDrop={() => {
              if (hoveredDropPath === item.path) {
                setHoveredDropPath(null);
              }
            }}
            onContextMenu={(e) => {
              captureLaunchOriginFromElement(e.currentTarget, 10000);
              if (!selectedSet.has(item.id)) {
                onSelectIds([item.id]);
              }
              if (onContextMenuItem) {
                onContextMenuItem(item, e);
              }
            }}
            className={cn(
              "group relative flex cursor-default rounded-xl outline-none select-none",
              compactHorizontal
                ? "flex-row items-center justify-start gap-1 px-1.5 py-0.5 text-left"
                : "flex-col items-center justify-start gap-1 px-1 py-1.5 text-center",
              !isDragging &&
                "transition-[left,top,width,height,background-color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isDragging && "opacity-25",
            )}
          >
            <div
              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              className={cn(
                "relative shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[width,height,opacity,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                item.kind === "file" &&
                  item.path &&
                  openFilePaths.has(item.path.replace(/\/+$/, "") || "/") &&
                  "opacity-55 grayscale-[0.45] brightness-90"
              )}
            >
              {(() => {
                const vfsEntry =
                  item.kind === "file" && item.path
                    ? getVfsEntry(item.path)
                    : undefined;
                const thumbUrl = vfsEntry
                  ? getVfsImageThumbnailUrl(
                      item.name,
                      vfsEntry.content,
                      vfsEntry.metadata
                    )
                  : undefined;
                if (thumbUrl) {
                  return (
                    <div className="flex size-full scale-[1.12] items-center justify-center rounded-[2px] border border-black bg-white p-[2px] shadow-xs">
                      <img
                        src={thumbUrl}
                        alt=""
                        draggable={false}
                        className="size-full rounded-[1px] object-cover"
                      />
                    </div>
                  );
                }
                if (item.kind === "directory") {
                  return (
                    <DynamicFolderIcon
                      accentColor={settings.accentColor}
                      opened={
                        openFolderPaths.has(item.path) ||
                        hoveredDropPath === item.path
                      }
                      pathOrName={item.path || item.name}
                      className="size-full"
                    />
                  );
                }
                if (item.kind === "file") {
                  if (item.iconUrl) {
                    return (
                      <img
                        src={item.iconUrl}
                        alt=""
                        draggable={false}
                        className="size-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]"
                      />
                    );
                  }
                  return (
                    <DynamicFileIcon
                      accentColor={settings.accentColor}
                      name={item.name}
                      iconCandidates={item.iconCandidates}
                      className="size-full"
                    />
                  );
                }
                return (
                  <AppSquircleIcon
                    iconName={item.iconName}
                    iconUrl={resolveItemIconUrl(item)}
                    gradient={item.gradient}
                    squircle={false}
                    className="size-full"
                    glyphClassName="size-7"
                  />
                );
              })()}
              {item.path && (emblemsMap[item.path]?.length ?? 0) > 0 && (
                <div className="pointer-events-none absolute -top-1 -right-1 z-10 flex flex-col items-center">
                  {(emblemsMap[item.path] ?? []).map((emblemId, emblemIdx) => {
                    const meta = VFS_EMBLEM_META[emblemId];
                    const overlapStyle =
                      emblemIdx > 0
                        ? { marginTop: `-${emblemStackOverlap}px` }
                        : undefined;
                    if (emblemId === "favorite") {
                      return (
                        <span
                          key={emblemId}
                          aria-label={meta.label}
                          style={{
                            width: `${heartSize}px`,
                            height: `${heartSize}px`,
                            color: "#ef4444",
                            ...overlapStyle,
                          }}
                          className="flex items-center justify-center !text-red-500 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                        >
                          <HeartIcon
                            style={{
                              width: `${heartSize}px`,
                              height: `${heartSize}px`,
                              color: "#ef4444",
                            }}
                            className="fill-current !text-red-500"
                          />
                        </span>
                      );
                    }
                    const EmblemIcon =
                      emblemId === "important"
                        ? AlertCircleIcon
                        : emblemId === "work"
                          ? BriefcaseIcon
                          : TagIcon;
                    return (
                      <span
                        key={emblemId}
                        aria-label={meta.label}
                        style={{
                          width: `${emblemSize}px`,
                          height: `${emblemSize}px`,
                          ...overlapStyle,
                        }}
                        className={cn(
                          "flex items-center justify-center rounded-full shadow-xs ring-1 ring-black/25 dark:ring-white/20",
                          meta.badgeBgClass,
                        )}
                      >
                        <EmblemIcon
                          style={{
                            width: `${emblemGlyphSize}px`,
                            height: `${emblemGlyphSize}px`,
                          }}
                        />
                      </span>
                    );
                  })}
                </div>
              )}
              {settings.showFileExtensionBadges !== false &&
                !compactHorizontal &&
                item.kind === "file" &&
                (() => {
                  const [, ext] = splitFileNameExt(item.name, item.kind);
                  const cleanExt = ext.replace(/^\./, "").toUpperCase();
                  if (!cleanExt || cleanExt.length > 6) return null;
                  return (
                    <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 z-10 rounded bg-zinc-900/85 px-1 py-0.5 text-[9px] leading-none font-bold tracking-wide text-white shadow-xs ring-1 ring-white/20">
                      {cleanExt}
                    </span>
                  );
                })()}
            </div>
            {renamingId === item.id ? (
              <input
                type="text"
                defaultValue={item.name}
                autoFocus
                style={{ width: `${Math.max(4, item.name.length + 1)}ch` }}
                onInput={(e) => {
                  e.currentTarget.style.width = `${Math.max(4, e.currentTarget.value.length + 1)}ch`;
                }}
                ref={(el) => {
                  if (!el) return;
                  requestAnimationFrame(() => {
                    const [stem] = splitFileNameExt(item.name, item.kind);
                    el.setSelectionRange(0, stem.length);
                  });
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCommitRename?.(item, e.currentTarget.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    onCancelRename?.();
                  }
                }}
                onBlur={(e) => {
                  onCommitRename?.(item, e.currentTarget.value);
                }}
                className={cn(
                  "w-auto min-w-[3.5rem] max-w-full rounded bg-zinc-900/95 px-1.5 py-0.5 text-adw-callout leading-tight font-medium text-white ring-1 ring-adw-accent outline-none",
                  compactHorizontal ? "text-left" : "text-center",
                )}
              />
            ) : (
              <span
                className={cn(
                  "w-fit max-w-full shrink-0 rounded px-1.5 py-0.5 text-adw-callout leading-[1.3] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
                  compactHorizontal && "truncate",
                  selected && "bg-adw-accent text-white drop-shadow-none",
                )}
              >
                <span
                  className={cn(
                    !compactHorizontal &&
                      "block line-clamp-2 break-words pb-[1px]",
                  )}
                >
                  {item.name}
                </span>
              </span>
            )}
          </button>
        );
      })}

      {drag?.active &&
        typeof document !== "undefined" &&
        (() => {
          const draggedItem = items.find((i) => i.id === drag.itemId);
          if (!draggedItem) return null;
          const dragCount = drag.draggedIds.length;
          return createPortal(
            <div
              ref={(el) => {
                dragGhostRef.current = el;
                const latest = dragRef.current;
                if (el && latest) {
                  el.style.transform = `translate3d(${latest.currentX - latest.startX}px, ${latest.currentY - latest.startY}px, 0)`;
                }
              }}
              style={{
                left: `${drag.originLeft}px`,
                top: `${drag.originTop}px`,
                width: `${effectiveCellWidth}px`,
                height: `${effectiveCellHeight}px`,
                willChange: "transform",
                transition: "none",
                animation: "none",
              }}
              className={cn(
                "pointer-events-none fixed z-[9999] flex rounded-xl opacity-90 select-none",
                compactHorizontal
                  ? "flex-row items-center justify-start gap-1 px-1.5 py-0.5 text-left"
                  : "flex-col items-center justify-start gap-1 px-1 py-1.5 text-center",
              )}
            >
              <div
                style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                className="relative shrink-0"
              >
                {draggedItem.kind === "directory" ? (
                  <DynamicFolderIcon
                    accentColor={settings.accentColor}
                    pathOrName={draggedItem.path || draggedItem.name}
                    className="size-full"
                  />
                ) : draggedItem.kind === "file" ? (
                  <DynamicFileIcon
                    accentColor={settings.accentColor}
                    name={draggedItem.name}
                    iconCandidates={draggedItem.iconCandidates}
                    className="size-full"
                  />
                ) : (
                  <AppSquircleIcon
                    iconName={draggedItem.iconName}
                    iconUrl={resolveItemIconUrl(draggedItem)}
                    gradient={draggedItem.gradient}
                    squircle={false}
                    className="size-full"
                    glyphClassName="size-7"
                  />
                )}
                {dragCount > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-adw-accent px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                    {dragCount}
                  </span>
                )}
              </div>
              <span className="w-fit max-w-full shrink-0 rounded bg-adw-accent px-1.5 py-0.5 text-[11.5px] leading-[1.3] font-medium text-white shadow-md">
                <span className="block line-clamp-2 break-words pb-[1px]">
                  {dragCount > 1
                    ? `${draggedItem.name} (+${dragCount - 1})`
                    : draggedItem.name}
                </span>
              </span>
            </div>,
            document.body,
          );
        })()}
    </div>
  );
}

