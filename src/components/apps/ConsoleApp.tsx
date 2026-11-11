import * as React from "react";
import { useDisplays } from "@domicile-desktop/react/displays";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import {
  ActivityIcon,
  ChevronRightIcon,
  Code2Icon,
  Maximize2Icon,
  MinusIcon,
  PlayIcon,
  ScrollTextIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import {
  clearConsoleEntries,
  evaluateReplCode,
  formatInspectValue,
  useConsoleEntries,
  type ConsoleLogLevel,
} from "@/lib/console-store";
import { cn } from "@/lib/utils";

export type ConsoleModuleId = "repl" | "logs" | "inspector";

interface ReplItem {
  id: number;
  code: string;
  ok: boolean;
  output: string;
  durationMs: number;
}

const REPL_QUICK_SNIPPETS: { label: string; code: string }[] = [
  { label: "help()", code: "help()" },
  { label: "windows", code: "windows.map(w => ({ id: w.id, title: w.title }))" },
  { label: "settings", code: "settings" },
  { label: "displays", code: "displays" },
  { label: "uname -a", code: 'await run("uname -a")' },
];

let nextReplId = 1;

function ReplModule({
  scope,
}: {
  scope: Record<string, unknown>;
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
          help: () => ({
            bindings: [
              "domicile",
              "windows",
              "focusedWindow",
              "displays",
              "browserWindows",
              "settings",
              "updateSettings(patch)",
              "apps",
              "notifications",
              "gnomeCapabilities",
              "launchApp(id)",
              "focusWindow(id)",
              "closeWindow(id)",
              "openWebUrl(url)",
              "run(shellCmd)",
              "clear()",
              "$_ (last result)",
            ],
            examples: [
              'await run("uname -a")',
              'await domicile.files.readDir("/usr/share/applications")',
              'updateSettings({ uiTheme: "adwaita" })',
              'openWebUrl("https://gnome.org")',
            ],
          }),
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
            output: formatInspectValue(result),
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Quick Snippets Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-mac-separator bg-black/3 px-3 py-1.5 dark:bg-white/3">
        <div className="flex flex-wrap items-center gap-1">
          {REPL_QUICK_SNIPPETS.map((snippet) => (
            <button
              key={snippet.label}
              type="button"
              onClick={() => void execute(snippet.code)}
              className="rounded-md bg-black/7 px-2 py-0.5 font-mono text-[11px] text-mac-label-secondary transition-colors hover:bg-mac-accent hover:text-white dark:bg-white/8"
            >
              {snippet.label}
            </button>
          ))}
        </div>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setItems([])}
          disabled={items.length === 0}
          className="gap-1 text-[11px]"
        >
          <Trash2Icon className="size-3" />
          Clear
        </Button>
      </div>

      {/* Output Transcript */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 font-mono text-[12px]"
      >
        {items.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center gap-1.5 py-8 text-center font-sans text-mac-label-secondary">
            <TerminalIcon className="size-7 text-mac-accent opacity-80" />
            <div className="text-[13px] font-semibold text-mac-label">
              Piloti Shell REPL
            </div>
            <p className="max-w-md text-[11.5px]">
              Evaluate live JavaScript &amp; async Domicile commands (`domicile`,{" "}
              `windows`, `settings`, `await run("cmd")`). Run `help()` for bindings.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-mac-separator bg-black/3 px-2.5 py-2 dark:bg-white/4"
            >
              <div className="flex items-center justify-between gap-2 text-mac-label-secondary">
                <div className="flex min-w-0 items-start gap-1.5 font-semibold text-mac-label">
                  <ChevronRightIcon className="mt-0.5 size-3.5 shrink-0 text-mac-accent" />
                  <pre className="min-w-0 whitespace-pre-wrap break-all">
                    {item.code}
                  </pre>
                </div>
                <span className="shrink-0 text-[10px] text-mac-label-tertiary">
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
          ))
        )}
      </div>

      {/* Input Prompt */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void execute();
        }}
        className="flex shrink-0 items-end gap-2 border-t border-mac-separator bg-mac-titlebar px-3 py-2"
      >
        <ChevronRightIcon className="mb-1.5 size-4 shrink-0 text-mac-accent" />
        <textarea
          ref={inputRef}
          autoFocus
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter JS expression or await run('cmd')… (Shift+Enter for newline)"
          className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-1 font-mono text-[12px] text-mac-label outline-none placeholder:text-mac-label-tertiary"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || running}
          className="gap-1"
        >
          <PlayIcon className="size-3" />
          Run
        </Button>
      </form>
    </div>
  );
}

function LogsModule() {
  const entries = useConsoleEntries();
  const [filterLevel, setFilterLevel] = React.useState<
    "all" | ConsoleLogLevel
  >("all");
  const [search, setSearch] = React.useState("");
  const endRef = React.useRef<HTMLDivElement | null>(null);

  const visibleEntries = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filterLevel !== "all" && entry.level !== filterLevel) return false;
      if (q && !entry.message.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filterLevel, search]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [visibleEntries.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-mac-separator bg-black/3 px-3 py-1.5 dark:bg-white/3">
        <div className="flex items-center gap-1">
          {(["all", "log", "warn", "error"] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setFilterLevel(lvl)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                filterLevel === lvl
                  ? "bg-mac-accent text-white"
                  : "bg-black/6 text-mac-label-secondary hover:bg-black/10 dark:bg-white/8"
              )}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-48">
            <SearchField
              placeholder="Filter logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => clearConsoleEntries()}
            disabled={entries.length === 0}
            className="gap-1 text-[11px]"
          >
            <Trash2Icon className="size-3" />
            Clear
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11.5px]">
        {visibleEntries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center font-sans text-mac-label-secondary">
            <ScrollTextIcon className="size-6 opacity-60" />
            <div className="text-xs font-medium">No console messages</div>
          </div>
        ) : (
          <div className="space-y-1">
            {visibleEntries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1 select-text",
                  entry.level === "error" &&
                    "bg-rose-500/12 text-rose-700 dark:text-rose-300",
                  entry.level === "warn" &&
                    "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                  (entry.level === "log" || entry.level === "info") &&
                    "bg-black/3 text-mac-label dark:bg-white/4"
                )}
              >
                <span className="shrink-0 text-[10px] text-mac-label-tertiary">
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

