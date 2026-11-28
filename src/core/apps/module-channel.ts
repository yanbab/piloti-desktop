/**
 * Messages between the shell and an app module once it runs, as Electron's IPC
 * on what Domicile gives a module:
 *
 * - module to shell: a shell command (`piloti send`), which is answered;
 * - shell to module: a D-Bus signal, `org.piloti.Shell.Message`.
 *
 * A module names itself in its URL (`data/app-modules.ts`), so the shell knows
 * its window. This is not a security boundary: any program of the session can
 * send either.
 */
import type { MimeAppOption } from "@/core/xdg/xdg-mimeapps";
import type { Dbus } from "@domicile-desktop/sdk/desktop/dbus";
import type { Processes } from "@domicile-desktop/sdk/desktop/processes";
import { Bus } from "@domicile-desktop/sdk/system";
import type { Rect } from "@/core/apps/window-controls-overlay";
import type { ShellWindow } from "@/core/ports/shell-host";

export const IPC_COMMAND = "piloti-ipc";
/** A request to the shell, answered once: close or focus a window. */
export const IPC_REQUEST = "piloti-ipc-do";
export const IPC_SIGNAL = {
  path: "/org/piloti/Shell",
  interface: "org.piloti.Shell",
  member: "Message",
} as const;

/** What a module's window should show: sent whole each time. */
export interface ModuleWindowState {
  menu?: Record<string, { checked?: boolean; disabled?: boolean; hidden?: boolean }>;
  /** The size the app's content wants, without the shell's titlebar. */
  size?: { width: number; height: number };
  /** The app is drawn. */
  ready?: boolean;
  /** Where its own titlebar drags the window (`window-controls-overlay.ts`). */
  dragRegions?: Rect[];
  /** What the shell should keep the module told about. */
  watch?: readonly "windows"[];
}

export type ModuleRequest =
  | { do: "close-window"; windowId: string }
  | { do: "focus-window"; windowId: string }
  /** Opens an app as the shell would: a built-in one, a `.desktop` id, a program. */
  | { do: "launch"; appId: string; payload?: string }
  /** Opens a file or folder with its default app, or the one chosen ("Open With"). */
  | { do: "open"; path: string; kind?: "file" | "directory"; preferApp?: MimeAppOption };

export type ShellMessage =
  | { to: string; type: "action"; actionId: string }
  /** Send the state again: the shell has just met this window. */
  | { to: string; type: "sync" }
  /** Whether the shell lays its window controls over the module's titlebar (not as a tab). */
  | { to: string; type: "overlay"; visible: boolean }
  /** The desktop's windows, for a module that watches them. */
  | { to: string; type: "windows"; windows: ShellWindow[] };

export const newModuleId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The words of a state message; encoded so that it stays one word. */
export const stateWords = (id: string, state: ModuleWindowState): string[] => [
  IPC_COMMAND,
  id,
  encodeWord(state),
];

/** Reads `stateWords` back; `null` for another command or a bad message. */
export function parseStateWords(
  words: readonly string[],
): { id: string; state: ModuleWindowState } | null {
  const [command, id, encoded] = words;
  if (command !== IPC_COMMAND || !id) return null;
  const state = decodeWord(encoded);
  return typeof state === "object" && state ? { id, state } : null;
}

/** One word for any JSON value: no spaces, quotes or shell characters. */
const encodeWord = (value: unknown) => encodeURIComponent(JSON.stringify(value));

function decodeWord(word: string | undefined): unknown {
  if (!word) return null;
  try {
    return JSON.parse(decodeURIComponent(word));
  } catch {
    return null;
  }
}

export const requestWords = (id: string, request: ModuleRequest): string[] => [
  IPC_REQUEST,
  id,
  encodeWord(request),
];

