import * as React from "react";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { FileType } from "@domicile-desktop/sdk/system";
import {
  FileItemContextMenu,
  type FileItemContextMenuState,
} from "@/components/apps/FileItemContextMenu";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
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
  inferFileVisual,
  moveItemToCell,
  normalizeRect,
  sortDesktopItems,
} from "@/lib/desktop-icons";
import { launchDesktopCommand } from "@/lib/gnome-bridge";
import { _ } from "@/lib/i18n";
import { startBootPhase } from "@/lib/perf-log";
import { cn } from "@/lib/utils";
import { parseDesktopEntry } from "@/lib/xdg-desktop-entry";
import {
  buildVfsEntryWebAppUrl,
  createVfsFolder,
  createVfsTextFile,
  getVfsEntry,
  importExternalFilesToVfs,
  listVfsDir,
  moveVfsEntry,
  renameVfsEntry,
  subscribeWebVfs,
  trashVfsEntry,
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
} from "@/lib/web-vfs";

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

/**
 * Reusable transparent 2D icon grid supporting spatial drag-and-drop,
 * rubber-band marquee selection, flow layout (for future Applications / Overview grids),
 * and 2D keyboard navigation.
 */
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

  const metrics = React.useMemo(
    () =>
      computeGridMetrics(
        size.width,
        size.height,
        cellWidth,
        cellHeight,
        padding
      ),
    [cellHeight, cellWidth, padding, size.height, size.width]
  );

  const resolvedPositions = React.useMemo(
    () =>
      assignGridPositions(items, positions ?? {}, metrics.cols, metrics.rows),
    [items, metrics.cols, metrics.rows, positions]
  );

  const focusItemButton = React.useCallback((id: string) => {
    const btn = itemRefs.current.get(id);
    if (btn) {
      btn.focus({ preventScroll: true });
      btn.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
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
          })
        );
      }

      const rect = containerRef.current?.getBoundingClientRect();
      const targetCell = rect
        ? clientPointToGridCell(
            e.clientX - rect.left,
            e.clientY - rect.top,
            metrics
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
          : null
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (drag.active) {
        window.dispatchEvent(
          new CustomEvent("residence:file-drag", {
            detail: { active: false },
          })
        );
        suppressClickRef.current = drag.itemId;
        const draggedItem = items.find((i) => i.id === drag.itemId);
        const hits = document.elementsFromPoint(e.clientX, e.clientY);
        const dropWindowEl = hits.find((el) =>
          el.hasAttribute("data-drop-window-id")
        );
        const dropDockEl = hits.find((el) =>
          el.hasAttribute("data-dock-app-id")
        );
        if (draggedItem && dropWindowEl) {
          const targetWindowId = dropWindowEl.getAttribute("data-drop-window-id");
          window.dispatchEvent(
            new CustomEvent("residence:file-drop-window", {
              detail: { windowId: targetWindowId, item: draggedItem },
            })
          );
        } else if (draggedItem && dropDockEl) {
          const dockAppId = dropDockEl.getAttribute("data-dock-app-id");
          window.dispatchEvent(
            new CustomEvent("residence:file-drop-dock", {
              detail: { appId: dockAppId, item: draggedItem },
            })
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
        currentY
      );
      const hitIds = findItemsInRect(
        items,
        resolvedPositions,
        selectionRect,
        metrics
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
          : null
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
        e.key
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
        marquee.currentY
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
        if (e.target === e.currentTarget) {
          if (suppressContainerClickRef.current) {
            suppressContainerClickRef.current = false;
            return;
          }
          onSelectIds([]);
        }
      }}
      className={cn(
        "relative h-full w-full overflow-hidden bg-transparent outline-none",
        mode === "flow" && "flex flex-wrap content-start gap-2 p-4 overflow-y-auto",
        className
      )}
    >
      {/* Rubber-band selection rectangle */}
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
        const dragDeltaX = isDragging ? drag.currentX - drag.startX : 0;
        const dragDeltaY = isDragging ? drag.currentY - drag.startY : 0;

        const spatialStyle: React.CSSProperties | undefined =
          mode === "spatial"
            ? {
                position: "absolute",
                left: `${padding + coord.col * cellWidth}px`,
                top: `${padding + coord.row * cellHeight}px`,
                width: `${cellWidth}px`,
                height: `${cellHeight}px`,
                zIndex: isDragging ? 9999 : selected ? 20 : 1,
              }
            : {
                width: `${cellWidth}px`,
                height: `${cellHeight}px`,
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
            data-vfs-drop-path={item.kind === "directory" ? item.path : undefined}
            tabIndex={
              item.id === primarySelectedId ||
              (!primarySelectedId && item.id === firstVisibleId)
                ? 0
                : -1
            }
            style={spatialStyle}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
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
              if (e.metaKey || e.ctrlKey) {
                const next = selectedSet.has(item.id)
                  ? selectedIds.filter((id) => id !== item.id)
                  : [...selectedIds, item.id];
                onSelectIds(next);
                return;
              }
              if (e.shiftKey) {
                if (!selectedSet.has(item.id)) {
                  onSelectIds([...selectedIds, item.id]);
                }
                return;
              }
              onSelectIds([item.id]);
              onActivateItem(item);
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
              "group flex cursor-default flex-col items-center justify-start gap-1.5 rounded-xl px-1.5 py-2 text-center outline-none select-none",
              !isDragging && "transition-colors duration-100",
              isDragging && "opacity-25"
            )}
          >
            <div
              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              className="shrink-0"
            >
              <AppSquircleIcon
                iconName={item.iconName}
                iconUrl={item.iconUrl}
                gradient={item.gradient}
                squircle={false}
                className="size-full"
                glyphClassName="size-7"
              />
            </div>
            {renamingId === item.id ? (
              <input
                type="text"
                defaultValue={item.name}
                autoFocus
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
                className="w-full rounded bg-zinc-900/95 px-1 py-0.5 text-center text-[11.5px] font-medium text-white ring-1 ring-adw-accent outline-none"
              />
            ) : (
              <span
                className={cn(
                  "line-clamp-2 w-fit max-w-full rounded px-1.5 py-0.5 text-[11.5px] leading-tight font-medium break-words text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
                  selected && "bg-adw-accent text-white drop-shadow-none"
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
                <AppSquircleIcon
                  iconName={draggedItem.iconName}
                  iconUrl={draggedItem.iconUrl}
                  gradient={draggedItem.gradient}
                  squircle={false}
                  className="size-full"
                  glyphClassName="size-7"
                />
              </div>
              <span className="line-clamp-2 w-fit max-w-full rounded bg-adw-accent px-1.5 py-0.5 text-[11.5px] leading-tight font-medium break-words text-white shadow-md">
                {draggedItem.name}
              </span>
            </div>,
            document.body
          );
        })()}
    </div>
  );
}

