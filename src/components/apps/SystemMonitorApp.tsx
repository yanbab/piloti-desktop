import { HeaderBar } from "@/components/elements/header-bar";
import * as React from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import {
  ListView,
  ListViewCell,
  ListViewHeader,
  ListViewRow,
  nextListViewSort,
  type ListViewSort,
} from "@/components/ui/list-view";
import { WindowControlButton } from "@/components/ui/window";
import {
  useApps,
  useWindowActions,
  useWindowManagerSelector,
} from "@/context/DesktopStateContext";
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
import { parseIniText, serializeIniText } from "@/lib/config/ini";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import { readVfsStateText, writeVfsStateText } from "@/lib/engine/vfs-state";
import { DRAG_THRESHOLD, dragShuffleCss, settleFromOffset } from "@/lib/shell/drag-feedback";
import {
  formatWidgetLayout,
  parseWidgetLayout,
  placeWidget,
  type WidgetLayout,
  type WidgetSize,
} from "@/lib/shell/widget-grid";
import { XIcon } from "lucide-react";

/**
 * System Monitor: one page of widgets, always fitted to the window, that the
 * user places by dragging them on a grid, as icons on the desktop.
 *
 * With system services the numbers come from `/proc` (`useSystemStats`); the
 * browser demo simulates them (`useSimulatedStats`). Widget places and the apps
 * list sort are kept in `~/.config/piloti/piloti-system-monitor.ini`.
 */

const SETTINGS_PATH = `${VFS_HOME}/.config/piloti/piloti-system-monitor.ini`;
const TICK_MS = 2000;
const HISTORY = 30;

type WidgetId = "memory" | "cpu" | "apps";
const GRID_COLS = 2;
const GRID_ROWS = 3;
const WIDGET_SIZES: Record<WidgetId, WidgetSize> = {
  memory: { cols: 1, rows: 1 },
  cpu: { cols: 1, rows: 1 },
  apps: { cols: 2, rows: 2 },
};
// Memory then CPU: the processor sits on the right.
const DEFAULT_LAYOUT: WidgetLayout<WidgetId> = {
  memory: { col: 0, row: 0 },
  cpu: { col: 1, row: 0 },
  apps: { col: 0, row: 1 },
};

function readSetting(key: string): string | undefined {
  return parseIniText(readVfsStateText(SETTINGS_PATH) ?? "").General?.[key];
}

function writeSetting(key: string, value: string): void {
  const ini = parseIniText(readVfsStateText(SETTINGS_PATH) ?? "");
  ini.General = { ...ini.General, [key]: value };
  writeVfsStateText(SETTINGS_PATH, serializeIniText(ini));
}

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
  cell,
  elementRef,
  children,
}: {
  id: WidgetId;
  title: string;
  cell: { col: number; row: number };
  elementRef: (id: WidgetId, el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const size = WIDGET_SIZES[id];
  const ref = React.useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el);
      elementRef(id, el);
    },
    [id, setNodeRef, elementRef],
  );
  return (
    <div
      ref={ref}
      className={cn("absolute p-1.5", isDragging && "z-10")}
      style={{
        left: `${(cell.col / GRID_COLS) * 100}%`,
        top: `${(cell.row / GRID_ROWS) * 100}%`,
        width: `${(size.cols / GRID_COLS) * 100}%`,
        height: `${(size.rows / GRID_ROWS) * 100}%`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        // The dragged widget follows the pointer; the others slide aside.
        transition: isDragging ? undefined : dragShuffleCss("left", "top"),
      }}
    >
      <section
        data-slot="monitor-widget"
        aria-label={title}
        {...listeners}
        className={cn(
          "flex h-full min-w-0 cursor-default flex-col gap-2 overflow-hidden rounded-shell-group bg-shell-group p-3",
          isDragging && "shadow-shell-popover"
        )}
      >
        <h2 className="shrink-0 text-shell-subheadline font-semibold text-shell-label-secondary">{title}</h2>
        {children}
      </section>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 100;
  const h = 32;
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / 100) * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <polygon points={`0,${h} ${points} ${w},${h}`} className="fill-shell-accent/15" />
      <polyline
        points={points}
        fill="none"
        className="stroke-shell-accent"
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
    <div className="relative min-h-0 flex-1">
      <Sparkline values={history} />
      <div className="relative text-shell-title-1 font-semibold tabular-nums text-shell-label">
        {Math.round(current)} %
      </div>
    </div>
  );
}

