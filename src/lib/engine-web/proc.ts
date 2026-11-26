/**
 * A made-up `/proc` for the browser demo: `stat`, `meminfo` and `<pid>/stat`,
 * in Linux's format, with numbers that move. Reading `/proc/stat` advances them.
 */
import { demoApps } from "@/lib/engine/demo-processes";

const CPUS = 4;
const TICKS_PER_SECOND = 100;
const MEM_TOTAL_KB = 8 * 1024 * 1024;
const PAGE_KB = 4;

interface DemoProcess {
  name: string;
  ppid: number;
  ticks: number;
  rssKb: number;
  /** Usual share of one CPU. */
  load: number;
}

const process = (name: string, ppid: number, rssMb: number, load: number): DemoProcess => ({
  name,
  ppid,
  ticks: 0,
  rssKb: rssMb * 1024,
  load,
});

export function createDemoProc(now: () => number = Date.now) {
  const system = new Map([
    [1, process("systemd", 0, 12, 0.001)],
    [312, process("dbus-daemon", 1, 6, 0.002)],
    [420, process("NetworkManager", 1, 21, 0.003)],
    [511, process("pipewire", 1, 18, 0.02)],
    [640, process("domicile", 1, 240, 0.09)],
    [655, process("piloti-shell", 640, 380, 0.06)],
  ]);
  const apps = new Map<number, DemoProcess>();
  const cpu = { busy: 0, idle: 0 };
  let last = now() - 1000;

  const sync = () => {
    const running = demoApps();
    for (const { appId, pid } of running) {
      if (!apps.has(pid)) apps.set(pid, process(appId.slice(0, 15), 655, 60 + (pid % 7) * 35, 0.01 + (pid % 5) * 0.02));
    }
    const alive = new Set(running.map((a) => a.pid));
    for (const pid of apps.keys()) if (!alive.has(pid)) apps.delete(pid);
    return new Map([...system, ...apps]);
  };

  const advance = () => {
    const ticks = Math.max(0, ((now() - last) / 1000) * TICKS_PER_SECOND);
    last = now();
    let busy = 0;
    for (const p of sync().values()) {
      const used = Math.round(ticks * p.load * (0.4 + Math.random() * 1.2));
      p.ticks += used;
      p.rssKb = Math.max(1024, Math.round(p.rssKb * (0.995 + Math.random() * 0.01)));
      busy += used;
    }
    const total = Math.round(ticks * CPUS);
    cpu.busy += Math.min(busy, total);
    cpu.idle += Math.max(0, total - busy);
  };

  return {
    list(path: string): { name: string; kind: "file" | "directory" }[] | null {
      const processes = sync();
      if (path === "/proc") {
        return [
          { name: "meminfo", kind: "file" },
          { name: "stat", kind: "file" },
          ...[...processes.keys()].map((pid) => ({ name: String(pid), kind: "directory" as const })),
        ];
      }
      const pid = Number(/^\/proc\/(\d+)$/.exec(path)?.[1]);
      return processes.has(pid) ? [{ name: "stat", kind: "file" }] : null;
    },
    read(path: string): string | null {
      if (path === "/proc/stat") {
        advance();
        return `cpu  ${cpu.busy} 0 0 ${cpu.idle} 0 0 0 0 0 0\n`;
      }
      const processes = sync();
      if (path === "/proc/meminfo") {
        const used = [...processes.values()].reduce((sum, p) => sum + p.rssKb, 1_500_000);
        return `MemTotal:       ${MEM_TOTAL_KB} kB\nMemAvailable:   ${Math.max(0, MEM_TOTAL_KB - used)} kB\n`;
      }
      const pid = Number(/^\/proc\/(\d+)\/stat$/.exec(path)?.[1]);
      const p = processes.get(pid);
      if (!p) return null;
      // Fields after the name: state ppid … utime(14th) stime … rss(24th).
      const fields = Array<string | number>(22).fill(0);
      fields[0] = "S";
      fields[1] = p.ppid;
      fields[11] = p.ticks;
      fields[21] = Math.round(p.rssKb / PAGE_KB);
      return `${pid} (${p.name}) ${fields.join(" ")}\n`;
    },
  };
}
