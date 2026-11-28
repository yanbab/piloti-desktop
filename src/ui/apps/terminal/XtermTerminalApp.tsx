import { runShellLine } from "@/platform/shared/system-commands";
import { hostFiles } from "@/core/files/host-files";
import { onShellEvent } from "@/core/windows/shell-events";
import * as React from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { usePiloti } from "@/platform/shared/piloti";
import {
  useApps,
  useSystemBackends,
  useWindowActions,
  useWindowManagerSelector,
  useDesktopSettings,
  useUpdateSettings,
} from "@/ui/context/DesktopStateContext";
import { getEngine } from "@/core/ports/engine";
import { setDemoApps } from "@/platform/shared/demo-processes";
import { readLoginShells, startShell, type BashSession, type LoginShell } from "@/platform/shared/terminal";
import { ChevronDownIcon } from "@/ui/components/ui/symbols";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { createRepl } from "@/ui/apps/terminal/piloti-repl";
import { createShellCommands, SHELL_COMMAND_HELP } from "@/ui/apps/terminal/piloti-commands";
import { useOpenPath } from "@/ui/hooks/use-open-path";
import { complete } from "@/ui/apps/terminal/piloti-completion";
import { createProgramIndex } from "@/ui/apps/terminal/piloti-programs";
import { runInTerminal } from "@/ui/apps/terminal/piloti-run";
import { runTop } from "@/ui/apps/terminal/piloti-top";
import { readSystemSample } from "@/platform/shared/system-commands";
import { ACCENT_COLORS } from "@/core/data/catalog";
import { _ } from "@/core/util/i18n";
import { HeaderBar } from "@/ui/components/elements/header-bar";

/** `"piloti"` is the JavaScript REPL; anything else is a shell path from /etc/shells. */
const PILOTI = "piloti";
const AUTOEXEC = "~/.config/piloti-shell/autoexec.psh";

/** The terminal colour tokens, as the page resolves them now. */
function terminalTheme() {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(`--ui-terminal-${name}`).trim();
  const foreground = token("label");
  return { background: token("background"), foreground, cursor: foreground, selectionBackground: token("selection") };
}

/**
 * Terminal on xterm.js with two modes: `bash` (the user's shell on a real
 * pseudo-terminal, Linux only) and `piloti-shell` (a JavaScript REPL with the
 * desktop in reach).
 */
