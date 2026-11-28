/**
 * Startup profiling: times every call into the host (`files`, `processes`) and
 * long main-thread stalls, then prints one report. Calls run in parallel, so
 * their totals overlap and can exceed the startup time: read them as "where
 * the work is". Costs a timestamp per call and stops after the report.
 */
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { bootElapsedMs, bootPhases } from "./perf-log";

const REPORT_AFTER_MS = 15_000;

interface CallStat {
  count: number;
  total: number;
  max: number;
  lastEnd: number;
}

const calls = new Map<string, CallStat>();
let recording = false;
let stalls = 0;
let stallTotal = 0;

function record(name: string, startedAt: number): void {
  if (!recording) return;
  const ms = performance.now() - startedAt;
  const stat = calls.get(name) ?? { count: 0, total: 0, max: 0, lastEnd: 0 };
  stat.count += 1;
  stat.total += ms;
  stat.max = Math.max(stat.max, ms);
  stat.lastEnd = bootElapsedMs();
  calls.set(name, stat);
}

/** `service.method`, plus the program for `processes.*`. */
function callName(service: string, method: string, args: unknown[]): string {
  const first = args[0];
  if (service !== "processes" || !Array.isArray(first)) return `${service}.${method}`;
  const argv = first.map(String);
  // `env VAR=x program …` and `sh -c script` say more with the next word.
  const program = argv.find((a, i) => i === 0 ? a !== "env" : argv[0] === "env" && !a.includes("="));
  const detail = program === "sh" ? ` -c ${(argv[2] ?? "").trim().slice(0, 40)}` : "";
  return `${service}.${method} ${program ?? argv[0]}${detail}`;
}

function timed<T extends object>(service: string, target: T): T {
  return new Proxy(target, {
    get(obj, key) {
      const value = Reflect.get(obj, key, obj) as unknown;
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const startedAt = performance.now();
        const name = callName(service, String(key), args);
        const result = (value as (...a: unknown[]) => unknown).apply(obj, args);
        const then = (result as PromiseLike<unknown> | undefined)?.then;
        if (typeof then !== "function") record(name, startedAt);
        else void then.call(result, () => record(name, startedAt), () => record(name, startedAt));
        return result;
      };
    },
  });
}

function report(): void {
  recording = false;
  const lines = ["[piloti:boot] startup report (first 15 s)", "  steps, slowest first:"];
  for (const p of [...bootPhases()].sort((a, b) => b.duration - a.duration)) {
    lines.push(`    ${p.duration}ms  ${p.label}  (ended @ ${p.end}ms)`);
  }
  lines.push("  host calls by total time (they overlap):");
  const top = [...calls].sort((a, b) => b[1].total - a[1].total).slice(0, 20);
  for (const [name, s] of top) {
    lines.push(
      `    ${Math.round(s.total)}ms  ${s.count}×  max ${Math.round(s.max)}ms  last @ ${s.lastEnd}ms  ${name}`
    );
  }
  lines.push(`  main thread stalls over 50ms: ${stalls}, ${Math.round(stallTotal)}ms in total`);
  console.info(lines.join("\n"));
}

/** Starts profiling and returns `domicile` with its file and process calls timed. */
export function profileStartup<T extends Domicile>(piloti: T): T {
  recording = true;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!recording) return;
        stalls += 1;
        stallTotal += entry.duration;
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* the engine has no long task timing */
  }
  setTimeout(report, REPORT_AFTER_MS);

  const wrapped = new Map<PropertyKey, object>();
  return new Proxy(piloti, {
    get(obj, key) {
      const value = Reflect.get(obj, key, obj) as unknown;
      if ((key !== "files" && key !== "processes") || !value) return value;
      let proxy = wrapped.get(key);
      if (!proxy) {
        proxy = timed(String(key), value as object);
        wrapped.set(key, proxy);
      }
      return proxy;
    },
  });
}
