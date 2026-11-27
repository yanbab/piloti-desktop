import * as React from "react";
import { useDesktopSettings } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { DRAG_EASE_SETTLE } from "@/lib/shell/drag-feedback";

const SLIDE_MS = 260;
const SLIDE_PX = 80;
const HINT_MS = 1400;

/**
 * Slides the window stage in from the side of the new workspace, and says so
 * when that workspace has no window.
 */
export function WorkspaceTransition({
  stageRef,
  empty,
}: {
  stageRef: React.RefObject<HTMLElement | null>;
  empty: boolean;
}) {
  const { activeWorkspace, reduceMotion } = useDesktopSettings(["activeWorkspace", "reduceMotion"]);
  const previous = React.useRef(activeWorkspace);
  // The workspace the hint is about, while it shows.
  const [hint, setHint] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const direction = Math.sign(activeWorkspace - previous.current);
    if (!direction) return;
    previous.current = activeWorkspace;
    setHint(activeWorkspace);
    const timer = window.setTimeout(() => setHint(null), HINT_MS);
    const reduced = reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const slide = reduced
      ? undefined
      : stageRef.current?.animate(
          [{ transform: `translateX(${direction * SLIDE_PX}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: SLIDE_MS, easing: DRAG_EASE_SETTLE },
        );
    return () => {
      window.clearTimeout(timer);
      slide?.cancel();
    };
  }, [activeWorkspace, reduceMotion, stageRef]);

  if (!empty || hint !== activeWorkspace) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-1/2 left-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 rounded-ui-control bg-ui-hud-dark px-2.5 py-1 text-ui-small text-ui-hud-dark-label"
    >
      {_("Workspace %s is empty", String(activeWorkspace))}
    </div>
  );
}
