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
import { createPortal } from "react-dom";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { BrowserTab } from "@/context/WindowsContext";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import {
  DRAG_THRESHOLD,
  dragFlyBackAnimation,
  dragShuffleTransition,
  liftGhost,
} from "@/lib/shell/drag-feedback";

/** Tabs slide sideways only. */
const horizontalOnly: Modifier = ({ transform }) => ({ ...transform, y: 0 });

/** Dragging this far above or below the bar tears the tab off into its own window. */
const DETACH_DISTANCE = 48;

const tabClass = (active: boolean, pinned = false) =>
  cn(
    // Chrome-style: tabs share the bar up to 240px each, left-aligned, and
    // shrink when there are many; icon, title, then close on the right.
    "group relative flex min-w-8 max-w-60 flex-1 basis-0 items-center gap-1.5 rounded-shell-control pr-1 pl-2 text-shell-subheadline select-none",
    pinned && "max-w-9 min-w-9 flex-none justify-center px-0",
    active
      ? "bg-shell-window font-medium text-shell-label shadow-2xs"
      : "text-shell-label-secondary"
  );

function TabContents({ tab, active, onClose }: { tab: BrowserTab; active: boolean; onClose?: () => void }) {
  if (tab.pinned) {
    return tab.iconUrl ? (
      <img src={tab.iconUrl} alt="" className="size-4 shrink-0" draggable={false} />
    ) : (
      <GlobeIcon className="size-4 shrink-0" />
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
          "order-last flex size-4 shrink-0 items-center justify-center rounded-shell-control text-shell-label-secondary hover-fill:bg-black/10 dark:hover-fill:bg-white/12",
          active ? "visible" : "invisible group-hover:visible"
        )}
      >
        <XIcon className="size-3" />
      </button>
      {tab.iconUrl ? (
        <img src={tab.iconUrl} alt="" className="size-4 shrink-0" draggable={false} />
      ) : (
        <GlobeIcon className="size-4 shrink-0" />
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
      aria-selected={active}
      data-slot="browser-tab"
      data-tab-id={tab.id}
      data-tab-pinned={tab.pinned || undefined}
      data-active={active || undefined}
      title={tab.title}
      onPointerDown={(e) => {
        if (e.button === 0) onSelect(tab.id);
        listeners?.onPointerDown?.(e);
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
  top,
  tabs,
  activeId,
  onSelect,
  onClose,
  onReorder,
  onDetach,
  onPin,
}: {
  hidden: boolean;
  top: number;
  tabs: BrowserTab[];
  activeId?: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onDetach: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}) {
  const [menuTab, setMenuTab] = React.useState<string | null>(null);
  const menuTabInfo = tabs.find((t) => t.id === menuTab);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } })
  );
  const [overlay, setOverlay] = React.useState<{ id: string; width: number; height: number } | null>(null);
  const [tearing, setTearing] = React.useState(false);
  const liftRef = React.useCallback((el: HTMLDivElement | null) => {
    if (el) liftGhost(el);
  }, []);
  const ids = tabs.map((t) => t.id);
  const overlayTab = overlay ? tabs.find((t) => t.id === overlay.id) : undefined;

  // The modifier zeroes the vertical offset dnd-kit reports, so follow the pointer itself.
  const pointerRef = React.useRef({ startY: 0, y: 0 });
  const trackPointer = React.useCallback((e: PointerEvent) => {
    pointerRef.current.y = e.clientY;
    setTearing(Math.abs(e.clientY - pointerRef.current.startY) > DETACH_DISTANCE);
  }, []);
  const stopTracking = React.useCallback(() => {
    window.removeEventListener("pointermove", trackPointer);
  }, [trackPointer]);
  React.useEffect(() => stopTracking, [stopTracking]);

  const onDragStart = (e: DragStartEvent) => {
    const startY = (e.activatorEvent as PointerEvent).clientY;
    pointerRef.current = { startY, y: startY };
    window.addEventListener("pointermove", trackPointer);
    const rect = e.active.rect.current.initial;
    setOverlay({ id: String(e.active.id), width: rect?.width ?? 160, height: rect?.height ?? 28 });
  };
  const onDragEnd = (e: DragEndEvent) => {
    stopTracking();
    setOverlay(null);
    setTearing(false);
    const id = String(e.active.id);
    const { startY, y } = pointerRef.current;
    if (ids.length > 1 && Math.abs(y - startY) > DETACH_DISTANCE) {
      onDetach(id);
      return;
    }
    const from = ids.indexOf(id);
    const to = e.over ? ids.indexOf(String(e.over.id)) : -1;
    if (from >= 0 && to >= 0 && from !== to) onReorder(arrayMove([...ids], from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[horizontalOnly]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        stopTracking();
        setOverlay(null);
        setTearing(false);
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
                role="tablist"
                data-slot="browser-tab-bar"
                hidden={hidden}
                style={{ top }}
                className={cn(
                  "absolute inset-x-0 z-10 h-shell-control-medium shrink-0 items-stretch gap-px border-b border-shell-separator bg-black/5 px-1 py-0.5 dark:bg-white/4",
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
            </ContextMenuContent>
          )}
        </ContextMenu>
      </SortableContext>
      {typeof document !== "undefined" &&
        createPortal(
          <>
          {/* Pages are iframes/web views that swallow the pointer: cover them while dragging. */}
          {overlay && <div className="fixed inset-0 z-[9998] cursor-grabbing" />}
          <DragOverlay zIndex={9999} modifiers={[horizontalOnly]} dropAnimation={dragFlyBackAnimation}>
            {overlayTab && overlay ? (
              <div
                ref={liftRef}
                data-dnd-kit-overlay=""
                style={{ width: overlay.width, height: overlay.height, opacity: tearing ? 0.6 : 1 }}
                className={cn(tabClass(overlayTab.id === activeId, overlayTab.pinned), "cursor-grabbing")}
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
