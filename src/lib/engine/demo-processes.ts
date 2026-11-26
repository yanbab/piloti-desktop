/**
 * The browser demo has no processes. Its apps are given made-up process ids, so
 * `/proc`, System Monitor and `top` agree on which process is which app.
 */
const apps = new Map<string, number>();
let nextPid = 1000;

export function demoPid(appId: string): number {
  let pid = apps.get(appId);
  if (pid === undefined) apps.set(appId, (pid = nextPid++));
  return pid;
}

/** The running apps: those with a process in the demo's `/proc`. */
let running: string[] = [];

export function setDemoApps(appIds: readonly string[]): void {
  running = [...new Set(appIds)];
}

export function demoApps(): { appId: string; pid: number }[] {
  return running.map((appId) => ({ appId, pid: demoPid(appId) }));
}
