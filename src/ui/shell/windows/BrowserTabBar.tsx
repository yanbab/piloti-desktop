import * as React from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GlobeIcon, XIcon } from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { createPortal } from "react-dom";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/ui/components/ui/context-menu";
import type { BrowserTab } from "@/ui/context/WindowsContext";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import {
  DRAG_THRESHOLD,
  dragFlyBackAnimation,
  dragShuffleTransition,
  DRAG_DURATION,
  DRAG_LIFT,
} from "@/ui/fx/drag-feedback";

/** Dragging this far above or below the bar tears the tab off into its own window. */
const DETACH_DISTANCE = 32;

/** Escape cancels a dnd-kit pointer drag, the way a tear-off ends the reorder. */
function cancelReorder() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }));
}

const tabClass = (active: boolean, pinned = false) =>
  cn(
    // Chrome-style: tabs share the bar up to 240px each, left-aligned, and
    // shrink when there are many; icon, title, then close on the right.
    "group relative flex min-w-8 max-w-60 flex-1 basis-0 items-center gap-1.5 rounded-ui-control pr-1 pl-2 text-ui-small select-none",
    pinned && "max-w-9 min-w-9 flex-none justify-center px-0",
    active
      ? "bg-ui-window font-medium text-ui-label shadow-2xs"
      : "text-ui-label-secondary"
  );

function TabContents({ tab, active, onClose }: { tab: BrowserTab; active: boolean; onClose?: () => void }) {
  if (tab.pinned) {
    return tab.iconUrl ? (
      <img src={tab.iconUrl} alt="" className="size-4 shrink-0" draggable={false} />
    ) : (
      <SymbolicIcon name="web-browser" fallback={GlobeIcon} className="size-4 shrink-0" />
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label={_("Close Tab")}
        title={_("Close Tab")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
        className={cn(
          "order-last flex size-4 shrink-0 items-center justify-center rounded-ui-control text-ui-label-secondary hover-fill:bg-black/10 dark:hover-fill:bg-white/12",
          active ? "visible" : "invisible group-hover:visible"
        )}
      >
        <SymbolicIcon name="window-close" fallback={XIcon} className="size-3" />
      </button>
      {tab.iconUrl ? (
        <img src={tab.iconUrl} alt="" className="size-4 shrink-0" draggable={false} />
      ) : (
        <SymbolicIcon name="web-browser" fallback={GlobeIcon} className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{tab.title}</span>
    </>
  );
}

function SortableTab({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: BrowserTab;
  active: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  // Same springy neighbour shuffle as the Dock.
  const sortable = useSortable({ id: tab.id, transition: dragShuffleTransition });
  const { listeners } = sortable;
  return (
    <div
      ref={sortable.setNodeRef}
      {...sortable.attributes}
      {...listeners}
      role="tab"
      data-window-no-drag
      aria-selected={active}
      data-slot="browser-tab"
      data-tab-id={tab.id}
      data-tab-pinned={tab.pinned || undefined}
      data-active={active || undefined}
      title={tab.title}
      onPointerDown={(e) => {
        if (e.button === 0) onSelect(tab.id);
        listeners?.onPointerDown?.(e);
        // The bar is the window's titlebar: a tab drags itself, not the window.
        e.stopPropagation();
      }}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose(tab.id);
        }
      }}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0 : undefined,
      }}
      className={tabClass(active, tab.pinned)}
    >
      <TabContents tab={tab} active={active} onClose={() => onClose(tab.id)} />
    </div>
  );
}

/**
 * The tab strip of a web window. Tabs reorder with the Dock's dnd-kit feel
 * (horizontal only); pulling one away from the bar detaches it.
 */
