/**
 * Runs `run` one call at a time. Calls made while it runs are folded into one
 * more run with the latest argument, so runs never overlap or pile up.
 */
export function latestRunner<T>(run: (arg: T) => Promise<unknown>): (arg: T) => void {
  let busy = false;
  let next: { arg: T } | null = null;
  const start = async (arg: T) => {
    busy = true;
    try {
      await run(arg);
    } catch (error) {
      console.warn("[piloti] a queued run failed", error);
    } finally {
      busy = false;
      const queued = next;
      next = null;
      if (queued) void start(queued.arg);
    }
  };
  return (arg) => {
    if (busy) next = { arg };
    else void start(arg);
  };
}