function MemoryWidget({ used, total }: { used: number; total: number }) {
  const ratio = total > 0 ? used / total : 0;
  return (
    <>
      <div className="text-shell-title-1 font-semibold tabular-nums text-shell-label">
        {total > 0 ? formatMb(used) : "—"}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
        <div className="h-full rounded-full bg-shell-accent transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="text-shell-footnote tabular-nums text-shell-label-secondary">
        {total > 0 ? _("%s of %s", formatMb(used), formatMb(total)) : "—"}
      </div>
    </>
  );
}

type AppSortKey = "name" | "memory" | "cpu";
const DEFAULT_APP_SORT: ListViewSort<AppSortKey> = { by: "cpu", dir: "desc" };

function readAppSort(): ListViewSort<AppSortKey> {
  const [by, dir] = (readSetting("sort") ?? "").split(":");
  return (by === "name" || by === "memory" || by === "cpu") && (dir === "asc" || dir === "desc")
    ? { by, dir }
    : DEFAULT_APP_SORT;
}

function AppsWidget({ apps, onQuit }: { apps: AppStat[]; onQuit: (appId: string) => void }) {
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
    return <p className="py-2 text-shell-body text-shell-label-tertiary">{_("No apps running")}</p>;
  }
  return (
    // A long list scrolls inside its widget; the page never does.
    <div className="min-h-0 flex-1 overflow-y-auto">
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
          writeSetting("sort", `${next.by}:${next.dir}`);
        }}
      />
      <tbody>
        {sorted.map((app) => (
          <ListViewRow key={app.appId} className="group">
            <ListViewCell>
              <div className="flex items-center gap-2">
                <AppSquircleIcon
                  iconUrl={getAppIconUrl(app.appId)}
                  squircle={false}
                  className="size-6 shrink-0"
                  glyphClassName="size-4"
                />
                <span className="truncate text-shell-label">{_(app.name)}</span>
                <WindowControlButton
                  aria-label={_("Quit %s", _(app.name))}
                  title={_("Quit %s", _(app.name))}
                  className="ml-auto size-5 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [&_svg]:size-3"
                  // Not the start of a widget drag.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onQuit(app.appId)}
                >
                  <XIcon />
                </WindowControlButton>
              </div>
            </ListViewCell>
            <ListViewCell align="right" className="tabular-nums text-shell-label-secondary">
              {app.memMb === undefined ? "—" : formatMb(app.memMb)}
            </ListViewCell>
            <ListViewCell align="right" className="tabular-nums text-shell-label-secondary">
              {app.cpu === undefined ? "—" : `${app.cpu.toFixed(1)} %`}
            </ListViewCell>
          </ListViewRow>
        ))}
      </tbody>
    </ListView>
    </div>
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
  const runningAppIds = React.useMemo(
    () => (runningIds ? runningIds.split(",") : []),
    [runningIds]
  );
  const realStats = useSystemStats(runningProcesses, runningAppIds, systemServices);
  const simulatedStats = useSimulatedStats(runningAppIds, !systemServices);
  const stats = systemServices ? realStats : simulatedStats;

  // `appId windowId` lines, to close an app's windows.
  const windowList = useWindowManagerSelector((wm) =>
    wm.windows.map((w) => `${w.appId} ${w.id}`).join("\n"),
  );
  const { closeWindow } = useWindowActions();
  const quitApp = (appId: string) => {
    for (const line of windowList.split("\n")) {
      if (line.startsWith(`${appId} `)) closeWindow(line.slice(appId.length + 1));
    }
  };

  const [layout, setLayout] = React.useState(() =>
    parseWidgetLayout(
      readSetting("widget-cells"),
      DEFAULT_LAYOUT,
      WIDGET_SIZES,
      GRID_COLS,
      GRID_ROWS,
    ),
  );
  /** Where everything would go if dropped now. */
  const [drag, setDrag] = React.useState<{ id: WidgetId; layout: WidgetLayout<WidgetId> } | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const elements = React.useRef(new Map<WidgetId, HTMLElement>());
  const elementRef = React.useCallback((id: WidgetId, el: HTMLElement | null) => {
    if (el) elements.current.set(id, el);
    else elements.current.delete(id);
  }, []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }));

  const dropLayout = ({ active, delta }: DragMoveEvent) => {
    const grid = gridRef.current;
    if (!grid) return layout;
    const id = active.id as WidgetId;
    const target = {
      col: layout[id].col + Math.round(delta.x / (grid.clientWidth / GRID_COLS)),
      row: layout[id].row + Math.round(delta.y / (grid.clientHeight / GRID_ROWS)),
    };
    return placeWidget(layout, WIDGET_SIZES, id, target, GRID_COLS, GRID_ROWS);
  };
  const onDragMove = (event: DragMoveEvent) => {
    const id = event.active.id as WidgetId;
    const next = dropLayout(event);
    setDrag((prev) =>
      prev && formatWidgetLayout(prev.layout) === formatWidgetLayout(next)
        ? prev
        : { id, layout: next },
    );
  };
  const onDragEnd = (event: DragMoveEvent) => {
    const id = event.active.id as WidgetId;
    const next = dropLayout(event);
    const el = elements.current.get(id);
    const grid = gridRef.current;
    setDrag(null);
    setLayout(next);
    writeSetting("widget-cells", formatWidgetLayout(next));
    if (!el || !grid) return;
    // Glide from where it was let go to its cell.
    const dx = event.delta.x - (next[id].col - layout[id].col) * (grid.clientWidth / GRID_COLS);
    const dy = event.delta.y - (next[id].row - layout[id].row) * (grid.clientHeight / GRID_ROWS);
    requestAnimationFrame(() => settleFromOffset(el, dx, dy));
  };
  // While dragging, the dragged widget stays put in the layout and follows the pointer.
  const shown = drag ? { ...drag.layout, [drag.id]: layout[drag.id] } : layout;

  const renderWidget = (id: WidgetId) => {
    const props = { id, cell: shown[id], elementRef };
    switch (id) {
      case "cpu":
        return (
          <Widget key={id} {...props} title={_("CPU")}>
            <CpuWidget history={stats.cpuHistory} />
          </Widget>
        );
      case "memory":
        return (
          <Widget key={id} {...props} title={_("Memory")}>
            <MemoryWidget used={stats.memUsedMb} total={stats.memTotalMb} />
          </Widget>
        );
      case "apps":
        return (
          <Widget key={id} {...props} title={_("Apps")}>
            <AppsWidget apps={stats.apps} onQuit={quitApp} />
          </Widget>
        );
    }
  };

  return (
    <div
      data-slot="system-monitor"
      className="flex h-full w-full flex-col overflow-hidden bg-[color-mix(in_srgb,var(--shell-accent)_10%,var(--shell-window))] text-shell-label select-none"
    >
      <HeaderBar className="border-transparent bg-transparent">
        <HeaderBar.Title>{_("System Monitor")}</HeaderBar.Title>
      </HeaderBar>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 pb-2">
        <DndContext
          sensors={sensors}
          autoScroll={false}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDrag(null)}
        >
          <div ref={gridRef} className="relative min-h-0 flex-1">
            {(Object.keys(DEFAULT_LAYOUT) as WidgetId[]).map(renderWidget)}
          </div>
        </DndContext>
        <p className="mt-1 shrink-0 text-center text-shell-footnote text-shell-label-tertiary">
          {systemServices
            ? _("Apps without figures run inside the desktop or share its browser.")
            : _("Simulated values in the demo.")}
        </p>
      </div>
    </div>
  );
};
