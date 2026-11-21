import * as React from "react";
import { useDisplays } from "@domicile-desktop/react/displays";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  AppWindowIcon,
  BellIcon,
  ChevronRightIcon,
  CpuIcon,
  DatabaseIcon,
  LayoutGridIcon,
  Maximize2Icon,
  MinusIcon,
  MonitorIcon,
  ScrollTextIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { ObjectView, themeGitHubLight, themeOneDark } from "react-obj-view";
import "react-obj-view/dist/react-obj-view.css";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import {
  abbreviateDataImageUri,
  evaluateReplCode,
  formatInspectValue,
  useConsoleEntries,
} from "@/lib/console-store";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  WEB_VFS_CHANGED_EVENT,
  WEB_VFS_STORAGE_KEY,
  type WebVfsEntry,
} from "@/lib/web-vfs";

export type ConsoleModuleId =
  | "repl"
  | "logs"
  | "inspector"
  | "storage"
  | "vfs-events";

interface ReplItem {
  id: number;
  code: string;
  ok: boolean;
  output: string;
  durationMs: number;
}

let nextReplId = 1;

function ReplModule({
  scope,
  active,
}: {
  scope: Record<string, unknown>;
  active: boolean;
}) {
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [items, setItems] = React.useState<ReplItem[]>([]);
  const [running, setRunning] = React.useState(false);

  const lastResultRef = React.useRef<unknown>(undefined);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (active) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [active]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items.length]);

  const execute = React.useCallback(
    async (rawCode?: string) => {
      const code = (rawCode ?? input).trim();
      if (!code || running) return;

      if (!rawCode) {
        setInput("");
      }
      setHistory((prev) =>
        prev[0] === code ? prev : [code, ...prev.slice(0, 99)]
      );
      setHistoryIndex(-1);
      setRunning(true);

      const t0 = performance.now();
      try {
        const evalScope: Record<string, unknown> = {
          ...scope,
          $_: lastResultRef.current,
          clear: () => {
            setItems([]);
            return "Cleared";
          },
          help: () =>
            [
              "Piloti DevTools REPL — usage: <command> [args]",
              "",
              "Globals:",
              "  domicile              Domicile host bridge (files, windows, processes)",
              "  windows               All open shell & Wayland windows",
              "  focusedWindow         Currently focused window",
              "  waylandPopups         Active Wayland popup surfaces",
              "  displays              Connected display descriptors",
              "  browserWindows        Active webview windows",
              "  settings              Current DesktopSettings object",
              "  apps                  Discovered XDG .desktop applications",
              "  notifications         Notification history items",
              "  gnomeCapabilities     Available GNOME/systemd backends",
              "  availableGnomePanels  Supported GNOME Settings panels",
              "  $_                    Result of the previous evaluation",
              "",
              "Commands:",
              "  launchApp(id, opts?)          Launch an app by ID",
              "  focusWindow(id)               Focus a window",
              "  closeWindow(id)               Close a window",
              "  openWebUrl(url, opts?)        Open a URL in browser/web-app mode",
              "  openGnomeSettings(panel?)     Open GNOME Settings panel",
              "  updateSettings(patch)         Patch DesktopSettings",
              "  pushNotification(input)       Send a desktop notification",
              "  run(shellCmd)                 Run a shell command (returns Promise)",
              "  bsod(message?)                Trigger crash screen test",
              "  clear()                       Clear REPL output",
              "  help()                        Show this help message",
              "",
              "Tabs:",
              "  Console                       Interactive JS REPL (state persists across tabs)",
              "  Logs                          Live captured console & error stream",
              "  Infos                         Compositor, window, display & backend diagnostics",
              "  VFS & Events                  Live VFS diff & window/shell events (records in background)",
              "  Storage                       Inspect localStorage keys & embedded images",
              "",
              "Examples:",
              '  await run("uname -a")',
              '  await domicile.files.readDir("/usr/share/applications")',
              '  updateSettings({ themeMode: "dark" })',
              '  openWebUrl("https://gnome.org")',
            ].join("\n"),
        };

        const result = await evaluateReplCode(code, evalScope);
        lastResultRef.current = result;
        const durationMs = Math.round(performance.now() - t0);
        setItems((prev) => [
          ...prev,
          {
            id: nextReplId++,
            code,
            ok: true,
            output:
              typeof result === "string" && result.includes("\n")
                ? result
                : formatInspectValue(result),
            durationMs,
          },
        ]);
      } catch (err) {
        const durationMs = Math.round(performance.now() - t0);
        setItems((prev) => [
          ...prev,
          {
            id: nextReplId++,
            code,
            ok: false,
            output:
              err instanceof Error
                ? err.stack || `${err.name}: ${err.message}`
                : String(err),
            durationMs,
          },
        ]);
      } finally {
        setRunning(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [input, running, scope]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void execute();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setItems([]);
      return;
    }
    if (e.key === "ArrowUp" && !input.includes("\n")) {
      if (history.length === 0) return;
      e.preventDefault();
      const nextIdx = Math.min(history.length - 1, historyIndex + 1);
      setHistoryIndex(nextIdx);
      setInput(history[nextIdx]);
      return;
    }
    if (e.key === "ArrowDown" && !input.includes("\n")) {
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInput("");
        return;
      }
      e.preventDefault();
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setInput(history[nextIdx]);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-white dark:bg-black">
      {/* Output Transcript */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 font-mono text-[12px]"
      >
        <div className="text-adw-label-tertiary select-none">
          Type &quot;help()&quot; for help.
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg bg-black/3 px-2.5 py-2 dark:bg-white/4"
          >
            <div className="flex items-center justify-between gap-2 text-adw-label-secondary">
              <div className="flex min-w-0 items-start gap-1.5 font-semibold text-adw-label">
                <ChevronRightIcon className="mt-0.5 size-3.5 shrink-0 text-adw-label dark:text-white" />
                <pre className="min-w-0 whitespace-pre-wrap break-all">
                  {item.code}
                </pre>
              </div>
              <span className="shrink-0 text-[10px] text-adw-label-tertiary">
                {item.durationMs}ms
              </span>
            </div>
            <pre
              className={cn(
                "mt-1.5 pl-5 whitespace-pre-wrap break-words select-text",
                item.ok
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {item.output}
            </pre>
          </div>
        ))}
      </div>

      {/* Input Prompt */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void execute();
        }}
        className="flex h-12 min-h-12 shrink-0 items-center gap-2 border-t border-adw-separator bg-adw-titlebar px-3"
      >
        <ChevronRightIcon className="size-4 shrink-0 text-adw-label dark:text-white" />
        <textarea
          ref={inputRef}
          autoFocus
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-full max-h-32 min-h-12 flex-1 resize-none bg-transparent py-[15px] font-mono text-[12px] leading-[18px] text-adw-label outline-none placeholder:text-adw-label-tertiary"
        />
      </form>
    </div>
  );
}

