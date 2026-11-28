/**
 * The popup layer holds one surface at a time: a menu, context menu or other
 * transient popup. Opening one closes whatever was open, so a single event
 * (a right-click handled at two levels, a shortcut…) can never leave two
 * menus on screen.
 *
 * Surfaces opened from inside another surface (a submenu, a select inside a
 * menu) are nested: they live inside their parent's popup and do not replace
 * it. Wrappers mark that with `PopupSurfaceScope` around their content.
 */

import * as React from "react";

interface Holder {
  token: symbol;
  close: () => void;
}

let current: Holder | null = null;

/** Registers an open surface, closing the previous one. Returns a release. */
export function openPopupSurface(close: () => void): () => void {
  const previous = current;
  const token = Symbol("popup-surface");
  current = { token, close };
  if (previous) previous.close();
  return () => {
    if (current?.token === token) current = null;
  };
}

/** Whether a surface currently holds the popup layer (for tests/diagnostics). */
export function hasOpenPopupSurface(): boolean {
  return current !== null;
}

const NestedContext = React.createContext(false);

/** Wrap a surface's content so surfaces opened inside it count as nested. */
export function PopupSurfaceScope({ children }: { children: React.ReactNode }) {
  return React.createElement(NestedContext.Provider, { value: true }, children);
}

/**
 * Keeps a surface on the popup layer while `open` is true. `close` must close
 * it; it is called when another top-level surface opens.
 */
export function usePopupSurface(open: boolean, close: () => void): void {
  const nested = React.useContext(NestedContext);
  const closeRef = React.useRef(close);
  closeRef.current = close;
  React.useEffect(() => {
    if (!open || nested) return;
    return openPopupSurface(() => closeRef.current());
  }, [open, nested]);
}

/**
 * Open state for a menu root that may be controlled or not, registered on the
 * popup layer. Returns the props to pass to the Base UI root.
 */
export function usePopupSurfaceState<Details>(props: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: Details) => void;
}): { open: boolean; onOpenChange: (open: boolean, details: Details) => void } {
  const { open: openProp, defaultOpen, onOpenChange } = props;
  const [inner, setInner] = React.useState(defaultOpen ?? false);
  const open = openProp ?? inner;
  const handleOpenChange = React.useCallback(
    (next: boolean, details: Details) => {
      if (openProp === undefined) setInner(next);
      onOpenChange?.(next, details);
    },
    [onOpenChange, openProp]
  );
  usePopupSurface(open, () => handleOpenChange(false, undefined as Details));
  return { open, onOpenChange: handleOpenChange };
}

/** Base UI's own backdrop, and the one of hand-made menus. */
const BACKDROP = "[data-base-ui-inert], [data-popup-backdrop]";

/**
 * Menus and context menus put an invisible backdrop over the page, which
 * swallows the press that dismisses them: a window could not be dragged while
 * one was open. A press over a window's drag region closes the open surface
 * and is handed on to what is under the backdrop, so the drag starts at once.
 * Elsewhere the first click still only dismisses.
 */
export function installPopupPressThrough(
  dragRegion: string,
  keepOut: string
): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (!current || !event.isTrusted || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.matches(BACKDROP)) return;

    const backdrops = [...document.querySelectorAll<HTMLElement>(BACKDROP)];
    const previous = backdrops.map((b) => b.style.pointerEvents);
    backdrops.forEach((b) => (b.style.pointerEvents = "none"));
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const grabs = under?.closest(dragRegion) && !under.closest(keepOut);
    if (under && grabs) {
      event.preventDefault();
      event.stopImmediatePropagation();
      current.close();
      under.dispatchEvent(new PointerEvent("pointerdown", event));
    }
    backdrops.forEach((b, i) => (b.style.pointerEvents = previous[i] ?? ""));
  };
  window.addEventListener("pointerdown", onPointerDown, true);
  return () => window.removeEventListener("pointerdown", onPointerDown, true);
}
