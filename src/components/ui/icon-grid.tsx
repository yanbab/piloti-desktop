import * as React from "react";
import { createPortal } from "react-dom";
import { HeartIcon } from "lucide-react";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { useSettings } from "@/context/DesktopStateContext";
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
  loadVfsFavorites,
  subscribeWebVfs,
} from "@/lib/web-vfs";

function splitFileNameExt(name: string, kind: IconGridItem["kind"]): [string, string] {
  if (kind !== "file") return [name, ""];
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === name.length - 1) return [name, ""];
  return [name.slice(0, dotIdx), name.slice(dotIdx)];
}

export interface IconGridProps {
  items: readonly IconGridItem[];
  mode?: IconGridMode;
  positions?: Readonly<Record<string, GridCoord>>;
  onMoveItem?: (itemId: string, cell: GridCoord, metrics: GridMetrics) => void;
  onDropItem?: (item: IconGridItem, clientX: number, clientY: number) => void;
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
  positions,
  onMoveItem,
  onDropItem,
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
  const openFolderPaths = useOpenFolderPaths();
  const [hoveredDropPath, setHoveredDropPath] = React.useState<string | null>(
    null,
  );
  const [favoritesSet, setFavoritesSet] = React.useState<Set<string>>(
    () => new Set(loadVfsFavorites()),
  );
  React.useEffect(() => {
    return subscribeWebVfs(() => {
      setFavoritesSet(new Set(loadVfsFavorites()));
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
  const suppressClickRef = React.useRef<string | null>(null);
  const suppressContainerClickRef = React.useRef(false);
  const [size, setSize] = React.useState<{ width: number; height: number }>({
    width: 1200,
    height: 760,
  });
  const [drag, setDrag] = React.useState<DragState | null>(null);
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

  const compactHorizontal = iconSize < 24;
  const effectiveCellWidth = compactHorizontal ? Math.max(cellWidth, 168) : cellWidth;
  const effectiveCellHeight = compactHorizontal ? 28 : cellHeight;

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
      assignGridPositions(items, positions ?? {}, metrics.cols, metrics.rows),
    [items, metrics.cols, metrics.rows, positions],
  );

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
      const hits = document.elementsFromPoint(detail.clientX, detail.clientY);
      let found: string | null = null;
      for (const el of hits) {
        const dropEl = (el as HTMLElement).closest?.("[data-vfs-drop-path]");
        const dest = dropEl?.getAttribute("data-vfs-drop-path");
        if (dest && dest !== detail.item?.path) {
          found = dest;
          break;
        }
      }
      setHoveredDropPath(found);
    };
    window.addEventListener("residence:file-drag", onGlobalFileDrag);
    return () =>
      window.removeEventListener("residence:file-drag", onGlobalFileDrag);
  }, []);

  React.useEffect(() => {
    if (!drag) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const movedEnough = drag.active || Math.hypot(dx, dy) >= 6;
      if (!movedEnough) return;

      const draggedItem = items.find((i) => i.id === drag.itemId);
      if (draggedItem) {
        window.dispatchEvent(
          new CustomEvent("residence:file-drag", {
            detail: {
              active: true,
              item: draggedItem,
              clientX: e.clientX,
              clientY: e.clientY,
            },
          }),
        );
      }

      const rect = containerRef.current?.getBoundingClientRect();
      const targetCell = rect
        ? clientPointToGridCell(
            e.clientX - rect.left,
            e.clientY - rect.top,
            metrics,
          )
        : null;

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              currentX: e.clientX,
              currentY: e.clientY,
              active: true,
              targetCell,
            }
          : null,
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (drag.active) {
        window.dispatchEvent(
          new CustomEvent("residence:file-drag", {
            detail: { active: false },
          }),
        );
        suppressClickRef.current = drag.itemId;
        const draggedItem = items.find((i) => i.id === drag.itemId);
        const hits = document.elementsFromPoint(e.clientX, e.clientY);
        const dropWindowEl = hits.find((el) =>
          el.hasAttribute("data-drop-window-id"),
        );
        const dropDockEl = hits.find((el) =>
          el.hasAttribute("data-dock-app-id"),
        );
        if (draggedItem && dropWindowEl) {
          const targetWindowId =
            dropWindowEl.getAttribute("data-drop-window-id");
          window.dispatchEvent(
            new CustomEvent("residence:file-drop-window", {
              detail: { windowId: targetWindowId, item: draggedItem },
            }),
          );
        } else if (draggedItem && dropDockEl) {
          const dockAppId = dropDockEl.getAttribute("data-dock-app-id");
          window.dispatchEvent(
            new CustomEvent("residence:file-drop-dock", {
              detail: { appId: dockAppId, item: draggedItem },
            }),
          );
        } else {
          if (drag.targetCell && onMoveItem && mode === "spatial") {
            onMoveItem(drag.itemId, drag.targetCell, metrics);
          }
          if (draggedItem && onDropItem) {
            onDropItem(draggedItem, e.clientX, e.clientY);
          }
        }
      }
      setDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [drag, items, metrics, mode, onDropItem, onMoveItem]);

