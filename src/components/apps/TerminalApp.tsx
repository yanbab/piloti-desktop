import React from "react";
import { useWindowManager } from "@/context/WindowsContext";
import {
  WEB_VFS_HOME,
  buildVfsEntryWebAppUrl,
  createVfsFolder,
  createVfsTextFile,
  getVfsEntry,
  listVfsDir,
  resolveVfsPath,
  trashVfsEntry,
} from "@/lib/web-vfs";

interface TerminalAppProps {
  initialPath?: string;
  windowId: string;
}

interface OutputLine {
  id: number;
  text: string;
  tone?: "default" | "muted" | "error" | "accent" | "dir";
}

interface TopProcess {
  pid: number;
  user: string;
  cpu: string;
  mem: string;
  state: string;
  command: string;
}

function splitArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

function formatPromptPath(cwd: string): string {
  if (cwd === WEB_VFS_HOME) return "~";
  if (cwd.startsWith(`${WEB_VFS_HOME}/`)) {
    return `~${cwd.slice(WEB_VFS_HOME.length)}`;
  }
  return cwd;
}

function getParentAndName(fullPath: string): { parent: string; name: string } {
  const idx = fullPath.lastIndexOf("/");
  if (idx <= 0) {
    return { parent: "/", name: fullPath.slice(1) };
  }
  return {
    parent: fullPath.slice(0, idx),
    name: fullPath.slice(idx + 1),
  };
}

const CORE_DAEMONS: Array<{ pid: number; command: string; baseCpu: number; baseMem: number }> = [
  { pid: 101, command: "piloti-compositor", baseCpu: 1.8, baseMem: 3.4 },
  { pid: 112, command: "piloti-desktop", baseCpu: 0.7, baseMem: 2.1 },
  { pid: 118, command: "piloti-menubar", baseCpu: 0.4, baseMem: 1.2 },
  { pid: 124, command: "piloti-dock", baseCpu: 0.5, baseMem: 1.5 },
  { pid: 131, command: "piloti-wm", baseCpu: 1.1, baseMem: 2.6 },
  { pid: 145, command: "piloti-vfsd (localStorage)", baseCpu: 0.2, baseMem: 0.8 },
];

