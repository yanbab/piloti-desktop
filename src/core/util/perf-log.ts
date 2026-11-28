const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const BOOT_START_MS = nowMs();

export function bootElapsedMs(): number {
  return Math.round(nowMs() - BOOT_START_MS);
}

export function logBootEvent(message: string): void {
  console.info(`[piloti:boot] ${message} (@ ${bootElapsedMs()}ms)`);
}

export interface BootPhase {
  label: string;
  duration: number;
  end: number;
}
const phases: BootPhase[] = [];

/** The finished startup steps, for the startup report. */
export const bootPhases = (): readonly BootPhase[] => phases;

export function startBootPhase(label: string): (detail?: string) => void {
  const startedAt = nowMs();
  logBootEvent(`starting ${label}`);
  let ended = false;
  return (detail?: string) => {
    if (ended) return;
    ended = true;
    const duration = Math.round(nowMs() - startedAt);
    const suffix = detail ? ` (${detail})` : "";
    if (phases.length < 100) {
      phases.push({ label: `${label}${suffix}`, duration, end: bootElapsedMs() });
    }
    logBootEvent(`loaded ${label}${suffix} in ${duration}ms`);
  };
}

// App launches, to profile how long each one takes to show.
const launches = new Map<string, number>();

/** An app was asked to start. Later events of this app report the time since. */
export function logAppLaunch(appId: string, detail?: string): void {
  launches.set(appId, nowMs());
  const suffix = detail ? ` ${detail}` : "";
  console.info(`[piloti:app] launch ${appId}${suffix} (@ ${bootElapsedMs()}ms)`);
}

/** Something that happened to an app: window opened, ready, closed… */
export function logAppEvent(appId: string, event: string): void {
  const startedAt = launches.get(appId);
  const since =
    startedAt === undefined ? "" : `, +${Math.round(nowMs() - startedAt)}ms since launch`;
  console.info(`[piloti:app] ${appId} ${event} (@ ${bootElapsedMs()}ms${since})`);
  if (event === "closed") launches.delete(appId);
}
