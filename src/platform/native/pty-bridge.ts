import type { Piloti } from "@/platform/shared/piloti";

/**
 * `domicile.processes.spawn` gives a program pipes, not a terminal. This small
 * Python program (stdlib only) puts the shell on a pseudo-terminal and relays
 * bytes both ways. It reads one private escape sequence from the input to learn
 * the window size: `ESC ] 777 ; resize ; <cols> ; <rows> BEL`.
 */
export const PTY_BRIDGE_PY = String.raw`
import fcntl, os, pty, re, select, signal, struct, sys, termios
cols, rows = int(sys.argv[1]), int(sys.argv[2])
command = [a for a in sys.argv[3:4] if a] + sys.argv[4:] or [os.environ.get("SHELL") or "/bin/bash"]
pid, fd = pty.fork()
if pid == 0:
    os.environ["TERM"] = "xterm-256color"
    try:
        os.execvp(command[0], command)
    except OSError as error:
        print(f"{command[0]}: {error.strerror}", flush=True)
        os._exit(127)
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
export interface LoginShell {
  path: string;
  /** Whether the program is installed. */
  available: boolean;
}

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/**
 * The shells of `/etc/shells` that exist (no `nologin`/`false`), one per real
 * program (`/bin` and `/usr/bin` are often the same directory), sorted by
 * name. `bash` is always listed, marked unavailable when it is not installed.
 */
export async function readLoginShells(piloti: Piloti): Promise<LoginShell[]> {
  const res = await piloti.files.readText("/etc/shells").catch(() => null);
  const text = res?.match({ Ok: (t) => t, Err: () => "" }) ?? "";
  const candidates = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("/") && !/\/(nologin|false)$/.test(l));
  const seen = new Set<string>();
  const found: LoginShell[] = [];
  for (const path of candidates) {
    const stat = await piloti.files.stat(path).catch(() => null);
    const info = stat?.match({ Ok: (st) => st, Err: () => null });
    if (!info) continue; // listed but not installed
    const real = info.realPath && info.realPath.startsWith("/") ? info.realPath : path;
    if (seen.has(real)) continue;
    seen.add(real);
    found.push({ path, available: true });
  }
  if (!found.some((s) => baseName(s.path) === "bash")) found.push({ path: "/bin/bash", available: false });
  return found.sort((a, b) => baseName(a.path).localeCompare(baseName(b.path)));
}

export async function startShell(
  piloti: Piloti,
  /** A shell path, or a program and its arguments. */
  command: string | readonly string[],
  size: { cols: number; rows: number },
  onOutput: (bytes: Uint8Array) => void,
  onExit: (reason: string, code?: number) => void,
  options: { cwd?: string } = {},
): Promise<BashSession | null> {
  const spawned = await piloti.processes.spawn(
    ["python3", "-c", PTY_BRIDGE_PY, String(size.cols), String(size.rows), ...[command].flat()],
    { stdin: true, cwd: options.cwd },
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
      exit.match({ Ok: (e) => e.code, Err: () => undefined }),
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
