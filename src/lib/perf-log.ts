const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const BOOT_START_MS = nowMs();

export function bootElapsedMs(): number {
  return Math.round(nowMs() - BOOT_START_MS);
}

export function logBootEvent(message: string): void {
  console.info(`[piloti:boot] ${message} (@ ${bootElapsedMs()}ms)`);
}

export function startBootPhase(label: string): (detail?: string) => void {
  const startedAt = nowMs();
  logBootEvent(`starting ${label}`);
  let ended = false;
  return (detail?: string) => {
    if (ended) return;
    ended = true;
    const duration = Math.round(nowMs() - startedAt);
    const suffix = detail ? ` (${detail})` : "";
    logBootEvent(`loaded ${label}${suffix} in ${duration}ms`);
  };
}
