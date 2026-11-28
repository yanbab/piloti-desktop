/** Adds to each measured start what the renderers grew by (Linux, Devtools ▸ Apps). */
import * as React from "react";
import { onAppLaunch, onAppReady, setAppMemory } from "@/core/util/perf-log";
import type { Piloti } from "@/platform/shared/piloti";
import { readProcessMemory, readRendererMemory } from "@/platform/shared/system-commands";

/** A renderer goes on allocating after its first drawing. */
const SETTLE_MS = 3000;

export function useAppMemory(piloti: Piloti, systemServices: boolean): void {
  React.useEffect(() => {
    if (!systemServices) return;
    const before = new Map<string, ReturnType<typeof readRendererMemory>>();
    const stopLaunch = onAppLaunch((appId) => before.set(appId, readRendererMemory(piloti)));
    const stopReady = onAppReady((timing) => {
      const start = before.get(timing.appId);
      before.delete(timing.appId);
      if (!start) return;
      window.setTimeout(() => {
        if (timing.pid) {
          void readProcessMemory(piloti, timing.pid).then((kb) => {
            if (kb) setAppMemory(timing, kb);
          });
          return;
        }
        void Promise.all([start, readRendererMemory(piloti)]).then(([from, to]) => {
          if (from && to) setAppMemory(timing, to.totalKb - from.totalKb);
        });
      }, SETTLE_MS);
    });
    return () => {
      stopLaunch();
      stopReady();
    };
  }, [piloti, systemServices]);
}