export const TerminalApp: React.FC<TerminalAppProps> = ({ initialPath }) => {
  const { windows, launchApp, openWebUrl } = useWindowManager();
  const [cwd, setCwd] = React.useState<string>(() => {
    if (initialPath) {
      const entry = getVfsEntry(initialPath);
      if (entry?.kind === "directory") return entry.path;
    }
    return WEB_VFS_HOME;
  });

  const nextIdRef = React.useRef(1);
  const [lines, setLines] = React.useState<OutputLine[]>([
    {
      id: nextIdRef.current++,
      text: "Residence Web Shell — type 'help' for available commands.",
      tone: "muted",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [topActive, setTopActive] = React.useState(false);
  const [topTick, setTopTick] = React.useState(0);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const topContainerRef = React.useRef<HTMLDivElement>(null);

  const appendLines = React.useCallback(
    (entries: Array<Omit<OutputLine, "id">>) => {
      setLines((prev) => [
        ...prev,
        ...entries.map((entry) => ({ ...entry, id: nextIdRef.current++ })),
      ]);
    },
    [],
  );

  React.useEffect(() => {
    if (topActive) {
      topContainerRef.current?.focus();
    } else {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
      });
    }
  }, [lines, topActive]);

  React.useEffect(() => {
    if (!topActive) return;
    const timer = window.setInterval(() => {
      setTopTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [topActive]);

  const topProcesses = React.useMemo<TopProcess[]>(() => {
    if (!topActive) return [];
    const jitter = (seed: number, base: number) =>
      Math.max(0.1, base + Math.sin(topTick * 0.9 + seed) * 0.4).toFixed(1);

    const daemons: TopProcess[] = CORE_DAEMONS.map((d) => ({
      pid: d.pid,
      user: "user",
      cpu: jitter(d.pid, d.baseCpu),
      mem: d.baseMem.toFixed(1),
      state: "S",
      command: d.command,
    }));

    const appProcs: TopProcess[] = windows.map((w, idx) => {
      const label = w.builtinComponent
        ? `${w.builtinComponent} (${w.title})`
        : `${w.appId} (${w.title})`;
      return {
        pid: 400 + idx * 13,
        user: "user",
        cpu: jitter(400 + idx, w.minimized ? 0.1 : 1.4),
        mem: (1.6 + (idx % 4) * 0.7).toFixed(1),
        state: w.minimized ? "T" : "R",
        command: label,
      };
    });

    return [...daemons, ...appProcs];
  }, [topActive, topTick, windows]);

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    const promptPrefix = `user@residence:${formatPromptPath(cwd)}$`;
    const commandLine: Omit<OutputLine, "id"> = {
      text: `${promptPrefix} ${raw}`,
      tone: "accent",
    };

    if (!trimmed) {
      appendLines([commandLine]);
      return;
    }

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const tokens = splitArgs(trimmed);
    const cmd = tokens[0];
    const args = tokens.slice(1);

    if (cmd === "clear") {
      setLines([]);
      return;
    }

    if (cmd === "help") {
      appendLines([
        commandLine,
        {
          text: "Commands: cd, pwd, ls [-la], mkdir, touch, cat, rm, open, notepad, top, clear, help",
          tone: "muted",
        },
      ]);
      return;
    }

    if (cmd === "pwd") {
      appendLines([commandLine, { text: cwd }]);
      return;
    }

    if (cmd === "cd") {
      const target = resolveVfsPath(cwd, args[0] ?? "~");
      const entry = getVfsEntry(target);
      if (!entry) {
        appendLines([
          commandLine,
          { text: `cd: no such file or directory: ${args[0] ?? "~"}`, tone: "error" },
        ]);
        return;
      }
      if (entry.kind !== "directory") {
        appendLines([
          commandLine,
          { text: `cd: not a directory: ${args[0]}`, tone: "error" },
        ]);
        return;
      }
      setCwd(entry.path);
      appendLines([commandLine]);
      return;
    }

    if (cmd === "ls") {
      const flags = args.filter((a) => a.startsWith("-")).join("");
      const showLong = flags.includes("l");
      const showAll = flags.includes("a");
      const targetArg = args.find((a) => !a.startsWith("-"));
      const target = resolveVfsPath(cwd, targetArg);
      const entry = getVfsEntry(target);

      if (!entry) {
        appendLines([
          commandLine,
          { text: `ls: cannot access '${targetArg ?? "."}': No such file or directory`, tone: "error" },
        ]);
        return;
      }

      if (entry.kind !== "directory") {
        appendLines([commandLine, { text: entry.name }]);
        return;
      }

      const items = listVfsDir(entry.path).filter(
        (item) => showAll || !item.name.startsWith("."),
      );
      if (items.length === 0) {
        appendLines([commandLine]);
        return;
      }

      if (showLong) {
        const rows: Array<Omit<OutputLine, "id">> = items.map((item) => {
          const kindChar = item.kind === "directory" ? "d" : "-";
          const size =
            item.kind === "directory" ? "4096" : String(item.content?.length ?? 0);
          const suffix = item.kind === "directory" ? "/" : "";
          return {
            text: `${kindChar}rw-r--r--  user  ${size.padStart(6, " ")}  ${item.name}${suffix}`,
            tone: item.kind === "directory" ? "dir" : "default",
          };
        });
        appendLines([commandLine, ...rows]);
      } else {
        const summary = items
          .map((item) => (item.kind === "directory" ? `${item.name}/` : item.name))
          .join("  ");
        appendLines([commandLine, { text: summary }]);
      }
      return;
    }

    if (cmd === "mkdir") {
      if (args.length === 0) {
        appendLines([
          commandLine,
          { text: "mkdir: missing operand", tone: "error" },
        ]);
        return;
      }
      const out: Array<Omit<OutputLine, "id">> = [commandLine];
      for (const arg of args) {
        const target = resolveVfsPath(cwd, arg);
        const { parent, name } = getParentAndName(target);
        if (!name) {
          out.push({ text: `mkdir: invalid directory '${arg}'`, tone: "error" });
          continue;
        }
        const existing = getVfsEntry(target);
        if (existing) {
          out.push({
            text: `mkdir: cannot create directory '${arg}': File exists`,
            tone: "error",
          });
          continue;
        }
        const created = createVfsFolder(parent, name);
        if (!created) {
          out.push({
            text: `mkdir: cannot create directory '${arg}': No such parent directory`,
            tone: "error",
          });
        }
      }
      appendLines(out);
      return;
    }

    if (cmd === "touch") {
      if (args.length === 0) {
        appendLines([
          commandLine,
          { text: "touch: missing file operand", tone: "error" },
        ]);
        return;
      }
      const out: Array<Omit<OutputLine, "id">> = [commandLine];
      for (const arg of args) {
        const target = resolveVfsPath(cwd, arg);
        const existing = getVfsEntry(target);
        if (existing) continue;
        const { parent, name } = getParentAndName(target);
        if (!name || !createVfsTextFile(parent, name, "")) {
          out.push({
            text: `touch: cannot touch '${arg}': No such parent directory`,
            tone: "error",
          });
        }
      }
      appendLines(out);
      return;
    }

    if (cmd === "cat") {
      if (args.length === 0) {
        appendLines([
          commandLine,
          { text: "cat: missing file operand", tone: "error" },
        ]);
        return;
      }
      const out: Array<Omit<OutputLine, "id">> = [commandLine];
      for (const arg of args) {
        const target = resolveVfsPath(cwd, arg);
        const entry = getVfsEntry(target);
        if (!entry) {
          out.push({
            text: `cat: ${arg}: No such file or directory`,
            tone: "error",
          });
          continue;
        }
        if (entry.kind === "directory") {
          out.push({ text: `cat: ${arg}: Is a directory`, tone: "error" });
          continue;
        }
        const contentLines = (entry.content ?? "").split("\n");
        for (const line of contentLines) {
          out.push({ text: line });
        }
      }
      appendLines(out);
      return;
    }

    if (cmd === "rm") {
      if (args.length === 0) {
        appendLines([
          commandLine,
          { text: "rm: missing operand", tone: "error" },
        ]);
        return;
      }
      const out: Array<Omit<OutputLine, "id">> = [commandLine];
      for (const arg of args) {
        if (arg.startsWith("-")) continue;
        const target = resolveVfsPath(cwd, arg);
        const entry = getVfsEntry(target);
        if (!entry) {
          out.push({
            text: `rm: cannot remove '${arg}': No such file or directory`,
            tone: "error",
          });
          continue;
        }
        trashVfsEntry(entry.path);
      }
      appendLines(out);
      return;
    }

    if (cmd === "open" || cmd === "notepad" || cmd === "edit") {
      if (args.length === 0) {
        if (cmd === "open") {
          launchApp("nautilus", { payload: cwd });
        } else {
          launchApp("text-editor");
        }
        appendLines([commandLine]);
        return;
      }
      const target = resolveVfsPath(cwd, args[0]);
      const entry = getVfsEntry(target);
      if (entry?.kind === "directory") {
        launchApp("nautilus", { payload: entry.path });
      } else if (
        cmd === "open" &&
        entry &&
        /\.(html?|svg|png|jpe?g|gif|webp)$/i.test(entry.name)
      ) {
        const webUrl = buildVfsEntryWebAppUrl(entry);
        if (webUrl) {
          openWebUrl(webUrl, { title: entry.name });
        } else {
          launchApp("text-editor", { payload: target });
        }
      } else {
        launchApp("text-editor", { payload: target });
      }
      appendLines([commandLine]);
      return;
    }

    if (cmd === "top") {
      appendLines([commandLine]);
      setTopActive(true);
      return;
    }

    appendLines([
      commandLine,
      { text: `${cmd}: command not found`, tone: "error" },
    ]);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = input;
      setInput("");
      runCommand(value);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx =
        historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInput(history[nextIdx] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex >= history.length - 1) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx] ?? "");
      }
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const promptPrefix = `user@residence:${formatPromptPath(cwd)}$`;
      appendLines([{ text: `${promptPrefix} ${input}^C`, tone: "accent" }]);
      setInput("");
    }
  };

  const handleTopKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key === "q" ||
      e.key === "Escape" ||
      e.key === "Enter" ||
      (e.ctrlKey && e.key.toLowerCase() === "c")
    ) {
      e.preventDefault();
      setTopActive(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  if (topActive) {
    return (
      <div
        ref={topContainerRef}
        tabIndex={0}
        onKeyDown={handleTopKeyDown}
        className="flex h-full w-full flex-col bg-zinc-950 p-3 font-mono text-[12px] leading-snug text-zinc-100 outline-none select-none"
      >
        <div className="mb-2 flex items-center justify-between text-zinc-400">
          <span>
            top - residence-web-shell | Tasks: {topProcesses.length} total,{" "}
            {topProcesses.filter((p) => p.state === "R").length} running
          </span>
          <span className="text-zinc-500">Press q or Ctrl+C to exit</span>
        </div>
        <div className="grid grid-cols-[56px_64px_56px_56px_40px_1fr] bg-zinc-800/80 px-2 py-1 font-semibold text-zinc-200">
          <span>PID</span>
          <span>USER</span>
          <span>%CPU</span>
          <span>%MEM</span>
          <span>S</span>
          <span>COMMAND</span>
        </div>
        <div className="flex-1 overflow-auto">
          {topProcesses.map((proc) => (
            <div
              key={`${proc.pid}-${proc.command}`}
              className="grid grid-cols-[56px_64px_56px_56px_40px_1fr] px-2 py-0.5 odd:bg-zinc-900/40"
            >
              <span className="text-emerald-400">{proc.pid}</span>
              <span className="text-zinc-300">{proc.user}</span>
              <span>{proc.cpu}</span>
              <span>{proc.mem}</span>
              <span className={proc.state === "R" ? "text-amber-300" : "text-zinc-400"}>
                {proc.state}
              </span>
              <span className="truncate text-zinc-100">{proc.command}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onClick={() => inputRef.current?.focus()}
      className="h-full w-full overflow-auto bg-zinc-950 p-3 font-mono text-[13px] leading-relaxed text-zinc-100 select-text"
    >
      {lines.map((line) => (
        <div
          key={line.id}
          className={
            line.tone === "error"
              ? "whitespace-pre-wrap text-red-400"
              : line.tone === "muted"
                ? "whitespace-pre-wrap text-zinc-500"
                : line.tone === "accent"
                  ? "whitespace-pre-wrap text-emerald-400"
                  : line.tone === "dir"
                    ? "whitespace-pre-wrap text-sky-400"
                    : "whitespace-pre-wrap text-zinc-100"
          }
        >
          {line.text || "\u00A0"}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-emerald-400">
          user@residence:{formatPromptPath(cwd)}$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Terminal input"
          className="min-w-0 flex-1 bg-transparent text-zinc-100 outline-none"
        />
      </div>
    </div>
  );
};