/** "Bash", "Zsh", "Piloti Shell": the program name, capitalized, for the menu. */
function shellDisplayName(mode: string): string {
  const program = mode === PILOTI ? "piloti-shell" : mode.slice(mode.lastIndexOf("/") + 1);
  return program
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function XtermTerminalApp({
  initialPath: _initialPath,
  windowId = "",
}: {
  initialPath?: string;
  windowId?: string;
}) {
  const piloti = usePiloti();
  const settings = useDesktopSettings(["accentColor", "customAccentHex", "fontScale", "fontMonoFamily"]);
  const updateSettings = useUpdateSettings();
  const { pushNotification } = useSystemBackends();
  const { launchApp } = useWindowActions();
  const windows = useWindowManagerSelector((wm) =>
    wm.windows.map((w) => ({ id: w.id, appId: w.appId, title: w.title })),
  );
  const focused = useWindowManagerSelector((wm) => wm.focusedWindowId === windowId);
  const { systemServices } = getEngine().capabilities;
  const bashAvailable = systemServices;
  const [shells, setShells] = React.useState<LoginShell[]>([]);
  const [mode, setMode] = React.useState<string>(bashAvailable ? "" : PILOTI);
  React.useEffect(() => {
    let cancelled = false;
    void readLoginShells(piloti).then((list) => {
      if (cancelled) return;
      setShells(list);
      if (!bashAvailable) return; // the web demo has no shells: they are listed, disabled
      const preferred = list.find((s) => s.available && s.path.endsWith("/bash")) ?? list.find((s) => s.available);
      setMode(preferred?.path ?? PILOTI);
    });
    return () => {
      cancelled = true;
    };
  }, [bashAvailable, piloti]);

  // One menu, sorted by name: piloti-shell among the real shells.
  const menuEntries = React.useMemo(
    () =>
      [
        { value: PILOTI, label: shellDisplayName(PILOTI), available: true },
        ...shells.map(({ path, available }) => ({
          value: path,
          label: shellDisplayName(path),
          available,
        })),
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [shells],
  );

  const hostRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const bashRef = React.useRef<BashSession | null>(null);

  // What the REPL can reach, kept current without restarting the session.
  const { installedXdgApps } = useApps();
  const live = React.useRef({ windows, settings, apps: installedXdgApps });
  live.current = { windows, settings, apps: installedXdgApps };
  const { openPath } = useOpenPath();
  const openRef = React.useRef(openPath);
  openRef.current = openPath;
  // Keeps the current folder for the window's life.
  const [shellCommands] = React.useState(() =>
    createShellCommands({ vfs: () => piloti.vfs, open: (path, kind) => openRef.current(path, { kind }),
      color: true,
      columns: () => termRef.current?.cols ?? 80,
    }),
  );
  const [programIndex] = React.useState(() => (systemServices ? createProgramIndex(piloti) : null));
  const replRef = React.useRef<ReturnType<typeof createRepl> | null>(null);
  const scope = React.useCallback(
    () => ({
      ...shellCommands.commands,
      clear: () => termRef.current?.clear(),
      source: async (path: string) => {
        const text = await piloti.vfs.readText(shellCommands.resolve(String(path)));
        if (text === null) throw new Error(`source: ${path}: no such file`);
        await replRef.current?.runScript(text, String(path));
      },
      top: async () => {
        const term = termRef.current;
        const repl = replRef.current;
        if (!term || !repl) return;
        if (!systemServices) setDemoApps(live.current.windows.map((w) => w.appId));
        await runTop({
          sample: () => readSystemSample(piloti),
          write: (t) => term.write(t),
          size: () => ({ cols: term.cols, rows: term.rows }),
          capture: repl.capture,
        });
      },
      windows: () => live.current.windows,
      settings: () => live.current.settings,
      set: (patch: Record<string, unknown>) => updateSettings(patch as never),
      launch: (appId: string, payload?: string) => launchApp(appId, { payload }),
      notify: (summary: string, body = "") => pushNotification({ appName: "Piloti shell", summary, body }),
      apps: () => live.current.apps,
      run: async (cmd: string) => {
        if (!systemServices) return { code: 0, stdout: `[web demo] would run: ${cmd}`, stderr: "" };
        const res = await runShellLine(piloti, cmd);
        return res.match({
          Ok: (ran) => ran,
          Err: (err) => {
            throw new Error(String(err));
          },
        });
      },
      files: hostFiles(piloti),
      piloti,
      help: () =>
        [
          "Commands can be typed shell-style: name arg 'other arg' calls name('arg', 'other arg').",
          "Use $name, $(expression), {...} or [...] to pass JavaScript values.",
          "Other names run programs of $PATH. Tab completes. Arrays of objects print as tables.",
          "",
          SHELL_COMMAND_HELP,
          "source file        run a script, line by line (or ./file.psh)",
          "top                processes, busiest first (q quits)",
          "clear              clear the screen",
          "",
          "windows()          open windows",
          "settings()         current settings",
          "set({ ... })       change settings, e.g. set({ themeMode: 'dark' })",
          "launch(appId, p?)  open an app, e.g. launch('nautilus', '/home')",
          "notify(title, b?)  show a notification",
          "apps()             installed applications",
          "run(cmd)           run a Linux command, returns { code, stdout, stderr }",
          "files              Domicile's files",
          "piloti             Domicile's desktop plus vfs, desktop, settings, plugins",
        ].join("\n"),
    }),
    [piloti, launchApp, pushNotification, updateSettings, shellCommands, systemServices],
  );
  // The prompt takes the accent color (24-bit).
  const custom = settings.customAccentHex?.trim() ?? "";
  const accent = /^#[0-9a-f]{6}$/i.test(custom)
    ? custom
    : (ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.hex ?? "#3584e4");
  const accentRef = React.useRef(accent);
  accentRef.current = accent;
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

  React.useEffect(
    () =>
      onShellEvent("piloti:select-all", (detail, event) => {
        if (detail.windowId !== (windowId ?? null)) return;
        event.preventDefault();
        termRef.current?.selectAll();
      }),
    [windowId],
  );

  // Light and dark switch on the root element, also in automatic mode.
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      if (termRef.current) termRef.current.options.theme = terminalTheme();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-interface-theme"] });
    return () => observer.disconnect();
  }, []);

  // The terminal draws its own text: give it the font settings.
  React.useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const family = settings.fontMonoFamily.trim();
    term.options.fontFamily = `${family ? `"${family}", ` : ""}"JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace`;
    term.options.fontSize = Math.round(13 * (settings.fontScale || 1));
    fitRef.current?.fit();
  }, [settings.fontScale, settings.fontMonoFamily]);

  // The terminal takes the keyboard whenever its window is focused.
  React.useEffect(() => {
    if (focused) termRef.current?.focus();
  }, [focused, mode]);

  // (Re)start the chosen mode when it changes.
  React.useEffect(() => {
    const term = termRef.current;
    if (!term || !mode) return;
    term.reset();
    term.options.theme = terminalTheme();
    let cancelled = false;
    let input: { dispose(): void } | null = null;

    if (mode === PILOTI) {
      const repl = createRepl({
        write: (t) => term.write(t),
        scope: () => scopeRef.current(),
        prompt: () => {
          const rgb = [1, 3, 5].map((i) => parseInt(accentRef.current.slice(i, i + 2), 16)).join(";");
          return `\x1b[38;2;${rgb}m${shellCommands.shortCwd().replace(/[\x00-\x1f\x7f-\x9f]/g, "?")}>\x1b[0m `;
        },
        aliases: shellCommands.aliases,
        textCommands: new Set(Object.keys(shellCommands.commands).filter((name) => name !== "echo")),
        glob: shellCommands.glob,
        columns: () => term.cols,
        complete: (text) =>
          complete(text, {
            scope: scopeRef.current(),
            programs: async () => [...shellCommands.aliases.keys(), ...(programIndex ? await programIndex.all() : [])],
            vfs: piloti.vfs,
            resolve: shellCommands.resolve,
          }),
        programs: programIndex
          ? {
              has: async (name) => {
                if (!name.includes("/")) return programIndex.has(name);
                return (await piloti.vfs.stat(shellCommands.resolve(name)))?.kind === "file";
              },
              run: (argv, attach) => {
                const [name, ...args] = argv as [string, ...string[]];
                return runInTerminal({
                  start: (onOutput, onExit) =>
                    startShell(
                      piloti,
                      [name.startsWith("~") ? shellCommands.resolve(name) : name, ...args],
                      { cols: term.cols, rows: term.rows },
                      onOutput,
                      onExit,
                      { cwd: shellCommands.cwd() },
                    ),
                  write: (data) => term.write(data),
                  attach,
                  // The window keeps it, to resize it and to stop it on closing.
                  hold: (session) => {
                    if (cancelled) session?.stop();
                    else bashRef.current = session;
                  },
                });
              },
            }
          : undefined,
      });
      replRef.current = repl;
      input = term.onData((d) => repl.onData(d));
      repl.start(async () => {
        const text = await piloti.vfs.readText(shellCommands.resolve(AUTOEXEC));
        if (text !== null) await repl.runScript(text, "autoexec.psh", { keepGoing: true });
      });
    } else {
      void startShell(
        piloti,
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
      replRef.current?.dispose();
      replRef.current = null;
      input?.dispose();
      bashRef.current?.stop();
      bashRef.current = null;
    };
    // The session restarts on mode change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, piloti]);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: "var(--ui-terminal-background)" }}
    >
      {/* Header bar, GNOME-style: the shell menu is the title. */}
      {/* Header clicks must not take the keyboard from the terminal. */}
      <HeaderBar onMouseDown={(e) => e.preventDefault()}>
        <HeaderBar.Title interactive>
          <DropdownMenu onOpenChange={(open) => !open && requestAnimationFrame(() => termRef.current?.focus())}>
            <DropdownMenuTrigger
              aria-label={_("Choose shell")}
              className="inline-flex max-w-full items-center gap-1 rounded-[7px] px-2.5 py-1 text-ui-body font-semibold text-ui-label outline-none hover:bg-black/8 data-popup-open:bg-black/12 dark:hover:bg-white/10 dark:data-popup-open:bg-white/15"
            >
              <span className="truncate">
                {shellDisplayName(mode)}
              </span>
              <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[11rem]">
              <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(String(value))}>
                {menuEntries.map(({ value, label, available }) => (
                  <DropdownMenuRadioItem key={value} value={value} disabled={!available}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </HeaderBar.Title>
      </HeaderBar>
      <div ref={hostRef} className="min-h-0 flex-1 p-2" onMouseDown={() => requestAnimationFrame(() => termRef.current?.focus())} />
    </div>
  );
}