export function BrowserTabBar({
  hidden,
  tabs,
  activeId,
  onSelect,
  onClose,
  onReorder,
  onDetach,
  onTearOff,
  onPin,
  onDuplicate,
  onReload,
  onCloseOthers,
  onCloseToRight,
}: {
  hidden: boolean;
  tabs: BrowserTab[];
  activeId?: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onDetach: (id: string) => void;
  /** The tab was pulled off the bar: it becomes a window following `pointer`. */
  onTearOff: (id: string, pointer: { clientX: number; clientY: number }) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDuplicate: (id: string) => void;
  onReload: (id: string) => void;
  /** Closes every tab but `id` (pinned ones stay). */
  onCloseOthers: (id: string) => void;
  onCloseToRight: (id: string) => void;
}) {
  const [menuTab, setMenuTab] = React.useState<string | null>(null);
  const menuTabInfo = tabs.find((t) => t.id === menuTab);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } })
  );
  const [overlay, setOverlay] = React.useState<{ id: string; width: number; height: number } | null>(null);
  const barRef = React.useRef<HTMLDivElement | null>(null);
  // The bar's edges at drag start: a dragged tab stays between them.
  const barRectRef = React.useRef<DOMRect | null>(null);
  const keepInBar = React.useCallback<Modifier>(({ transform, activeNodeRect }) => {
    // Pulled up or down, the tab gives a little, then tears off.
    const pull = Math.sign(transform.y) * Math.min(Math.abs(transform.y) * 0.45, DETACH_DISTANCE * 0.45);
    const bar = barRectRef.current;
    if (!bar || !activeNodeRect) return { ...transform, y: pull };
    const minX = bar.left + 2 - activeNodeRect.left;
    const maxX = bar.right - 2 - activeNodeRect.right;
    return { ...transform, x: Math.min(maxX, Math.max(minX, transform.x)), y: pull };
  }, []);
  // Lifted by its shadow only: a tab keeps its size while it moves.
  const liftRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.style.opacity = String(DRAG_LIFT.opacity);
    el.style.filter = DRAG_LIFT.restShadow;
    el.style.transition = `filter ${DRAG_DURATION.lift}ms ease`;
    requestAnimationFrame(() => {
      el.style.filter = DRAG_LIFT.shadow;
    });
  }, []);
  const ids = tabs.map((t) => t.id);
  const overlayTab = overlay ? tabs.find((t) => t.id === overlay.id) : undefined;

  // The modifier zeroes the vertical offset dnd-kit reports, so follow the
  // pointer itself: past DETACH_DISTANCE up or down, the tab tears off.
  const dragRef = React.useRef<{ id: string; startY: number } | null>(null);
  const onTearOffRef = React.useRef(onTearOff);
  onTearOffRef.current = onTearOff;
  const canTearRef = React.useRef(false);
  canTearRef.current = ids.length > 1;
  const trackPointer = React.useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !canTearRef.current) return;
    if (Math.abs(e.clientY - drag.startY) <= DETACH_DISTANCE) return;
    dragRef.current = null;
    window.removeEventListener("pointermove", trackPointer, true);
    cancelReorder();
    onTearOffRef.current(drag.id, { clientX: e.clientX, clientY: e.clientY });
  }, []);
  const stopTracking = React.useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", trackPointer, true);
  }, [trackPointer]);
  React.useEffect(() => stopTracking, [stopTracking]);

  const onDragStart = (e: DragStartEvent) => {
    barRectRef.current = barRef.current?.getBoundingClientRect() ?? null;
    dragRef.current = {
      id: String(e.active.id),
      startY: (e.activatorEvent as PointerEvent).clientY,
    };
    window.addEventListener("pointermove", trackPointer, true);
    // The ghost keeps the tab's size: measure the tab itself.
    const node = Array.from(
      barRef.current?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? []
    ).find((el) => el.dataset.tabId === String(e.active.id));
    const rect = node?.getBoundingClientRect() ?? e.active.rect.current.initial;
    setOverlay({ id: String(e.active.id), width: rect?.width ?? 160, height: rect?.height ?? 28 });
  };
  const onDragEnd = (e: DragEndEvent) => {
    stopTracking();
    setOverlay(null);
    const id = String(e.active.id);
    const from = ids.indexOf(id);
    const to = e.over ? ids.indexOf(String(e.over.id)) : -1;
    if (from >= 0 && to >= 0 && from !== to) onReorder(arrayMove([...ids], from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[keepInBar]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        stopTracking();
        setOverlay(null);
      }}
    >
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <ContextMenu>
          <ContextMenuTrigger
            onContextMenuCapture={(e: React.MouseEvent) =>
              setMenuTab(
                (e.target as HTMLElement).closest<HTMLElement>("[data-tab-id]")?.dataset.tabId ?? null
              )
            }
            render={
              <div
                ref={barRef}
                role="tablist"
                data-slot="browser-tab-bar"
                hidden={hidden}
                className={cn(
                  "h-ui-control-large min-w-0 flex-1 items-stretch gap-px py-0.5",
                  hidden ? "hidden" : "flex"
                )}
              />
            }
          >
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeId}
                onSelect={onSelect}
                onClose={onClose}
              />
            ))}
          </ContextMenuTrigger>
          {menuTabInfo && (
            <ContextMenuContent className="min-w-48">
              <ContextMenuItem onClick={() => onReload(menuTabInfo.id)}>{_("Reload Tab")}</ContextMenuItem>
              <ContextMenuItem onClick={() => onDuplicate(menuTabInfo.id)}>{_("Duplicate Tab")}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onPin(menuTabInfo.id, !menuTabInfo.pinned)}>
                {menuTabInfo.pinned ? _("Unpin Tab") : _("Pin Tab")}
              </ContextMenuItem>
              {tabs.length > 1 && (
                <ContextMenuItem onClick={() => onDetach(menuTabInfo.id)}>
                  {_("Move Tab to New Window")}
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onClose(menuTabInfo.id)}>{_("Close Tab")}</ContextMenuItem>
              <ContextMenuItem
                disabled={!tabs.some((t) => t.id !== menuTabInfo.id && !t.pinned)}
                onClick={() => onCloseOthers(menuTabInfo.id)}
              >
                {_("Close Other Tabs")}
              </ContextMenuItem>
              <ContextMenuItem
                disabled={!tabs.slice(tabs.findIndex((t) => t.id === menuTabInfo.id) + 1).some((t) => !t.pinned)}
                onClick={() => onCloseToRight(menuTabInfo.id)}
              >
                {_("Close Tabs to the Right")}
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>
      </SortableContext>
      {typeof document !== "undefined" &&
        createPortal(
          <>
          {/* Pages are iframes/web views that swallow the pointer: cover them while dragging. */}
          {overlay && <div className="fixed inset-0 z-[9998] cursor-grabbing" />}
          <DragOverlay zIndex={9999} modifiers={[keepInBar]} dropAnimation={dragFlyBackAnimation}>
            {overlayTab && overlay ? (
              <div
                ref={liftRef}
                data-dnd-kit-overlay=""
                style={{ width: overlay.width, height: overlay.height }}
                className={cn(
                  tabClass(overlayTab.id === activeId, overlayTab.pinned),
                  "max-w-none min-w-0 flex-none cursor-grabbing"
                )}
              >
                <TabContents tab={overlayTab} active={overlayTab.id === activeId} />
              </div>
            ) : null}
          </DragOverlay>
          </>,
          document.body
        )}
    </DndContext>
  );
}
