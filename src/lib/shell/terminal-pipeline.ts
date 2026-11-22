import {
  getVfsEntry,
  listVfsDir,
  resolveVfsPath,
  WEB_VFS_HOME,
  writeVfsTextFile,
} from "@/lib/engine-web/web-vfs";

export interface ParsedRedirect {
  mode: "overwrite" | "append";
  target: string;
}

export interface ParsedPipeline {
  stages: string[][];
  redirect: ParsedRedirect | null;
}

export function tokenizeShellSegment(input: string): string[] {
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

export function splitUnquotedPipes(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === "|") {
      segments.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  segments.push(current.trim());
  return segments.filter(Boolean);
}

export function parseCommandPipeline(raw: string): ParsedPipeline {
  const pipeSegments = splitUnquotedPipes(raw);
  let redirect: ParsedRedirect | null = null;

  const stages = pipeSegments.map((seg, idx) => {
    const tokens = tokenizeShellSegment(seg);
    if (idx !== pipeSegments.length - 1) return tokens;

    const cleaned: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if ((tok === ">" || tok === ">>") && tokens[i + 1]) {
        redirect = {
          mode: tok === ">>" ? "append" : "overwrite",
          target: tokens[++i],
        };
      } else if (tok.startsWith(">>") && tok.length > 2) {
        redirect = { mode: "append", target: tok.slice(2) };
      } else if (tok.startsWith(">") && tok.length > 1) {
        redirect = { mode: "overwrite", target: tok.slice(1) };
      } else {
        cleaned.push(tok);
      }
    }
    return cleaned;
  });

  return { stages, redirect };
}

export function runGrepFilter(
  inputText: string,
  args: readonly string[],
  cwd: string,
): { ok: true; output: string } | { ok: false; error: string } {
  let ignoreCase = false;
  let invert = false;
  let lineNumbers = false;
  const positional: string[] = [];

  for (const a of args) {
    if (a.startsWith("-") && a.length > 1) {
      for (const ch of a.slice(1)) {
        if (ch === "i") ignoreCase = true;
        else if (ch === "v") invert = true;
        else if (ch === "n") lineNumbers = true;
      }
    } else {
      positional.push(a);
    }
  }

  const pattern = positional[0];
  if (!pattern) {
    return { ok: false, error: "grep: missing pattern" };
  }

  let sourceText = inputText;
  const fileArgs = positional.slice(1);
  if (fileArgs.length > 0) {
    const chunks: string[] = [];
    for (const f of fileArgs) {
      const resolved = resolveVfsPath(cwd, f);
      const entry = getVfsEntry(resolved);
      if (!entry) {
        return { ok: false, error: `grep: ${f}: No such file or directory` };
      }
      if (entry.kind === "directory") {
        return { ok: false, error: `grep: ${f}: Is a directory` };
      }
      chunks.push(entry.content ?? "");
    }
    sourceText = chunks.join("\n");
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, ignoreCase ? "i" : "");
  } catch {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(escaped, ignoreCase ? "i" : "");
  }

  const lines = sourceText.split(/\r?\n/);
  const matched: string[] = [];
  lines.forEach((line, idx) => {
    const isMatch = regex.test(line);
    if (invert ? !isMatch : isMatch) {
      matched.push(lineNumbers ? `${idx + 1}:${line}` : line);
    }
  });
  return { ok: true, output: matched.join("\n") };
}

