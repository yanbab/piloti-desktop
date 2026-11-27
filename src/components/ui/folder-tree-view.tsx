import * as React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { BriefcaseIcon, HeartIcon, TagIcon } from "lucide-react";
import {
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "@/components/ui/symbols";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { ThemeFolderIcon } from "@/components/ui/folder-icon";
import type { ListViewSort } from "@/components/ui/list-view";
import { DynamicFileIcon, useOpenFolderPaths } from "@/data/folder-icons";
import type { FolderTree } from "@/hooks/use-folder-tree";
import { VFS_EMBLEM_META, type VfsEmblemId } from "@/lib/core/emblems";
import { _, getLocale } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { parentPath } from "@/lib/ports/vfs";
import type { IconGridItem } from "@/lib/shell/desktop-icons";
import {
  DRAG_DURATION,
  DRAG_EASE_SETTLE,
  DRAG_THRESHOLD,
  dragFlyBackAnimation,
} from "@/lib/shell/drag-feedback";
import { buildDragGhost } from "@/lib/shell/drag-ghost";
import { topmostItems, type FolderTreeNode } from "@/lib/shell/folder-tree";
import {
  broadcastItemDrag,
  endItemDragBroadcast,
  resolveTopDropTarget,
  routeItemDrop,
} from "@/lib/shell/item-drop";

const INDENT_PX = 16;
const HEADER_PX = 28;

const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});

type ColumnId = "name" | "kind" | "size" | "modified" | "favorite";
export type TreeSortColumn = "name" | "kind" | "size" | "modified";

const COLUMN_WIDTHS: Record<ColumnId, string> = {
  name: "minmax(0, 1fr)",
  kind: "88px",
  size: "88px",
  modified: "104px",
  favorite: "32px",
};
const columns = (Object.keys(COLUMN_WIDTHS) as ColumnId[]).map((id) => ({ id }));

const columnLabel = (id: ColumnId): string =>
  id === "name"
    ? _("Name")
    : id === "kind"
      ? _("Kind")
      : id === "size"
        ? _("Size")
        : id === "modified"
          ? _("Modified")
          : "";

const kindLabel = (item: IconGridItem): string =>
  item.kind === "desktop-entry"
    ? _("Application")
    : item.kind === "directory"
      ? _("Directory")
      : _("File");

const sizeLabel = (item: IconGridItem): string =>
  item.kind === "desktop-entry"
    ? "—"
    : item.kind === "directory"
      ? _("Folder")
      : item.size === undefined
        ? "—"
        : `${item.size} B`;

const modifiedLabel = (item: IconGridItem): string =>
  item.modifiedMs
    ? new Date(item.modifiedMs).toLocaleDateString(
        getLocale() === "fr" ? "fr-FR" : getLocale() === "es" ? "es-ES" : "en-US",
      )
    : "—";

export interface FolderTreeViewProps {
  tree: FolderTree;
  sort?: ListViewSort<string>;
  onSort: (column: TreeSortColumn) => void;
  iconSize: number;
  accentColor: React.ComponentProps<typeof ThemeFolderIcon>["accentColor"];
  selectedIds: readonly string[];
  onSelectIds: (ids: string[]) => void;
  /** Files open in a window are dimmed. */
  openFilePaths: ReadonlySet<string>;
  emblemsOf: (item: IconGridItem) => readonly VfsEmblemId[];
  onToggleFavorite: (item: IconGridItem) => void;
  renamingId: string | null;
  onCommitRename: (item: IconGridItem, name: string) => void;
  onCancelRename: () => void;
  onActivateItem: (item: IconGridItem, row: HTMLElement) => void;
  activateOnClick: boolean;
  onContextMenuItem: (item: IconGridItem, event: React.MouseEvent<HTMLElement>) => void;
  /** Unset where nothing can be dropped (Trash, virtual views). */
  onDropItems?: (items: IconGridItem[], destPath: string, opts?: { copy?: boolean }) => void;
  ariaLabel?: string;
}

/**
 * Folders' list view: a tree. TanStack Table holds the rows and their depth,
 * TanStack Virtual renders the visible ones, dnd-kit drags them with the same
 * feedback and drop targets as the icon grids.
 */
