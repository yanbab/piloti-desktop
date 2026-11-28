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
  launchListeners.forEach((l) => l(appId));
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

/** How long one start of an app took, kept while the shell runs. */
export interface AppTiming {
  appId: string;
  /** In its own process. */
  separate: boolean;
  ms: number;
  /** A program of its own: its memory is its process's, not the renderers'. */
  pid?: number;
  /** What the renderers grew by, if measured. */
  memoryKb?: number;
}

const timings: AppTiming[] = [];
const MAX_TIMINGS = 200;
const launchListeners = new Set<(appId: string) => void>();
const readyListeners = new Set<(timing: AppTiming) => void>();
const timingListeners = new Set<() => void>();
let timingsVersion = 0;

const changed = () => {
  timingsVersion += 1;
  timingListeners.forEach((l) => l());
};

/** The app asked for by `logAppLaunch` is drawn. Counted once per launch. */
export function recordAppReady(appId: string, separate: boolean, pid?: number): void {
  const startedAt = launches.get(appId);
  logAppEvent(appId, "ready");
  if (startedAt === undefined) return;
  launches.delete(appId);
  const timing: AppTiming = { appId, separate, ms: Math.round(nowMs() - startedAt), ...(pid ? { pid } : {}) };
  timings.push(timing);
  if (timings.length > MAX_TIMINGS) timings.shift();
  readyListeners.forEach((l) => l(timing));
  changed();
}

export function setAppMemory(timing: AppTiming, memoryKb: number): void {
  timing.memoryKb = memoryKb;
  changed();
}

export const appTimings = (): readonly AppTiming[] => timings;
export const getAppTimingsVersion = () => timingsVersion;

const subscribe = <T>(set: Set<T>, listener: T) => {
  set.add(listener);
  return () => void set.delete(listener);
};
export const subscribeAppTimings = (listener: () => void) => subscribe(timingListeners, listener);
export const onAppLaunch = (listener: (appId: string) => void) => subscribe(launchListeners, listener);
export const onAppReady = (listener: (timing: AppTiming) => void) => subscribe(readyListeners, listener);
