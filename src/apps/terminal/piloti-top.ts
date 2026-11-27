/** piloti-shell's `top`: processes by CPU, redrawn until `q` or Ctrl+C. */
import { cpuPercent, type SystemSample } from "@/lib/core/system-stats";

export interface TopOptions {
  sample: () => Promise<SystemSample | null>;
  write: (text: string) => void;
  size: () => { cols: number; rows: number };
  /** Takes the keys. */
  capture: (handler: (data: string) => void) => void;
  interval?: number;
}

export function formatTop(prev: SystemSample, next: SystemSample, cols: number, rows: number): string {
  const total = next.cpuTotal - prev.cpuTotal;
  const processes = [...next.processes].map(([pid, p]) => {
    const ticks = Math.max(0, p.ticks - (prev.processes.get(pid)?.ticks ?? p.ticks));
    return { pid, name: p.name, cpu: total > 0 ? (ticks / total) * 100 : 0, mem: p.rssKb / 1024 };
  });
  processes.sort((a, b) => b.cpu - a.cpu || b.mem - a.mem);
  const mb = (kb: number) => `${Math.round(kb / 1024)} MB`;
  const line = (text: string) => text.slice(0, cols);
  const columns = (pid: string, cpu: string, mem: string, name: string) =>
    line(`${pid.padStart(7)} ${cpu.padStart(6)} ${mem.padStart(9)}  ${name}`);
  return [
    line(`CPU ${cpuPercent(prev, next).toFixed(1)}%   Memory ${mb(next.memTotalKb - next.memAvailableKb)} / ${mb(next.memTotalKb)}`),
    line(`${processes.length} processes   q to quit`),
    columns("PID", "CPU%", "MEM MB", "NAME"),
    "─".repeat(cols),
    ...processes
      .slice(0, Math.max(0, rows - 4))
      .map((p) =>
        columns(String(p.pid), p.cpu.toFixed(1), p.mem.toFixed(1), p.name.replace(/[\x00-\x1f\x7f-\x9f]/g, "?")),
      ),
  ].join("\r\n");
}

export async function runTop({ sample, write, size, capture, interval = 2000 }: TopOptions): Promise<void> {
  let stopped = false;
  let wake = () => {};
  capture((data) => {
    if (!/[q\x03]/.test(data)) return;
    stopped = true;
    wake();
  });
  const wait = (ms: number) =>
    new Promise<void>((done) => {
      if (stopped) return done();
      const timer = setTimeout(done, ms);
      wake = () => {
        clearTimeout(timer);
        done();
      };
    });

  let prev = await sample();
  if (!prev) throw new Error("top: cannot read /proc");
  // The alternate screen, cursor hidden: the shell's lines come back after.
  write("\x1b[?1049h\x1b[?25l\x1b[H\x1b[2JReading…");
  try {
    // CPU needs two samples: the second follows closely.
    for (let delay = Math.min(500, interval); ; delay = interval) {
      await wait(delay);
      if (stopped) break;
      const next = await sample();
      if (stopped) break;
      if (!next) continue;
      const { cols, rows } = size();
      write(`\x1b[H\x1b[2J${formatTop(prev, next, cols, rows)}`);
      prev = next;
    }
  } finally {
    write("\x1b[?25h\x1b[?1049l");
  }
}
