/** The shell's end of `lib/apps/module-channel.ts`. */
import { parseStateWords, type ModuleWindowState, type ShellMessage } from "@/lib/apps/module-channel";
import type { Piloti } from "@/lib/engine/piloti";
import { emitShellSignal } from "@/lib/engine/system-commands";

const states = new Map<string, ModuleWindowState>();
const listeners = new Set<() => void>();

/** Takes a module's message from the shell commands; false if it is not one. */
export function receiveModuleCommand(words: readonly string[]): boolean {
  const message = parseStateWords(words);
  if (!message) return false;
  // Kept even before the module's window is listed.
  states.set(message.id, message.state);
  listeners.forEach((l) => l());
  return true;
}

export const moduleState = (id: string) => states.get(id);

export const forgetModule = (id: string) => void states.delete(id);

export function onModuleState(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function sendToModule(piloti: Pick<Piloti, "processes">, message: ShellMessage): void {
  emitShellSignal(piloti, JSON.stringify(message));
}