export function FolderTreeView({
  tree,
  sort,
  onSort,
  iconSize,
  accentColor,
  selectedIds,
  onSelectIds,
  openFilePaths,
  emblemsOf,
  onToggleFavorite,
  renamingId,
  onCommitRename,
  onCancelRename,
  onActivateItem,
  activateOnClick,
  onContextMenuItem,
  onDropItems,
  ariaLabel,
}: FolderTreeViewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const openFolderPaths = useOpenFolderPaths();

  const table = useTable({
    features,
    columns,
    data: tree.nodes,
    getRowId: (node: FolderTreeNode) => node.item.id,
    getSubRows: (node: FolderTreeNode) => node.children,
    getRowCanExpand: (row) => tree.expandable && row.original.item.kind === "directory",
    state: { expanded: { ...tree.expanded } },
    autoResetExpanded: false,
  });
  const rows = table.getRowModel().rows;
  const indexById = React.useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows]);
  const selected = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  // Narrow windows drop the less useful columns.
  const [width, setWidth] = React.useState(800);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth || 800));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const visibleColumns = table
    .getAllLeafColumns()
    .map((column) => column.id as ColumnId)
    .filter((id) => (id === "modified" ? width >= 520 : id === "kind" ? width >= 400 : true));
  const gridTemplateColumns = visibleColumns.map((id) => COLUMN_WIDTHS[id]).join(" ");

  // ── Keyboard cursor and Shift ranges ──
  const [cursorId, setCursorId] = React.useState<string | null>(null);
  const anchorRef = React.useRef<string | null>(null);
  const cursorIndex =
    (cursorId !== null && selected.has(cursorId) ? indexById.get(cursorId) : undefined) ??
    indexById.get(selectedIds.at(-1) ?? "") ??
    -1;

  const select = (index: number, mode: "one" | "toggle" | "range") => {
    const id = rows[index]?.id;
    if (id === undefined) return;
    setCursorId(id);
    if (mode === "range") {
      const from = indexById.get(anchorRef.current ?? "") ?? index;
      onSelectIds(rows.slice(Math.min(from, index), Math.max(from, index) + 1).map((r) => r.id));
      return;
    }
    anchorRef.current = id;
    if (mode === "one") onSelectIds([id]);
    else onSelectIds(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
  };

  // ── Opening and closing ──
  const [revealing, setRevealing] = React.useState<string | null>(null);
  const setOpen = (item: IconGridItem, open: boolean) => {
    if (open) {
      setRevealing(item.path);
    } else {
      // Nothing stays selected out of sight.
      const kept = selectedIds.filter((id) => !id.startsWith(`${item.path}/`));
      if (kept.length !== selectedIds.length) onSelectIds(kept);
    }
    tree.setOpen(item.path, open);
  };
  const revealPending = revealing !== null && tree.loading.has(revealing);
  React.useEffect(() => {
    if (revealing === null || revealPending) return;
    const timer = window.setTimeout(() => setRevealing(null), DRAG_DURATION.reveal);
    return () => window.clearTimeout(timer);
  }, [revealPending, revealing]);

  // ── Drag and drop ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }),
  );
  const [drag, setDrag] = React.useState<{ id: string; items: IconGridItem[] } | null>(null);
  const [dropped, setDropped] = React.useState(false);
  const [dropPath, setDropPath] = React.useState<string | null>(null);
  const pendingDragRef = React.useRef<IconGridItem[]>([]);
  const pointerRef = React.useRef({ x: 0, y: 0, copy: false });
  const suppressClickRef = React.useRef(false);
  const nameCells = React.useRef(new Map<string, HTMLElement>());
  const rowNodes = React.useRef(new Map<string, HTMLElement>());

  // While dragging: tell the Dock and other views where the pointer is.
  React.useEffect(() => {
    if (!drag) return;
    const primary = drag.items.find((i) => i.id === drag.id) ?? drag.items[0];
    if (!primary) return;
    let frame = 0;
    const track = (e: PointerEvent | KeyboardEvent) => {
      pointerRef.current.copy = e.ctrlKey || e.altKey;
      document.body.style.cursor = pointerRef.current.copy ? "copy" : "";
      if (!("clientX" in e)) return;
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        broadcastItemDrag(primary, drag.items, pointerRef.current.x, pointerRef.current.y);
      });
    };
    const events = ["pointermove", "pointerup", "keydown", "keyup"] as const;
    events.forEach((type) => window.addEventListener(type, track, true));
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.cursor = "";
      events.forEach((type) => window.removeEventListener(type, track, true));
    };
  }, [drag]);

  // The folder under any dragged item (from here or elsewhere) lights up.
  React.useEffect(() => {
    const onItemDrag = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          active?: boolean;
          items?: { path: string }[];
          clientX?: number;
          clientY?: number;
        }>
      ).detail;
      if (!detail?.active || detail.clientX === undefined || detail.clientY === undefined) {
        setDropPath(null);
        return;
      }
      const target = resolveTopDropTarget(
        detail.clientX,
        detail.clientY,
        detail.items?.map((i) => i.path) ?? [],
      );
      setDropPath(target?.kind === "vfs" ? target.destPath : null);
    };
    window.addEventListener("residence:file-drag", onItemDrag);
    return () => window.removeEventListener("residence:file-drag", onItemDrag);
  }, []);

  // Hovering a closed folder opens it.
  const springRef = React.useRef(setOpen);
  React.useLayoutEffect(() => {
    springRef.current = setOpen;
  });
  const hovered = dropPath === null ? undefined : rows[indexById.get(dropPath) ?? -1];
  const springItem =
    hovered?.getCanExpand() && !hovered.getIsExpanded() ? hovered.original.item : null;
  const springPath = springItem?.path;
  const springItemRef = React.useRef(springItem);
  React.useLayoutEffect(() => {
    springItemRef.current = springItem;
  });
  React.useEffect(() => {
    if (!springPath) return;
    const timer = window.setTimeout(() => {
      const item = springItemRef.current;
      if (item) springRef.current(item, true);
    }, DRAG_DURATION.springLoad);
    return () => window.clearTimeout(timer);
  }, [springPath]);

  // A folder that received a drop plays its animation.
  const [dropNonces, setDropNonces] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    const onFolderDrop = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path;
      if (path) setDropNonces((prev) => ({ ...prev, [path]: (prev[path] ?? 0) + 1 }));
    };
    window.addEventListener("piloti:folder-drop-anim", onFolderDrop);
    return () => window.removeEventListener("piloti:folder-drop-anim", onFolderDrop);
  }, []);

  const endDrag = (commit: boolean) => {
    const current = drag;
    setDrag(null);
    endItemDragBroadcast();
    window.setTimeout(() => (suppressClickRef.current = false), 0);
    const primary = current?.items.find((i) => i.id === current.id) ?? current?.items[0];
    if (!commit || !current || !primary) return;
    const outcome = routeItemDrop(primary, current.items, pointerRef.current, { onDropItems });
    // Taken somewhere: the ghost disappears there instead of flying back.
    setDropped(outcome === "external");
  };

  // ── Rendering only what is on screen ──
  const rowHeight = Math.max(28, iconSize + 10);
  // These rows stay mounted when scrolled away: focus, a half-typed name, the
  // row in hand.
  const pinned = [cursorId, renamingId, drag?.id ?? null]
    .map((id) => (id === null ? undefined : indexById.get(id)))
    .filter((i): i is number => i !== undefined);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index]!.id,
    overscan: 12,
    scrollMargin: HEADER_PX,
    scrollPaddingStart: HEADER_PX,
    rangeExtractor: (range: Range) =>
      [...new Set([...defaultRangeExtractor(range), ...pinned])].sort((a, b) => a - b),
  });
  React.useLayoutEffect(() => virtualizer.measure(), [rowHeight, virtualizer]);

  // Bring a new, renamed or keyboard-selected row into view, once.
  const primaryId = renamingId ?? (selectedIds.length === 1 ? selectedIds[0]! : null);
  const primaryIndex = primaryId === null ? undefined : indexById.get(primaryId);
  const shownRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (primaryId === null) {
      shownRef.current = null;
      return;
    }
    if (primaryIndex === undefined || shownRef.current === primaryId) return;
    shownRef.current = primaryId;
    virtualizer.scrollToIndex(primaryIndex);
  }, [primaryId, primaryIndex, virtualizer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
    const row = rows[cursorIndex];
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 0) / rowHeight) - 1);
    const go = (index: number) => {
      const next = Math.max(0, Math.min(rows.length - 1, index));
      select(next, e.shiftKey ? "range" : "one");
      virtualizer.scrollToIndex(next);
    };
    if (e.key === "ArrowDown") go(cursorIndex + 1);
    else if (e.key === "ArrowUp") go(cursorIndex < 0 ? rows.length - 1 : cursorIndex - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(rows.length - 1);
    else if (e.key === "PageDown") go(cursorIndex + page);
    else if (e.key === "PageUp") go(cursorIndex - page);
    else if (e.key === "ArrowRight" && row?.getCanExpand()) {
      if (!row.getIsExpanded()) setOpen(row.original.item, true);
      else if (row.subRows.length > 0) go(cursorIndex + 1);
    } else if (e.key === "ArrowLeft" && row && (row.getIsExpanded() || row.parentId)) {
      // On a closed top-level row Left goes on to the sidebar.
      if (row.getCanExpand() && row.getIsExpanded()) setOpen(row.original.item, false);
      else go(indexById.get(row.parentId!) ?? cursorIndex);
    } else if ((e.key === "Enter" || e.key === " ") && row) {
      onActivateItem(row.original.item, rowNodes.current.get(row.id) ?? scrollRef.current!);
    } else if (e.key === "Escape" && selectedIds.length > 0) onSelectIds([]);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  // Enter and Escape remove the rename field: keep the keyboard in the tree.
  const refocus = () => scrollRef.current?.focus({ preventScroll: true });

  const isUnderDrag = (path: string) =>
    Boolean(drag?.items.some((i) => path === i.path || path.startsWith(`${i.path}/`)));

  const renderCell = (column: ColumnId, row: (typeof rows)[number]) => {
    const item = row.original.item;
    const emblems = item.kind === "desktop-entry" ? [] : emblemsOf(item);
    if (column === "kind") {
      return (
        <span className="truncate px-3 text-ui-label-secondary">
          {kindLabel(item)}
        </span>
      );
    }
    if (column === "size" || column === "modified") {
      return (
        <span className="truncate px-3 text-right font-mono text-ui-small text-ui-label-secondary">
          {column === "size" ? sizeLabel(item) : modifiedLabel(item)}
        </span>
      );
    }
    if (column === "favorite") {
      const isFavorite = emblems.includes("favorite");
      const label = isFavorite ? _("Remove from Favorites") : _("Add to Favorites");
      return (
        <span className="flex justify-center">
          {item.kind !== "desktop-entry" && (
            <button
              type="button"
              tabIndex={-1}
              data-slot="list-favorite-toggle"
              aria-pressed={isFavorite}
              aria-label={label}
              title={label}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.preventDefault();
                refocus();
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item);
              }}
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-ui-control transition-opacity duration-150",
                isFavorite
                  ? "text-red-500 opacity-100"
                  : "text-ui-label-secondary opacity-0 group-hover:opacity-60 hover:!opacity-100",
              )}
            >
              <HeartIcon className={cn("size-3.5", isFavorite && "fill-current")} />
            </button>
          )}
        </span>
      );
    }
    const expanded = row.getCanExpand() && row.getIsExpanded();
    return (
      <span
        className="flex min-w-0 items-center gap-1 pr-2 pl-1"
        style={{ paddingLeft: 4 + row.depth * INDENT_PX }}
      >
        {row.getCanExpand() ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={expanded ? _("Collapse") : _("Expand")}
            aria-busy={tree.loading.has(item.path) || undefined}
            onPointerDown={(e) => e.stopPropagation()}
            // Focus stays on the tree: this row can scroll out of the DOM.
            onMouseDown={(e) => {
              e.preventDefault();
              refocus();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(item, !expanded);
            }}
            className="inline-flex size-5 shrink-0 items-center justify-center text-ui-label-secondary outline-none aria-busy:opacity-50"
          >
            <ChevronRightIcon
              className={cn(
                "size-3 transition-transform motion-reduce:transition-none",
                expanded && "rotate-90",
              )}
              style={{
                transitionDuration: `${DRAG_DURATION.reveal}ms`,
                transitionTimingFunction: DRAG_EASE_SETTLE,
              }}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <span
          ref={(node) => {
            if (node) nameCells.current.set(row.id, node);
            else nameCells.current.delete(row.id);
          }}
          className="flex min-w-0 items-center gap-2 font-medium"
        >
          <span
            style={{ width: iconSize, height: iconSize }}
            className={cn(
              "inline-flex shrink-0",
              item.kind === "file" &&
                openFilePaths.has(item.path.replace(/\/+$/, "") || "/") &&
                "opacity-55 grayscale-[0.45] brightness-90",
            )}
          >
            {item.kind === "desktop-entry" ? (
              <AppSquircleIcon
                iconName={item.iconName}
                iconUrl={item.iconUrl}
                squircle={item.id.startsWith("app:web:")}
                className="size-full"
              />
            ) : item.kind === "directory" ? (
              <ThemeFolderIcon
                accentColor={accentColor}
                opened={expanded || dropPath === item.path || openFolderPaths.has(item.path)}
                playNonce={dropNonces[item.path] ?? 0}
                pathOrName={item.path || item.name}
                className="size-full"
              />
            ) : (
              <DynamicFileIcon
                accentColor={accentColor}
                name={item.name}
                iconCandidates={item.iconCandidates}
                isEmpty={item.isEmpty}
                className="size-full"
              />
            )}
          </span>
          {renamingId === item.id ? (
            <RenameField
              item={item}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
              onKeyDone={refocus}
            />
          ) : (
            <span className="truncate">{item.name}</span>
          )}
          {emblems
            .filter((id) => id !== "favorite")
            .map((id) => {
              const Icon =
                id === "important" ? AlertCircleIcon : id === "work" ? BriefcaseIcon : TagIcon;
              return <Icon key={id} className={cn("size-3 shrink-0", VFS_EMBLEM_META[id].colorClass)} />;
            })}
        </span>
      </span>
    );
  };

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => {
        suppressClickRef.current = true;
        setDropped(false);
        setDrag({ id: String(e.active.id), items: pendingDragRef.current });
      }}
      onDragEnd={() => endDrag(true)}
      onDragCancel={() => endDrag(false)}
    >
      <div
        ref={scrollRef}
        role="treegrid"
        aria-label={ariaLabel}
        aria-multiselectable="true"
        aria-rowcount={rows.length + 1}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('[role="row"]')) onSelectIds([]);
        }}
        className="group/tree h-full select-none overflow-auto text-ui-body outline-none"
      >
        <div
          role="row"
          data-slot="list-view-header"
          style={{ gridTemplateColumns, height: HEADER_PX }}
          className="sticky top-0 z-10 grid items-stretch border-b border-ui-separator bg-ui-window px-2 text-ui-small font-semibold text-ui-label-secondary"
        >
          {visibleColumns.map((id) => {
            if (id === "favorite") {
              return <span key={id} role="columnheader" aria-label={_("Favorites")} />;
            }
            const active = sort?.by === id;
            const right = id === "size" || id === "modified";
            const Arrow = sort?.dir === "desc" ? ChevronDownIcon : ChevronUpIcon;
            return (
              <span
                key={id}
                role="columnheader"
                aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                className="flex min-w-0"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  data-slot="list-view-sort"
                  data-active={active || undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSort(id);
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-1 px-3 outline-none data-[active]:text-ui-label",
                    right && "flex-row-reverse",
                  )}
                >
                  <span className="truncate">{columnLabel(id)}</span>
                  {active && <Arrow className="size-3 shrink-0" strokeWidth={2.5} />}
                </button>
              </span>
            );
          })}
        </div>
        <div className="relative mx-2" style={{ height: virtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            const item = row.original.item;
            const isSelected = selected.has(row.id);
            const dropInto =
              onDropItems && item.kind !== "desktop-entry"
                ? item.kind === "directory"
                  ? item.path
                  : parentPath(item.path)
                : undefined;
            return (
              <TreeRow
                key={row.id}
                id={row.id}
                nodeRef={(node) => {
                  if (node) rowNodes.current.set(row.id, node);
                  else rowNodes.current.delete(row.id);
                }}
                role="row"
                data-slot="list-view-row"
                data-selected={isSelected || undefined}
                data-vfs-drop-path={dropInto}
                data-drop-blocked={isUnderDrag(item.path) ? "" : undefined}
                aria-rowindex={virtualRow.index + 2}
                aria-level={row.depth + 1}
                aria-selected={isSelected}
                aria-expanded={row.getCanExpand() ? row.getIsExpanded() : undefined}
                style={{
                  top: virtualRow.start - HEADER_PX,
                  height: rowHeight,
                  gridTemplateColumns,
                  opacity: item.isHidden || item.name.startsWith(".") ? 0.55 : undefined,
                  animationDuration: `${DRAG_DURATION.reveal}ms`,
                  animationTimingFunction: DRAG_EASE_SETTLE,
                }}
                className={cn(
                  "group absolute inset-x-0 grid cursor-default items-center border-b border-ui-separator/40 transition-colors",
                  isSelected || (item.kind === "directory" && dropPath === item.path)
                    ? "bg-ui-accent/20 text-ui-label"
                    : "hover-fill:bg-black/4 dark:hover-fill:bg-white/5",
                  virtualRow.index === cursorIndex &&
                    "group-focus-visible/tree:ring-1 group-focus-visible/tree:ring-ui-accent/70 group-focus-visible/tree:ring-inset",
                  revealing !== null &&
                    row.id.startsWith(`${revealing}/`) &&
                    "animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none",
                )}
                onPress={(e) => {
                  scrollRef.current?.focus({ preventScroll: true });
                  if (e.shiftKey) select(virtualRow.index, "range");
                  else if (e.metaKey || e.ctrlKey) select(virtualRow.index, "toggle");
                  else if (!isSelected) select(virtualRow.index, "one");
                  pendingDragRef.current = isSelected
                    ? topmostItems(
                        rows.filter((r) => selected.has(r.id)).map((r) => r.original.item),
                      )
                    : [item];
                }}
                onClick={(e) => {
                  if (suppressClickRef.current || e.shiftKey || e.metaKey || e.ctrlKey) return;
                  select(virtualRow.index, "one");
                  if (activateOnClick || item.kind === "desktop-entry") {
                    onActivateItem(item, e.currentTarget);
                  }
                }}
                onDoubleClick={(e) => {
                  if (!activateOnClick && item.kind !== "desktop-entry") {
                    onActivateItem(item, e.currentTarget);
                  }
                }}
                onContextMenu={(e) => {
                  if (!isSelected) select(virtualRow.index, "one");
                  onContextMenuItem(item, e);
                }}
              >
                {visibleColumns.map((column) => (
                  <span key={column} role="gridcell" className="grid min-w-0">
                    {renderCell(column, row)}
                  </span>
                ))}
              </TreeRow>
            );
          })}
        </div>
      </div>
      {createPortal(
        <DragOverlay zIndex={9999} dropAnimation={dropped ? null : dragFlyBackAnimation}>
          {drag ? (
            <div
              data-drag-ghost
              ref={(el) => {
                const origin = rowNodes.current.get(drag.id)?.getBoundingClientRect();
                if (!el || !origin) return;
                buildDragGhost(el, {
                  ids: drag.items.map((i) => i.id),
                  primaryId: drag.id,
                  nodeOf: (id) => nameCells.current.get(id),
                  origin,
                });
              }}
              className="pointer-events-none size-full text-ui-body text-ui-label select-none"
            />
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

function TreeRow({
  id,
  nodeRef,
  onPress,
  ...props
}: Omit<React.ComponentProps<"div">, "id"> & {
  id: string;
  nodeRef: (node: HTMLElement | null) => void;
  onPress: (e: React.PointerEvent) => void;
}) {
  const { setNodeRef, listeners } = useDraggable({ id });
  return (
    <div
      {...props}
      ref={(node) => {
        setNodeRef(node);
        nodeRef(node);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onPress(e);
        listeners?.onPointerDown?.(e);
      }}
    />
  );
}

function RenameField({
  item,
  onCommit,
  onCancel,
  onKeyDone,
}: {
  item: IconGridItem;
  onCommit: (item: IconGridItem, name: string) => void;
  onCancel: () => void;
  onKeyDone: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  // Leaving the field after Enter or Escape must not commit a second time.
  const done = React.useRef(false);
  React.useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    const dot = item.kind === "file" ? item.name.lastIndexOf(".") : -1;
    input.setSelectionRange(0, dot > 0 ? dot : item.name.length);
  }, [item.kind, item.name]);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <input
      ref={ref}
      type="text"
      defaultValue={item.name}
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key !== "Enter" && e.key !== "Escape") return;
        e.preventDefault();
        done.current = true;
        if (e.key === "Enter") onCommit(item, e.currentTarget.value);
        else onCancel();
        onKeyDone();
      }}
      onBlur={(e) => {
        if (!done.current) onCommit(item, e.currentTarget.value);
      }}
      className="min-w-28 rounded bg-ui-hud-dark px-1.5 py-0.5 text-ui-body font-medium text-ui-hud-dark-label ring-1 ring-ui-accent outline-none"
    />
  );
}
