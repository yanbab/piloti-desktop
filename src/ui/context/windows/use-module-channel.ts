/** The shell's side of its app module windows: menus, size, and what they watch. */
import { dropFromApp } from "@/ui/dnd/drop-from-app";
import { droppedActions, type FileDropWindowDetail } from "@/core/files/dropped-paths";
import * as React from "react";
import type { DesktopWindowInstance } from "@/ui/context/windows/types";
import { moduleInstance, resolveAppModuleByUrl } from "@/core/data/app-modules";
import { recordAppReady } from "@/core/util/perf-log";
import { publishWindowMenuState } from "@/platform/shared/app-bridge";
import {
  forgetModule,
  moduleState,
  onModuleRequest,
  onModuleState,
  sendToModule,
} from "@/platform/shared/module-ipc";
import type { Piloti } from "@/platform/shared/piloti";
import { shellWindowsKey } from "@/core/ports/shell-host";
import { toShellWindows } from "@/core/windows/shell-windows";

type Resize = (windowId: string, patch: { size: { width: number; height: number } }) => void;

export interface ModuleChannelActions {
  resize: Resize;
  close: (windowId: string) => void;
  focus: (windowId: string) => void;
}

/** Windows change at drag rate in places; modules hear of them at most this often. */
const WINDOWS_DELAY_MS = 250;

export function useModuleChannel(
  piloti: Piloti,
  windows: readonly DesktopWindowInstance[],
  actions: ModuleChannelActions,
): void {
  const { resize } = actions;
  // `<instance>=<windowId>` pairs: changes only when module windows do.
  const key = windows
    .flatMap((w) => {
      const id = resolveAppModuleByUrl(w.browserUrl) && moduleInstance(w.browserUrl);
      return id ? [`${id}=${w.id}`] : [];
    })
    .join(" ");
  const windowsRef = React.useRef(windows);
  windowsRef.current = windows;
  const resizeRef = React.useRef(resize);
  resizeRef.current = resize;
  const known = React.useRef(new Set<string>());
  /** The size last applied, so a window the user resized stays so. */
  const sizes = React.useRef(new Map<string, string>());
  const drawn = React.useRef(new Set<string>());

  React.useEffect(() => {
    const modules = new Map(key ? key.split(" ").map((p) => p.split("=") as [string, string]) : []);
    for (const id of known.current) {
      if (modules.has(id)) continue;
      forgetModule(id);
      sizes.current.delete(id);
      drawn.current.delete(id);
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
        if (state?.ready && !drawn.current.has(id)) {
          drawn.current.add(id);
          const appId = windowsRef.current.find((w) => w.id === windowId)?.appId;
          if (appId) recordAppReady(appId, true);
        }
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
    // Items dropped on a module's window: Folders takes them into its folder,
    // an editor or a viewer opens the first.
    const onFileDrop = (e: Event) => {
      const detail = (e as CustomEvent<FileDropWindowDetail>).detail;
      for (const [id, module] of modules) {
        if (module !== detail?.windowId) continue;
        for (const actionId of droppedActions(detail)) sendToModule(piloti, { to: id, type: "action", actionId });
      }
    };
    window.addEventListener("piloti:app-action", onAppAction);
    window.addEventListener("residence:file-drop-window", onFileDrop);
    const stop = onModuleState(apply);
    apply();
    return () => {
      stop();
      window.removeEventListener("piloti:app-action", onAppAction);
      window.removeEventListener("residence:file-drop-window", onFileDrop);
    };
  }, [key, piloti]);

  // Requests: any module may ask, as any program of the session could.
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;
  const pilotiRef = React.useRef(piloti);
  pilotiRef.current = piloti;
  React.useEffect(
    () =>
      onModuleRequest((id, request) => {
        if (request.do === "drop-items") {
          const win = windowsRef.current.find((w) => moduleInstance(w.browserUrl) === id);
          const view = win && document.querySelector(`[data-module-view="${CSS.escape(win.id)}"]`);
          if (view) dropFromApp(pilotiRef.current, view, request);
          return;
        }
        // Launches and opens: `useModuleOpenRequests`.
        if (request.do !== "close-window" && request.do !== "focus-window") return;
        const exists = windowsRef.current.some((w) => w.id === request.windowId);
        if (!exists) return;
        if (request.do === "close-window") actionsRef.current.close(request.windowId);
        else actionsRef.current.focus(request.windowId);
      }),
    [],
  );

  // Modules watching the windows: told when they change, and when they start.
  const shellWindows = React.useMemo(() => toShellWindows(windows), [windows]);
  const windowsKey = shellWindowsKey(shellWindows);
  const shellWindowsRef = React.useRef(shellWindows);
  shellWindowsRef.current = shellWindows;
  /** The windows each watcher was last sent. */
  const told = React.useRef(new Map<string, string>());
  const keyRef = React.useRef(key);
  keyRef.current = key;
  const tell = React.useCallback(() => {
    const instances = new Set(keyRef.current ? keyRef.current.split(" ").map((p) => p.split("=")[0]!) : []);
    const list = shellWindowsRef.current;
    const current = shellWindowsKey(list);
    for (const id of [...told.current.keys()]) if (!instances.has(id)) told.current.delete(id);
    for (const id of instances) {
      if (!moduleState(id)?.watch?.includes("windows")) {
        told.current.delete(id);
        continue;
      }
      if (told.current.get(id) === current) continue;
      told.current.set(id, current);
      sendToModule(piloti, { to: id, type: "windows", windows: list });
    }
  }, [piloti]);
  // A module that starts watching, or a new module window, is told at once.
  React.useEffect(() => {
    tell();
    return onModuleState(tell);
  }, [key, tell]);
  // Changes of the windows, at most every WINDOWS_DELAY_MS.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (told.current.size === 0 || timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      tell();
    }, WINDOWS_DELAY_MS);
  }, [windowsKey, tell]);
  React.useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
}
