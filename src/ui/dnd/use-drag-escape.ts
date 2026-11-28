/**
 * Escape reaches the shell during a drag whichever app has the keyboard: the
 * shell grabs it from the compositor while a drag runs (`drag-session.ts`),
 * and lets it go after, so apps get their Escape back.
 */
import * as React from "react";
import type { Piloti } from "@/platform/shared/piloti";
import { activeDragCount, escapeDrags, onDragsChange } from "./drag-session";

const ESCAPE = "Escape";

export function useDragEscape(piloti: Piloti): void {
  React.useEffect(() => {
    let grabbed = false;
    const setGrab = (want: boolean) => {
      if (want === grabbed) return;
      grabbed = want;
      try {
        if (want) piloti.keyboard.grab(ESCAPE);
        else piloti.keyboard.ungrab(ESCAPE);
      } catch {
        // A host without key grabs: the shell's own keydown still cancels.
      }
    };
    const stopShortcut = piloti.keyboard.on("shortcut", ({ chord }) => {
      if (chord === ESCAPE) escapeDrags();
    });
    // Settled once per task: a drag that ends as another starts grabs nothing.
    let queued = false;
    const stopDrags = onDragsChange(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        setGrab(activeDragCount() > 0);
      });
    });
    return () => {
      stopDrags();
      stopShortcut();
      setGrab(false);
    };
  }, [piloti]);
}
