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
import { readLoginShells, startShell, type BashSession, type LoginShell } from "@/lib/engine-native/pty-bridge";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createRepl } from "@/lib/shell/piloti-repl";
import { _ } from "@/lib/core/i18n";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";

/** `"piloti"` is the JavaScript REPL; anything else is a shell path from /etc/shells. */
const PILOTI = "piloti";

const DARK = { background: "#1e1e1e", foreground: "#e6e6e6", cursor: "#e6e6e6", selectionBackground: "#4a4a4a" };
const LIGHT = { background: "#fafafa", foreground: "#1e1e1e", cursor: "#1e1e1e", selectionBackground: "#cfcfcf" };

/**
 * Terminal on xterm.js with two modes: `bash` (the user's shell on a real
 * pseudo-terminal, Linux only) and `piloti-shell` (a JavaScript REPL with the
 * desktop in reach).
 */
export function XtermTerminalApp({
  initialPath: _initialPath,
  windowId = "",
}: {
  initialPath?: string;
  windowId?: string;
}) {
  const domicile = useDomicile();
  const { settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const { launchApp } = useWindowActions();
  const windows = useWindowManagerSelector((wm) =>
    wm.windows.map((w) => ({ id: w.id, appId: w.appId, title: w.title })),
  );
  const bashAvailable = getEngine().capabilities.systemServices;
  const [shells, setShells] = React.useState<LoginShell[]>([]);
  const [mode, setMode] = React.useState<string>(bashAvailable ? "" : PILOTI);
  React.useEffect(() => {
    let cancelled = false;
    void readLoginShells(domicile).then((list) => {
      if (cancelled) return;
      setShells(list);
      if (!bashAvailable) return; // the web demo has no shells: they are listed, disabled
      const preferred = list.find((s) => s.available && s.path.endsWith("/bash")) ?? list.find((s) => s.available);
      setMode(preferred?.path ?? PILOTI);
    });
    return () => {
      cancelled = true;
    };
  }, [bashAvailable, domicile]);

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
    if (!term || !mode) return;
    term.reset();
    term.options.theme = settings.themeMode === "dark" ? DARK : LIGHT;
    let cancelled = false;
    let input: { dispose(): void } | null = null;

    if (mode === PILOTI) {
      const repl = createRepl({ write: (t) => term.write(t), scope: () => scopeRef.current() });
      input = term.onData((d) => repl.onData(d));
      repl.start();
    } else {
      void startShell(
        domicile,
        mode,
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

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: (settings.themeMode === "dark" ? DARK : LIGHT).background }}
    >
      {/* Header bar, GNOME-style: the shell menu is the title. */}
      <WindowTitlebar
        data-window-drag-region=""
        className="h-9 shrink-0 justify-between border-b border-adw-separator bg-adw-titlebar px-2.5 select-none"
      >
        <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
          <WindowControls side="left" />
          <WindowMenuButton side="left" windowId={windowId} appId="terminal" iconName="terminal" />
        </div>
        <div className="flex min-w-0 items-center justify-center" data-window-no-drag>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={_("Choose shell")}
              className="inline-flex max-w-full items-center gap-1 rounded-[7px] px-2.5 py-1 text-adw-body font-semibold text-adw-label outline-none hover:bg-black/8 data-popup-open:bg-black/12 dark:hover:bg-white/10 dark:data-popup-open:bg-white/15"
            >
              <span className="truncate">
                {mode === PILOTI ? "piloti-shell" : (mode.split("/").pop() ?? mode)}
              </span>
              <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[11rem]">
              <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(String(value))}>
                <DropdownMenuRadioItem value={PILOTI}>piloti-shell</DropdownMenuRadioItem>
                {shells.map(({ path, available }) => (
                  <DropdownMenuRadioItem key={path} value={path} disabled={!available}>
                    {path.slice(path.lastIndexOf("/") + 1)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
          <WindowMenuButton side="right" windowId={windowId} appId="terminal" iconName="terminal" />
          <WindowControls side="right" />
        </div>
      </WindowTitlebar>
      <div ref={hostRef} className="min-h-0 flex-1 p-2" />
    </div>
  );
}