export function executeTextPipeline(
  parsed: ParsedPipeline,
  cwd: string,
  history: readonly string[],
): { ok: true; stdout: string; redirectedTo?: string } | { ok: false; error: string } {
  let stdin = "";

  for (const tokens of parsed.stages) {
    const cmd = tokens[0];
    const args = tokens.slice(1);
    if (!cmd) continue;

    if (cmd === "echo") {
      stdin = args.join(" ");
    } else if (cmd === "pwd") {
      stdin = cwd;
    } else if (cmd === "whoami") {
      stdin = "user";
    } else if (cmd === "uname") {
      stdin = args.includes("-a")
        ? "Linux piloti-web 6.8.0-piloti #1 SMP PREEMPT x86_64 GNU/Linux"
        : "Linux";
    } else if (cmd === "date") {
      stdin = new Date().toString();
    } else if (cmd === "env") {
      stdin = [
        `HOME=${WEB_VFS_HOME}`,
        `PWD=${cwd}`,
        "USER=user",
        "SHELL=/bin/piloti-sh",
        "XDG_CURRENT_DESKTOP=Piloti",
      ].join("\n");
    } else if (cmd === "history") {
      stdin = history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join("\n");
    } else if (cmd === "ls") {
      const showAll = args.some((a) => a.startsWith("-") && a.includes("a"));
      const targetArg = args.find((a) => !a.startsWith("-"));
      const target = resolveVfsPath(cwd, targetArg);
      const entry = getVfsEntry(target);
      if (!entry) {
        return { ok: false, error: `ls: cannot access '${targetArg ?? "."}': No such file or directory` };
      }
      if (entry.kind !== "directory") {
        stdin = entry.name;
      } else {
        stdin = listVfsDir(entry.path, { includeHidden: showAll })
          .map((e) => (e.kind === "directory" ? `${e.name}/` : e.name))
          .join("\n");
      }
    } else if (cmd === "cat") {
      const files = args.filter((a) => !a.startsWith("-"));
      if (files.length === 0) {
        // pass stdin through
      } else {
        const parts: string[] = [];
        for (const f of files) {
          const entry = getVfsEntry(resolveVfsPath(cwd, f));
          if (!entry) return { ok: false, error: `cat: ${f}: No such file or directory` };
          if (entry.kind === "directory") return { ok: false, error: `cat: ${f}: Is a directory` };
          parts.push(entry.content ?? "");
        }
        stdin = parts.join("\n");
      }
    } else if (cmd === "grep") {
      const res = runGrepFilter(stdin, args, cwd);
      if (!res.ok) return res;
      stdin = res.output;
    } else if (cmd === "wc") {
      const linesCount = stdin ? stdin.split(/\r?\n/).length : 0;
      const wordsCount = stdin.trim() ? stdin.trim().split(/\s+/).length : 0;
      const bytesCount = stdin.length;
      if (args.includes("-l")) stdin = String(linesCount);
      else if (args.includes("-w")) stdin = String(wordsCount);
      else if (args.includes("-c")) stdin = String(bytesCount);
      else stdin = `${linesCount} ${wordsCount} ${bytesCount}`;
    } else if (cmd === "head" || cmd === "tail") {
      let count = 10;
      const nIdx = args.indexOf("-n");
      if (nIdx !== -1 && args[nIdx + 1]) {
        const parsedN = Number.parseInt(args[nIdx + 1], 10);
        if (Number.isFinite(parsedN) && parsedN >= 0) count = parsedN;
      }
      const lines = stdin.split(/\r?\n/);
      stdin = (cmd === "head" ? lines.slice(0, count) : lines.slice(-count)).join("\n");
    } else if (cmd === "sort") {
      const lines = stdin.split(/\r?\n/).sort();
      if (args.includes("-r")) lines.reverse();
      stdin = lines.join("\n");
    } else {
      return { ok: false, error: `${cmd}: command not supported in pipeline` };
    }
  }

  if (parsed.redirect) {
    const destPath = resolveVfsPath(cwd, parsed.redirect.target);
    const existing = getVfsEntry(destPath);
    if (existing?.kind === "directory") {
      return { ok: false, error: `${parsed.redirect.target}: Is a directory` };
    }
    const nextContent =
      parsed.redirect.mode === "append" && existing?.content
        ? `${existing.content.replace(/\n$/, "")}\n${stdin}\n`
        : `${stdin}\n`;
    writeVfsTextFile(destPath, nextContent);
    return { ok: true, stdout: "", redirectedTo: destPath };
  }

  return { ok: true, stdout: stdin };
}

