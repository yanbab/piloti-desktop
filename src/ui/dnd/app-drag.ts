/**
 * A drag that started in an app on its own (a module, the demo's iframe).
 * Domicile gives each pointer move to the surface under the pointer, so once
 * it leaves the app's window the app hears nothing more, not even the release.
 * As a compositor does (Wayland's `start_drag`), the shell then owns the drag:
 * a layer over the whole screen takes the pointer, the shell draws the items
 * and lights its targets, and tells a module window under the pointer where
 * the drag is (`over`, `leave`) and where it was dropped (`drop`), so the
 * module lights and fills its own folders, the source's included.
 * In the demo's iframe the browser keeps the pointer in the frame, so nothing
 * arrives here and the app drops itself (`drop-items`).
 */
import type { AppDragEvent } from "@/core/apps/module-channel";
import { sendToModule } from "@/platform/shared/module-ipc";
import type { Piloti } from "@/platform/shared/piloti";
import { moveOrCopyFromApp } from "@/ui/dnd/drop-from-app";
import { broadcastItemDrag, endItemDragBroadcast, pathItems, routeItemDrop } from "@/ui/dnd/item-drop";
import { liftGhost } from "@/ui/fx/drag-feedback";

/** How often a module under the drag hears where it is. */
const MODULE_OVER_MS = 33;

interface AppDrag {
  source: string;
  stop(): void;
}

let current: AppDrag | null = null;

/** The app whose drag the shell follows, if any (its window id). */
export const appDragSource = (): string | null => current?.source ?? null;

/** Ends the drag `source` reported, if it is the one followed. */
export function endAppDrag(source: string): void {
  if (current?.source === source) current.stop();
}

/** The module window under a point (`data-module-instance` on its view), and the point in it. */
function moduleAt(x: number, y: number): { instance: string; x: number; y: number } | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const instance = el.getAttribute("data-module-instance");
    if (!instance) continue;
    const r = el.getBoundingClientRect();
    return { instance, x: x - r.left, y: y - r.top };
  }
  return null;
}

/**
 * Follows the drag of `paths` that `source` (its window id) reports, over
 * `frame`, its view. `tell` lets the app know what the shell did with it.
 */
export function followAppDrag(
  piloti: Piloti,
  source: string,
  frame: Element,
  drag: { paths: readonly string[]; icon?: string },
  tell: (event: AppDragEvent) => void,
): void {
  const { icon } = drag;
  const paths = [...drag.paths];
  current?.stop();
  if (paths.length === 0) return;
  const items = pathItems(paths);
  let ghost: HTMLElement | null = null;
  let layer: HTMLElement | null = null;
  let frameId = 0;
  let last = { x: 0, y: 0 };
  let module: { instance: string; sentAt: number } | null = null;

  const toModule = (instance: string, event: AppDragEvent) =>
    sendToModule(piloti, { to: instance, type: "drag", ...event });
  const overFrame = (x: number, y: number) => {
    const r = frame.getBoundingClientRect();
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  };
  const place = () => {
    frameId = 0;
    if (ghost) ghost.style.translate = `${last.x}px ${last.y}px`;
    const under = moduleAt(last.x, last.y);
    if (module && module.instance !== under?.instance) {
      toModule(module.instance, { state: "leave" });
      module = null;
    }
    if (under) {
      // The module lights its own folders; the shell's targets stand down.
      endItemDragBroadcast();
      const now = performance.now();
      if (module && now - module.sentAt < MODULE_OVER_MS) return;
      module = { instance: under.instance, sentAt: now };
      toModule(under.instance, { state: "over", paths, x: under.x, y: under.y });
      return;
    }
    broadcastItemDrag(items[0]!, items, last.x, last.y);
  };
  const onMove = (e: PointerEvent) => {
    // Released where the shell could not see it: nothing to drop.
    if ((e.buttons & 1) === 0) {
      finish();
      return;
    }
    // Still in the app's window, before the shell took it: the app draws it.
    if (!layer && overFrame(e.clientX, e.clientY)) return;
    if (!layer) {
      layer = document.createElement("div");
      layer.dataset.dragLayer = "";
      layer.style.cssText = "position:fixed;inset:0;z-index:2147483645;cursor:default";
      document.body.appendChild(layer);
      ghost = makeGhost(items[0]!.name, items.length, icon);
      tell({ state: "outside" });
    }
    last = { x: e.clientX, y: e.clientY };
    frameId ||= requestAnimationFrame(place);
  };
  const onUp = (e: PointerEvent) => {
    if (!layer) return;
    const point = { x: e.clientX, y: e.clientY, copy: e.altKey || e.ctrlKey };
    finish();
    const under = moduleAt(point.x, point.y);
    if (under) {
      toModule(under.instance, { state: "drop", paths, x: under.x, y: under.y, copy: point.copy });
      return;
    }
    routeItemDrop(items[0]!, items, point, {
      onDropItems: (list, destPath, options) =>
        void moveOrCopyFromApp(piloti, list, destPath, options?.copy === true),
    });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") finish();
  };
  const finish = () => {
    stop();
    tell({ state: "ended" });
  };
  const stop = () => {
    if (current?.source !== source) return;
    current = null;
    if (frameId) cancelAnimationFrame(frameId);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("keydown", onKey, true);
    if (module) toModule(module.instance, { state: "leave" });
    ghost?.remove();
    layer?.remove();
    if (layer) endItemDragBroadcast();
  };
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("keydown", onKey, true);
  current = { source, stop };
}

/**
 * What the shell shows of the items, as the app's grid did: the first one's
 * icon over its name, lifted, with how many there are.
 */
function makeGhost(name: string, count: number, icon: string | undefined): HTMLElement {
  const ghost = document.createElement("div");
  ghost.dataset.dragGhost = "";
  ghost.style.cssText =
    "position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;width:112px;margin:-40px 0 0 -56px;";
  const body = document.createElement("div");
  body.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;gap:4px";
  if (icon) {
    const img = document.createElement("img");
    img.src = icon;
    img.alt = "";
    img.style.cssText = "width:64px;height:64px;object-fit:contain";
    body.appendChild(img);
  }
  const label = document.createElement("div");
  label.textContent = name;
  label.style.cssText =
    "max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border-radius:6px;background:var(--ui-accent);color:var(--ui-accent-foreground);font:500 13px/18px system-ui";
  body.appendChild(label);
  if (count > 1) {
    const badge = document.createElement("span");
    badge.textContent = String(count);
    badge.style.cssText =
      "position:absolute;top:-2px;right:14px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--ui-accent);color:var(--ui-accent-foreground);font:700 11px/20px system-ui;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.35)";
    body.appendChild(badge);
  }
  liftGhost(body);
  ghost.appendChild(body);
  document.body.appendChild(ghost);
  return ghost;
}
