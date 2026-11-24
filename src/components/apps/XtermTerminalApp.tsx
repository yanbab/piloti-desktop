import * as React from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  useSettings,
  useSystemBackends,
  useWindowActions,
  useWindowManagerSelector,
} from "@/context/DesktopStateContext";
import { getEngine } from "@/lib/engine/engine";
import { startBash, type BashSession } from "@/lib/engine-native/pty-bridge";
import { createRepl } from "@/lib/shell/piloti-repl";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";

type Mode = "bash" | "piloti";

const DARK = { background: "#1e1e1e", foreground: "#e6e6e6", cursor: "#e6e6e6", selectionBackground: "#4a4a4a" };
const LIGHT = { background: "#fafafa", foreground: "#1e1e1e", cursor: "#1e1e1e", selectionBackground: "#cfcfcf" };

/**
 * Terminal on xterm.js with two modes: `bash` (the user's shell on a real
 * pseudo-terminal, Linux only) and `piloti-shell` (a JavaScript REPL with the
 * desktop in reach).
 */
export function XtermTerminalApp({ initialPath: _initialPath }: { initialPath?: string; windowId?: string }) {
  const domicile = useDomicile();
  const { settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const { launchApp } = useWindowActions();
  const windows = useWindowManagerSelector((wm) =>
    wm.windows.map((w) => ({ id: w.id, appId: w.appId, title: w.title })),
  );
  const bashAvailable = getEngine().capabilities.systemServices;
  const [mode, setMode] = React.useState<Mode>(bashAvailable ? "bash" : "piloti");

  const hostRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const bashRef = React.useRef<BashSession | null>(null);

  // What the REPL can reach, kept current without restarting the session.
  const live = React.useRef({ windows, settings });
  live.current = { windows, settings };
  const scope = React.useCallback(
    () => ({
      windows: () => live.current.windows,
      settings: () => live.current.settings,
      set: (patch: Record<string, unknown>) => updateSettings(patch as never),
      launch: (appId: string, payload?: string) => launchApp(appId, { payload }),
      notify: (summary: string, body = "") => pushNotification({ appName: "Piloti shell", summary, body }),
      piloti: (globalThis as { __PILOTI__?: unknown }).__PILOTI__,
      files: domicile.files,
      domicile,
      help: () =>
        [
          "windows()          open windows",
          "settings()         current settings",
          "set({ ... })       change settings, e.g. set({ themeMode: 'dark' })",
          "launch(appId, p?)  open an app, e.g. launch('nautilus', '/home')",
          "notify(title, b?)  show a notification",
          "piloti             the plugin API (windows, settings, notifications...)",
          "files, domicile    Domicile's files and the whole desktop API",
        ].join("\n"),
    }),
    [domicile, launchApp, pushNotification, updateSettings],
  );
  const scopeRef = React.useRef(scope);
  scopeRef.current = scope;

  // One terminal for the window's life.
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* host not laid out yet */
      }
    });
    observer.observe(host);
    const sub = term.onResize(({ cols, rows }) => bashRef.current?.resize(cols, rows));
    return () => {
      observer.disconnect();
      sub.dispose();
      bashRef.current?.stop();
      bashRef.current = null;
      term.dispose();
      termRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const term = termRef.current;
    if (term) term.options.theme = settings.themeMode === "dark" ? DARK : LIGHT;
  }, [settings.themeMode]);

  // (Re)start the chosen mode when it changes.
  React.useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.reset();
    term.options.theme = settings.themeMode === "dark" ? DARK : LIGHT;
    let cancelled = false;
    let input: { dispose(): void } | null = null;

    if (mode === "piloti") {
      const repl = createRepl({ write: (t) => term.write(t), scope: () => scopeRef.current() });
      input = term.onData((d) => repl.onData(d));
      repl.start();
    } else {
      void startBash(
        domicile,
        { cols: term.cols, rows: term.rows },
        (bytes) => term.write(bytes),
        (reason) => term.write(`\r\n\x1b[2m[${reason}]\x1b[0m\r\n`),
      ).then((session) => {
        if (!session) return;
        if (cancelled) return session.stop();
        bashRef.current = session;
        input = term.onData((d) => session.write(d));
      });
    }
    term.focus();
    return () => {
      cancelled = true;
      input?.dispose();
      bashRef.current?.stop();
      bashRef.current = null;
    };
    // The session restarts on mode change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, domicile]);

  const option = (value: Mode, label: string, disabled = false) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      disabled={disabled}
      onClick={() => setMode(value)}
      className={cn(
        "rounded-[7px] px-3 py-1 text-[12px] font-medium transition-colors",
        mode === value
          ? "bg-adw-accent text-white"
          : "text-adw-label-secondary hover:bg-black/8 dark:hover:bg-white/10",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: (settings.themeMode === "dark" ? DARK : LIGHT).background }}
    >
      <div
        role="tablist"
        aria-label={_("Terminal mode")}
        className="flex shrink-0 items-center gap-1 border-b border-black/10 bg-adw-headerbar px-2 py-1.5 dark:border-white/10"
      >
        {option("bash", "bash", !bashAvailable)}
        {option("piloti", "piloti-shell")}
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 p-2" />
    </div>
  );
}
