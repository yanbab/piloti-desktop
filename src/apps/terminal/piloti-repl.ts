/**
 * The "piloti-shell" terminal mode: a JavaScript REPL whose scope is the
 * desktop (windows, settings, launching apps...). It speaks the terminal's
 * byte stream, so any xterm-like emulator can sit on top of it.
 *
 * A line is JavaScript, or a command: `name arg 'other arg'` calls
 * `name("arg", "other arg")` when `name` is a function of the scope, else runs
 * the program `name` of `$PATH`.
 */
import type { Completion } from "@/apps/terminal/piloti-completion";
import { compileScript } from "@/apps/terminal/piloti-script";
import { createLoopGuard, guardLoops, Interrupted } from "@/apps/terminal/piloti-loops";
import { formatTable, tableRows } from "@/apps/terminal/piloti-table";

export interface ProgramRunner {
  /** Whether `name` (or a path) can be run. */
  has: (name: string) => Promise<boolean>;
  /**
   * Runs it in the terminal. `attach` takes what is typed meanwhile. Resolves
   * with what is left to print, if anything.
   */
  run: (argv: string[], attach: (input: (data: string) => void) => void) => Promise<unknown>;
}

export interface ReplOptions {
  /** Writes terminal output. */
  write: (text: string) => void;
  /** Names usable in a line, e.g. `{ launch, windows }`. */
  scope: () => Record<string, unknown>;
  prompt?: string | (() => string);
  /** Functions whose command arguments are always text (`touch 1`), with `*` expanded. */
  textCommands?: ReadonlySet<string>;
  glob?: (word: string) => Promise<string[]>;
  programs?: ProgramRunner;
  /** Words that stand for others at the start of a line. */
  aliases?: ReadonlyMap<string, string>;
  /** Tab completion of the text left of the cursor. */
  complete?: (text: string) => Promise<Completion>;
  /** Terminal width, to redraw lines that wrap. */
  columns?: () => number;
}

const AsyncFunction = Object.getPrototypeOf(async function () {
  /* constructor access */
}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;

/** The native shell's content security policy forbids `eval`. */
const NEEDS_EVAL = "Loops, blocks and scripts need eval, which this shell's security policy blocks.";
const BLOCK_STATEMENT = /^\s*(for|while|do|if|switch|try|function|class|async\s+function)\b/;

/** `evaluateLine` where `eval` is blocked: expressions and simple statements. */
export async function evaluateWithoutEval(code: string, scope: Record<string, unknown>): Promise<unknown> {
  if (BLOCK_STATEMENT.test(code)) throw new Error(NEEDS_EVAL);
  const { evaluateCspSafe } = await import("@/lib/core/csp-repl-eval");
  return evaluateCspSafe(code, scope);
}

/** Evaluates a line as an expression, else as statements, with `scope` in reach. */
export async function evaluateLine(code: string, scope: Record<string, unknown>): Promise<unknown> {
  const typed = code;
  const names = Object.keys(scope);
  const values = names.map((n) => scope[n]);
  if (scope.__loop) code = guardLoops(code);
  let fn: (...values: unknown[]) => Promise<unknown>;
  try {
    fn = new AsyncFunction(...names, `return (${code}\n)`);
  } catch (error) {
    if (error instanceof EvalError) return evaluateWithoutEval(typed, scope);
    fn = new AsyncFunction(...names, code);
  }
  return fn(...values);
}

export interface CommandWord {
  text: string;
  /** `quoted` is always text; `js` is evaluated (`$name`, `$(...)`, `{...}`, `[...]`). */
  kind: "bare" | "quoted" | "js";
}

/** Index after the bracket closing the one at `start`, skipping strings; -1 if none. */
function closing(source: string, start: number): number {
  let depth = 0;
  let quote = "";
  for (let i = start; i < source.length; i += 1) {
    const c = source[i]!;
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = "";
    } else if (c === "'" || c === '"' || c === "`") quote = c;
    else if ("([{".includes(c)) depth += 1;
    else if (")]}".includes(c) && --depth === 0) return i + 1;
  }
  return -1;
}

