/**
 * CPU and memory from `/proc`, for System Monitor. One `sh` per sample reads
 * the machine totals and every process, so a sample is a single subprocess.
 * CPU shares are of the whole machine, from the difference of two samples.
 */
import { getEngine } from "@/lib/engine/engine";
import type { Piloti } from "@/lib/engine/piloti";

const SAMPLE_SCRIPT = [
  "getconf PAGESIZE",
  "head -n 1 /proc/stat",
  "grep -E '^(MemTotal|MemAvailable):' /proc/meminfo",
  // Processes come and go while `cat` runs: missing ones are not an error.
  "cat /proc/[0-9]*/stat 2>/dev/null",
  "true",
].join("; ");

export interface ProcessSample {
  ppid: number;
  name: string;
  /** utime + stime, in clock ticks. */
  ticks: number;
  rssKb: number;
}

export interface SystemSample {
  cpuTotal: number;
  cpuIdle: number;
  memTotalKb: number;
  memAvailableKb: number;
  processes: Map<number, ProcessSample>;
}

export interface ProcessUsage {
  /** Share of the whole machine, 0 to 100. */
  cpu: number;
  memMb: number;
}

export function parseSystemSample(raw: string): SystemSample | null {
  let pageKb = 4;
  let cpuTotal = 0;
  let cpuIdle = 0;
  let memTotalKb = 0;
  let memAvailableKb = 0;
  const processes = new Map<number, ProcessSample>();
  const stats: string[] = [];

  for (const line of raw.split("\n")) {
    if (/^\d+$/.test(line)) {
      pageKb = Number(line) / 1024;
    } else if (line.startsWith("cpu ")) {
      // user nice system idle iowait irq softirq steal; guest time is already in user.
      const ticks = line.trim().split(/\s+/).slice(1, 9).map(Number);
      cpuTotal = ticks.reduce((sum, n) => sum + n, 0);
      cpuIdle = (ticks[3] ?? 0) + (ticks[4] ?? 0);
    } else if (line.startsWith("MemTotal:")) {
      memTotalKb = Number(line.split(/\s+/)[1]);
    } else if (line.startsWith("MemAvailable:")) {
      memAvailableKb = Number(line.split(/\s+/)[1]);
    } else if (/^\d+ \(/.test(line)) {
      stats.push(line);
    }
  }

  for (const line of stats) {
    // The command name may hold spaces and parentheses: fields start after the last ")".
    const end = line.lastIndexOf(")");
    const fields = line.slice(end + 2).split(" ");
    processes.set(Number.parseInt(line, 10), {
      ppid: Number(fields[1]),
      name: line.slice(line.indexOf("(") + 1, end),
      ticks: Number(fields[11]) + Number(fields[12]),
      rssKb: Number(fields[21]) * pageKb,
    });
  }

  return cpuTotal > 0 && memTotalKb > 0
    ? { cpuTotal, cpuIdle, memTotalKb, memAvailableKb, processes }
    : null;
}

/** Busy share of the machine between two samples, 0 to 100. */
export function cpuPercent(prev: SystemSample, next: SystemSample): number {
  const total = next.cpuTotal - prev.cpuTotal;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (1 - (next.cpuIdle - prev.cpuIdle) / total) * 100));
}

/**
 * What each app uses: its processes and all their children. A child that is
 * another app's process (a program started from a terminal) counts for that
 * app only. Memory is resident size, so pages shared between processes are
 * counted once per process. Apps with no live process are left out.
 */
export function appUsage(
  prev: SystemSample,
  next: SystemSample,
  appPids: ReadonlyMap<string, readonly number[]>,
): Map<string, ProcessUsage> {
  const children = new Map<number, number[]>();
  for (const [pid, { ppid }] of next.processes) {
    const siblings = children.get(ppid);
    if (siblings) siblings.push(pid);
    else children.set(ppid, [pid]);
  }
  const roots = new Set(Array.from(appPids.values()).flat());
  const total = next.cpuTotal - prev.cpuTotal;
  const counted = new Set<number>();
  const usage = new Map<string, ProcessUsage>();

  for (const [appId, pids] of appPids) {
    const queue = pids.filter((pid) => next.processes.has(pid));
    let ticks = 0;
    let rssKb = 0;
    let found = false;
    for (let pid = queue.pop(); pid !== undefined; pid = queue.pop()) {
      if (counted.has(pid)) continue;
      counted.add(pid);
      found = true;
      const proc = next.processes.get(pid)!;
      const before = prev.processes.get(pid)?.ticks ?? proc.ticks;
      ticks += Math.max(0, proc.ticks - before);
      rssKb += proc.rssKb;
      queue.push(...(children.get(pid) ?? []).filter((child) => !roots.has(child)));
    }
    if (found) {
      usage.set(appId, { cpu: total > 0 ? (ticks / total) * 100 : 0, memMb: rssKb / 1024 });
    }
  }
  return usage;
}

/** The same text, file by file, where there is no `sh` (the browser demo). */
export async function readProcFiles(piloti: Pick<Piloti, "vfs">): Promise<string> {
  const read = async (path: string) => (await piloti.vfs.readText(path)) ?? "";
  const stat = await read("/proc/stat");
  const pids = ((await piloti.vfs.list("/proc")) ?? []).filter((e) => /^\d+$/.test(e.name));
  const processes = await Promise.all(pids.map((e) => read(`${e.path}/stat`)));
  return ["4096", stat, await read("/proc/meminfo"), ...processes].join("\n");
}

export async function readSystemSample(piloti: Piloti): Promise<SystemSample | null> {
  try {
    // On Linux one `sh` reads it all: a call per process would be costly.
    if (!getEngine().capabilities.systemServices) return parseSystemSample(await readProcFiles(piloti));
    const res = await piloti.processes.run(["sh", "-c", SAMPLE_SCRIPT], { env: { LC_ALL: "C" } });
    return res.match({ Ok: (ran) => parseSystemSample(ran.stdout), Err: () => null });
  } catch {
    return null;
  }
}
