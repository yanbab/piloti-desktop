/**
 * Puts a dnd-kit drag in `drag-session.ts`. Place inside each `DndContext`.
 * dnd-kit cancels on its own Escape keydown; when the drag must end from
 * elsewhere (Escape grabbed from the compositor, a missed release), it gets
 * that Escape.
 */
import { useDndMonitor } from "@dnd-kit/core";
import * as React from "react";
import { trackDrag } from "./drag-session";

function sendEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
}

export function DndKitDragSession() {
  const untrack = React.useRef<(() => void) | null>(null);
  const stop = React.useCallback(() => {
    untrack.current?.();
    untrack.current = null;
  }, []);
  useDndMonitor({
    onDragStart: () => {
      stop();
      untrack.current = trackDrag(() => {
        untrack.current = null;
        sendEscape();
      });
    },
    onDragEnd: stop,
    onDragCancel: stop,
  });
  React.useEffect(() => stop, [stop]);
  return null;
}