export function splitWords(source: string): CommandWord[] {
  const words: CommandWord[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i]!)) {
      i += 1;
      continue;
    }
    const open = source[i] === "$" && source[i + 1] === "(" ? i + 1 : i;
    if ("([{".includes(source[open]!)) {
      const end = closing(source, open);
      if (end !== -1 && (end === source.length || /\s/.test(source[end]!))) {
        words.push({ text: source.slice(open, end), kind: "js" });
        i = end;
        continue;
      }
    }
    let text = "";
    let quoted = false;
    while (i < source.length && !/\s/.test(source[i]!)) {
      const c = source[i]!;
      if (c === "'" || c === '"') {
        quoted = true;
        for (i += 1; i < source.length && source[i] !== c; i += 1) {
          if (c === '"' && source[i] === "\\" && '"\\'.includes(source[i + 1] ?? "")) i += 1;
          text += source[i];
        }
        if (i >= source.length) throw new Error(`Missing closing ${c}`);
        i += 1;
      } else if (c === "\\" && i + 1 < source.length) {
        quoted = true;
        text += source[i + 1];
        i += 2;
      } else {
        text += c;
        i += 1;
      }
    }
    const variable = !quoted && /^\$[A-Za-z_][\w.]*$/.test(text);
    words.push({ text: variable ? text.slice(1) : text, kind: variable ? "js" : quoted ? "quoted" : "bare" });
  }
  return words;
}

/** The function and words of a command line, or `null` if the line is JavaScript. */
export function parseCommand(line: string, scope: Record<string, unknown>) {
  const match = /^([A-Za-z_]\w*)(?:\s+([\s\S]*))?$/.exec(line.trim());
  if (!match) return null;
  const [, name, rest = ""] = match;
  if (!Object.hasOwn(scope, name!) || typeof scope[name!] !== "function") return null;
  // `name = 1`, `name (x)`, `name + 1`, `name ? a : b` stay JavaScript.
  if (OPERATOR.test(rest)) return null;
  return { name: name!, rest };
}

const LITERAL = /^(true|false|null|undefined|-?\d+(\.\d+)?)$/;

