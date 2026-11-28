/** The shell's side of its app module windows: their menus and their size. */
import * as React from "react";
import type { DesktopWindowInstance } from "@/context/windows/types";
import { moduleInstance, resolveAppModuleByUrl } from "@/data/app-modules";
import { publishWindowMenuState } from "@/lib/engine/app-bridge";
import { forgetModule, moduleState, onModuleState, sendToModule } from "@/lib/engine/module-ipc";
import type { Piloti } from "@/lib/engine/piloti";

type Resize = (windowId: string, patch: { size: { width: number; height: number } }) => void;

export function useModuleChannel(
  piloti: Piloti,
  windows: readonly DesktopWindowInstance[],
  resize: Resize,
): void {
  // `<instance>=<windowId>` pairs: changes only when module windows do.
  const key = windows
    .flatMap((w) => {
      const id = resolveAppModuleByUrl(w.browserUrl) && moduleInstance(w.browserUrl);
      return id ? [`${id}=${w.id}`] : [];
    })
    .join(" ");
  const resizeRef = React.useRef(resize);
  resizeRef.current = resize;
  const known = React.useRef(new Set<string>());
  /** The size last applied, so a window the user resized stays so. */
  const sizes = React.useRef(new Map<string, string>());

  React.useEffect(() => {
    const modules = new Map(key ? key.split(" ").map((p) => p.split("=") as [string, string]) : []);
    for (const id of known.current) {
      if (modules.has(id)) continue;
      forgetModule(id);
      sizes.current.delete(id);
    }
    // A shell that was reloaded, or a state sent before the window was listed.
    for (const id of modules.keys()) {
      if (!known.current.has(id) && !moduleState(id)) sendToModule(piloti, { to: id, type: "sync" });
    }
    known.current = new Set(modules.keys());
    if (modules.size === 0) return;

    const apply = () => {
      for (const [id, windowId] of modules) {
        const state = moduleState(id);
        if (state?.menu) publishWindowMenuState(windowId, state.menu);
        const size = state?.size;
        if (!size || sizes.current.get(id) === `${size.width}x${size.height}`) continue;
        sizes.current.set(id, `${size.width}x${size.height}`);
        const titlebar = document.querySelector<HTMLElement>(`[data-window-id="${windowId}"] header`);
        resizeRef.current(windowId, {
          size: { width: size.width, height: size.height + (titlebar?.offsetHeight ?? 0) },
        });
      }
    };
    const onAppAction = (e: Event) => {
      const { windowId, actionId } = (e as CustomEvent).detail ?? {};
      for (const [id, module] of modules) {
        if (module === windowId && actionId) sendToModule(piloti, { to: id, type: "action", actionId });
      }
    };
    window.addEventListener("piloti:app-action", onAppAction);
    const stop = onModuleState(apply);
    apply();
    return () => {
      stop();
      window.removeEventListener("piloti:app-action", onAppAction);
    };
  }, [key, piloti]);
}
