/**
 * The module's side of Window Controls Overlay (`core/apps/window-controls-overlay.ts`):
 * `navigator.windowControlsOverlay` and the `--titlebar-area-*` variables for
 * the page, and the regions that drag the window for the shell.
 */
import {
  dragRegions,
  titlebarAreaRect,
  type OverlayGeometry,
  type Rect,
} from "@/core/apps/window-controls-overlay";

/** What drags the window: titlebars, and what a page marks so. */
const DRAG = '[data-slot="window-titlebar"], [data-window-drag-region], [data-app-region="drag"]';
/** What stays clickable inside them. */
const NO_DRAG =
  'button, a, input, textarea, select, [role="button"], [role="tab"], [role="slider"], [contenteditable="true"], [data-window-no-drag], [data-app-region="no-drag"]';

/**
 * Installs the stand-in for the standard API; returns `set` to change the
 * geometry (the event fires when the free area changes).
 */
export function installWindowControlsOverlay(initial: OverlayGeometry) {
  let geometry = initial;
  const target = new EventTarget();
  let last = "";
  const overlay = {
    get visible() {
      return geometry.visible;
    },
    getTitlebarAreaRect() {
      const r = titlebarAreaRect(window.innerWidth, geometry);
      return new DOMRect(r.x, r.y, r.width, r.height);
    },
    ongeometrychange: null as ((event: Event) => void) | null,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  try {
    Object.defineProperty(navigator, "windowControlsOverlay", { configurable: true, get: () => overlay });
  } catch {
    // A browser that refuses: the CSS variables still work.
  }
  const apply = () => {
    const r = titlebarAreaRect(window.innerWidth, geometry);
    const style = document.documentElement.style;
    style.setProperty("--titlebar-area-x", `${r.x}px`);
    style.setProperty("--titlebar-area-y", `${r.y}px`);
    style.setProperty("--titlebar-area-width", `${r.width}px`);
    style.setProperty("--titlebar-area-height", `${r.height}px`);
    const key = `${geometry.visible}:${r.x},${r.y},${r.width},${r.height}`;
    if (key === last) return;
    const first = last === "";
    last = key;
    if (first) return;
    const event = Object.assign(new Event("geometrychange"), {
      titlebarAreaRect: new DOMRect(r.x, r.y, r.width, r.height),
      visible: geometry.visible,
    });
    overlay.ongeometrychange?.(event);
    target.dispatchEvent(event);
  };
  window.addEventListener("resize", apply);
  apply();
  return {
    set(next: OverlayGeometry) {
      geometry = next;
      apply();
    },
  };
}

const toRect = (r: DOMRect): Rect => ({ x: r.left, y: r.top, width: r.width, height: r.height });

/** The drag regions now, in the page's coordinates. */
export function readDragRegions(root: ParentNode = document): Rect[] {
  const drag = Array.from(root.querySelectorAll<HTMLElement>(DRAG)).filter((el) => !el.parentElement?.closest(DRAG));
  const holes = drag.flatMap((el) => Array.from(el.querySelectorAll<HTMLElement>(NO_DRAG)));
  return dragRegions(
    drag.map((el) => toRect(el.getBoundingClientRect())),
    holes.map((el) => toRect(el.getBoundingClientRect()))
  );
}

/** Calls `publish` with the drag regions whenever the page's layout changes, at most every 200 ms. */
export function watchDragRegions(publish: (regions: Rect[]) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    timer ??= setTimeout(() => {
      timer = null;
      publish(readDragRegions());
    }, 200);
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(document.documentElement);
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
  schedule();
  return () => {
    resize.disconnect();
    mutations.disconnect();
    if (timer) clearTimeout(timer);
  };
}
