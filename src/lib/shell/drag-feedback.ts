/**
 * Drag-and-drop feedback shared by every draggable surface, so they all move
 * and look the same: the lift when an item is picked up, the springy shuffle
 * of neighbours, the settle into place after a drop and the fly-back when a
 * drop is cancelled.
 *
 * Two families use it:
 * - item drag-and-drop on dnd-kit (icon grids, dock): ghost styling, drop and
 *   shuffle animations, the FLIP settle from the drop point;
 * - moving surfaces on plain pointer events (launcher, floating presentations,
 *   see `pointer-drag.ts` and `floating-window.ts`): the settle transition.
 */

/** Calm deceleration: things coming to rest (settle after a drop or a move). */
export const DRAG_EASE_SETTLE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Springy overshoot: neighbours sliding aside, the ghost lifting. */
export const DRAG_EASE_SPRING = "cubic-bezier(0.34, 1.45, 0.5, 1)";
/** Softer spring for the ghost flying back when nothing moved. */
export const DRAG_EASE_FLY_BACK = "cubic-bezier(0.34, 1.35, 0.5, 1)";

export const DRAG_DURATION = {
  /** Ghost scaling up and gaining its shadow. */
  lift: 200,
  /** Items or surfaces sliding from the drop point into place. */
  settle: 240,
  /** Ghost returning to its start (cancelled or rejected drop). */
  flyBack: 300,
  /** Neighbours making room while dragging. */
  shuffle: 320,
} as const;

/** Pointer travel (px) before a press becomes a drag, for every surface. */
export const DRAG_THRESHOLD = 5;

/** What an item looks like in hand vs. at rest. */
export const DRAG_LIFT = {
  scale: 1.1,
  opacity: 0.9,
  shadow: "drop-shadow(0 10px 16px rgba(0,0,0,0.4))",
  restShadow: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
} as const;

/** dnd-kit `DragOverlay.dropAnimation` for the fly-back. */
export const dragFlyBackAnimation = {
  duration: DRAG_DURATION.flyBack,
  easing: DRAG_EASE_FLY_BACK,
};

/** dnd-kit `useSortable({ transition })` for the neighbour shuffle. */
export const dragShuffleTransition = {
  duration: DRAG_DURATION.shuffle,
  easing: DRAG_EASE_SPRING,
};

/** CSS `transition` value for neighbours shuffling on the given properties. */
export function dragShuffleCss(...properties: string[]): string {
  return properties
    .map((p) => `${p} ${DRAG_DURATION.shuffle}ms ${DRAG_EASE_SPRING}`)
    .join(", ");
}

/** CSS `transition` value for something settling on the given property. */
export function dragSettleCss(property: string): string {
  return `${property} ${DRAG_DURATION.settle}ms ${DRAG_EASE_SETTLE}`;
}

/** Puts a freshly created ghost at rest, then animates the lift on the next frame. */
export function liftGhost(el: HTMLElement): void {
  el.style.transformOrigin = "50% 40%";
  el.style.opacity = String(DRAG_LIFT.opacity);
  el.style.transform = "scale(1)";
  el.style.filter = DRAG_LIFT.restShadow;
  el.style.transition = `transform ${DRAG_DURATION.lift}ms ${DRAG_EASE_SPRING}, filter ${DRAG_DURATION.lift}ms ease`;
  requestAnimationFrame(() => {
    el.style.transform = `scale(${DRAG_LIFT.scale})`;
    el.style.filter = DRAG_LIFT.shadow;
  });
}

/**
 * FLIP "settle from the drop point": the element is already in its new place;
 * it jumps to where it was dropped (offset `dx`, `dy` from there) and glides
 * home. It never passes through its start position. Returns a cancel function.
 */
export function settleFromOffset(el: HTMLElement, dx: number, dy: number): () => void {
  el.style.transition = "none";
  el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  void el.offsetWidth;
  el.style.transition = dragSettleCss("transform");
  el.style.transform = "translate3d(0, 0, 0)";
  const timer = window.setTimeout(() => {
    el.style.transition = "";
    el.style.transform = "";
  }, DRAG_DURATION.settle + 20);
  return () => window.clearTimeout(timer);
}

/**
 * Animates a moving surface to its released position with the settle curve
 * (`apply` sets the final style), then drops the transition again.
 */
export function settleSurface(
  el: HTMLElement,
  property: string,
  apply: () => void,
): () => void {
  el.style.transition = dragSettleCss(property);
  apply();
  const timer = window.setTimeout(() => {
    el.style.transition = "";
  }, DRAG_DURATION.settle + 20);
  return () => window.clearTimeout(timer);
}
