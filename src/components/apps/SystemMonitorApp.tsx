import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { WindowControls } from "@/components/ui/window";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import {
  ListView,
  ListViewCell,
  ListViewHeader,
  ListViewRow,
  nextListViewSort,
  type ListViewSort,
} from "@/components/ui/list-view";
import { useApps, useWindowManagerSelector } from "@/context/DesktopStateContext";
import { APP_CATALOG } from "@/data/catalog";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { getAppSetting, setAppSetting } from "@/lib/shell/app-settings";
import { DRAG_THRESHOLD, dragShuffleTransition } from "@/lib/shell/drag-feedback";

/**
 * System Monitor: one page of widgets the user reorders by dragging.
 *
 * First version: the numbers are simulated (`useSimulatedStats`), the widgets
 * and their layout are real. Widget order and the apps list sort are app
 * settings (`~/.config/piloti/apps/system-monitor.ini`).
 */

const APP_ID = "system-monitor";
const TICK_MS = 2000;
const HISTORY = 30;

type WidgetId = "cpu" | "memory" | "apps";
// Memory then CPU: the processor sits on the right.
const DEFAULT_WIDGETS: WidgetId[] = ["memory", "cpu", "apps"];

interface AppStat {
  appId: string;
  name: string;
  cpu: number; // %
  memMb: number;
}

interface Stats {
  cpuHistory: number[]; // %, oldest first
  memUsedMb: number;
  memTotalMb: number;
  apps: AppStat[];
}

function readOrder<T extends string>(key: string, fallback: T[], known: (v: string) => v is T): T[] {
  const raw = getAppSetting(APP_ID, key);
  if (!raw) return fallback;
  const saved = raw.split(",").map((s) => s.trim()).filter(known);
  // Keep new entries the saved order doesn't know yet.
  return [...saved, ...fallback.filter((id) => !saved.includes(id))];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const walk = (v: number, step: number, min: number, max: number) =>
  clamp(v + (Math.random() - 0.5) * 2 * step, min, max);

/** Simulated numbers that drift like real ones; replaced by real sources later. */
function useSimulatedStats(runningAppIds: string[]): Stats {
  const [stats, setStats] = React.useState<Stats>(() => ({
    cpuHistory: Array.from({ length: HISTORY }, () => 12),
    memUsedMb: 3200,
    memTotalMb: 8192,
    apps: [],
  }));
  const idsKey = runningAppIds.join(",");

  React.useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const tick = () =>
      setStats((prev) => {
        const byId = new Map(prev.apps.map((a) => [a.appId, a]));
        const apps = ids.map((appId) => {
          const old = byId.get(appId);
          const name = APP_CATALOG.find((a) => a.id === appId)?.name ?? appId;
          return {
            appId,
            name,
            cpu: walk(old?.cpu ?? 2 + Math.random() * 6, 3, 0, 60),
            memMb: walk(old?.memMb ?? 80 + Math.random() * 300, 12, 30, 1400),
          };
        });
        const appsCpu = apps.reduce((sum, a) => sum + a.cpu, 0);
        const cpu = clamp(appsCpu / Math.max(1, navigator.hardwareConcurrency || 4) + walk(6, 4, 2, 12), 1, 100);
        const appsMem = apps.reduce((sum, a) => sum + a.memMb, 0);
        return {
          cpuHistory: [...prev.cpuHistory.slice(1), cpu],
          memUsedMb: clamp(2400 + appsMem, 0, prev.memTotalMb),
          memTotalMb: prev.memTotalMb,
          apps,
        };
      });
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [idsKey]);

  return stats;
}