  React.useEffect(() => {
    if (!marquee) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== marquee.pointerId) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
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
      const hitIds = findItemsInRect(
        items,
        resolvedPositions,
        selectionRect,
        metrics,
      );
      if (marquee.additive) {
        const merged = new Set(marquee.initialSelection);
        for (const id of hitIds) merged.add(id);
        onSelectIds(Array.from(merged));
      } else {
        onSelectIds(hitIds);
      }

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
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== marquee.pointerId) return;
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
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
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
        if (
          e.target === e.currentTarget &&
          suppressContainerClickRef.current
        ) {
          suppressContainerClickRef.current = false;
        }
      }}
      className={cn(
        "relative h-full w-full overflow-hidden bg-transparent outline-none",
        mode === "flow" &&
          "flex flex-wrap content-start gap-2 overflow-y-auto p-4",
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
        const isDragging = drag?.active && drag.itemId === item.id;
        const coord = resolvedPositions[item.id] ?? { col: 0, row: 0 };

        const spatialStyle: React.CSSProperties | undefined =
          mode === "spatial"
            ? {
                position: "absolute",
                left: `${padding + coord.col * effectiveCellWidth}px`,
                top: `${padding + coord.row * effectiveCellHeight}px`,
                width: `${effectiveCellWidth}px`,
                height: `${effectiveCellHeight}px`,
                zIndex: isDragging ? 9999 : selected ? 20 : 1,
              }
            : {
                width: `${effectiveCellWidth}px`,
                height: `${effectiveCellHeight}px`,
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
              if (e.metaKey || e.ctrlKey) {
                const next = selectedSet.has(item.id)
                  ? selectedIds.filter((id) => id !== item.id)
                  : [...selectedIds, item.id];
                onSelectIds(next);
              } else if (e.shiftKey) {
                if (!selectedSet.has(item.id)) {
                  onSelectIds([...selectedIds, item.id]);
                }
              } else if (!selectedSet.has(item.id)) {
                onSelectIds([item.id]);
              }
              if ((mode === "spatial" && onMoveItem) || onDropItem) {
                const itemRect = e.currentTarget.getBoundingClientRect();
                setDrag({
                  itemId: item.id,
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
              if (settings.fileActivationMode !== "double") {
                onActivateItem(item);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (settings.fileActivationMode === "double") {
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
              if (!selectedSet.has(item.id)) {
                onSelectIds([item.id]);
              }
              if (onContextMenuItem) {
                onContextMenuItem(item, e);
              }
            }}
            className={cn(
              "group flex cursor-default rounded-xl outline-none select-none",
              compactHorizontal
                ? "flex-row items-center justify-start gap-2 px-2 py-1 text-left"
                : "flex-col items-center justify-start gap-1.5 px-1.5 py-2 text-center",
              !isDragging && "transition-colors duration-100",
              isDragging && "opacity-25",
            )}
          >
            <div
              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              className="relative shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
            >
              {(() => {
                const vfsEntry =
                  item.kind === "file" && item.path
                    ? getVfsEntry(item.path)
                    : undefined;
                const thumbUrl = vfsEntry
                  ? getVfsImageThumbnailUrl(item.name, vfsEntry.content)
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
              {item.path && favoritesSet.has(item.path) && (
                <span
                  aria-label="Favorite"
                  className="pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm ring-1 ring-white/80"
                >
                  <HeartIcon className="size-2.5 fill-current" />
                </span>
              )}
            </div>
            {renamingId === item.id ? (
              <input
                type="text"
                defaultValue={item.name}
                autoFocus
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
                  "w-full rounded bg-zinc-900/95 px-1 py-0.5 text-[11.5px] leading-tight font-medium text-white ring-1 ring-adw-accent outline-none",
                  compactHorizontal ? "text-left" : "text-center",
                )}
              />
            ) : (
              <span
                className={cn(
                  "w-fit max-w-full rounded px-1.5 py-0.5 text-[11.5px] leading-tight font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
                  compactHorizontal
                    ? "truncate"
                    : "line-clamp-2 break-words",
                  selected && "bg-adw-accent text-white drop-shadow-none",
                )}
              >
                {item.name}
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
          const dx = drag.currentX - drag.startX;
          const dy = drag.currentY - drag.startY;
          return createPortal(
            <div
              style={{
                left: `${drag.originLeft + dx}px`,
                top: `${drag.originTop + dy}px`,
                width: `${cellWidth}px`,
                height: `${cellHeight}px`,
              }}
              className="pointer-events-none fixed z-[9999] flex flex-col items-center justify-start gap-1.5 rounded-xl px-1.5 py-2 text-center opacity-90 select-none"
            >
              <div
                style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                className="shrink-0"
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
              </div>
              <span className="line-clamp-2 w-fit max-w-full rounded bg-adw-accent px-1.5 py-0.5 text-[11.5px] leading-tight font-medium break-words text-white shadow-md">
                {draggedItem.name}
              </span>
            </div>,
            document.body,
          );
        })()}
    </div>
  );
}