/** Reads `requestWords` back; `null` for another command or a bad message. */
export function parseRequestWords(
  words: readonly string[],
): { id: string; request: ModuleRequest } | null {
  const [command, id, encoded] = words;
  if (command !== IPC_REQUEST || !id) return null;
  const request = decodeWord(encoded) as Record<string, unknown> | null;
  const text = (key: string) => (typeof request?.[key] === "string" ? (request[key] as string) : undefined);
  const parsed = ((): ModuleRequest | null => {
    switch (request?.do) {
      case "close-window":
      case "focus-window": {
        const windowId = text("windowId");
        return windowId === undefined ? null : { do: request.do, windowId };
      }
      case "launch": {
        const appId = text("appId");
        const payload = text("payload");
        return appId ? { do: "launch", appId, ...(payload ? { payload } : null) } : null;
      }
      case "open": {
        const path = text("path");
        const kind = text("kind");
        const app = request.preferApp as Partial<MimeAppOption> | undefined;
        const preferApp =
          app && typeof app.appId === "string" && typeof app.desktopId === "string"
            ? (app as MimeAppOption)
            : undefined;
        if (!path?.startsWith("/")) return null;
        return {
          do: "open",
          path,
          ...(kind === "file" || kind === "directory" ? { kind } : null),
          ...(preferApp ? { preferApp } : null),
        };
      }
      default:
        return null;
    }
  })();
  return parsed ? { id, request: parsed } : null;
}

export interface ChannelHost {
  processes: Pick<Processes, "run">;
  dbus: Pick<Dbus, "match">;
}

/** The module's end. */
export function createModuleChannel({ processes, dbus }: ChannelHost, id: string) {
  let state: ModuleWindowState = {};
  let tail: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(actionId: string) => void>();
  const overlayListeners = new Set<(visible: boolean) => void>();
  const windowListeners = new Set<(windows: ShellWindow[]) => void>();

  const run = async (words: string[]) => {
    try {
      const ran = await processes.run(["piloti", "send", ...words]);
      const problem = ran.match({
        Ok: (r) => (r.code === 0 ? null : r.stderr),
        Err: (e) => e.message,
      });
      // Refused while the screen is locked: the next change or `sync` resends.
      if (problem) console.warn("[piloti] the shell did not answer:", problem);
    } catch (error) {
      console.warn("[piloti] could not reach the shell", error);
    }
  };
  // One at a time, so an older state cannot arrive after a newer one.
  const send = () => (tail = tail.then(() => run(stateWords(id, state))));

  const receive = (body: unknown) => {
    let message: ShellMessage;
    try {
      message = JSON.parse(String(body)) as ShellMessage;
    } catch {
      return;
    }
    if (message?.to !== id) return;
    if (message.type === "sync") void send();
    else if (message.type === "action") listeners.forEach((l) => l(message.actionId));
    else if (message.type === "overlay") overlayListeners.forEach((l) => l(message.visible !== false));
    else if (message.type === "windows" && Array.isArray(message.windows)) {
      windowListeners.forEach((l) => l(message.windows));
    }
  };

  void dbus.match({ bus: Bus.Session, ...IPC_SIGNAL }).then((result) =>
    result.match({
      Err: async (e) => console.warn("[piloti] cannot hear the shell:", e.message),
      Ok: async ({ items }) => {
        const reader = items.getReader();
        for (;;) {
          const next = await reader.read();
          if (next.done) return;
          // `Missed` (the compositor restarted) has no signal.
          const signal = "item" in next.value ? next.value.item : undefined;
          if (signal) receive(signal.body[0]);
        }
      },
    }),
  );

  return {
    publish(patch: ModuleWindowState) {
      const next = { ...state, ...patch };
      if (JSON.stringify(next) === JSON.stringify(state)) return tail;
      state = next;
      return send();
    },
    onAction(listener: (actionId: string) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    onOverlay(listener: (visible: boolean) => void) {
      overlayListeners.add(listener);
      return () => void overlayListeners.delete(listener);
    },
    onWindows(listener: (windows: ShellWindow[]) => void) {
      windowListeners.add(listener);
      return () => void windowListeners.delete(listener);
    },
    /** Asks the shell for something; after the states already sent. */
    request(request: ModuleRequest) {
      return (tail = tail.then(() => run(requestWords(id, request))));
    },
  };
}
