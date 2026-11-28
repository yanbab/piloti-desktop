/**
 * A drag that started in an app on its own (a module, the demo's iframe).
 * Domicile gives each pointer move to the surface under the pointer, so once
 * it leaves the app's window the app hears nothing more, not even the release:
 * the shell follows the drag from there (ghost, highlighted targets) and drops.
 * In the demo's iframe the browser keeps the pointer in the frame, so nothing
 * arrives here and the app drops itself (`drop-items`).
 */
import type { AppDragState } from "@/core/apps/module-channel";
import type { Piloti } from "@/platform/shared/piloti";
import { appDropItems, moveOrCopyFromApp } from "@/ui/dnd/drop-from-app";
import { broadcastItemDrag, endItemDragBroadcast, routeItemDrop } from "@/ui/dnd/item-drop";
import { liftGhost } from "@/ui/fx/drag-feedback";

interface AppDrag {
  source: string;
  stop(): void;
}

let current: AppDrag | null = null;

/** Ends the drag `source` reported, if it is the one followed. */
export function endAppDrag(source: string): void {
  if (current?.source === source) current.stop();
}

/**
 * Follows the drag of `paths` that `source` (its window id) reports, over
 * `frame`, its view. `tell` lets the app know what the shell did with it.
 */
export function followAppDrag(
  piloti: Piloti,
  source: string,
  frame: Element,
  paths: readonly string[],
  tell: (state: AppDragState) => void,
): void {
  current?.stop();
  if (paths.length === 0) return;
  const items = appDropItems(paths);
  let ghost: HTMLElement | null = null;
  let away = false;
  let frameId = 0;
  let last = { x: 0, y: 0 };

  const overFrame = (x: number, y: number) => {
    const r = frame.getBoundingClientRect();
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  };
  const place = () => {
    frameId = 0;
    if (ghost) ghost.style.translate = `${last.x}px ${last.y}px`;
    broadcastItemDrag(items[0]!, items, last.x, last.y);
  };
  const onMove = (e: PointerEvent) => {
    // Released where the shell could not see it: nothing to drop.
    if ((e.buttons & 1) === 0) {
      finish();
      return;
    }
    // Back over the app: it hears the pointer again and draws the drag.
    if (overFrame(e.clientX, e.clientY)) {
      if (!away) return;
      away = false;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      if (ghost) ghost.style.display = "none";
      endItemDragBroadcast();
      return;
    }
    if (!away) {
      away = true;
      tell("outside");
      ghost ??= makeGhost(items[0]!.name, items.length);
      ghost.style.display = "";
    }
    last = { x: e.clientX, y: e.clientY };
    frameId ||= requestAnimationFrame(place);
  };
  const onUp = (e: PointerEvent) => {
    if (!away || overFrame(e.clientX, e.clientY)) return;
    const point = { x: e.clientX, y: e.clientY, copy: e.altKey || e.ctrlKey };
    finish();
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
    tell("ended");
  };
  const stop = () => {
    if (current?.source !== source) return;
    current = null;
    if (frameId) cancelAnimationFrame(frameId);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("keydown", onKey, true);
    ghost?.remove();
    if (away) endItemDragBroadcast();
  };
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("keydown", onKey, true);
  current = { source, stop };
}

/** What the shell shows of the items: their name, lifted, and how many. */
function makeGhost(name: string, count: number): HTMLElement {
  const ghost = document.createElement("div");
  ghost.dataset.dragGhost = "";
  ghost.style.cssText =
    "position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;margin:-14px 0 0 12px;";
  const label = document.createElement("div");
  label.textContent = count > 1 ? `${name} +${count - 1}` : name;
  label.style.cssText =
    "max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 10px;border-radius:8px;background:var(--ui-accent);color:var(--ui-accent-foreground);font:600 13px/20px system-ui";
  liftGhost(label);
  ghost.appendChild(label);
  document.body.appendChild(ghost);
  return ghost;
}