const OPERATOR = /^([=(,?]|(\+|-|\*\*?|\/|%|<|>|<=|>=|!==?|&&|\|\||\?\?|in|instanceof)(\s|=|$))/;
const KEYWORDS = new Set(
  "async await break case catch class const continue debugger default delete do else false for function if import let new null return super switch this throw true try typeof undefined var void while with yield".split(" "),
);

/** The program and words of a line that runs one, or `null`. */
export async function parseProgram(line: string, scope: Record<string, unknown>, programs: ProgramRunner) {
  const match = /^((?:\.{1,2}|~)?\/[^\s'"()]*[^\s'"()/]|[A-Za-z_][\w.+-]*)(?:\s+([\s\S]*))?$/.exec(line.trim());
  if (!match) return null;
  const [, name, rest = ""] = match;
  if (KEYWORDS.has(name!) || Object.hasOwn(scope, name!)) return null;
  // Redirections look like operators too: they are reported below.
  if (/^[=(,?]/.test(rest) || !(await programs.has(name!))) return null;
  return { name: name!, rest };
}

type Evaluate = (code: string) => Promise<unknown>;

async function programArgs(
  rest: string,
  evaluate: Evaluate,
  glob?: ReplOptions["glob"],
): Promise<string[]> {
  const args: string[] = [];
  for (const { text, kind } of splitWords(rest)) {
    if (kind === "quoted") args.push(text);
    else if (kind === "js") {
      // `[` and `{}` are ordinary words to programs; `$x` and `$(...)` are values.
      const value = await evaluate(text);
      args.push(typeof value === "object" ? JSON.stringify(value) : String(value));
    } else if (/^(\|\|?|&&?|;|\d?>>?.*|<.*)$/.test(text)) {
      throw new Error(`${text}: pipes and redirections are not supported (try: sh -c '...')`);
    } else args.push(...(glob ? await glob(text) : [text]));
  }
  return args;
}

export function expandAliases(line: string, aliases: ReadonlyMap<string, string>): string {
  const seen = new Set<string>();
  let expanded = line.trim();
  for (;;) {
    const match = /^([\w.-]+)(\s[\s\S]*)?$/.exec(expanded);
    const [, name = "", rest = ""] = match ?? [];
    const value = aliases.get(name);
    // Once each, so `alias ls='ls -a'` ends; `ll = 1` stays JavaScript.
    if (value === undefined || seen.has(name) || OPERATOR.test(rest.trim())) return expanded;
    seen.add(name);
    expanded = value + rest;
  }
}

/** Runs a command line, a script or a program, or evaluates JavaScript. */
export async function runLine(
  line: string,
  scope: Record<string, unknown>,
  { textCommands, glob, programs, aliases }: Pick<ReplOptions, "textCommands" | "glob" | "programs" | "aliases"> = {},
  attach: (input: (data: string) => void) => void = () => {},
  {
    evaluate = (code) => evaluateLine(code, scope),
    onAll,
  }: { evaluate?: Evaluate; /** `-a`: show every column. */ onAll?: () => void } = {},
): Promise<unknown> {
  if (aliases) line = expandAliases(line, aliases);
  const script = /^[^\s'"()=]+\.psh$/.exec(line.trim())?.[0];
  if (script?.includes("/") && typeof scope.source === "function") return scope.source(script);
  const program = programs && (await parseProgram(line, scope, programs));
  if (program) {
    return programs.run([program.name, ...(await programArgs(program.rest, evaluate, glob))], attach);
  }
  const command = parseCommand(line, scope);
  if (!command) return evaluateLine(line, scope);
  const asText = textCommands?.has(command.name) ?? false;
  const args: unknown[] = [];
  for (const { text, kind } of splitWords(command.rest)) {
    // For `cat` and functions without options of their own, `-a` is about the table.
    if (kind === "bare" && text === "-a" && (!asText || command.name === "cat")) onAll?.();
    else if (kind === "js") args.push(await evaluate(text));
    else if (kind === "quoted") args.push(text);
    else if (asText) args.push(...(glob ? await glob(text) : [text]));
    else args.push(LITERAL.test(text) ? await evaluateLine(text, {}) : text);
  }
  return (scope[command.name] as (...a: unknown[]) => unknown)(...args);
}

export function formatValue(value: unknown, columns?: number, all?: boolean): string {
  if (value === undefined) return "";
  const rows = tableRows(value);
  if (rows) return formatTable(rows, { columns, all });
  if (typeof value === "string") return value;
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

const KEY = /\x1b\[[0-9;]*[A-Za-z~]|\x1b.|[\s\S]/g;
const CRLF = (s: string) => s.replace(/\r?\n/g, "\r\n");

export function createRepl({ write, scope, prompt = "piloti> ", textCommands, glob, programs, aliases, complete, columns }: ReplOptions) {
  let line = "";
  let cursor = 0;
  const history: string[] = [];
  let historyIndex = -1;
  let busy = false;
  /** Takes the keys while a program runs. */
  let input: ((data: string) => void) | null = null;
  let tabbed = false;
  let interrupted = false;
  let depth = 0;

  // Rows between the start of the prompt and the cursor.
  let cursorRow = 0;
  const redraw = () => {
    const text = typeof prompt === "function" ? prompt() : prompt;
    const textLength = text.replace(/\x1b\[[0-9;]*m/g, "").length;
    const width = columns?.() || Number.MAX_SAFE_INTEGER;
    const length = textLength + line.length;
    const at = textLength + cursor;
    write(`${cursorRow ? `\x1b[${cursorRow}A` : ""}\r\x1b[J${text}${line}`);
    // A full last row leaves the cursor on it until something more is written.
    if (length % width === 0) write("\r\n");
    cursorRow = Math.floor(at / width);
    const up = Math.floor(length / width) - cursorRow;
    if (up) write(`\x1b[${up}A`);
    if (up || cursor < line.length) write(`\r${at % width ? `\x1b[${at % width}C` : ""}`);
  };
  /** Leaves the edited line on screen and starts below it. */
  const newLine = (mark = "") => {
    if (cursor < line.length) {
      cursor = line.length;
      redraw();
    }
    write(`${mark}\r\n`);
    cursorRow = 0;
  };

  const printError = (error: unknown) =>
    write(`\x1b[31m${CRLF(String(error instanceof Error ? error.message : error))}\x1b[0m\r\n`);

  const options = { textCommands, glob, programs, aliases };
  const guard = createLoopGuard(() => interrupted);
  /** The scope, plus what the checks inside loops call. */
  const names = () => ({ ...scope(), __loop: guard });

  const execute = async (code: string, evaluate?: (expression: string) => Promise<unknown>) => {
    let all = false;
    const value = await runLine(code, names(), options, (to) => (input = to), {
      evaluate,
      onAll: () => (all = true),
    });
    input = null;
    const out = formatValue(value, columns?.(), all);
    if (out) write(`${CRLF(out)}\r\n`);
  };

  /** Whether a script line is a command; `declared` are the script's own names. */
  const isCommand = async (line: string, declared: ReadonlySet<string>, own: Set<string>) => {
    const [first = ""] = line.split(/\s/);
    const defined = /^alias\s+([\w.-]+)=/.exec(line)?.[1];
    if (defined) own.add(defined);
    if (declared.has(first)) return false;
    const expanded = expandAliases(line, aliases ?? new Map());
    // An alias the script itself sets is not there yet.
    if (own.has(first) || expanded !== line) return true;
    const names = scope();
    if (parseCommand(line, names) || /^[^\s'"()=]*\/[^\s'"()=]*\.psh$/.test(line)) return true;
    return !!programs && !!(await parseProgram(line, names, programs));
  };

  /**
   * Runs a script as one program: JavaScript in which a line may be a command.
   * `#` starts a comment line. With `keepGoing`, a failed command does not end it.
   */
  const runScript = async (source: string, name: string, { keepGoing = false } = {}) => {
    if (depth >= 8) throw new Error(`${name}: scripts nested too deep`);
    depth += 1;
    const reported = new WeakSet<Error>();
    const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
    let count = 0;
    const sh = async (line: string, values: Record<string, () => Promise<unknown>>, at: number) => {
      // Let the keys in now and then, so Ctrl+C can end a loop.
      if (++count % 20 === 0) await new Promise((done) => setTimeout(done, 0));
      if (interrupted) throw new Interrupted();
      try {
        await execute(line, (code) => values[code]?.() ?? evaluateLine(code, names()));
      } catch (error) {
        input = null;
        if (error instanceof Interrupted) throw error;
        const located = new Error(`${name}:${at}: ${messageOf(error)}`);
        reported.add(located);
        if (!keepGoing) throw located;
        printError(located);
      }
    };
    try {
      const own = new Set<string>();
      const body = await compileScript(source, {
        isCommand: (line, declared) => isCommand(line, declared, own),
        jsWords: (line) =>
          splitWords(line.replace(/^\S+/, ""))
            .filter((w) => w.kind === "js")
            .map((w) => w.text),
      });
      const inScope: Record<string, unknown> = names();
      const keys = Object.keys(inScope);
      await new AsyncFunction(...keys, "__sh", guardLoops(body))(...keys.map((k) => inScope[k]), sh);
    } catch (caught) {
      const error = caught instanceof EvalError ? new Error(NEEDS_EVAL) : caught;
      // A nested script passes it on, so the one that ran it stops too.
      if (error instanceof Interrupted && depth === 1) return;
      if (error instanceof Interrupted) throw error;
      const located = reported.has(error as Error) ? error : new Error(`${name}: ${messageOf(error)}`);
      if (!keepGoing) throw located;
      printError(located);
    } finally {
      depth -= 1;
    }
  };

  /** Keys are not edited into a line while `task` runs. */
  const during = async (task: () => Promise<void>) => {
    busy = true;
    interrupted = false;
    try {
      await task();
    } catch (error) {
      printError(error);
    }
    busy = false;
    input = null;
    redraw();
  };

  const run = async () => {
    const code = line.trim();
    newLine();
    line = "";
    cursor = 0;
    historyIndex = -1;
    if (!code) return redraw();
    history.push(code);
    await during(() => execute(code));
  };

  const tab = async () => {
    if (!complete) return;
    const before = line;
    const at = cursor;
    const again = tabbed;
    tabbed = true;
    const { start, matches } = await complete(before.slice(0, at));
    // Typed on since: the answer is for another line.
    if (busy || line !== before || cursor !== at || !matches.length) return;
    let common = matches[0]!.insert;
    for (const { insert } of matches) while (!insert.startsWith(common)) common = common.slice(0, -1);
    const only = matches.length === 1 ? matches[0]! : null;
    const text = only ? only.insert + only.end : common;
    if (only || text.length > at - start) {
      line = before.slice(0, start) + text + before.slice(at);
      cursor = start + text.length;
      redraw();
    } else if (again) {
      const labels = matches.slice(0, 200).map((m) => m.label.replace(/[\x00-\x1f\x7f-\x9f]/g, "?"));
      const more = matches.length > labels.length ? [`… ${matches.length - labels.length} more`] : [];
      const end = cursor;
      newLine();
      write(`${[...labels, ...more].join("  ")}\r\n`);
      cursor = end;
      redraw();
    }
  };

  const recall = (delta: number) => {
    const next = historyIndex === -1 && delta < 0 ? history.length - 1 : historyIndex + delta;
    if (next < 0 && historyIndex !== -1) return;
    if (next >= history.length) {
      historyIndex = -1;
      line = "";
    } else if (next >= 0) {
      historyIndex = next;
      line = history[next] ?? "";
    }
    cursor = line.length;
    redraw();
  };

  return {
    /** Prints the greeting, runs `startup`, then prompts. */
    start(startup?: () => Promise<void>) {
      write("Piloti shell — JavaScript with the desktop in reach. Type help.\r\n");
      if (startup) void during(startup);
      else redraw();
    },
    runScript,
    /** Hands the keys to a function that runs until they say stop. */
    capture(handler: (data: string) => void) {
      input = handler;
    },
    /** Ends what is running: the terminal is going away. */
    dispose() {
      interrupted = true;
      input?.("\x03");
    },
    /** Feed what the emulator sends for key presses and pastes. */
    onData(data: string) {
      if (busy) {
        if (input) input(data);
        else if (data.includes("\x03")) interrupted = true;
        return;
      }
      for (const key of data.match(KEY) ?? []) {
        // A command started by this chunk takes the rest of it.
        if (busy) break;
        if (key === "\t") {
          void tab();
          continue;
        }
        tabbed = false;
        if (key === "\r" || key === "\n") void run();
        else if (key === "\x7f" || key === "\b") {
          if (cursor > 0) {
            line = line.slice(0, cursor - 1) + line.slice(cursor);
            cursor -= 1;
            redraw();
          }
        } else if (key === "\x1b[D") {
          if (cursor > 0) {
            cursor -= 1;
            redraw();
          }
        } else if (key === "\x1b[C") {
          if (cursor < line.length) {
            cursor += 1;
            redraw();
          }
        } else if (key === "\x1b[A") recall(-1);
        else if (key === "\x1b[B") recall(1);
        else if (key === "\x03") {
          newLine("^C");
          line = "";
          cursor = 0;
          redraw();
        } else if (key === "\x15") {
          line = line.slice(cursor);
          cursor = 0;
          redraw();
        } else if (key === "\x0c") {
          write("\x1b[2J\x1b[H");
          cursorRow = 0;
          redraw();
        } else if (key >= " " && !key.startsWith("\x1b")) {
          line = line.slice(0, cursor) + key + line.slice(cursor);
          cursor += key.length;
          redraw();
        }
      }
    },
  };
}