/**
 * Transparent Desktop Icons app mounted over the desktop wallpaper (below windows).
 * Reads the user's XDG Desktop folder (`$HOME/Desktop`) and persists grid coordinates.
 */
export function DesktopIconsApp({
  bottomInset = 82,
}: {
  bottomInset?: number;
}) {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { locked } = useSystemBackends();
  const {
    xdgUserDirs,
    installedXdgApps,
    dockIconsReady,
    getAppIconUrl,
    ensureWaylandIcons,
    launchXdgEntry,
  } = useApps();
  const { launchApp, openWebUrl } = useWindowManager();

  const [items, setItems] = React.useState<IconGridItem[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [externalDropActive, setExternalDropActive] = React.useState(false);
  const [contextMenu, setContextMenu] =
    React.useState<FileItemContextMenuState | null>(null);
  const initialDesktopLoadLoggedRef = React.useRef(false);

  const desktopDirPath = React.useMemo(() => {
    if (isBrowserRuntime) return `${WEB_VFS_HOME}/Desktop`;
    const dir = xdgUserDirs.find((d) => d.key === "DESKTOP");
    return dir?.absolutePath ?? dir?.relativeHomePath ?? "Desktop";
  }, [isBrowserRuntime, xdgUserDirs]);

  const loadDesktopFolder = React.useCallback(async () => {
    if (!settings.desktopIconsEnabled) return;
    const finishDesktopIcons = !initialDesktopLoadLoggedRef.current
      ? startBootPhase("desktop icons")
      : null;
    try {
      if (isBrowserRuntime) {
        const vfsEntries = listVfsDir(desktopDirPath);
        const iconCandidatesToEnsure = new Set<string>();
        const built: IconGridItem[] = vfsEntries.map((entry) => {
          const visual = inferFileVisual(entry.name, entry.kind);
          for (const candidate of visual.iconCandidates) {
            iconCandidatesToEnsure.add(candidate);
          }
          return {
            id: entry.name,
            name: entry.name,
            kind: entry.kind,
            path: entry.path,
            iconName: visual.iconName,
            iconCandidates: visual.iconCandidates,
            gradient: visual.gradient,
            iconUrl: visual.iconCandidates
              .map((c) => getAppIconUrl(c))
              .find(Boolean),
          };
        });
        if (iconCandidatesToEnsure.size > 0) {
          ensureWaylandIcons(Array.from(iconCandidatesToEnsure));
        }
        setItems(sortDesktopItems(built));
        if (finishDesktopIcons) {
          initialDesktopLoadLoggedRef.current = true;
          finishDesktopIcons(`${built.length} items`);
        }
        return;
      }

      const res = await domicile.files.readDir(desktopDirPath);
      const entries = res.match({
        Ok: (list) => list,
        Err: () => [],
      });

      const visible = entries.filter(
        (entry) => entry.name && !entry.name.startsWith(".")
      );

      const iconCandidatesToEnsure = new Set<string>();
      const built: IconGridItem[] = await Promise.all(
        visible.map(async (entry): Promise<IconGridItem> => {
          const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${entry.name}`;
          const entryFileType: "file" | "directory" =
            entry.fileType === FileType.Directory ? "directory" : "file";

          if (entryFileType === "file" && entry.name.endsWith(".desktop")) {
            try {
              const textRes = await domicile.files.readText(fullPath);
              const content = textRes.match({
                Ok: (t) => t,
                Err: () => "",
              });
              if (content) {
                const parsed = parseDesktopEntry(content, {
                  filePath: fullPath,
                  baseDir: desktopDirPath,
                });
                if (parsed) {
                  if (parsed.icon) iconCandidatesToEnsure.add(parsed.icon);
                  const matchedXdg = installedXdgApps.find(
                    (app) =>
                      app.desktopId === parsed.desktopId ||
                      app.appId === parsed.appId
                  );
                  return {
                    id: entry.name,
                    name: parsed.name,
                    kind: "desktop-entry",
                    path: fullPath,
                    iconName: "sparkles",
                    iconCandidates: parsed.icon ? [parsed.icon] : undefined,
                    iconUrl:
                      matchedXdg?.iconUrl ??
                      getAppIconUrl(parsed.icon) ??
                      getAppIconUrl(parsed.desktopId) ??
                      getAppIconUrl(parsed.appId),
                    desktopEntry: parsed,
                  };
                }
              }
            } catch {
              // fallback to generic file entry below
            }
          }

          const visual = inferFileVisual(entry.name, entryFileType);
          for (const candidate of visual.iconCandidates) {
            iconCandidatesToEnsure.add(candidate);
          }

          return {
            id: entry.name,
            name: entry.name,
            kind: entryFileType === "directory" ? "directory" : "file",
            path: fullPath,
            iconName: visual.iconName,
            iconCandidates: visual.iconCandidates,
            gradient: visual.gradient,
            iconUrl: visual.iconCandidates
              .map((c) => getAppIconUrl(c))
              .find(Boolean),
          };
        })
      );

      if (iconCandidatesToEnsure.size > 0) {
        ensureWaylandIcons(Array.from(iconCandidatesToEnsure));
      }

      setItems(sortDesktopItems(built));
      if (finishDesktopIcons) {
        initialDesktopLoadLoggedRef.current = true;
        finishDesktopIcons(`${built.length} items`);
      }
    } catch {
      setItems([]);
      if (finishDesktopIcons) {
        initialDesktopLoadLoggedRef.current = true;
        finishDesktopIcons("0 items");
      }
    }
  }, [
    desktopDirPath,
    domicile.files,
    ensureWaylandIcons,
    getAppIconUrl,
    installedXdgApps,
    isBrowserRuntime,
    settings.desktopIconsEnabled,
  ]);

  React.useEffect(() => {
    if (!settings.desktopIconsEnabled || !dockIconsReady) return;
    void loadDesktopFolder();
    if (isBrowserRuntime) {
      return subscribeWebVfs(() => {
        void loadDesktopFolder();
      });
    }
    const timer = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      if (!locked) {
        void loadDesktopFolder();
      }
    }, 6000);
    const onFocus = () => {
      void loadDesktopFolder();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [
    dockIconsReady,
    isBrowserRuntime,
    loadDesktopFolder,
    locked,
    settings.desktopIconsEnabled,
  ]);

  const createDesktopFolder = React.useCallback(async () => {
    if (isBrowserRuntime) {
      const created = createVfsFolder(desktopDirPath);
      await loadDesktopFolder();
      setSelectedIds([created.name]);
      setRenamingId(created.name);
      return;
    }
    const existingNames = new Set(items.map((i) => i.name));
    let folderName = "Untitled Folder";
    let n = 2;
    while (existingNames.has(folderName)) {
      folderName = `Untitled Folder ${n++}`;
    }
    const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${folderName}`;
    await domicile.files.createDir(fullPath).catch(() => undefined);
    await loadDesktopFolder();
    setSelectedIds([folderName]);
    setRenamingId(folderName);
  }, [desktopDirPath, domicile.files, isBrowserRuntime, items, loadDesktopFolder]);

  const createDesktopTextFile = React.useCallback(async () => {
    if (isBrowserRuntime) {
      const created = createVfsTextFile(desktopDirPath);
      await loadDesktopFolder();
      setSelectedIds([created.name]);
      setRenamingId(created.name);
      return;
    }
    const existingNames = new Set(items.map((i) => i.name));
    let fileName = "Untitled.txt";
    let n = 2;
    while (existingNames.has(fileName)) {
      fileName = `Untitled ${n++}.txt`;
    }
    const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${fileName}`;
    await domicile.files.write(fullPath, "").catch(() => undefined);
    await loadDesktopFolder();
    setSelectedIds([fileName]);
    setRenamingId(fileName);
  }, [desktopDirPath, domicile.files, isBrowserRuntime, items, loadDesktopFolder]);

  // Listen for "New Folder" and "New Text File" triggered from the Desktop context menu
  React.useEffect(() => {
    const onNewFolder = () => void createDesktopFolder();
    const onNewFile = () => void createDesktopTextFile();
    window.addEventListener("piloti:desktop-new-folder", onNewFolder);
    window.addEventListener("piloti:desktop-new-file", onNewFile);
    return () => {
      window.removeEventListener("piloti:desktop-new-folder", onNewFolder);
      window.removeEventListener("piloti:desktop-new-file", onNewFile);
    };
  }, [createDesktopFolder, createDesktopTextFile]);

  const handleCommitRename = React.useCallback(
    async (item: IconGridItem, rawNextName: string) => {
      setRenamingId(null);
      const nextName = rawNextName.trim().replace(/[/\\]/g, "");
      if (!nextName || nextName === item.name) return;

      const nextPath = `${desktopDirPath.replace(/\/+$/, "")}/${nextName}`;
      if (!isBrowserRuntime) {
        await domicile.processes
          .run(["mv", "-n", "--", item.path, nextPath])
          .catch(() => undefined);
        await loadDesktopFolder();
      } else {
        const renamed = renameVfsEntry(item.path, nextName);
        if (!renamed) return;
        await loadDesktopFolder();
      }

      if (settings.desktopIconPositions[item.id]) {
        const nextPositions = { ...settings.desktopIconPositions };
        nextPositions[nextName] = nextPositions[item.id];
        delete nextPositions[item.id];
        updateSettings({ desktopIconPositions: nextPositions });
      }
      setSelectedIds([nextName]);
    },
    [
      desktopDirPath,
      domicile.processes,
      isBrowserRuntime,
      loadDesktopFolder,
      settings.desktopIconPositions,
      updateSettings,
    ]
  );

  const handleMoveToTrash = React.useCallback(
    async (item: IconGridItem) => {
      setContextMenu(null);
      if (!isBrowserRuntime) {
        await domicile.processes
          .run([
            "sh",
            "-c",
            'if command -v gio >/dev/null 2>&1; then gio trash "$1"; else mkdir -p "$HOME/.local/share/Trash/files" "$HOME/.local/share/Trash/info" && base=$(basename "$1") && mv -f "$1" "$HOME/.local/share/Trash/files/$base"; fi',
            "sh",
            item.path,
          ])
          .catch(() => undefined);
        await loadDesktopFolder();
      } else {
        trashVfsEntry(item.path);
        await loadDesktopFolder();
      }
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    },
    [domicile.processes, isBrowserRuntime, loadDesktopFolder]
  );

  // Re-attach resolved XDG icon URLs once asynchronous icon loading completes
  const enrichedItems = React.useMemo(
    () =>
      items.map((item) => {
        if (item.iconUrl || !item.iconCandidates) return item;
        const resolved = item.iconCandidates
          .map((c) => getAppIconUrl(c))
          .find(Boolean);
        return resolved ? { ...item, iconUrl: resolved } : item;
      }),
    [getAppIconUrl, items]
  );

  const handleMoveItem = React.useCallback(
    (itemId: string, cell: GridCoord, metrics: GridMetrics) => {
      const currentAssigned = assignGridPositions(
        enrichedItems,
        settings.desktopIconPositions,
        metrics.cols,
        metrics.rows
      );
      const nextPositions = moveItemToCell(
        currentAssigned,
        itemId,
        cell,
        metrics.cols,
        metrics.rows
      );
      updateSettings({ desktopIconPositions: nextPositions });
    },
    [enrichedItems, settings.desktopIconPositions, updateSettings]
  );

  const handleActivateItem = React.useCallback(
    (item: IconGridItem) => {
      if (item.kind === "desktop-entry" && item.desktopEntry) {
        const lower = `${item.desktopEntry.desktopId} ${item.desktopEntry.exec}`.toLowerCase();
        if (isBrowserRuntime) {
          if (lower.includes("nautilus")) {
            launchApp("nautilus");
            return;
          }
          if (lower.includes("settings") || lower.includes("control-center")) {
            launchApp("settings");
            return;
          }
        }
        launchXdgEntry(item.desktopEntry);
        return;
      }

      if (item.kind === "directory") {
        if (isBrowserRuntime) {
          launchApp("nautilus", { payload: item.path });
          return;
        }
        launchDesktopCommand(domicile, ["nautilus", item.path]);
        return;
      }

      if (isBrowserRuntime) {
        const entry = getVfsEntry(item.path);
        if (entry && entry.kind === "file") {
          openWebUrl(buildVfsEntryWebAppUrl(entry), {
            asApp: true,
            appId: `file:${entry.path}`,
            title: entry.name,
          });
        }
        return;
      }
      launchDesktopCommand(domicile, ["xdg-open", item.path]);
    },
    [domicile, isBrowserRuntime, launchApp, launchXdgEntry, openWebUrl]
  );

  const handleDropDesktopItem = React.useCallback(
    async (item: IconGridItem, clientX: number, clientY: number) => {
      if (typeof document === "undefined") return;
      const hitElements = document.elementsFromPoint(clientX, clientY);
      for (const el of hitElements) {
        const dropTarget = (el as HTMLElement).closest?.("[data-vfs-drop-path]");
        const destPath = dropTarget?.getAttribute("data-vfs-drop-path");
        if (!destPath || destPath === item.path) continue;
        if (destPath === WEB_VFS_TRASH) {
          await handleMoveToTrash(item);
          return;
        }
        if (isBrowserRuntime) {
          moveVfsEntry(item.path, destPath);
          await loadDesktopFolder();
          setSelectedIds((prev) => prev.filter((id) => id !== item.id));
          return;
        }
      }
    },
    [handleMoveToTrash, isBrowserRuntime, loadDesktopFolder]
  );

  if (!settings.desktopIconsEnabled) return null;

  return (
    <div
      data-desktop-icons-root
      style={{ bottom: `${bottomInset}px` }}
      className="pointer-events-auto absolute inset-x-0 top-0 z-0"
      onDragOver={(e) => {
        if (!isBrowserRuntime || !e.dataTransfer?.types?.includes("Files")) {
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!externalDropActive) setExternalDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setExternalDropActive(false);
        }
      }}
      onDrop={(e) => {
        if (!isBrowserRuntime || !e.dataTransfer?.files?.length) return;
        e.preventDefault();
        setExternalDropActive(false);
        void importExternalFilesToVfs(desktopDirPath, e.dataTransfer.files);
      }}
    >
      <IconGrid
        items={enrichedItems}
        mode="spatial"
        positions={settings.desktopIconPositions}
        onMoveItem={handleMoveItem}
        onDropItem={(item, x, y) => void handleDropDesktopItem(item, x, y)}
        onActivateItem={handleActivateItem}
        onContextMenuItem={(item, e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ item, x: e.clientX, y: e.clientY });
        }}
        renamingId={renamingId}
        onCommitRename={(item, nextName) =>
          void handleCommitRename(item, nextName)
        }
        onCancelRename={() => setRenamingId(null)}
        selectedIds={selectedIds}
        onSelectIds={setSelectedIds}
        ariaLabel="Desktop Icons"
      />

      {externalDropActive && (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-end justify-center rounded-xl border-2 border-dashed border-adw-accent/70 bg-adw-accent/10 pb-4">
          <span className="rounded-full bg-zinc-900/90 px-3 py-1 text-xs font-medium text-white shadow-sm ring-1 ring-white/10">
            {_("Drop files to copy to Desktop")}
          </span>
        </div>
      )}

      <FileItemContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpen={handleActivateItem}
        onEditText={(target) =>
          launchApp("text-editor", { payload: target.path })
        }
        onRename={(target) => setRenamingId(target.id)}
        onNewFolder={() => void createDesktopFolder()}
        onNewTextFile={() => void createDesktopTextFile()}
        onTrash={(target) => void handleMoveToTrash(target)}
      />
    </div>
  );
}
