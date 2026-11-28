/**
 * Runs one program in the terminal for piloti-shell. Its output streams as it
 * comes, except a JSON array of objects, held back to be printed as a table.
 */
import type { BashSession } from "@/platform/native/pty-bridge";
import { tableRows } from "@/ui/apps/terminal/piloti-table";

/** Beyond this, output is not worth a table. */
const MAX_HELD = 1_000_000;

export interface RunInTerminal {
  start: (
    onOutput: (bytes: Uint8Array) => void,
    onExit: (reason: string, code?: number) => void,
  ) => Promise<BashSession | null>;
  write: (data: string | Uint8Array) => void;
  attach: (input: (data: string) => void) => void;
  hold: (session: BashSession | null) => void;
}

export function runInTerminal({ start, write, attach, hold }: RunInTerminal): Promise<unknown> {
  return new Promise((done, fail) => {
    const decoder = new TextDecoder();
    let held: Uint8Array[] | null = [];
    let text = "";
    let last = 10;
    let typed = "";
    let session: BashSession | null = null;
    attach((data) => (session ? session.write(data) : (typed += data)));

    const release = () => {
      for (const bytes of held ?? []) write(bytes);
      held = null;
    };
    const onOutput = (bytes: Uint8Array) => {
      last = bytes[bytes.length - 1] ?? last;
      if (!held) return write(bytes);
      held.push(bytes);
      text += decoder.decode(bytes, { stream: true });
      // Only what may still be `[{`: a prompt like `[sudo]` must show at once.
      if (!/^\s*(\[\s*(\{[\s\S]*)?)?$/.test(text) || text.length > MAX_HELD) release();
    };
    const onExit = (reason: string, code?: number) => {
      hold(null);
      const table = held && tableRows(text);
      if (!table) release();
      if (!table && last !== 10) write("\r\n");
      if (code !== 0) write(`\x1b[2m[${code === undefined ? reason : `exit ${code}`}]\x1b[0m\r\n`);
      done(table ?? undefined);
    };

    start(onOutput, onExit).then((started) => {
      // `null`: `onExit` has said why.
      if (!started) return;
      session = started;
      hold(started);
      if (typed) started.write(typed);
    }, fail);
  });
}
