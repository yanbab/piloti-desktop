import { describe, expect, it } from "bun:test";
import { appUsage, cpuPercent, parseSystemSample } from "../../src/core/system/system-stats";

const stat = (pid: number, comm: string, ppid: number, ticks: number, pages: number) =>
  `${pid} (${comm}) S ${ppid} 1 1 0 -1 0 0 0 0 0 ${ticks} 0 0 0 20 0 1 0 100 1000 ${pages} 0`;

const raw = (user: number, idle: number, procs: string[]) =>
  [
    "4096",
    `cpu  ${user} 0 0 ${idle} 0 0 0 0 0 0`,
    "MemTotal:        8000000 kB",
    "MemAvailable:    6000000 kB",
    ...procs,
    "",
  ].join("\n");

const before = parseSystemSample(
  raw(100, 900, [stat(10, "term", 1, 10, 256), stat(11, "a (b) c", 10, 5, 256), stat(12, "editor", 10, 0, 512)]),
)!;
const after = parseSystemSample(
  raw(150, 950, [stat(10, "term", 1, 20, 256), stat(11, "a (b) c", 10, 25, 256), stat(12, "editor", 10, 10, 512)]),
)!;

describe("system stats", () => {
  it("parses totals and processes, whatever the command name", () => {
    expect(after.memTotalKb).toBe(8000000);
    expect(after.memAvailableKb).toBe(6000000);
    expect(after.processes.get(11)).toEqual({ ppid: 10, name: "a (b) c", ticks: 25, rssKb: 1024 });
  });

  it("gives CPU as a share of the machine", () => {
    expect(cpuPercent(before, after)).toBe(50);
  });

  it("adds children to their app, except another app's process", () => {
    const usage = appUsage(before, after, new Map([["term", [10]], ["editor", [12]], ["gone", [99]]]));
    expect(usage.get("term")).toEqual({ cpu: 30, memMb: 2 });
    expect(usage.get("editor")).toEqual({ cpu: 10, memMb: 2 });
    expect(usage.has("gone")).toBe(false);
  });

  it("rejects output without totals", () => {
    expect(parseSystemSample("")).toBeNull();
  });
});