function LogsModule() {
  const entries = useConsoleEntries();
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-black">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px]">
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center font-sans text-adw-label-secondary">
            <ScrollTextIcon className="size-6 opacity-60" />
            <div className="text-xs font-medium">{_("No console messages")}</div>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-start gap-2 select-text",
                  entry.level === "error" &&
                    "text-rose-600 dark:text-rose-400",
                  entry.level === "warn" &&
                    "text-amber-700 dark:text-amber-300",
                  (entry.level === "log" || entry.level === "info") &&
                    "text-adw-label"
                )}
              >
                <span className="shrink-0 text-[10px] text-adw-label-tertiary">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="w-10 shrink-0 font-semibold uppercase">
                  {entry.level}
                </span>
                <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {entry.message}
                </pre>
                {entry.count > 1 && (
                  <span className="shrink-0 rounded-full bg-black/10 px-1.5 text-[10px] font-semibold dark:bg-white/15">
                    {entry.count}
                  </span>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatCellValue(val: unknown): string {
  if (val === null) return "null";
  if (val === undefined) return "—";
  if (typeof val === "string") return abbreviateDataImageUri(val);
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  try {
    return (
      JSON.stringify(val, (_k, v) =>
        typeof v === "string" ? abbreviateDataImageUri(v) : v
      ) ?? "—"
    );
  } catch {
    return String(val);
  }
}

interface StateTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

function StateSectionTable({
  title,
  columns,
  rows,
  emptyLabel = "No entries.",
}: {
  title?: string;
  columns: StateTableColumn[];
  rows: Record<string, unknown>[];
  emptyLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      {title && (
        <div className="flex items-center justify-between px-0.5 text-[11.5px] font-semibold tracking-wide text-adw-label-secondary uppercase">
          <span>{title}</span>
          <span className="font-mono text-[11px] font-normal">
            {rows.length}
          </span>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-adw-separator bg-adw-window">
        {rows.length === 0 ? (
          <div className="px-3 py-2.5 text-[12px] text-adw-label-tertiary">
            {emptyLabel}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-adw-separator bg-black/4 text-[11px] font-semibold text-adw-label-secondary dark:bg-white/5">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-2 whitespace-nowrap",
                      col.align === "right" && "text-right"
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-t border-adw-separator/60 first:border-t-0 hover:bg-black/3 dark:hover:bg-white/4"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "max-w-[360px] px-3 py-1.5 align-top font-mono text-[11.5px] break-words text-adw-label select-text",
                        col.align === "right" && "text-right"
                      )}
                    >
                      {formatCellValue(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StateKeyValueTable({
  title,
  data,
}: {
  title?: string;
  data: Record<string, unknown>;
}) {
  const rows = Object.entries(data).map(([key, value]) => ({
    key,
    value,
  }));
  return (
    <StateSectionTable
      title={title}
      columns={[
        { key: "key", label: "Key" },
        { key: "value", label: "Value" },
      ]}
      rows={rows}
    />
  );
}

type InspectorSectionId =
  | "windows"
  | "displays"
  | "system"
  | "apps"
  | "settings"
  | "notifications";

function InspectorModule() {
  const domicile = useDomicile();
  const displays = useDisplays() ?? [];
  const { isBrowserRuntime, settings } = useSettings();
  const {
    installedXdgApps,
    xdgUserDirs,
    activeIconTheme,
    dockIconsReady,
  } = useApps();
  const {
    availableGnomePanels,
    audioSinks,
    batteryInfo,
    gnomeCapabilities,
    mprisMedia,
    notifications,
  } = useSystemBackends();
  const { windows, focusedWindowId, waylandPopups } = useWindowManager();
  const browserWindows =
    useWatch(domicile.browser, "change", () => domicile.browser.windows) ?? [];

  const [activeSection, setActiveSection] =
    React.useState<InspectorSectionId>("windows");
  const inspectorSidebarRef = React.useRef<HTMLElement | null>(null);
  const inspectorContentRef = React.useRef<HTMLDivElement | null>(null);

  const sections: { id: InspectorSectionId; label: string; icon: React.ReactNode }[] = [
    { id: "windows", label: "Windows", icon: <AppWindowIcon className="size-4 shrink-0" /> },
    { id: "displays", label: "Displays", icon: <MonitorIcon className="size-4 shrink-0" /> },
    { id: "system", label: "System Backends", icon: <CpuIcon className="size-4 shrink-0" /> },
    { id: "apps", label: "Installed Apps", icon: <LayoutGridIcon className="size-4 shrink-0" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="size-4 shrink-0" /> },
    { id: "notifications", label: "Notifications", icon: <BellIcon className="size-4 shrink-0" /> },
  ];

  const {
    highlightedId: highlightedSection,
    onSidebarKeyDown: onInspectorSidebarKeyDown,
    onSidebarKeyUp: onInspectorSidebarKeyUp,
    onContentKeyDown: onInspectorContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: sections.map((s) => s.id),
    activeId: activeSection,
    onActivate: (id) => setActiveSection(id),
    sidebarRef: inspectorSidebarRef,
    contentRef: inspectorContentRef,
  });

  const renderSectionTables = () => {
    switch (activeSection) {
      case "windows": {
        const windowRows = windows.map((w) => {
          const flags = [
            w.id === focusedWindowId ? "focused" : null,
            w.minimized ? "minimized" : null,
            w.maximized ? "maximized" : null,
            w.fullscreen ? "fullscreen" : null,
            w.tiled ? `tiled:${w.tiled}` : null,
          ]
            .filter(Boolean)
            .join(", ");
          return {
            id: w.id,
            title: w.title,
            appId: w.appId,
            workspace: w.workspace,
            position: `${w.position.x}, ${w.position.y}`,
            size: `${w.size.width}×${w.size.height}`,
            state: flags || "normal",
            zIndex: w.zIndex,
          };
        });
        return (
          <div className="space-y-4">
            <StateKeyValueTable
              title="Summary"
              data={{
                focusedWindowId: focusedWindowId ?? null,
                windows: windows.length,
                waylandPopups: waylandPopups.length,
                browserWindows: browserWindows.length,
              }}
            />
            <StateSectionTable
              title="Windows"
              columns={[
                { key: "id", label: "ID" },
                { key: "title", label: "Title" },
                { key: "appId", label: "App" },
                { key: "workspace", label: "WS", align: "right" },
                { key: "position", label: "Pos" },
                { key: "size", label: "Size" },
                { key: "state", label: "State" },
                { key: "zIndex", label: "Z", align: "right" },
              ]}
              rows={windowRows}
              emptyLabel="No open windows."
            />
            {waylandPopups.length > 0 && (
              <StateSectionTable
                title="Wayland Popups"
                columns={[
                  { key: "appId", label: "App ID" },
                  { key: "x", label: "X", align: "right" },
                  { key: "y", label: "Y", align: "right" },
                  { key: "width", label: "Width", align: "right" },
                  { key: "height", label: "Height", align: "right" },
                ]}
                rows={waylandPopups.map((p) => ({ ...p }))}
              />
            )}
            {browserWindows.length > 0 && (
              <StateSectionTable
                title="Browser Windows"
                columns={[
                  { key: "id", label: "ID" },
                  { key: "appId", label: "App ID" },
                  { key: "title", label: "Title" },
                  { key: "url", label: "URL" },
                ]}
                rows={browserWindows.map((bw) => ({
                  id: bw.id,
                  appId: bw.appId,
                  title: bw.title,
                  url: bw.url,
                }))}
              />
            )}
          </div>
        );
      }
      case "displays":
        return (
          <StateSectionTable
            title="Displays"
            columns={[
              { key: "id", label: "ID" },
              { key: "name", label: "Name" },
              { key: "geometry", label: "Geometry" },
              { key: "scale", label: "Scale", align: "right" },
              { key: "primary", label: "Primary" },
            ]}
            rows={displays.map((d) => {
              const rec = d as unknown as Record<string, unknown>;
              const x = rec.x ?? 0;
              const y = rec.y ?? 0;
              const w = rec.width ?? "—";
              const h = rec.height ?? "—";
              return {
                id: rec.id ?? "—",
                name: rec.name ?? rec.model ?? "—",
                geometry: `${w}×${h} @ ${x},${y}`,
                scale: rec.scale ?? 1,
                primary: rec.primary ?? false,
              };
            })}
            emptyLabel="No displays reported."
          />
        );
      case "system":
        return (
          <div className="space-y-4">
            <StateKeyValueTable
              title="System Backends"
              data={{
                runtime: isBrowserRuntime ? "Browser Harness" : "Domicile Wayland",
                activeIconTheme,
                dockIconsReady,
                wifiEnabled: settings.wifiEnabled,
                connectedWifi: settings.connectedWifi,
                batteryInfo,
                mprisMedia,
              }}
            />
            {gnomeCapabilities && (
              <StateKeyValueTable
                title="GNOME Capabilities"
                data={gnomeCapabilities as unknown as Record<string, unknown>}
              />
            )}
            <StateSectionTable
              title="Audio Sinks"
              columns={[
                { key: "id", label: "ID" },
                { key: "name", label: "Name" },
                { key: "description", label: "Description" },
                { key: "volume", label: "Volume", align: "right" },
                { key: "muted", label: "Muted" },
              ]}
              rows={audioSinks.map((s) => ({
                ...(s as unknown as Record<string, unknown>),
              }))}
              emptyLabel="No audio sinks."
            />
          </div>
        );
      case "apps":
        return (
          <div className="space-y-4">
            <StateKeyValueTable
              title="XDG User Dirs"
              data={xdgUserDirs as unknown as Record<string, unknown>}
            />
            <StateSectionTable
              title="Installed Web Apps"
              columns={[
                { key: "id", label: "ID" },
                { key: "title", label: "Title" },
                { key: "url", label: "URL" },
              ]}
              rows={settings.installedWebApps.map((a) => ({
                id: a.id,
                title: a.title,
                url: a.url,
              }))}
              emptyLabel="No installed web apps."
            />
            <StateSectionTable
              title="Available GNOME Panels"
              columns={[{ key: "panel", label: "Panel" }]}
              rows={availableGnomePanels.map((panel) => ({ panel }))}
              emptyLabel="No GNOME panels detected."
            />
            <StateSectionTable
              title="Installed XDG Apps"
              columns={[
                { key: "desktopId", label: "Desktop ID" },
                { key: "name", label: "Name" },
                { key: "exec", label: "Exec" },
                { key: "icon", label: "Icon" },
              ]}
              rows={installedXdgApps.map((a) => ({
                desktopId: a.desktopId,
                name: a.name,
                exec: a.exec,
                icon: a.icon,
              }))}
              emptyLabel="No XDG apps indexed."
            />
          </div>
        );
      case "settings":
        return (
          <StateKeyValueTable
            title="Settings"
            data={settings as unknown as Record<string, unknown>}
          />
        );
      case "notifications":
        return (
          <StateSectionTable
            title="Notifications"
            columns={[
              { key: "id", label: "ID" },
              { key: "appName", label: "App" },
              { key: "summary", label: "Summary" },
              { key: "body", label: "Body" },
              { key: "urgency", label: "Urgency" },
              { key: "timestamp", label: "Timestamp" },
            ]}
            rows={notifications.map((n) => ({
              ...(n as unknown as Record<string, unknown>),
            }))}
            emptyLabel="No notifications."
          />
        );
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Settings-style Left Sidebar (collapses to VS Code-style icon bar when narrow) */}
      <TooltipProvider delay={450}>
        <aside
          ref={inspectorSidebarRef}
          onKeyDown={onInspectorSidebarKeyDown}
          onKeyUp={onInspectorSidebarKeyUp}
          className="flex min-h-0 w-[52px] shrink-0 flex-col space-y-1 overflow-x-hidden overflow-y-auto border-r border-adw-separator bg-adw-sidebar p-1.5 transition-[width] duration-150 sm:w-44 sm:p-2"
        >
          {sections.map((section) => {
            const active = highlightedSection === section.id;
            const btn = (
              <button
                key={section.id}
                type="button"
                aria-label={section.label}
                data-sidebar-item={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors",
                  active
                    ? "bg-adw-sidebar-selection font-medium text-adw-label"
                    : "font-normal text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6"
                )}
              >
                <span className="shrink-0 opacity-85">{section.icon}</span>
                <span className="truncate opacity-0 transition-opacity duration-150 sm:opacity-100">
                  {section.label}
                </span>
              </button>
            );
            return (
              <Tooltip key={section.id}>
                <TooltipTrigger render={btn} />
                <TooltipContent
                  side="right"
                  sideOffset={-36}
                  className={cn(
                    "pointer-events-none h-[34px] gap-2.5 rounded-lg border border-adw-separator px-2.5 py-2 text-[12.5px] shadow-md sm:hidden",
                    active
                      ? "bg-adw-sidebar-selection font-medium text-adw-label"
                      : "bg-adw-sidebar font-normal text-adw-label"
                  )}
                >
                  <span className="shrink-0 opacity-85">{section.icon}</span>
                  <span className="whitespace-nowrap">{section.label}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </aside>
      </TooltipProvider>

      {/* Right Content: Structured Tables */}
      <div
        ref={inspectorContentRef}
        onKeyDown={onInspectorContentKeyDown}
        className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black/2 dark:bg-white/2"
      >
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {renderSectionTables()}
        </div>
      </div>
    </div>
  );
}

interface StorageEntry {
  key: string;
  rawValue: string;
  byteSize: number;
  isJson: boolean;
  formattedJson: string | null;
  parsedJson?: unknown;
}

function formatStorageKeyLabel(key: string): string {
  return key.replace(/^(?:piloti|residence)\./i, "").replace(/\.v\d+$/i, "");
}

interface DataImagePreview {
  label: string;
  src: string;
}

function isDataImageUri(val: string): boolean {
  return /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(val.trim());
}

function extractDataImages(entry: StorageEntry): DataImagePreview[] {
  const trimmed = entry.rawValue.trim();
  if (isDataImageUri(trimmed)) {
    return [{ label: entry.key, src: trimmed }];
  }
  if (!entry.isJson) return [];

  const found: DataImagePreview[] = [];
  const visit = (node: unknown, path: string) => {
    if (found.length >= 256) return;
    if (typeof node === "string") {
      if (isDataImageUri(node)) {
        found.push({ label: path || entry.key, src: node.trim() });
      }
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const [k, v] of Object.entries(node)) {
        visit(v, path ? `${path}.${k}` : k);
      }
    }
  };

  try {
    visit(JSON.parse(entry.rawValue), "");
  } catch {
    // ignore
  }
  return found;
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readLocalStorageEntries(): StorageEntry[] {
  if (typeof localStorage === "undefined") return [];
  const encoder =
    typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const entries: StorageEntry[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    const rawValue = localStorage.getItem(key) ?? "";
    const byteSize = encoder ? encoder.encode(rawValue).length : rawValue.length;
    let isJson = false;
    let formattedJson: string | null = null;
    let parsedJson: unknown;
    try {
      const parsed: unknown = JSON.parse(rawValue);
      isJson = true;
      formattedJson = JSON.stringify(
        parsed,
        (_k, val) => (typeof val === "string" ? abbreviateDataImageUri(val) : val),
        2
      );
      parsedJson = JSON.parse(formattedJson);
    } catch {
      // Plain non-JSON string value
    }
    entries.push({ key, rawValue, byteSize, isJson, formattedJson, parsedJson });
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries;
}

interface InspectorEventLog {
  id: number;
  time: string;
  type: string;
  detail: string;
}

interface VfsDiffItem {
  kind: "added" | "modified" | "removed";
  path: string;
  entryType: "file" | "directory";
  sizeDelta?: number;
}

function readVfsSnapshotMap(): Map<string, WebVfsEntry> {
  const map = new Map<string, WebVfsEntry>();
  if (typeof localStorage === "undefined") return map;
  try {
    const raw = localStorage.getItem(WEB_VFS_STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const entry of parsed as WebVfsEntry[]) {
        if (entry?.path) map.set(entry.path, entry);
      }
    }
  } catch {
    // ignore
  }
  return map;
}

function VfsEventsModule() {
  const { windows, focusedWindowId } = useWindowManager();
  const [baseline, setBaseline] = React.useState<Map<string, WebVfsEntry>>(() =>
    readVfsSnapshotMap()
  );
  const [currentMap, setCurrentMap] = React.useState<Map<string, WebVfsEntry>>(
    () => readVfsSnapshotMap()
  );
  const [events, setEvents] = React.useState<InspectorEventLog[]>([]);
  const nextEventIdRef = React.useRef(1);
  const prevWinSummaryRef = React.useRef<string>("");

  const pushEvent = React.useCallback((type: string, detail: string) => {
    const time = new Date().toLocaleTimeString();
    setEvents((prev) => [
      { id: nextEventIdRef.current++, time, type, detail },
      ...prev.slice(0, 149),
    ]);
  }, []);

  React.useEffect(() => {
    const summary = JSON.stringify({
      focusedWindowId,
      wins: windows.map((w) => ({
        id: w.id,
        appId: w.appId,
        ws: w.workspace,
        min: w.minimized,
        max: w.maximized,
      })),
    });
    if (prevWinSummaryRef.current && prevWinSummaryRef.current !== summary) {
      pushEvent(
        "WindowEvent",
        `focused=${focusedWindowId ?? "none"} count=${windows.length}`
      );
    }
    prevWinSummaryRef.current = summary;
  }, [focusedWindowId, pushEvent, windows]);

  React.useEffect(() => {
    const eventNames = [
      "piloti:app-action",
      "piloti:app-menu-state",
      "piloti:open-launcher",
      "piloti:workspace-zoom-from-thumb",
      "piloti:xdg-webapps-changed",
      "residence:file-drop-dock",
      "residence:file-drop-window",
      "residence:desktop-drop-position",
      WEB_VFS_CHANGED_EVENT,
    ];
    const listeners = eventNames.map((name) => {
      const fn = (e: Event) => {
        if (name === WEB_VFS_CHANGED_EVENT) {
          setCurrentMap(readVfsSnapshotMap());
        }
        const detail = (e as CustomEvent<unknown>).detail;
        let detailStr = "";
        try {
          detailStr = detail ? JSON.stringify(detail) : "";
        } catch {
          detailStr = String(detail);
        }
        pushEvent(name, detailStr.slice(0, 180));
      };
      window.addEventListener(name, fn);
      return { name, fn };
    });
    return () => {
      for (const { name, fn } of listeners) {
        window.removeEventListener(name, fn);
      }
    };
  }, [pushEvent]);

  const diffs = React.useMemo<VfsDiffItem[]>(() => {
    const items: VfsDiffItem[] = [];
    for (const [path, cur] of currentMap.entries()) {
      const base = baseline.get(path);
      if (!base) {
        items.push({
          kind: "added",
          path,
          entryType: cur.kind,
          sizeDelta: cur.content?.length ?? 0,
        });
      } else if (
        base.content !== cur.content ||
        base.updatedAt !== cur.updatedAt
      ) {
        items.push({
          kind: "modified",
          path,
          entryType: cur.kind,
          sizeDelta: (cur.content?.length ?? 0) - (base.content?.length ?? 0),
        });
      }
    }
    for (const [path, base] of baseline.entries()) {
      if (!currentMap.has(path)) {
        items.push({
          kind: "removed",
          path,
          entryType: base.kind,
          sizeDelta: -(base.content?.length ?? 0),
        });
      }
    }
    return items.sort((a, b) => a.path.localeCompare(b.path));
  }, [baseline, currentMap]);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-adw-separator overflow-hidden bg-adw-content md:grid-cols-2 md:divide-x md:divide-y-0">
      {/* Left: Live VFS Diff Viewer */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-adw-separator px-3 py-2">
          <span className="text-[12px] font-semibold text-adw-label">
            VFS Diff ({diffs.length})
          </span>
          <button
            type="button"
            onClick={() => {
              const snap = readVfsSnapshotMap();
              setBaseline(snap);
              setCurrentMap(snap);
            }}
            className="rounded-md bg-black/8 px-2 py-0.5 text-[11px] font-medium text-adw-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
          >
            Snapshot Baseline
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-[11.5px]">
          {diffs.length === 0 ? (
            <div className="px-2 py-4 text-adw-dim">
              No VFS changes since baseline ({currentMap.size} entries tracked).
            </div>
          ) : (
            diffs.map((d) => (
              <div
                key={`${d.kind}:${d.path}`}
                className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span
                  className={cn(
                    "truncate",
                    d.kind === "added" && "text-emerald-500",
                    d.kind === "modified" && "text-amber-500",
                    d.kind === "removed" && "text-rose-500"
                  )}
                >
                  {d.kind === "added" ? "+ " : d.kind === "modified" ? "~ " : "- "}
                  {d.path}
                </span>
                {typeof d.sizeDelta === "number" && d.entryType === "file" && (
                  <span className="shrink-0 text-[10.5px] text-adw-dim">
                    {d.sizeDelta >= 0 ? `+${d.sizeDelta}B` : `${d.sizeDelta}B`}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Live WindowEvent & Shell Event Stream */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-adw-separator px-3 py-2">
          <span className="text-[12px] font-semibold text-adw-label">
            Window & Shell Events ({events.length})
          </span>
          <button
            type="button"
            onClick={() => setEvents([])}
            className="rounded-md bg-black/8 px-2 py-0.5 text-[11px] font-medium text-adw-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
          >
            Clear
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-[11px]">
          {events.length === 0 ? (
            <div className="px-2 py-4 text-adw-dim">
              Listening for WindowEvent, VFS, and Shell events...
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="border-b border-adw-separator/40 px-2 py-1.5 last:border-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-adw-accent">
                    {ev.type}
                  </span>
                  <span className="text-[10px] text-adw-dim">{ev.time}</span>
                </div>
                {ev.detail && (
                  <div className="mt-0.5 truncate text-adw-label-secondary">
                    {ev.detail}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StorageModule() {
  const { settings } = useSettings();
  const [entries, setEntries] = React.useState<StorageEntry[]>(() =>
    readLocalStorageEntries()
  );
  const [selectedKey, setSelectedKey] = React.useState<string | null>(
    () => entries[0]?.key ?? null
  );
  const storageSidebarRef = React.useRef<HTMLElement | null>(null);
  const storageContentRef = React.useRef<HTMLDivElement | null>(null);
  const {
    highlightedId: highlightedStorageKey,
    onSidebarKeyDown: onStorageSidebarKeyDown,
    onSidebarKeyUp: onStorageSidebarKeyUp,
    onContentKeyDown: onStorageContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: entries.map((e) => e.key),
    activeId: selectedKey ?? entries[0]?.key ?? null,
    onActivate: (key) => setSelectedKey(key),
    sidebarRef: storageSidebarRef,
    contentRef: storageContentRef,
  });

  const refresh = React.useCallback(() => {
    const next = readLocalStorageEntries();
    setEntries(next);
    setSelectedKey((prev) =>
      prev && next.some((item) => item.key === prev)
        ? prev
        : (next[0]?.key ?? null)
    );
  }, []);

  React.useEffect(() => {
    refresh();
    const handleStorage = () => refresh();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refresh]);

  const activeEntry = React.useMemo(
    () =>
      entries.find((entry) => entry.key === selectedKey) ??
      entries[0] ??
      null,
    [entries, selectedKey]
  );

  const activeDisplayValue = activeEntry
    ? activeEntry.formattedJson !== null
      ? activeEntry.formattedJson
      : abbreviateDataImageUri(activeEntry.rawValue)
    : "";

  const activeImages = React.useMemo(
    () => (activeEntry ? extractDataImages(activeEntry) : []),
    [activeEntry]
  );

  const groupedStorageEntries = React.useMemo(() => {
    const classify = (key: string): { section: string; shortLabel: string } => {
      const k = key.toLowerCase();
      if (k.includes("launcher")) {
        if (k.includes("recent")) return { section: "Launcher", shortLabel: "Recent" };
        if (k.includes("history")) return { section: "Launcher", shortLabel: "History" };
        if (k.includes("height")) return { section: "Launcher", shortLabel: "Height" };
        if (k.includes("snapshot")) return { section: "Launcher", shortLabel: "Snapshots" };
        return { section: "Launcher", shortLabel: formatStorageKeyLabel(key) };
      }
      if (k.includes("vfs") || k.includes("files") || k.includes("bookmark") || k.includes("favorite")) {
        if (k.includes("vfs")) return { section: "Files & VFS", shortLabel: "Filesystem" };
        if (k.includes("favorite")) return { section: "Files & VFS", shortLabel: "Favorites" };
        if (k.includes("bookmark")) return { section: "Files & VFS", shortLabel: "Bookmarks" };
        return { section: "Files & VFS", shortLabel: formatStorageKeyLabel(key) };
      }
      if (k.includes("settings") || k.includes("notif") || k.includes("session") || k.includes("piloti")) {
        if (k.includes("settings")) return { section: "Shell", shortLabel: "Settings" };
        if (k.includes("notif")) return { section: "Shell", shortLabel: "Notifications" };
        if (k.includes("session")) return { section: "Shell", shortLabel: "Session" };
        if (k.includes("activepane")) return { section: "Shell", shortLabel: "Settings Pane" };
        return { section: "Shell", shortLabel: formatStorageKeyLabel(key) };
      }
      return { section: "Other", shortLabel: formatStorageKeyLabel(key) };
    };

    const order = ["Shell", "Launcher", "Files & VFS", "Other"];
    const map = new Map<string, Array<{ entry: StorageEntry; shortLabel: string }>>();
    for (const s of order) map.set(s, []);
    for (const entry of entries) {
      const { section, shortLabel } = classify(entry.key);
      map.get(section)?.push({ entry, shortLabel });
    }
    return order
      .map((section) => ({ section, items: map.get(section) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [entries]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Split Explorer */}
      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-adw-label-secondary">
          <DatabaseIcon className="size-7 opacity-40" />
          <div className="text-[12px] font-medium">
            {_("No keys stored in localStorage.")}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Left: Sectioned Sidebar with simple labels */}
          <aside
            ref={storageSidebarRef}
            onKeyDown={onStorageSidebarKeyDown}
            onKeyUp={onStorageSidebarKeyUp}
            className="w-40 shrink-0 space-y-3 overflow-y-auto border-r border-adw-separator bg-adw-sidebar p-2 sm:w-44"
          >
            {groupedStorageEntries.map((group) => (
              <div key={group.section} className="space-y-0.5">
                <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-adw-dim uppercase">
                  {group.section}
                </div>
                {group.items.map(({ entry, shortLabel }) => {
                  const isSelected = highlightedStorageKey === entry.key;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      data-sidebar-item={entry.key}
                      onClick={() => setSelectedKey(entry.key)}
                      className={cn(
                        "flex w-full items-center rounded-lg px-3 py-1.5 text-left transition-colors",
                        isSelected
                          ? "bg-adw-sidebar-selection font-medium text-adw-label"
                          : "font-normal text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6"
                      )}
                    >
                      <span className="truncate text-[12.5px] font-medium">
                        {shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Right: Selected Entry Value Inspector with small key header */}
          {activeEntry ? (
            <div
              ref={storageContentRef}
              onKeyDown={onStorageContentKeyDown}
              className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black/2 dark:bg-white/2"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-adw-separator bg-adw-window/60 px-4 py-1.5">
                <span className="truncate font-mono text-[11px] font-medium text-adw-dim select-text">
                  {activeEntry.key}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-adw-dim tabular-nums">
                  {activeEntry.rawValue.length} chars
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                {activeImages.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-3 border-b border-adw-separator pb-4">
                    {activeImages.map((img) => (
                      <div
                        key={img.label}
                        className="flex flex-col gap-1.5 rounded-lg bg-black/4 p-2 dark:bg-white/5"
                      >
                        <img
                          src={img.src}
                          alt={img.label}
                          className="max-h-[512px] max-w-[512px] rounded object-contain"
                        />
                        <span className="max-w-[512px] truncate font-mono text-[10.5px] text-adw-label-secondary">
                          {img.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {activeEntry.isJson &&
                typeof activeEntry.parsedJson === "object" &&
                activeEntry.parsedJson !== null ? (
                  <ObjectView
                    key={activeEntry.key}
                    valueGetter={() => activeEntry.parsedJson}
                    name={formatStorageKeyLabel(activeEntry.key)}
                    expandLevel={2}
                    style={
                      {
                        ...(settings.themeMode === "light"
                          ? themeGitHubLight
                          : themeOneDark),
                        backgroundColor: "transparent",
                        fontSize: "12.5px",
                      } as React.CSSProperties
                    }
                  />
                ) : (
                  <pre className="font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-adw-label select-text">
                    {activeDisplayValue}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4 text-[12px] text-adw-label-tertiary">
              {_("Select a key to inspect its stored state.")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConsoleApp({
  initialModule,
  isCsd = false,
  windowId,
}: {
  initialModule?: string;
  isCsd?: boolean;
  windowId?: string;
}) {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { installedXdgApps } = useApps();
  const {
    availableGnomePanels,
    gnomeCapabilities,
    notifications,
    pushNotification,
  } = useSystemBackends();
  const {
    windows,
    focusedWindow,
    waylandPopups,
    launchApp,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    openGnomeSettings,
    openWebUrl,
  } = useWindowManager();

  const DEVTOOLS_ACTIVE_MODULE_KEY = "piloti.devtools.activeModule.v1";
  const isModuleId = (v: string | null | undefined): v is ConsoleModuleId =>
    v === "repl" ||
    v === "logs" ||
    v === "inspector" ||
    v === "storage" ||
    v === "vfs-events";

  const [activeModule, setActiveModule] = React.useState<ConsoleModuleId>(
    () => {
      if (isModuleId(initialModule)) return initialModule;
      try {
        const saved = localStorage.getItem(DEVTOOLS_ACTIVE_MODULE_KEY);
        if (isModuleId(saved)) return saved;
      } catch {
        // ignore storage errors
      }
      return "repl";
    }
  );

  React.useEffect(() => {
    if (isModuleId(initialModule)) {
      setActiveModule(initialModule);
    }
  }, [initialModule]);

  React.useEffect(() => {
    try {
      localStorage.setItem(DEVTOOLS_ACTIVE_MODULE_KEY, activeModule);
    } catch {
      // ignore storage errors
    }
  }, [activeModule]);

  const consoleEntries = useConsoleEntries();
  const errorCount = React.useMemo(
    () => consoleEntries.filter((e) => e.level === "error").length,
    [consoleEntries]
  );

  const replScope = React.useMemo<Record<string, unknown>>(
    () => ({
      domicile,
      displays: domicile.displays.list,
      browserWindows: domicile.browser.windows ?? [],
      windows,
      focusedWindow,
      waylandPopups,
      apps: installedXdgApps,
      settings,
      updateSettings,
      notifications,
      pushNotification,
      gnomeCapabilities,
      availableGnomePanels,
      launchApp,
      focusWindow,
      closeWindow,
      openWebUrl,
      openGnomeSettings,
      bsod: (message = "Manual BSOD triggered from Console") => {
        window.dispatchEvent(
          new CustomEvent("residence:bsod", { detail: new Error(message) })
        );
        return "BSOD triggered";
      },
      run: async (cmd: string) => {
        if (isBrowserRuntime) {
          return {
            code: 0,
            stdout: `[Browser Preview] Simulated command: ${cmd}`,
            stderr: "",
          };
        }
        const res = await domicile.processes.run(["sh", "-c", cmd]);
        return res.match({
          Ok: (ran) => ran,
          Err: (err) => {
            throw new Error(String(err));
          },
        });
      },
    }),
    [
      availableGnomePanels,
      closeWindow,
      domicile,
      focusWindow,
      focusedWindow,
      gnomeCapabilities,
      installedXdgApps,
      isBrowserRuntime,
      launchApp,
      notifications,
      openGnomeSettings,
      openWebUrl,
      pushNotification,
      settings,
      updateSettings,
      waylandPopups,
      windows,
    ]
  );

  const modules: { id: ConsoleModuleId; label: string; badge?: number }[] = [
    { id: "repl", label: "Console" },
    {
      id: "logs",
      label: "Logs",
      badge: errorCount > 0 ? errorCount : undefined,
    },
    { id: "inspector", label: "Infos" },
    { id: "vfs-events", label: "VFS & Events" },
    { id: "storage", label: "Storage" },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label">
      {/* Header / Module Switcher */}
      <WindowTitlebar
        data-window-drag-region={isCsd ? "" : undefined}
        className={cn(
          "border-b border-adw-separator bg-adw-titlebar",
          !isCsd && "rounded-t-none"
        )}
      >
        <div className="flex w-16 items-center gap-1.5" data-window-no-drag>
          {isCsd && windowId && <WindowControls side="left" />}
          <WindowMenuButton
            side="left"
            windowId={windowId}
            appId="console"
            iconName="activity"
          />
        </div>

        {/* Module Tabs (text-only, no icons) */}
        <div
          data-window-no-drag
          className="flex items-center gap-1 rounded-lg bg-black/6 p-0.5 dark:bg-white/8"
        >
          {modules.map((mod) => {
            const active = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveModule(mod.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  active
                    ? "bg-adw-window text-adw-label shadow-xs"
                    : "text-adw-label-secondary hover:text-adw-label"
                )}
              >
                <span>{mod.label}</span>
                {mod.badge !== undefined && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[9.5px] font-bold text-white">
                    {mod.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* CSD Window Controls */}
        <div className="flex w-16 items-center justify-end gap-1.5" data-window-no-drag>
          <WindowMenuButton
            side="right"
            windowId={windowId}
            appId="console"
            iconName="activity"
          />
          {isCsd && windowId && <WindowControls side="right" />}
        </div>
      </WindowTitlebar>

      {/* Active Module (keep REPL and VFS & Events mounted so state/logs persist across tab switches) */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          activeModule === "repl" ? "flex" : "hidden"
        )}
      >
        <ReplModule scope={replScope} active={activeModule === "repl"} />
      </div>
      {activeModule === "logs" && <LogsModule />}
      {activeModule === "inspector" && <InspectorModule />}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          activeModule === "vfs-events" ? "flex" : "hidden"
        )}
      >
        <VfsEventsModule />
      </div>
      {activeModule === "storage" && <StorageModule />}
    </div>
  );
}