function InspectorModule() {
  const domicile = useDomicile();
  const displays = useDisplays();
  const { isBrowserRuntime, settings } = useSettings();
  const { gnomeCapabilities } = useSystemBackends();
  const { windows, focusWindow, closeWindow } = useWindowManager();
  const browserWindows =
    useWatch(domicile.browser, "change", () => domicile.browser.windows) ?? [];

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs">
      <section className="space-y-2">
        <h3 className="text-[12px] font-bold tracking-wide text-mac-label-secondary uppercase">
          Open Windows ({windows.length})
        </h3>
        <div className="divide-y divide-mac-separator overflow-hidden rounded-lg border border-mac-separator bg-black/3 dark:bg-white/4">
          {windows.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-mac-label">
                  {w.title}
                </div>
                <div className="truncate font-mono text-[10.5px] text-mac-label-secondary">
                  id={w.id} · appId={w.appId} · ws={w.workspace} ·{" "}
                  {w.size.width}×{w.size.height}
                  {w.clientFrame ? " · CSD" : " · SSD"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => focusWindow(w.id)}
                >
                  Focus
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => closeWindow(w.id)}
                >
                  Close
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {browserWindows.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-bold tracking-wide text-mac-label-secondary uppercase">
            WebView Windows ({browserWindows.length})
          </h3>
          <div className="divide-y divide-mac-separator overflow-hidden rounded-lg border border-mac-separator bg-black/3 dark:bg-white/4">
            {browserWindows.map((bw) => (
              <div
                key={bw.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{bw.title || bw.url}</div>
                  <div className="truncate font-mono text-[10.5px] text-mac-label-secondary">
                    {bw.url}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => domicile.browser.close(bw.id)}
                >
                  Close
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-[12px] font-bold tracking-wide text-mac-label-secondary uppercase">
          Runtime &amp; Displays
        </h3>
        <pre className="overflow-x-auto rounded-lg border border-mac-separator bg-black/3 p-3 font-mono text-[11px] select-text dark:bg-white/4">
          {formatInspectValue({
            runtime: isBrowserRuntime ? "Browser Harness" : "Domicile Wayland",
            displays,
            gnomeCapabilities,
            settings,
          })}
        </pre>
      </section>
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

  const [activeModule, setActiveModule] = React.useState<ConsoleModuleId>(
    initialModule === "logs" || initialModule === "inspector"
      ? initialModule
      : "repl"
  );

  React.useEffect(() => {
    if (
      initialModule === "repl" ||
      initialModule === "logs" ||
      initialModule === "inspector"
    ) {
      setActiveModule(initialModule);
    }
  }, [initialModule]);

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

  const modules: { id: ConsoleModuleId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "repl", label: "REPL", icon: <TerminalIcon className="size-3.5" /> },
    {
      id: "logs",
      label: "Logs",
      icon: <ScrollTextIcon className="size-3.5" />,
      badge: errorCount > 0 ? errorCount : undefined,
    },
    {
      id: "inspector",
      label: "Inspector",
      icon: <ActivityIcon className="size-3.5" />,
    },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-mac-window text-mac-label">
      {/* Header / Module Switcher */}
      <div
        data-window-drag-region={isCsd ? "" : undefined}
        onDoubleClick={(e) => {
          if (!isCsd || !windowId) return;
          if ((e.target as HTMLElement).closest("button")) return;
          toggleMaximizeWindow(windowId);
        }}
        className={cn(
          "relative flex shrink-0 items-center justify-between gap-2 border-b border-mac-separator bg-mac-titlebar px-3 select-none",
          isCsd ? "h-[46px] rounded-t-[inherit]" : "h-10"
        )}
      >
        <div className="flex items-center gap-2 text-[12.5px] font-semibold">
          <Code2Icon className="size-4 text-mac-accent" />
          <span>Piloti Console</span>
        </div>

        {/* Module Tabs */}
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
                    ? "bg-mac-window text-mac-label shadow-xs"
                    : "text-mac-label-secondary hover:text-mac-label"
                )}
              >
                {mod.icon}
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
        {isCsd && windowId ? (
          <div className="flex items-center gap-1.5" data-window-no-drag>
            <button
              type="button"
              aria-label="Minimize"
              onClick={() => minimizeWindow(windowId)}
              className="flex size-6 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
            >
              <MinusIcon className="size-3" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-label="Maximize"
              onClick={() => toggleMaximizeWindow(windowId)}
              className="flex size-6 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
            >
              <Maximize2Icon className="size-3" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={() => closeWindow(windowId)}
              className="flex size-6 items-center justify-center rounded-full bg-black/8 text-mac-label transition-colors hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/16"
            >
              <XIcon className="size-3.5" strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Active Module */}
      {activeModule === "repl" && <ReplModule scope={replScope} />}
      {activeModule === "logs" && <LogsModule />}
      {activeModule === "inspector" && <InspectorModule />}
    </div>
  );
}

