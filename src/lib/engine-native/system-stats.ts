/**
 * CPU and memory from `/proc`, for System Monitor. One `sh` per sample reads
 * the machine totals and every process, so a sample is a single subprocess.
 * The figures are computed in `core/system-stats.ts`.
 */
import { getEngine } from "@/lib/engine/engine";
import type { Piloti } from "@/lib/engine/piloti";
import { parseSystemSample, type SystemSample } from "@/lib/core/system-stats";

const SAMPLE_SCRIPT = [
  "getconf PAGESIZE",
  "head -n 1 /proc/stat",
  "grep -E '^(MemTotal|MemAvailable):' /proc/meminfo",
  // Processes come and go while `cat` runs: missing ones are not an error.
  "cat /proc/[0-9]*/stat 2>/dev/null",
  "true",
].join("; ");

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
