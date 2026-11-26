import { HeaderBar } from "@/components/elements/header-bar";
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
import { getEngine } from "@/lib/engine/engine";
import { usePiloti } from "@/lib/engine/piloti";
import {
  appUsage,
  cpuPercent,
  readSystemSample,
  type SystemSample,
} from "@/lib/engine-native/system-stats";
import { getAppSetting, setAppSetting } from "@/lib/shell/app-settings";
import { DRAG_THRESHOLD, dragShuffleTransition } from "@/lib/shell/drag-feedback";

/**
 * System Monitor: one page of widgets the user reorders by dragging.
 *
 * With system services the numbers come from `/proc` (`useSystemStats`); the
 * browser demo simulates them (`useSimulatedStats`). Widget order and the apps
 * list sort are app settings (`~/.config/piloti/apps/system-monitor.ini`).
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
  /** Unset for an app with no process of its own. */
  cpu?: number; // %
  memMb?: number;
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

/**
 * Real numbers, sampled while the window is open. `apps` lists the process ids
 * of the running apps' windows, as `appId:pid` pairs joined by commas.
 */
function useSystemStats(apps: string, runningAppIds: string[], enabled: boolean): Stats {
  const piloti = usePiloti();
  const { installedXdgApps } = useApps();
  const [sampled, setSampled] = React.useState<{
    cpuHistory: number[];
    prev: SystemSample;
    next: SystemSample;
  } | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: number | undefined;
    let prev: SystemSample | null = null;
    let cpuHistory = Array.from({ length: HISTORY }, () => 0);
    // A chain rather than an interval, so a slow sample never overlaps the next.
    const tick = async () => {
      const next = await readSystemSample(piloti);
      if (stopped) return;
      // CPU needs two samples: the second follows the first closely.
      const delay = next && !prev ? 500 : TICK_MS;
      if (next && prev) {
        cpuHistory = [...cpuHistory.slice(1), cpuPercent(prev, next)];
        setSampled({ cpuHistory, prev, next });
      }
      prev = next ?? prev;
      timer = window.setTimeout(() => void tick(), delay);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [piloti, enabled]);

  return React.useMemo(() => {
    if (!sampled) {
      return { cpuHistory: Array.from({ length: HISTORY }, () => 0), memUsedMb: 0, memTotalMb: 0, apps: [] };
    }
    const { cpuHistory, prev, next } = sampled;
    const appPids = new Map<string, number[]>();
    for (const pair of apps ? apps.split(",") : []) {
      const split = pair.lastIndexOf(":");
      const appId = pair.slice(0, split);
      const pid = Number(pair.slice(split + 1));
      if (pid > 0) appPids.set(appId, [...(appPids.get(appId) ?? []), pid]);
    }
    const usage = appUsage(prev, next, appPids);
    return {
      cpuHistory,
      memUsedMb: (next.memTotalKb - next.memAvailableKb) / 1024,
      memTotalMb: next.memTotalKb / 1024,
      apps: runningAppIds.map((appId) => ({
        appId,
        name:
          installedXdgApps.find((entry) => entry.appId === appId)?.name ??
          APP_CATALOG.find((a) => a.id === appId)?.name ??
          appId,
        ...usage.get(appId),
      })),
    };
  }, [sampled, apps, runningAppIds, installedXdgApps]);
}

/** Numbers that drift like real ones, for the browser demo. */
function useSimulatedStats(runningAppIds: string[], enabled: boolean): Stats {
  const [stats, setStats] = React.useState<Stats>(() => ({
    cpuHistory: Array.from({ length: HISTORY }, () => 12),
    memUsedMb: 3200,
    memTotalMb: 8192,
    apps: [],
  }));
  const idsKey = runningAppIds.join(",");

  React.useEffect(() => {
    if (!enabled) return;
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
  }, [idsKey, enabled]);

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
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, transition: dragShuffleTransition });
  return (
    <section
      ref={setNodeRef}
      data-slot="monitor-widget"
      aria-label={title}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex min-w-0 cursor-default flex-col gap-2 rounded-adw-group bg-adw-group p-3",
        wide && "col-span-full",
        isDragging && "relative z-10 shadow-adw-popover"
      )}
    >
      <h2 className="text-adw-subheadline font-semibold text-adw-label-secondary">{title}</h2>
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
      <div className="text-adw-title-1 font-semibold tabular-nums text-adw-label">
        {total > 0 ? formatMb(used) : "—"}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
        <div className="h-full rounded-full bg-adw-accent transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="text-adw-footnote tabular-nums text-adw-label-secondary">
        {total > 0 ? _("%s of %s", formatMb(used), formatMb(total)) : "—"}
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
            ? (a.memMb ?? -1) - (b.memMb ?? -1)
            : (a.cpu ?? -1) - (b.cpu ?? -1);
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
              {app.memMb === undefined ? "—" : formatMb(app.memMb)}
            </ListViewCell>
            <ListViewCell align="right" className="tabular-nums text-adw-label-secondary">
              {app.cpu === undefined ? "—" : `${app.cpu.toFixed(1)} %`}
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
}

export const SystemMonitorApp: React.FC<SystemMonitorAppProps> = ({ windowId = "" }) => {
  const { systemServices } = getEngine().capabilities;
  const runningIds = useWindowManagerSelector(
    (wm) => Array.from(new Set(wm.windows.map((w) => w.appId))).join(","),
  );
  // Only Linux client windows have a process of their own.
  const runningProcesses = useWindowManagerSelector((wm) =>
    wm.windows
      .flatMap((w) => (w.pid ? [`${w.appId}:${w.pid}`] : []))
      .join(","),
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
  const realStats = useSystemStats(runningProcesses, runningAppIds, systemServices);
  const simulatedStats = useSimulatedStats(runningAppIds, !systemServices);
  const stats = systemServices ? realStats : simulatedStats;

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
    <div
      data-slot="system-monitor"
      className="flex h-full w-full flex-col overflow-hidden bg-[color-mix(in_srgb,var(--adw-accent)_10%,var(--adw-window))] text-adw-label select-none"
    >
      <HeaderBar className="border-transparent bg-transparent">
        <HeaderBar.Title>{_("System Monitor")}</HeaderBar.Title>
      </HeaderBar>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWidgetDragEnd}>
          <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {widgetOrder.map(renderWidget)}
            </div>
          </SortableContext>
        </DndContext>
        <p className="mt-3 text-center text-adw-footnote text-adw-label-tertiary">
          {systemServices
            ? _("Apps without figures run inside the desktop or share its browser.")
            : _("Simulated values in the demo.")}
        </p>
      </div>
    </div>
  );
};
