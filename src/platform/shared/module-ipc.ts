/** The shell's end of `core/apps/module-channel.ts`. */
import {
  type ModuleRequest,
  type ModuleWindowState,
  parseRequestWords,
  parseStateWords,
  type ShellMessage,
} from "@/core/apps/module-channel";
import type { Piloti } from "@/platform/shared/piloti";
import { emitShellSignal } from "@/platform/shared/system-commands";

const states = new Map<string, ModuleWindowState>();
const listeners = new Set<() => void>();
const requestListeners = new Set<(id: string, request: ModuleRequest) => void>();

/** Takes a module's message from the shell commands; false if it is not one. */
export function receiveModuleCommand(words: readonly string[]): boolean {
  const request = parseRequestWords(words);
  if (request) {
    requestListeners.forEach((l) => l(request.id, request.request));
    return true;
  }
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

/** Requests from modules (close or focus a window), with the module's name. */
export function onModuleRequest(listener: (id: string, request: ModuleRequest) => void): () => void {
  requestListeners.add(listener);
  return () => void requestListeners.delete(listener);
}

export function sendToModule(piloti: Pick<Piloti, "processes">, message: ShellMessage): void {
  emitShellSignal(piloti, JSON.stringify(message));
}
