/**
 * The "piloti-shell" terminal mode: a JavaScript REPL whose scope is the
 * desktop (windows, settings, launching apps...). It speaks the terminal's
 * byte stream, so any xterm-like emulator can sit on top of it.
 */

export interface ReplOptions {
  /** Writes terminal output. */
  write: (text: string) => void;
  /** Names usable in a line, e.g. `{ launch, windows }`. */
  scope: () => Record<string, unknown>;
  prompt?: string;
}

const AsyncFunction = Object.getPrototypeOf(async function () {
  /* constructor access */
}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;

/** Evaluates a line as an expression, else as statements, with `scope` in reach. */
export async function evaluateLine(code: string, scope: Record<string, unknown>): Promise<unknown> {
  const names = Object.keys(scope);
  const values = names.map((n) => scope[n]);
  let fn: (...values: unknown[]) => Promise<unknown>;
  try {
    fn = new AsyncFunction(...names, `return (${code}\n)`);
  } catch {
    fn = new AsyncFunction(...names, code);
  }
  return fn(...values);
}

export function formatValue(value: unknown): string {
  if (value === undefined) return "";
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

export function createRepl({ write, scope, prompt = "piloti> " }: ReplOptions) {
  let line = "";
  let cursor = 0;
  const history: string[] = [];
  let historyIndex = -1;
  let busy = false;

  const redraw = () => {
    write(`\r\x1b[2K${prompt}${line}`);
    if (cursor < line.length) write(`\x1b[${line.length - cursor}D`);
  };

  const run = async () => {
    const code = line.trim();
    write("\r\n");
    line = "";
    cursor = 0;
    historyIndex = -1;
    if (code) {
      history.push(code);
      busy = true;
      try {
        const out = formatValue(await evaluateLine(code, scope()));
        if (out) write(`${CRLF(out)}\r\n`);
      } catch (error) {
        write(`\x1b[31m${CRLF(String(error instanceof Error ? error.message : error))}\x1b[0m\r\n`);
      }
      busy = false;
    }
    redraw();
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
    start() {
      write("Piloti shell — JavaScript with the desktop in reach. Type help().\r\n");
      redraw();
    },
    /** Feed what the emulator sends for key presses and pastes. */
    onData(data: string) {
      if (busy) return;
      for (const key of data.match(KEY) ?? []) {
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
            write("\x1b[D");
          }
        } else if (key === "\x1b[C") {
          if (cursor < line.length) {
            cursor += 1;
            write("\x1b[C");
          }
        } else if (key === "\x1b[A") recall(-1);
        else if (key === "\x1b[B") recall(1);
        else if (key === "\x03") {
          write("^C\r\n");
          line = "";
          cursor = 0;
          redraw();
        } else if (key === "\x15") {
          line = line.slice(cursor);
          cursor = 0;
          redraw();
        } else if (key === "\x0c") {
          write("\x1b[2J\x1b[H");
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
