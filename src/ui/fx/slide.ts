/**
 * piloti-fx, edge panels: panels that slide in from a screen edge and back
 * out, such as the workspaces strip at the top of the Overview and the
 * on-screen keyboard at the bottom. One duration and one curve, so every edge
 * panel moves the same way.
 *
 * The curve is the settle (`FX_EASE.settle`): a panel coming to rest moves
 * like an item dropped into place.
 */
import * as React from "react";
import { FX_DURATION, fxTransition } from "@/ui/fx/motion";

export const SLIDE_DURATION = FX_DURATION.slide;

/** CSS `transition` for the given properties, `transform` by default. */
export function slideTransition(...properties: string[]): string {
  return fxTransition(SLIDE_DURATION, "settle", ...properties);
}

/**
 * Whether a sliding panel is in the page: true while `open`, and for the
 * slide out after. Mount the panel while this is true.
 */
export function useSlidePresence(open: boolean): boolean {
  const [mounted, setMounted] = React.useState(open);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), SLIDE_DURATION + 10);
    return () => window.clearTimeout(timer);
  }, [open]);
  return open || mounted;
}

/**
 * Whether the panel is at its place on screen: false on its first frame, so
 * it slides in even when it mounts already open, and false again as soon as
 * it closes. Use it inside the panel, so a lazy panel slides in once loaded.
 */
export function useSlideShown(open: boolean): boolean {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    // Two frames: the off-screen position has been painted before it moves.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open]);
  return open && shown;
}
