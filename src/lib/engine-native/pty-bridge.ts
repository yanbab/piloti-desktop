import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";

/**
 * `domicile.processes.spawn` gives a program pipes, not a terminal. This small
 * Python program (stdlib only) puts the shell on a pseudo-terminal and relays
 * bytes both ways. It reads one private escape sequence from the input to learn
 * the window size: `ESC ] 777 ; resize ; <cols> ; <rows> BEL`.
 */
export const PTY_BRIDGE_PY = String.raw`
import fcntl, os, pty, re, select, signal, struct, sys, termios
cols, rows = int(sys.argv[1]), int(sys.argv[2])
shell = (sys.argv[3] if len(sys.argv) > 3 else "") or os.environ.get("SHELL") or "/bin/bash"
pid, fd = pty.fork()
if pid == 0:
    os.environ["TERM"] = "xterm-256color"
    os.execvp(shell, [shell])
def size(c, r):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", r, c, 0, 0))
size(cols, rows)
RESIZE = re.compile(rb"\x1b\]777;resize;(\d+);(\d+)\x07")
HEAD = b"\x1b]777;resize;"
held = b""
src, out = sys.stdin.fileno(), sys.stdout.buffer
while True:
    ready, _, _ = select.select([fd, src], [], [], 0.05 if held else None)
    if not ready and held:
        os.write(fd, held)
        held = b""
        continue
    if fd in ready:
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        out.write(data)
        out.flush()
    if src in ready:
        data = os.read(src, 65536)
        if not data:
            os.kill(pid, signal.SIGHUP)
            break
        held += data
        while True:
            m = RESIZE.search(held)
            if not m:
                break
            os.write(fd, held[:m.start()])
            size(int(m.group(1)), int(m.group(2)))
            held = held[m.end():]
        k = held.rfind(b"\x1b")
        if k != -1 and (HEAD.startswith(held[k:]) or held[k:].startswith(HEAD)):
            os.write(fd, held[:k])
            held = held[k:]
        else:
            os.write(fd, held)
            held = b""
try:
    _, status = os.waitpid(pid, 0)
    sys.exit(os.waitstatus_to_exitcode(status))
except ChildProcessError:
    pass
`;

export interface BashSession {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  stop(): void;
}

/**
 * Starts the user's shell on a pseudo-terminal. `onOutput` gets its bytes;
 * `onExit` fires once when it ends (or could not start).
 */
/** Login shells from `/etc/shells` (absolute paths, no `nologin`/`false`), first occurrence of each. */
export async function readLoginShells(domicile: Domicile): Promise<string[]> {
  const res = await domicile.files.readText("/etc/shells").catch(() => null);
  const text = res?.match({ Ok: (t) => t, Err: () => "" }) ?? "";
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("/") || /\/(nologin|false)$/.test(line) || out.includes(line)) continue;
    out.push(line);
  }
  return out;
}

export async function startShell(
  domicile: Domicile,
  shell: string,
  size: { cols: number; rows: number },
  onOutput: (bytes: Uint8Array) => void,
  onExit: (reason: string) => void,
): Promise<BashSession | null> {
  const spawned = await domicile.processes.spawn(
    ["python3", "-c", PTY_BRIDGE_PY, String(size.cols), String(size.rows), shell],
    { stdin: true },
  );
  const process = spawned.match({ Ok: (p) => p, Err: () => null });
  if (!process) {
    onExit("could not start python3 (needed for a terminal session)");
    return null;
  }
  const pump = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader();
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        onOutput(next.value);
      }
    } catch {
      /* stream closed */
    }
  };
  let stopped = false;
  void Promise.all([pump(process.stdout), pump(process.stderr)]).then(async () => {
    const exit = await process.exited;
    if (stopped) return; // switched away: the new session owns the screen
    onExit(
      exit.match({
        Ok: (e) => (e.code === 0 || e.code === undefined ? "shell exited" : `shell exited (${e.code})`),
        Err: () => "shell ended",
      }),
    );
  });
  return {
    write: (data) => process.write(data),
    resize: (cols, rows) => process.write(`\x1b]777;resize;${cols};${rows}\x07`),
    stop: () => {
      stopped = true;
      process.kill();
    },
  };
}
