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
import type { Dbus } from "@domicile-desktop/sdk/desktop/dbus";
import type { Processes } from "@domicile-desktop/sdk/desktop/processes";
import { Bus } from "@domicile-desktop/sdk/system";

export const IPC_COMMAND = "piloti-ipc";
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
}

export type ShellMessage =
  | { to: string; type: "action"; actionId: string }
  /** Send the state again: the shell has just met this window. */
  | { to: string; type: "sync" };

export const newModuleId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The words of a state message; encoded so that it stays one word. */
export const stateWords = (id: string, state: ModuleWindowState): string[] => [
  IPC_COMMAND,
  id,
  encodeURIComponent(JSON.stringify(state)),
];

/** Reads `stateWords` back; `null` for another command or a bad message. */
export function parseStateWords(
  words: readonly string[],
): { id: string; state: ModuleWindowState } | null {
  const [command, id, encoded] = words;
  if (command !== IPC_COMMAND || !id || !encoded) return null;
  try {
    const state: unknown = JSON.parse(decodeURIComponent(encoded));
    return typeof state === "object" && state ? { id, state } : null;
  } catch {
    return null;
  }
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

  // One at a time, so an older state cannot arrive after a newer one.
  const send = () =>
    (tail = tail.then(async () => {
      try {
        const ran = await processes.run(["piloti", "send", ...stateWords(id, state)]);
        const problem = ran.match({
          Ok: (r) => (r.code === 0 ? null : r.stderr),
          Err: (e) => e.message,
        });
        // Refused while the screen is locked: the next change or `sync` resends.
        if (problem) console.warn("[piloti] the shell did not answer:", problem);
      } catch (error) {
        console.warn("[piloti] could not reach the shell", error);
      }
    }));

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
  };
}
