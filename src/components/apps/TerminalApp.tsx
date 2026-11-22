import React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { InlineCompletionInput } from "@/components/ui/inline-completion-input";
import {
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import {
  canonicalizeWebUrl,
  fetchWebPageMetadata,
  getWebAppFaviconUrl,
} from "@/data/web-apps";
import {
  executeTextPipeline,
  parseCommandPipeline,
  runGrepFilter,
} from "@/lib/shell/terminal-pipeline";
import {
  installWebAppDesktopEntry,
  removeWebAppDesktopEntry,
} from "@/lib/xdg/xdg-web-apps";
import {
  WEB_VFS_HOME,
  buildVfsEntryWebAppUrl,
  copyVfsEntry,
  createVfsFolder,
  createVfsTextFile,
  getVfsEntry,
  isImageVfsFile,
  listVfsDir,
  moveVfsEntry,
  renameVfsEntry,
  resolveVfsPath,
  trashVfsEntry,
  writeVfsTextFile,
} from "@/lib/engine-web/web-vfs";
import {
  readVfsStateText,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateText,
} from "@/lib/engine/vfs-state";

interface TerminalAppProps {
  initialPath?: string;
  windowId: string;
}

interface OutputSpan {
  text: string;
  className?: string;
}

interface OutputLine {
  id: number;
  prompt?: string;
  text: string;
  tone?: "default" | "muted" | "error" | "accent" | "dir";
  spans?: OutputSpan[];
}

const TERMINAL_COMMANDS = [
  "help",
  "clear",
  "pwd",
  "cd",
  "ls",
  "mkdir",
  "touch",
  "cat",
  "cp",
  "mv",
  "rm",
  "open",
  "notepad",
  "edit",
  "top",
  "ps",
  "uname",
  "whoami",
  "date",
  "echo",
  "env",
  "grep",
  "history",
  "head",
  "tail",
  "wc",
  "sort",
  "curl",
  "wget",
  "piloti",
  "piloti-settings",
  "piloti-console",
  "piloti-shell",
  "piloti-applications",
  "piloti-files",
  "piloti-notepad",
  "piloti-calculator",
  "piloti-image-viewer",
  "piloti-login",
] as const;

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (let i = 1; i < values.length; i++) {
    while (!values[i].startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
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
  { pid: 112, command: "piloti-console", baseCpu: 0.7, baseMem: 2.1 },
  { pid: 118, command: "piloti-menubar", baseCpu: 0.4, baseMem: 1.2 },
  { pid: 124, command: "piloti-dock", baseCpu: 0.5, baseMem: 1.5 },
  { pid: 131, command: "piloti-wm", baseCpu: 1.1, baseMem: 2.6 },
  { pid: 145, command: "piloti-vfsd (localStorage)", baseCpu: 0.2, baseMem: 0.8 },
];

export const TerminalApp: React.FC<TerminalAppProps> = ({ initialPath }) => {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings } = useSettings();
  const {
    lockSession,
    requestPowerAction,
    takeScreenshot,
    startScreenRecording,
  } = useSystemBackends();
  const {
    windows,
    launchApp,
    openWebUrl,
    setLauncherOpen,
    toggleOverview,
  } = useWindowManager();
  const [cwd, setCwd] = React.useState<string>(() => {
    if (initialPath) {
      const entry = getVfsEntry(initialPath);
      if (entry?.kind === "directory") return entry.path;
    }
    return WEB_VFS_HOME;
  });

  const nextIdRef = React.useRef(1);
  const [lines, setLines] = React.useState<OutputLine[]>(() => {
    const issue = getVfsEntry("/etc/issue")?.content?.trimEnd();
    const issueLines = issue
      ? issue.split(/\r?\n/)
      : ["Web Shell — type 'help' for help."];
    return issueLines.map((text) => ({
      id: nextIdRef.current++,
      text,
      tone: "muted" as const,
    }));
  });
  const TERMINAL_HISTORY_KEY = "piloti.web.terminal.history.v1";
  const [input, setInput] = React.useState("");
  const parseTerminalHistory = React.useCallback((raw: string | null): string[] => {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((x): x is string => typeof x === "string" && x.length > 0)
            .slice(-500);
        }
      } catch {
        // fall through to line-based history
      }
    }
    return raw
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .slice(-500);
  }, []);
  const [history, setHistory] = React.useState<string[]>(() =>
    parseTerminalHistory(
      readVfsStateText(VFS_STATE_PATHS.terminalHistory, TERMINAL_HISTORY_KEY)
    )
  );
  React.useEffect(
    () =>
      subscribeVfsPath(VFS_STATE_PATHS.terminalHistory, (raw) => {
        setHistory(parseTerminalHistory(raw));
      }),
    [parseTerminalHistory]
  );
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [reverseSearch, setReverseSearch] = React.useState<{
    active: boolean;
    query: string;
    matchOffset: number;
  }>({ active: false, query: "", matchOffset: 0 });
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

  const runSingleCommand = (
    rawSeg: string,
    activeCwd: string
  ): {
    nextCwd: string;
    output: Array<Omit<OutputLine, "id">>;
    ok: boolean;
  } => {
    const segTrimmed = rawSeg.trim();
    if (!segTrimmed) return { nextCwd: activeCwd, output: [], ok: true };

    let redirectFile: string | null = null;
    let redirectAppend = false;
    let cmdPart = segTrimmed;
    const redirMatch = segTrimmed.match(/^(.*?)\s*(>>|>)\s*(\S+)\s*$/);
    if (redirMatch) {
      cmdPart = redirMatch[1].trim();
      redirectAppend = redirMatch[2] === ">>";
      redirectFile = redirMatch[3];
    }

    const writeRedirect = (linesOut: Array<Omit<OutputLine, "id">>): {
      nextCwd: string;
      output: Array<Omit<OutputLine, "id">>;
      ok: boolean;
    } => {
      if (!redirectFile) {
        return { nextCwd: activeCwd, output: linesOut, ok: true };
      }
      const target = resolveVfsPath(activeCwd, redirectFile);
      const { parent, name } = getParentAndName(target);
      if (!name) {
        return {
          nextCwd: activeCwd,
          output: [{ text: `redirect: invalid path '${redirectFile}'`, tone: "error" }],
          ok: false,
        };
      }
      const textContent = linesOut
        .map((l) =>
          l.spans ? l.spans.map((s) => s.text).join("") : l.text
        )
        .join("\n");
      const existing = getVfsEntry(target);
      if (existing && existing.kind === "file") {
        const nextText = redirectAppend
          ? `${existing.content ?? ""}${existing.content ? "\n" : ""}${textContent}`
          : textContent;
        writeVfsTextFile(target, nextText);
      } else {
        createVfsTextFile(parent, name, textContent);
      }
      return { nextCwd: activeCwd, output: [], ok: true };
    };

    const tokens = splitArgs(cmdPart);
    const cmd = tokens[0];
    const args = tokens.slice(1);
    const curCwd = activeCwd;

    if (cmd === "date") {
      return writeRedirect([{ text: new Date().toString() }]);
    }
    if (cmd === "env") {
      return writeRedirect([
        { text: `USER=user\nHOME=${WEB_VFS_HOME}\nPWD=${curCwd}\nSHELL=/bin/piloti-sh\nXDG_CURRENT_DESKTOP=GNOME` },
      ]);
    }
    if (cmd === "ps") {
      return writeRedirect(
        CORE_DAEMONS.map((d) => ({
          text: `${String(d.pid).padStart(5, " ")} pts/0    00:00:00 ${d.command}`,
        }))
      );
    }
    if (cmd === "echo") {
      return writeRedirect([{ text: args.join(" ") }]);
    }
    if (cmd === "pwd") {
      return writeRedirect([{ text: curCwd }]);
    }
    if (cmd === "whoami") {
      return writeRedirect([{ text: "user" }]);
    }
    if (cmd === "uname") {
      return writeRedirect([
        {
          text: "Linux residence-web 6.12.0-piloti #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux",
        },
      ]);
    }
    if (cmd === "cd") {
      const target = resolveVfsPath(curCwd, args[0] ?? "~");
      const entry = getVfsEntry(target);
      if (!entry) {
        return {
          nextCwd: curCwd,
          output: [
            { text: `cd: no such file or directory: ${args[0] ?? "~"}`, tone: "error" },
          ],
          ok: false,
        };
      }
      if (entry.kind !== "directory") {
        return {
          nextCwd: curCwd,
          output: [{ text: `cd: not a directory: ${args[0]}`, tone: "error" }],
          ok: false,
        };
      }
      setCwd(entry.path);
      return { nextCwd: entry.path, output: [], ok: true };
    }
    return { nextCwd: curCwd, output: [], ok: true };
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    const promptPrefix = `${formatPromptPath(cwd)}> `;
    const commandLine: Omit<OutputLine, "id"> = {
      prompt: promptPrefix,
      text: raw,
      tone: "default",
    };

    if (!trimmed) {
      appendLines([commandLine]);
      return;
    }

    setHistory((prev) => {
      const next = [...prev, trimmed].slice(-500);
      try {
        writeVfsStateText(
          VFS_STATE_PATHS.terminalHistory,
          next.length > 0 ? `${next.join("\n")}\n` : ""
        );
      } catch {
        // ignore storage quota
      }
      return next;
    });
    setHistoryIndex(-1);

    const parsedPipe = parseCommandPipeline(trimmed);
    if (parsedPipe.stages.length > 1 || parsedPipe.redirect) {
      const pipeRes = executeTextPipeline(parsedPipe, cwd, history);
      if (!pipeRes.ok) {
        appendLines([commandLine, { text: pipeRes.error, tone: "error" }]);
      } else if (pipeRes.stdout) {
        appendLines([
          commandLine,
          ...pipeRes.stdout.split(/\r?\n/).map((line) => ({ text: line })),
        ]);
      } else {
        appendLines([commandLine]);
      }
      return;
    }

    if (trimmed.includes("&&")) {
      const segments = trimmed.split(/\s*&&\s*/);
      let cur = cwd;
      const collected: Array<Omit<OutputLine, "id">> = [commandLine];
      for (const seg of segments) {
        const segTokens = splitArgs(seg.replace(/\s*>>?\s*\S+\s*$/, "").trim());
        const segCmd = segTokens[0];
        if (
          segCmd === "date" ||
          segCmd === "env" ||
          segCmd === "ps" ||
          segCmd === "echo" ||
          segCmd === "pwd" ||
          segCmd === "whoami" ||
          segCmd === "uname" ||
          segCmd === "cd"
        ) {
          const res = runSingleCommand(seg, cur);
          cur = res.nextCwd;
          collected.push(...res.output);
          if (!res.ok) break;
        } else {
          // Delegate other commands if single segment without redirect
          break;
        }
      }
      if (collected.length > 1 || segments.every((s) => /^(date|env|ps|echo|pwd|whoami|uname|cd)\b/.test(s.trim()))) {
        appendLines(collected);
        return;
      }
    }

    const tokens = splitArgs(trimmed);
    const cmd = tokens[0];
    const args = tokens.slice(1);

    if (cmd === "date" || cmd === "env" || cmd === "ps") {
      const res = runSingleCommand(trimmed, cwd);
      appendLines([commandLine, ...res.output]);
      return;
    }

    if (cmd === "clear") {
      setLines([]);
      return;
    }

    if (cmd === "help") {
      appendLines([
        commandLine,
        { text: "Piloti Desktop Shell — usage: <command> [args]", tone: "accent" },
        { text: "" },
        { text: "Navigation & Files:", tone: "muted" },
        { text: "  pwd                 Print current working directory" },
        { text: "  cd [dir]            Change directory (default: ~)" },
        { text: "  ls [-la] [dir]      List directory contents" },
        { text: "  mkdir <dir>         Create a directory" },
        { text: "  touch <file>        Create an empty file" },
        { text: "  cat <file>          Print file contents" },
        { text: "  cp <src> <dest>     Copy file or folder" },
        { text: "  mv <src> <dest>     Move or rename file or folder" },
        { text: "  rm <path>           Move file or folder to Trash" },
        { text: "" },
        { text: "Editing & Apps:", tone: "muted" },
        { text: "  open <path|url>     Open file, folder, or web URL" },
        { text: "  edit <file>         Open file in Text Editor" },
        { text: "  notepad <file>      Alias for edit" },
        { text: "  piloti-settings     Open Desktop Settings" },
        { text: "  piloti-console      Open Desktop Console" },
        { text: "  piloti-shell        Open Desktop Shell" },
        { text: "  piloti-applications Open App Store" },
        { text: "  piloti-login        Open Login Screen" },
        { text: "" },
        { text: "System & Process:", tone: "muted" },
        { text: "  ps / top            Show running daemons & windows" },
        { text: "  whoami / uname      Print user and kernel info" },
        { text: "  date / env / echo   Print date, environment, or text" },
        { text: "" },
        { text: "Pipelines, Search & Control:", tone: "muted" },
        { text: "  cmd | grep <pat>    Pipe output & filter lines" },
        { text: "  cmd > / >> <file>   Redirect output (overwrite / append)" },
        { text: "  piloti <subcmd>     Control desktop (run 'piloti help')" },
        { text: "  Ctrl+R              Reverse search command history" },
        { text: "  clear / help        Clear output or show this help" },
      ]);
      return;
    }

    if (cmd === "whoami") {
      appendLines([commandLine, { text: "user" }]);
      return;
    }

    if (cmd === "uname") {
      appendLines([
        commandLine,
        { text: "Linux residence-web 6.12.0-piloti #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" },
      ]);
      return;
    }

    if (cmd === "echo") {
      appendLines([commandLine, { text: args.join(" ") }]);
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

      const items = listVfsDir(entry.path, { includeHidden: showAll });
      if (items.length === 0) {
        appendLines([commandLine]);
        return;
      }

      if (showLong) {
        const rows: Array<Omit<OutputLine, "id">> = items.map((item) => {
          const kindChar = item.kind === "directory" ? "d" : "-";
          const size =
            item.kind === "directory" ? "4096" : String(item.content?.length ?? 0);
          const isDir = item.kind === "directory";
          return {
            text: "",
            spans: [
              {
                text: `${kindChar}rw-r--r--  user  ${size.padStart(6, " ")}  `,
                className: "text-zinc-100",
              },
              {
                text: isDir ? `${item.name}/` : item.name,
                className: isDir ? "font-bold text-blue-400" : "text-zinc-100",
              },
            ],
          };
        });
        appendLines([commandLine, ...rows]);
      } else {
        const spans: OutputSpan[] = [];
        items.forEach((item, index) => {
          if (index > 0) {
            spans.push({ text: "  " });
          }
          const isDir = item.kind === "directory";
          spans.push({
            text: isDir ? `${item.name}/` : item.name,
            className: isDir ? "font-bold text-blue-400" : "text-zinc-100",
          });
        });
        appendLines([commandLine, { text: "", spans }]);
      }
      return;
    }

    if (cmd === "mkdir") {
      const targets = args.filter((a) => !a.startsWith("-"));
      const recursive = args.some((a) => a.startsWith("-") && a.includes("p"));
      if (targets.length === 0) {
        appendLines([
          commandLine,
          { text: "mkdir: missing operand", tone: "error" },
        ]);
        return;
      }
      const out: Array<Omit<OutputLine, "id">> = [commandLine];
      for (const arg of targets) {
        const target = resolveVfsPath(cwd, arg);
        if (recursive) {
          const parts = target.split("/").filter(Boolean);
          let acc = "";
          for (const part of parts) {
            const parent = acc || "/";
            acc = `${acc}/${part}`;
            if (!getVfsEntry(acc)) {
              createVfsFolder(parent, part);
            }
          }
          continue;
        }
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

    if (cmd === "cp") {
      const paths = args.filter((a) => !a.startsWith("-"));
      if (paths.length < 2) {
        appendLines([
          commandLine,
          { text: "cp: missing file operand", tone: "error" },
        ]);
        return;
      }
      const srcPath = resolveVfsPath(cwd, paths[0]);
      const destPath = resolveVfsPath(cwd, paths[1]);
      const srcEntry = getVfsEntry(srcPath);
      if (!srcEntry) {
        appendLines([
          commandLine,
          {
            text: `cp: cannot stat '${paths[0]}': No such file or directory`,
            tone: "error",
          },
        ]);
        return;
      }
      const destEntry = getVfsEntry(destPath);
      if (destEntry?.kind === "directory") {
        copyVfsEntry(srcPath, destPath);
      } else if (srcEntry.kind === "file") {
        const { parent } = getParentAndName(destPath);
        if (!getVfsEntry(parent)) {
          appendLines([
            commandLine,
            {
              text: `cp: cannot create regular file '${paths[1]}': No such directory`,
              tone: "error",
            },
          ]);
          return;
        }
        writeVfsTextFile(destPath, srcEntry.content ?? "");
      } else {
        appendLines([
          commandLine,
          {
            text: `cp: cannot copy directory '${paths[0]}' to non-directory '${paths[1]}'`,
            tone: "error",
          },
        ]);
        return;
      }
      appendLines([commandLine]);
      return;
    }

    if (cmd === "mv") {
      const paths = args.filter((a) => !a.startsWith("-"));
      if (paths.length < 2) {
        appendLines([
          commandLine,
          { text: "mv: missing file operand", tone: "error" },
        ]);
        return;
      }
      const srcPath = resolveVfsPath(cwd, paths[0]);
      const destPath = resolveVfsPath(cwd, paths[1]);
      const srcEntry = getVfsEntry(srcPath);
      if (!srcEntry) {
        appendLines([
          commandLine,
          {
            text: `mv: cannot stat '${paths[0]}': No such file or directory`,
            tone: "error",
          },
        ]);
        return;
      }
      const destEntry = getVfsEntry(destPath);
      if (destEntry?.kind === "directory") {
        moveVfsEntry(srcPath, destPath);
      } else {
        const { parent: destParent, name: destName } = getParentAndName(destPath);
        if (!destName || !getVfsEntry(destParent)) {
          appendLines([
            commandLine,
            {
              text: `mv: cannot move '${paths[0]}' to '${paths[1]}': No such directory`,
              tone: "error",
            },
          ]);
          return;
        }
        if (srcEntry.parentPath === destParent) {
          renameVfsEntry(srcPath, destName);
        } else {
          const moved = moveVfsEntry(srcPath, destParent);
          if (moved && moved.name !== destName) {
            renameVfsEntry(moved.path, destName);
          }
        }
      }
      appendLines([commandLine]);
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
        isImageVfsFile(entry.name, entry.content)
      ) {
        launchApp("image-viewer", { payload: entry.path });
      } else if (
        cmd === "open" &&
        entry &&
        /\.(html?)$/i.test(entry.name)
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

    if (cmd === "history") {
      appendLines([
        commandLine,
        ...history.map((h, i) => ({
          text: `${String(i + 1).padStart(4)}  ${h}`,
        })),
      ]);
      return;
    }

    if (cmd === "grep") {
      const res = runGrepFilter("", args, cwd);
      if (!res.ok) {
        appendLines([commandLine, { text: res.error, tone: "error" }]);
      } else if (res.output) {
        appendLines([
          commandLine,
          ...res.output.split(/\r?\n/).map((line) => ({ text: line })),
        ]);
      } else {
        appendLines([commandLine]);
      }
      return;
    }

    if (cmd === "curl" || cmd === "wget") {
      let outFile: string | null = null;
      let targetUrl: string | null = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if ((a === "-o" || a === "-O") && args[i + 1]) {
          outFile = args[++i];
        } else if (!a.startsWith("-")) {
          targetUrl = a;
        }
      }
      if (!targetUrl) {
        appendLines([
          commandLine,
          { text: `${cmd}: missing URL`, tone: "error" },
        ]);
        return;
      }
      const normalizedUrl = /^https?:\/\//i.test(targetUrl)
        ? targetUrl
        : `https://${targetUrl}`;
      appendLines([
        commandLine,
        { text: `Fetching ${normalizedUrl}...`, tone: "muted" },
      ]);
      void fetch(normalizedUrl)
        .then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            appendLines([
              {
                text: `${cmd}: HTTP ${res.status} ${res.statusText}`,
                tone: "error",
              },
            ]);
            return;
          }
          if (outFile) {
            const dest = resolveVfsPath(cwd, outFile);
            writeVfsTextFile(dest, text);
            appendLines([
              {
                text: `Saved ${text.length} bytes to ${dest}`,
                tone: "accent",
              },
            ]);
          } else {
            const lines = text.split(/\r?\n/).slice(0, 80);
            appendLines(lines.map((line) => ({ text: line })));
            if (text.split(/\r?\n/).length > 80) {
              appendLines([
                { text: "... (truncated; use -o <file> to save full response)", tone: "muted" },
              ]);
            }
          }
        })
        .catch((err) => {
          appendLines([
            {
              text: `${cmd}: failed to fetch (${err instanceof Error ? err.message : String(err)} — CORS or network blocked)`,
              tone: "error",
            },
          ]);
        });
      return;
    }

    if (cmd === "piloti") {
      const sub = (args[0] ?? "help").toLowerCase();
      if (sub === "help" || sub === "--help" || sub === "-h") {
        appendLines([
          commandLine,
          { text: "piloti — Piloti Desktop control metacommand", tone: "accent" },
          { text: "  piloti add|install <url>       Install web app (.desktop in ~/.local/share/applications)" },
          { text: "  piloti del|remove|uninstall <url|id>  Remove installed web app" },
          { text: "  piloti list                    List installed web apps" },
          { text: "  piloti open <app|url>          Launch app or open URL" },
          { text: "  piloti settings [pane]         Open Desktop Settings" },
          { text: "  piloti launcher | overview     Open Launcher or Overview" },
          { text: "  piloti screenshot | record     Take screenshot or start recording" },
          { text: "  piloti lock | logout | restart | poweroff" },
        ]);
        return;
      }
      if (sub === "add" || sub === "install") {
        const rawUrl = args[1];
        const canonical = canonicalizeWebUrl(rawUrl);
        if (!canonical) {
          appendLines([
            commandLine,
            { text: "piloti install: valid http(s) URL required", tone: "error" },
          ]);
          return;
        }
        const hostTitle = new URL(canonical).hostname.replace(/^www\./, "");
        const app = {
          id: `web:${canonical}`,
          title: hostTitle,
          url: canonical,
          iconUrl: getWebAppFaviconUrl(canonical),
          category: "Internet",
        };
        appendLines([
          commandLine,
          { text: `Installing ${canonical}...`, tone: "muted" },
        ]);
        void installWebAppDesktopEntry(domicile, isBrowserRuntime, app).then(
          () => {
            void fetchWebPageMetadata(canonical).then(({ title, iconUrl, startUrl }) => {
              if (title || iconUrl || startUrl) {
                void installWebAppDesktopEntry(domicile, isBrowserRuntime, {
                  ...app,
                  ...(title ? { title } : {}),
                  ...(iconUrl ? { iconUrl } : {}),
                  ...(startUrl ? { url: startUrl } : {}),
                });
              }
            });
            appendLines([
              { text: `Installed ${hostTitle} (${canonical})`, tone: "accent" },
            ]);
          },
        );
        return;
      }
      if (sub === "del" || sub === "remove" || sub === "uninstall") {
        const target = args[1];
        if (!target) {
          appendLines([
            commandLine,
            { text: "piloti remove: URL or app ID required", tone: "error" },
          ]);
          return;
        }
        const canonical = canonicalizeWebUrl(target);
        const match = settings.installedWebApps.find(
          (w) =>
            w.id === target ||
            (canonical !== undefined &&
              (canonicalizeWebUrl(w.url) ?? w.url) === canonical),
        );
        const toRemove = match ?? {
          id: target,
          url: canonical ?? target,
        };
        void removeWebAppDesktopEntry(domicile, isBrowserRuntime, toRemove).then(
          () => {
            appendLines([
              { text: `Removed ${toRemove.id}`, tone: "accent" },
            ]);
          },
        );
        appendLines([commandLine]);
        return;
      }
      if (sub === "list") {
        appendLines([
          commandLine,
          ...(settings.installedWebApps.length === 0
            ? [{ text: "No web apps installed.", tone: "muted" as const }]
            : settings.installedWebApps.map((w) => ({
                text: `${w.id.padEnd(20)} ${w.title} (${w.url})`,
              }))),
        ]);
        return;
      }
      if (sub === "poweroff" || sub === "restart" || sub === "logout") {
        appendLines([commandLine, { text: `Requesting ${sub}...`, tone: "muted" }]);
        requestPowerAction(sub);
        return;
      }
      if (sub === "lock") {
        appendLines([commandLine]);
        lockSession();
        return;
      }
      if (sub === "overview") {
        appendLines([commandLine]);
        toggleOverview();
        return;
      }
      if (sub === "launcher") {
        appendLines([commandLine]);
        setLauncherOpen(true);
        return;
      }
      if (sub === "settings") {
        appendLines([commandLine]);
        launchApp("settings", args[1] ? { payload: args[1] } : undefined);
        return;
      }
      if (sub === "screenshot") {
        appendLines([commandLine]);
        void takeScreenshot();
        return;
      }
      if (sub === "record") {
        appendLines([commandLine]);
        void startScreenRecording();
        return;
      }
      if (sub === "open" && args[1]) {
        appendLines([commandLine]);
        if (/^https?:\/\//i.test(args[1])) {
          openWebUrl(args[1]);
        } else {
          launchApp(args[1]);
        }
        return;
      }
      appendLines([
        commandLine,
        { text: `piloti: unknown subcommand '${sub}' (try 'piloti help')`, tone: "error" },
      ]);
      return;
    }

    const builtinCmdMap: Record<string, string> = {
      "piloti-settings": "settings",
      "piloti-console": "console",
      "piloti-desktop": "console",
      "piloti-devtools": "console",
      "piloti-shell": "terminal",
      "piloti-terminal": "terminal",
      "piloti-applications": "app-store",
      "piloti-app-store": "app-store",
      "piloti-files": "nautilus",
      "piloti-notepad": "text-editor",
      "piloti-calculator": "calculator",
      "piloti-image-viewer": "image-viewer",
      "piloti-login": "login-screen",
    };

    if (builtinCmdMap[cmd]) {
      appendLines([commandLine]);
      launchApp(
        builtinCmdMap[cmd],
        args[0] ? { payload: args[0] } : undefined,
      );
      return;
    }

    appendLines([
      commandLine,
      { text: `${cmd}: command not found`, tone: "error" },
    ]);
  };

  const moveCursorToEnd = () => {
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  };

  const handleTabComplete = () => {
    const beforeSpace = !/\s/.test(input);
    if (beforeSpace) {
      const matches = TERMINAL_COMMANDS.filter((c) => c.startsWith(input));
      if (matches.length === 1) {
        setInput(`${matches[0]} `);
        moveCursorToEnd();
      } else if (matches.length > 1) {
        const lcp = longestCommonPrefix(matches);
        if (lcp.length > input.length) {
          setInput(lcp);
          moveCursorToEnd();
        } else {
          appendLines([
            { prompt: `${formatPromptPath(cwd)}> `, text: input },
            { text: matches.join("  "), tone: "muted" },
          ]);
        }
      }
      return;
    }

    const lastSpaceIdx = input.search(/\S+$/);
    const prefixStart = lastSpaceIdx === -1 ? input.length : lastSpaceIdx;
    const head = input.slice(0, prefixStart);
    const token = input.slice(prefixStart);
    const slashIdx = token.lastIndexOf("/");
    const dirPart = slashIdx >= 0 ? token.slice(0, slashIdx + 1) : "";
    const namePart = slashIdx >= 0 ? token.slice(slashIdx + 1) : token;
    const searchDir = dirPart ? resolveVfsPath(cwd, dirPart) : cwd;
    const entries = listVfsDir(searchDir, {
      includeHidden: namePart.startsWith("."),
    });
    const matches = entries.filter((item) => item.name.startsWith(namePart));
    if (matches.length === 1) {
      const m = matches[0];
      const completed = `${dirPart}${m.name}${m.kind === "directory" ? "/" : " "}`;
      setInput(`${head}${completed}`);
      moveCursorToEnd();
    } else if (matches.length > 1) {
      const lcp = longestCommonPrefix(matches.map((m) => m.name));
      if (lcp.length > namePart.length) {
        setInput(`${head}${dirPart}${lcp}`);
        moveCursorToEnd();
      } else {
        appendLines([
          { prompt: `${formatPromptPath(cwd)}> `, text: input },
          {
            text: "",
            spans: matches.flatMap((m, i) => [
              ...(i > 0 ? [{ text: "  " }] : []),
              {
                text: m.kind === "directory" ? `${m.name}/` : m.name,
                className:
                  m.kind === "directory"
                    ? "font-bold text-blue-400"
                    : "text-zinc-100",
              },
            ]),
          },
        ]);
      }
    }
  };

  const inlineCompletion = React.useMemo(() => {
    if (!input || reverseSearch.active) return undefined;
    const lower = input.toLowerCase();
    if (!/\s/.test(input)) {
      const cmdMatch = TERMINAL_COMMANDS.find(
        (c) => c.startsWith(input) && c.length > input.length
      );
      if (cmdMatch) return cmdMatch;
      for (let i = history.length - 1; i >= 0; i -= 1) {
        const item = history[i];
        if (item.toLowerCase().startsWith(lower) && item.length > input.length) {
          return item;
        }
      }
      return undefined;
    }

    const lastSpaceIdx = input.search(/\S+$/);
    const prefixStart = lastSpaceIdx === -1 ? input.length : lastSpaceIdx;
    const head = input.slice(0, prefixStart);
    const token = input.slice(prefixStart);
    if (token.length > 0) {
      const slashIdx = token.lastIndexOf("/");
      const dirPart = slashIdx >= 0 ? token.slice(0, slashIdx + 1) : "";
      const namePart = slashIdx >= 0 ? token.slice(slashIdx + 1) : token;
      const searchDir = dirPart ? resolveVfsPath(cwd, dirPart) : cwd;
      const entries = listVfsDir(searchDir, {
        includeHidden: namePart.startsWith("."),
      });
      const match = entries.find((item) => item.name.startsWith(namePart));
      if (match) {
        const candidate = `${head}${dirPart}${match.name}${match.kind === "directory" ? "/" : ""}`;
        if (candidate.length > input.length) {
          return candidate;
        }
      }
    }

    for (let i = history.length - 1; i >= 0; i -= 1) {
      const item = history[i];
      if (item.toLowerCase().startsWith(lower) && item.length > input.length) {
        return item;
      }
    }
    return undefined;
  }, [cwd, history, input, reverseSearch.active]);

  const reverseMatches = React.useMemo(() => {
    if (!reverseSearch.active) return [];
    const q = reverseSearch.query.toLowerCase();
    const out: string[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      if (!q || item.toLowerCase().includes(q)) {
        if (!out.includes(item)) out.push(item);
      }
    }
    return out;
  }, [history, reverseSearch.active, reverseSearch.query]);

  const activeReverseMatch = reverseSearch.active
    ? (reverseMatches[reverseSearch.matchOffset] ?? "")
    : "";

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      e.stopPropagation();
      setReverseSearch((prev) =>
        prev.active
          ? {
              ...prev,
              matchOffset:
                reverseMatches.length > 0
                  ? (prev.matchOffset + 1) % reverseMatches.length
                  : 0,
            }
          : { active: true, query: "", matchOffset: 0 },
      );
      return;
    }
    if (reverseSearch.active) {
      if (e.key === "Escape" || (e.ctrlKey && e.key.toLowerCase() === "c")) {
        e.preventDefault();
        setReverseSearch({ active: false, query: "", matchOffset: 0 });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosen = activeReverseMatch;
        setReverseSearch({ active: false, query: "", matchOffset: 0 });
        if (chosen) {
          setInput("");
          runCommand(chosen);
        }
        return;
      }
      if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        if (activeReverseMatch) {
          setInput(activeReverseMatch);
          moveCursorToEnd();
        }
        setReverseSearch({ active: false, query: "", matchOffset: 0 });
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setReverseSearch((prev) => ({
          active: true,
          query: prev.query.slice(0, -1),
          matchOffset: 0,
        }));
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setReverseSearch((prev) => ({
          active: true,
          query: prev.query + e.key,
          matchOffset: 0,
        }));
        return;
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      handleTabComplete();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const value = input;
      setInput("");
      runCommand(value);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (history.length === 0) return;
      const nextIdx =
        historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInput(history[nextIdx] ?? "");
      moveCursorToEnd();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (historyIndex === -1) return;
      if (historyIndex >= history.length - 1) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx] ?? "");
      }
      moveCursorToEnd();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      appendLines([
        { prompt: `${formatPromptPath(cwd)}> `, text: `${input}^C` },
      ]);
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
      className="h-full w-full cursor-text overflow-auto bg-zinc-950 p-3 font-mono text-[13px] leading-relaxed text-zinc-100 select-text"
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
                    ? "whitespace-pre-wrap font-bold text-blue-400"
                    : "whitespace-pre-wrap text-zinc-100"
          }
        >
          {line.prompt && (
            <span className="text-emerald-400">{line.prompt}</span>
          )}
          {line.spans
            ? line.spans.map((span, idx) => (
              <span key={idx} className={span.className}>
                {span.text}
              </span>
            ))
            : line.text || (line.prompt ? "" : "\u00A0")}
        </div>
      ))}
      {reverseSearch.active && (
        <div className="mb-1 flex items-center gap-1.5 text-[12px] text-amber-300">
          <span>(reverse-i-search)`{reverseSearch.query}`:</span>
          <span className="text-zinc-100">
            {activeReverseMatch || "(no match)"}
          </span>
        </div>
      )}
      <div className="flex items-center">
        <span className="shrink-0 whitespace-pre text-emerald-400">
          {formatPromptPath(cwd)}&gt;{" "}
        </span>
        <InlineCompletionInput
          ref={inputRef}
          type="text"
          value={input}
          completion={inlineCompletion}
          onAcceptCompletion={(completed) => {
            const next =
              !/\s/.test(completed) &&
              (TERMINAL_COMMANDS as readonly string[]).includes(completed)
                ? `${completed} `
                : completed;
            setInput(next);
            moveCursorToEnd();
          }}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Terminal input"
          ghostClassName="text-zinc-500"
          className="font-mono text-[13px] leading-relaxed text-zinc-100"
        />
      </div>
    </div>
  );
};