function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} ${_("GB")}` : `${Math.round(mb)} ${_("MB")}`;
}

// ── Widgets ──────────────────────────────────────────────────────────────

function Widget({
  id,
  title,
  wide,
  children,
}: {
  id: string;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, transition: dragShuffleTransition });
  return (
    <section
      ref={setNodeRef}
      data-slot="monitor-widget"
      aria-label={title}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-adw-group bg-adw-group p-3",
        wide && "col-span-full",
        isDragging && "relative z-10 shadow-adw-popover"
      )}
    >
      <header className="flex items-center gap-1">
        <h2 className="flex-1 text-adw-subheadline font-semibold text-adw-label-secondary">{title}</h2>
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={_("Move")}
          className="flex size-5 cursor-grab items-center justify-center rounded-adw-control text-adw-label-tertiary active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
      </header>
      {children}
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 100;
  const h = 32;
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / 100) * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <polygon points={`0,${h} ${points} ${w},${h}`} className="fill-adw-accent/15" />
      <polyline
        points={points}
        fill="none"
        className="stroke-adw-accent"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CpuWidget({ history }: { history: number[] }) {
  const current = history[history.length - 1] ?? 0;
  return (
    <>
      <div className="text-adw-title-1 font-semibold tabular-nums text-adw-label">
        {Math.round(current)} %
      </div>
      <Sparkline values={history} />
    </>
  );
}

function MemoryWidget({ used, total }: { used: number; total: number }) {
  const ratio = total > 0 ? used / total : 0;
  return (
    <>
      <div className="text-adw-title-1 font-semibold tabular-nums text-adw-label">{formatMb(used)}</div>
      <div className="h-2 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
        <div className="h-full rounded-full bg-adw-accent transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="text-adw-footnote tabular-nums text-adw-label-secondary">
        {_("%s of %s", formatMb(used), formatMb(total))}
      </div>
    </>
  );
}

type AppSortKey = "name" | "memory" | "cpu";
const DEFAULT_APP_SORT: ListViewSort<AppSortKey> = { by: "cpu", dir: "desc" };

function readAppSort(): ListViewSort<AppSortKey> {
  const [by, dir] = (getAppSetting(APP_ID, "sort") ?? "").split(":");
  return (by === "name" || by === "memory" || by === "cpu") && (dir === "asc" || dir === "desc")
    ? { by, dir }
    : DEFAULT_APP_SORT;
}

function AppsWidget({ apps }: { apps: AppStat[] }) {
  const { getAppIconUrl } = useApps();
  const [sort, setSort] = React.useState(readAppSort);
  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...apps].sort((a, b) => {
      const diff =
        sort.by === "name"
          ? _(a.name).localeCompare(_(b.name))
          : sort.by === "memory"
            ? a.memMb - b.memMb
            : a.cpu - b.cpu;
      return diff * factor || _(a.name).localeCompare(_(b.name));
    });
  }, [apps, sort]);

  if (apps.length === 0) {
    return <p className="py-2 text-adw-body text-adw-label-tertiary">{_("No apps running")}</p>;
  }
  return (
    <ListView>
      <ListViewHeader<AppSortKey>
        columns={[
          { id: "name", label: _("Name") },
          { id: "memory", label: _("Memory"), align: "right", width: "96px" },
          { id: "cpu", label: _("CPU"), align: "right", width: "80px" },
        ]}
        sort={sort}
        onSort={(column) => {
          // Numbers start with the biggest, names with A.
          const next = nextListViewSort(sort, column, column === "name" ? "asc" : "desc");
          setSort(next);
          setAppSetting(APP_ID, "sort", `${next.by}:${next.dir}`);
        }}
      />
      <tbody>
        {sorted.map((app) => (
          <ListViewRow key={app.appId}>
            <ListViewCell>
              <div className="flex items-center gap-2">
                <AppSquircleIcon
                  iconUrl={getAppIconUrl(app.appId)}
                  squircle={false}
                  className="size-6 shrink-0"
                  glyphClassName="size-4"
                />
                <span className="truncate text-adw-label">{_(app.name)}</span>
              </div>
            </ListViewCell>
            <ListViewCell align="right" className="tabular-nums text-adw-label-secondary">
              {formatMb(app.memMb)}
            </ListViewCell>
            <ListViewCell align="right" className="tabular-nums text-adw-label-secondary">
              {app.cpu.toFixed(1)} %
            </ListViewCell>
          </ListViewRow>
        ))}
      </tbody>
    </ListView>
  );
}

// ── App ──────────────────────────────────────────────────────────────────

export interface SystemMonitorAppProps {
  windowId?: string;
  isCsd?: boolean;
}

export const SystemMonitorApp: React.FC<SystemMonitorAppProps> = ({ windowId = "", isCsd = true }) => {
  const runningIds = useWindowManagerSelector(
    (wm) => Array.from(new Set(wm.windows.map((w) => w.appId))).join(","),
  );
  const [widgetOrder, setWidgetOrder] = React.useState<WidgetId[]>(() =>
    readOrder("widget-order", DEFAULT_WIDGETS, (v): v is WidgetId =>
      (DEFAULT_WIDGETS as string[]).includes(v)
    )
  );
  const runningAppIds = React.useMemo(
    () => (runningIds ? runningIds.split(",") : []),
    [runningIds]
  );
  const stats = useSimulatedStats(runningAppIds);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }));
  const onWidgetDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      widgetOrder,
      widgetOrder.indexOf(active.id as WidgetId),
      widgetOrder.indexOf(over.id as WidgetId)
    );
    setWidgetOrder(next);
    setAppSetting(APP_ID, "widget-order", next.join(","));
  };

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "cpu":
        return (
          <Widget key={id} id={id} title={_("CPU")}>
            <CpuWidget history={stats.cpuHistory} />
          </Widget>
        );
      case "memory":
        return (
          <Widget key={id} id={id} title={_("Memory")}>
            <MemoryWidget used={stats.memUsedMb} total={stats.memTotalMb} />
          </Widget>
        );
      case "apps":
        return (
          <Widget key={id} id={id} title={_("Apps")} wide>
            <AppsWidget apps={stats.apps} />
          </Widget>
        );
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label select-none">
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        className="relative flex h-11 shrink-0 items-center justify-between gap-2 border-b border-adw-separator bg-adw-titlebar px-2.5"
      >
        <div className="flex items-center gap-2" data-window-no-drag>
          {windowId && <WindowMenuButton side="left" windowId={windowId} appId={APP_ID} />}
        </div>
        <div className="pointer-events-none absolute inset-x-24 truncate text-center text-adw-body font-bold">
          {_("System Monitor")}
        </div>
        <div className="flex items-center gap-2" data-window-no-drag>
          {isCsd && <WindowControls side="right" />}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWidgetDragEnd}>
          <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {widgetOrder.map(renderWidget)}
            </div>
          </SortableContext>
        </DndContext>
        <p className="mt-3 text-center text-adw-footnote text-adw-label-tertiary">
          {_("Simulated values: real system data comes next.")}
        </p>
      </div>
    </div>
  );
};
