import { DndKitDragSession } from "@/ui/dnd/dnd-kit-session";
import { trackDrag } from "@/ui/dnd/drag-session";
import * as React from "react";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { BriefcaseIcon, HeartIcon, TagIcon } from "lucide-react";
import { AlertCircleIcon } from "@/ui/components/ui/symbols";
import { AppSquircleIcon } from "@/ui/components/common/AppSymbol";
import { ThemeFolderIcon } from "@/ui/components/ui/folder-icon";
import { isLottieIconUrl, LottieIcon } from "@/ui/components/ui/lottie-icon";
import { captureLaunchOriginFromElement } from "@/core/windows/launch-origin";
import {
  DRAG_THRESHOLD,
  dragFlyBackAnimation,
  dragShuffleCss,
  settleFromOffset,
} from "@/ui/fx/drag-feedback";
import { buildDragGhost } from "@/ui/dnd/drag-ghost";
import {
  broadcastItemDrag,
  endItemDragBroadcast,
  resolveTopDropTarget,
  routeItemDrop,
} from "@/ui/dnd/item-drop";
import {
  useApps,
  useWindowManagerSelector,
  useDesktopSettings,
} from "@/ui/context/DesktopStateContext";
import {
  DynamicFileIcon,
  getAccentFolderIconUrl,
  getAccentHtmlIconUrl,
  useOpenFolderPaths,
} from "@/ui/components/folder-icons";
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
  pushItemsToCells,
} from "@/core/files/desktop-icons";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import { EMBLEM_META, loadEmblemsMap, subscribeEmblems, type EmblemId } from "@/platform/shared/emblems";
import { importFsFiles } from "@/platform/shared/fs-bridge";
import { recordCreated } from "@/platform/shared/fs-undo";
import { usePiloti } from "@/platform/shared/piloti";

function splitFileNameExt(name: string, kind: IconGridItem["kind"]): [string, string] {
  if (kind !== "file") return [name, ""];
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === name.length - 1) return [name, ""];
  return [name.slice(0, dotIdx), name.slice(dotIdx)];
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
  /** `copy` is set when Ctrl / Alt / ⌘-Option was held on drop. */
  onDropItems?: (items: IconGridItem[], destPath: string, opts?: { copy?: boolean }) => void;
  onActivateItem: (item: IconGridItem) => void;
  onContextMenuItem?: (item: IconGridItem, event: React.MouseEvent) => void;
  /**
   * Direct favorite toggle: a heart on each icon, faint on hover, full on the
   * heart itself, red when the item is a favorite.
   */
  onToggleFavorite?: (item: IconGridItem) => void;
  /**
   * For grids that navigate in place (Folders): a folder shows its opening
   * for this long before `onActivateItem` runs, as a window opening does on
   * the desktop.
   */
  folderOpenDelayMs?: number;
  /** Spatial grid: equal cells spread to both edges (the desktop). */
  stretchCells?: boolean;
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
  canceling?: boolean;
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
  onToggleFavorite,
  folderOpenDelayMs,
  stretchCells = false,
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
  const piloti = usePiloti();
  const settings = useDesktopSettings(["accentColor", "fileActivationMode", "showFileExtensionBadges"]);
  const { realFilesystem } = useCapabilities();
  const { getAppIconUrl } = useApps();
  const windows = useWindowManagerSelector((wm) =>
    wm.windows.map((w) => ({ appId: w.appId, payload: w.payload })),
  );
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
  const [folderDropNonces, setFolderDropNonces] = React.useState<
    Record<string, number>
  >({});
  const [fileAnimNonces, setFileAnimNonces] = React.useState<
    Record<string, number>
  >({});
  const [openingDirPath, setOpeningDirPath] = React.useState<string | null>(null);
  const prevEmptyStateRef = React.useRef<Map<string, boolean>>(new Map());
  const prevOpenFilePathsRef = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    const onFolderDrop = (e: Event) => {
      const detail = (e as CustomEvent<{ path?: string }>).detail;
      const norm = detail?.path?.replace(/\/+$/, "") || "/";
      if (!norm) return;
      setFolderDropNonces((prev) => ({
        ...prev,
        [norm]: (prev[norm] ?? 0) + 1,
      }));
    };
    window.addEventListener("piloti:folder-drop-anim", onFolderDrop);
    return () =>
      window.removeEventListener("piloti:folder-drop-anim", onFolderDrop);
  }, []);

  React.useEffect(() => {
    const updates: Record<string, number> = {};
    const prevMap = prevEmptyStateRef.current;
    const nextMap = new Map<string, boolean>();
    for (const item of items) {
      if (item.kind !== "file" || !item.path || item.isEmpty === undefined) continue;
      const norm = item.path.replace(/\/+$/, "") || "/";
      if (prevMap.get(norm) === true && item.isEmpty === false) {
        updates[norm] = (updates[norm] ?? 0) + 1;
      }
      nextMap.set(norm, item.isEmpty);
    }
    prevEmptyStateRef.current = nextMap;
    if (Object.keys(updates).length > 0) {
      setFileAnimNonces((prev) => {
        const merged = { ...prev };
        for (const [k, delta] of Object.entries(updates)) {
          merged[k] = (merged[k] ?? 0) + delta;
        }
        return merged;
      });
    }
  }, [items]);

  React.useEffect(() => {
    if (prevOpenFilePathsRef.current === null) {
      prevOpenFilePathsRef.current = new Set(openFilePaths);
      return;
    }
    const prevSet = prevOpenFilePathsRef.current;
    const toggledPaths: string[] = [];
    for (const p of openFilePaths) {
      if (!prevSet.has(p)) toggledPaths.push(p);
    }
    for (const p of prevSet) {
      if (!openFilePaths.has(p)) toggledPaths.push(p);
    }
    prevOpenFilePathsRef.current = new Set(openFilePaths);
    if (toggledPaths.length > 0) {
      setFileAnimNonces((prev) => {
        const next = { ...prev };
        for (const p of toggledPaths) {
          next[p] = (next[p] ?? 0) + 1;
        }
        return next;
      });
    }
  }, [openFilePaths]);
  const [emblemsMap, setEmblemsMap] = React.useState<
    Record<string, EmblemId[]>
  >(() => loadEmblemsMap());
  React.useEffect(() => {
    return subscribeEmblems((next) => {
      // Keep the same object when unchanged so the whole grid doesn't re-render.
      setEmblemsMap((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    });
  }, []);
  const useAccentIcons = !realFilesystem || mode === "flow";
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
        stretchCells && mode === "spatial",
      ),
    [effectiveCellHeight, effectiveCellWidth, mode, padding, size.height, size.width, stretchCells],
  );
  // Spatial cells use the (possibly stretched) metrics; flow cells keep their size.
  const spatialCellWidth = metrics.cellWidth;
  const spatialCellHeight = metrics.cellHeight;

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
    const cancels: Array<() => void> = [];
    for (const id of pending.ids) {
      const btn = itemRefs.current.get(id);
      const oldCoord = pending.oldCoords[id];
      const newCoord = resolvedPositions[id];
      if (!btn || !oldCoord || !newCoord) continue;
      const offsetX =
        (oldCoord.col - newCoord.col) * spatialCellWidth + pending.dropDx;
      const offsetY =
        (oldCoord.row - newCoord.row) * spatialCellHeight + pending.dropDy;
      cancels.push(settleFromOffset(btn, offsetX, offsetY));
    }
    return () => {
      for (const cancel of cancels) cancel();
    };
  }, [spatialCellHeight, spatialCellWidth, mode, resolvedPositions]);

  /** Opens an item, with the same feedback everywhere (desktop and Folders). */
  const activateItem = (item: IconGridItem) => {
    const norm = item.path?.replace(/\/+$/, "") || "/";
    if (item.kind === "file" && item.path) {
      setFileAnimNonces((prev) => ({ ...prev, [norm]: (prev[norm] ?? 0) + 1 }));
    }
    if (item.kind === "directory" && folderOpenDelayMs && item.path) {
      setOpeningDirPath(norm);
      window.setTimeout(() => {
        setOpeningDirPath(null);
        onActivateItem(item);
      }, folderOpenDelayMs);
      return;
    }
    onActivateItem(item);
  };

  const focusItemButton = React.useCallback((id: string) => {
    const btn = itemRefs.current.get(id);
    if (btn) {
      btn.focus({ preventScroll: true });
      btn.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, []);

  // Enter and Escape remove the rename field, which would leave focus on the
  // page: give it back to the icon (under its new name once listed).
  const refocusAfterRenameRef = React.useRef(false);
  React.useEffect(() => {
    if (!refocusAfterRenameRef.current || renamingId || !primarySelectedId) return;
    if (!itemRefs.current.has(primarySelectedId)) return;
    refocusAfterRenameRef.current = false;
    focusItemButton(primarySelectedId);
  }, [focusItemButton, items, primarySelectedId, renamingId]);

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

  const dragEnabled =
    (mode === "spatial" && Boolean(onMoveItem || onMoveItems)) ||
    Boolean(onDropItem || onDropItems);
  const pendingDragIdsRef = React.useRef<string[] | null>(null);
  const lastPointerRef = React.useRef({ x: 0, y: 0, alt: false });
  const [preview, setPreview] = React.useState<Record<string, GridCoord> | null>(null);
  const previewKeyRef = React.useRef("");
  const [dropAnimOff, setDropAnimOff] = React.useState(false);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }),
  );

  const isDragStarted = Boolean(drag);
  // While dragging: broadcast the pointer (so Dock / windows can highlight drop targets) and,
  // on the spatial grid, preview where everything lands so neighbours slide out of the way.
  React.useEffect(() => {
    if (!isDragStarted) return;
    let rafId = 0;
    const handlePointerMove = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      lastPointerRef.current = { x: e.clientX, y: e.clientY, alt: e.altKey || e.ctrlKey };
      cur.currentX = e.clientX;
      cur.currentY = e.clientY;
      // Ctrl / Alt while dragging means "copy": show it with the cursor.
      document.body.style.cursor = e.altKey || e.ctrlKey ? "copy" : "";
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const latest = dragRef.current;
        if (!latest) return;
        const draggedItems = items.filter((i) => latest.draggedIds.includes(i.id));
        const draggedItem = items.find((i) => i.id === latest.itemId) ?? draggedItems[0];
        if (!draggedItem) return;
        broadcastItemDrag(draggedItem, draggedItems, latest.currentX, latest.currentY);
        if (mode !== "spatial") return;
        const rect = containerRef.current?.getBoundingClientRect();
        const top = resolveTopDropTarget(
          latest.currentX,
          latest.currentY,
          draggedItems.map((d) => d.path),
        );
        const overOwnGrid =
          Boolean(rect) &&
          latest.currentX >= rect!.left &&
          latest.currentX <= rect!.right &&
          latest.currentY >= rect!.top &&
          latest.currentY <= rect!.bottom &&
          (!top || (top.kind === "vfs" && top.destPath === currentDirPath));
        if (!overOwnGrid || !rect) {
          if (previewKeyRef.current) {
            previewKeyRef.current = "";
            setPreview(null);
          }
          return;
        }
        const cell = clientPointToGridCell(
          latest.currentX - rect.left,
          latest.currentY - rect.top,
          metrics,
        );
        const key = `${cell.col},${cell.row}`;
        if (key === previewKeyRef.current) return;
        previewKeyRef.current = key;
        setPreview(
          pushItemsToCells(
            resolvedPositionsRef.current,
            latest.draggedIds,
            latest.itemId,
            cell,
            metrics.cols,
            metrics.rows,
          ),
        );
      });
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      document.body.style.cursor = "";
    };
  }, [currentDirPath, isDragStarted, items, metrics, mode]);

  const onDndStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const ev = e.activatorEvent as PointerEvent;
    const pending = pendingDragIdsRef.current;
    const ids = pending?.includes(id) ? pending : [id];
    const rect = itemRefs.current.get(id)?.getBoundingClientRect();
    lastPointerRef.current = { x: ev.clientX, y: ev.clientY, alt: ev.altKey || ev.ctrlKey };
    previewKeyRef.current = "";
    setDropAnimOff(false);
    setDrag({
      itemId: id,
      draggedIds: ids,
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      originLeft: rect?.left ?? 0,
      originTop: rect?.top ?? 0,
      currentX: ev.clientX,
      currentY: ev.clientY,
      active: true,
      targetCell: resolvedPositionsRef.current[id] ?? { col: 0, row: 0 },
    });
  };

  const endDrag = (commit: boolean) => {
    const cur = dragRef.current;
    previewKeyRef.current = "";
    setPreview(null);
    endItemDragBroadcast();
    if (cur && commit) {
      suppressClickRef.current = cur.itemId;
      const outcome = commitDrop(cur, lastPointerRef.current);
      // The ghost only flies back when nothing moved. Dropped elsewhere, it
      // disappears there; moved in this grid, the items take over from the
      // drop point (see the settle effect).
      if (outcome !== "none") setDropAnimOff(true);
    }
    dragRef.current = null;
    setDrag(null);
  };

  /** Routes a drop to the right place. */
  const commitDrop = (
    cur: DragState,
    pt: { x: number; y: number; alt: boolean },
  ): "external" | "moved" | "none" => {
    const rect = containerRef.current?.getBoundingClientRect();
    const dropCell = rect
      ? clientPointToGridCell(pt.x - rect.left, pt.y - rect.top, metrics)
      : cur.targetCell;
    const draggedItems = items.filter((i) => cur.draggedIds.includes(i.id));
    const draggedItem = items.find((i) => i.id === cur.itemId) ?? draggedItems[0];
    if (!draggedItem) return "none";
    const moveWithinGrid = (): "moved" | "none" => {
      if (mode !== "spatial" || !dropCell) return "none";
      // Items start from where they were dropped, then settle into their cells.
      pendingSettleRef.current = {
        ids: new Set(cur.draggedIds),
        oldCoords: { ...resolvedPositionsRef.current },
        dropDx: pt.x - cur.startX,
        dropDy: pt.y - cur.startY,
      };
      if (onMoveItems) onMoveItems(cur.draggedIds, cur.itemId, dropCell, metrics);
      else onMoveItem?.(cur.itemId, dropCell, metrics);
      return "moved";
    };
    const outcome = routeItemDrop(draggedItem, draggedItems, { x: pt.x, y: pt.y, copy: pt.alt }, {
      currentDirPath,
      onDropItems,
      onDropItem,
    });
    if (outcome === "external") return "external";
    return outcome === "blocked" ? "none" : moveWithinGrid();
  };

  const onDndEnd = (_e: DragEndEvent) => endDrag(true);


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
    // Escape or a missed release: the selection stays as drawn.
    const untrack = trackDrag(() => setMarquee(null));
    return () => {
      untrack();
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

    if (
      (e.key === "Enter" || e.key === " ") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      if (!primarySelectedId) return;
      const target = items.find((item) => item.id === primarySelectedId);
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        activateItem(target);
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
    <DndContext
      sensors={dndSensors}
      onDragStart={onDndStart}
      onDragEnd={onDndEnd}
      onDragCancel={() => endDrag(false)}
    >
      <DndKitDragSession />
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
          className="pointer-events-none absolute z-40 rounded-[3px] border border-ui-accent/85 bg-ui-accent/20"
        />
      )}

      {items.map((item) => {
        const selected = selectedSet.has(item.id);
        const isHiddenFile = Boolean(item.isHidden || item.name.startsWith("."));
        const isDragging =
          Boolean(drag?.active) && Boolean(drag?.draggedIds.includes(item.id));
        const coord =
          (!isDragging && preview ? preview[item.id] : undefined) ??
          resolvedPositions[item.id] ?? { col: 0, row: 0 };

        const spatialStyle: React.CSSProperties =
          mode === "spatial"
            ? {
                position: "absolute",
                left: `${padding + coord.col * spatialCellWidth}px`,
                top: `${padding + coord.row * spatialCellHeight}px`,
                width: `${spatialCellWidth}px`,
                height: `${spatialCellHeight}px`,
                zIndex: isDragging ? 1 : selected ? 20 : 1,
                opacity: isDragging ? 0 : isHiddenFile ? 0.55 : undefined,
                // Neighbours glide aside (springy) while a drag previews the drop.
                transition:
                  drag && !isDragging
                    ? dragShuffleCss("left", "top")
                    : undefined,
              }
            : {
                width: `${effectiveCellWidth}px`,
                height: `${effectiveCellHeight}px`,
                opacity: isDragging ? 0 : isHiddenFile ? 0.55 : undefined,
              };

        return (
          <GridDraggable key={item.id} id={item.id} disabled={!dragEnabled}>
            {(dnd) => (
          <button
            ref={(node) => {
              dnd.setNodeRef(node);
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
              pendingDragIdsRef.current = activeDraggedIds;
              if (dragEnabled) dnd.listeners?.onPointerDown?.(e);
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
                activateItem(item);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (settings.fileActivationMode === "double" && item.kind !== "desktop-entry") {
                captureLaunchOriginFromElement(e.currentTarget);
                activateItem(item);
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
            onDrop={(e) => {
              if (hoveredDropPath === item.path) {
                setHoveredDropPath(null);
              }
              if (
                item.kind === "directory" &&
                item.path &&
                e.dataTransfer?.files?.length
              ) {
                e.preventDefault();
                e.stopPropagation();
                void importFsFiles(piloti, item.path, e.dataTransfer.files).then((created) => {
                  recordCreated({ piloti }, created, "Create");
                  window.dispatchEvent(
                    new CustomEvent("piloti:folder-drop-anim", {
                      detail: { path: item.path },
                    }),
                  );
                });
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
              "group relative flex cursor-default rounded-ui-box outline-none select-none",
              compactHorizontal
                ? "flex-row items-center justify-start gap-1 px-1.5 py-0.5 text-left"
                : "flex-col items-center justify-start gap-1 px-1 py-1.5 text-center",
              !isDragging &&
                "transition-[left,top,width,height,background-color,opacity] duration-200 ease-[var(--fx-ease-settle)]",
              isDragging && "opacity-25",
            )}
          >
            {selected && !compactHorizontal && (
              // Light square behind the selected icon, as in Finder.
              <span
                aria-hidden
                data-slot="icon-selection-square"
                style={{ width: `${iconSize + 12}px`, height: `${iconSize + 12}px` }}
                className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded-ui-control bg-black/10 dark:bg-white/16"
              />
            )}
            <div
              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              className={cn(
                "relative shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[width,height,opacity,filter] duration-200 ease-[var(--fx-ease-settle)]",
                item.kind === "file" &&
                  item.path &&
                  openFilePaths.has(item.path.replace(/\/+$/, "") || "/") &&
                  "opacity-55 grayscale-[0.45] brightness-90"
              )}
            >
              {(() => {
                const thumbUrl = item.thumbnailUrl;
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
                  const normDir = item.path?.replace(/\/+$/, "") || "/";
                  const isOpened =
                    openFolderPaths.has(item.path) ||
                    hoveredDropPath === item.path ||
                    openingDirPath === normDir;
                  return (
                    <ThemeFolderIcon
                      accentColor={settings.accentColor}
                      opened={isOpened}
                      playNonce={folderDropNonces[normDir] ?? 0}
                      pathOrName={item.path || item.name}
                      className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]"
                    />
                  );
                }
                if (item.kind === "file") {
                  const normFile = item.path?.replace(/\/+$/, "") || "/";
                  if (item.iconUrl) {
                    if (isLottieIconUrl(item.iconUrl)) {
                      return (
                        <LottieIcon
                          src={item.iconUrl}
                          playNonce={fileAnimNonces[normFile] ?? 0}
                          className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]"
                        />
                      );
                    }
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
                      isEmpty={item.isEmpty}
                      className="size-full"
                    />
                  );
                }
                return (
                  <AppSquircleIcon
                    iconName={item.iconName}
                    iconUrl={resolveItemIconUrl(item)}
                    squircle={false}
                    className="size-full"
                    glyphClassName="size-7"
                  />
                );
              })()}
              {item.isSymlink && (
                <span
                  aria-hidden
                  title="Symbolic link"
                  className="pointer-events-none absolute -bottom-0.5 -left-0.5 z-10 flex size-[1.1em] min-h-4 min-w-4 items-center justify-center rounded-full bg-ui-emblem text-ui-emblem-label shadow ring-1 ring-black/25"
                >
                  <svg viewBox="0 0 16 16" className="size-[70%]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12 12 4M6 4h6v6" />
                  </svg>
                </span>
              )}
              {item.path && onToggleFavorite && item.kind !== "desktop-entry" && (() => {
                const isFavorite = (emblemsMap[item.path] ?? []).includes("favorite");
                return (
                  <span
                    role="button"
                    tabIndex={-1}
                    data-slot="icon-favorite-toggle"
                    aria-label={isFavorite ? _("Remove from Favorites") : _("Add to Favorites")}
                    aria-pressed={isFavorite}
                    title={isFavorite ? _("Remove from Favorites") : _("Add to Favorites")}
                    // Not a drag handle and not a selection click.
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onToggleFavorite(item);
                    }}
                    style={{
                      width: `${heartSize}px`,
                      height: `${heartSize}px`,
                      // Inline: label colour rules on the grid reach every span.
                      color: isFavorite ? "var(--ui-red)" : "var(--ui-emblem)",
                    }}
                    className={cn(
                      "absolute -top-1 -right-1 z-20 flex cursor-default items-center justify-center transition-opacity duration-150",
                      isFavorite
                        ? "opacity-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                        : "opacity-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] group-hover:opacity-25 hover:!opacity-100",
                    )}
                  >
                    <HeartIcon
                      style={{ width: `${heartSize}px`, height: `${heartSize}px` }}
                      className={cn(isFavorite && "fill-current")}
                      strokeWidth={isFavorite ? 2 : 2.25}
                    />
                  </span>
                );
              })()}
              {item.path && (emblemsMap[item.path] ?? []).some(
                (emblemId) => !(onToggleFavorite && emblemId === "favorite"),
              ) && (
                <div
                  className="pointer-events-none absolute -top-1 -right-1 z-10 flex flex-col items-center"
                  // The favorite toggle sits on top; the other emblems stack under it.
                  style={
                    onToggleFavorite && item.kind !== "desktop-entry"
                      ? { marginTop: `${heartSize + 2}px` }
                      : undefined
                  }
                >
                  {(emblemsMap[item.path] ?? [])
                    .filter((emblemId) => !(onToggleFavorite && emblemId === "favorite"))
                    .map((emblemId, emblemIdx) => {
                    const meta = EMBLEM_META[emblemId];
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
                            color: "var(--ui-red)",
                            ...overlapStyle,
                          }}
                          className="flex items-center justify-center !text-ui-red drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                        >
                          <HeartIcon
                            style={{
                              width: `${heartSize}px`,
                              height: `${heartSize}px`,
                              color: "var(--ui-red)",
                            }}
                            className="fill-current !text-ui-red"
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
                    <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 z-10 rounded bg-ui-hud-dark px-1 py-0.5 text-ui-caption leading-none font-bold tracking-wide text-ui-hud-dark-label shadow-xs ring-1 ring-ui-hud-dark-border">
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
                    refocusAfterRenameRef.current = true;
                    onCommitRename?.(item, e.currentTarget.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    refocusAfterRenameRef.current = true;
                    onCancelRename?.();
                  }
                }}
                onBlur={(e) => {
                  onCommitRename?.(item, e.currentTarget.value);
                }}
                className={cn(
                  "w-auto min-w-[3.5rem] max-w-full rounded bg-ui-hud-dark px-1.5 py-0.5 text-ui-body leading-tight font-medium text-ui-hud-dark-label ring-1 ring-ui-accent outline-none",
                  compactHorizontal ? "text-left" : "text-center",
                )}
              />
            ) : (
              <span
                data-slot="icon-label"
                data-selected={selected || undefined}
                className={cn(
                  "w-fit max-w-full shrink-0 rounded px-1.5 py-0.5 text-ui-body leading-[1.3] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
                  compactHorizontal && "truncate",
                  selected && "bg-ui-accent text-white drop-shadow-none",
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
            )}
          </GridDraggable>
        );
      })}

    </div>
    {typeof document !== "undefined" &&
      createPortal(
        <DragOverlay
          zIndex={9999}
          dropAnimation={
dropAnimOff ? null : dragFlyBackAnimation
          }
        >
          {drag?.active ? (
            <div
              data-drag-ghost
              ref={(el) => {
                const latest = dragRef.current;
                if (!el || !latest) return;
                const origin = itemRefs.current.get(latest.itemId)?.getBoundingClientRect();
                if (!origin) return;
                buildDragGhost(el, {
                  ids: latest.draggedIds,
                  primaryId: latest.itemId,
                  nodeOf: (id) => itemRefs.current.get(id),
                  origin,
                });
              }}
              className="pointer-events-none size-full select-none"
            />
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

/** Makes one grid icon draggable with dnd-kit (the pointer sensor lives on the DndContext). */
function GridDraggable({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (dnd: ReturnType<typeof useDraggable>) => React.ReactNode;
}) {
  const dnd = useDraggable({ id, disabled });
  return <>{children(dnd)}</>;
}

