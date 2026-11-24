import { isWebEngine } from "@/lib/engine/engine";
import { createBrowserDomicile } from "./domicile";

export { createBrowserDomicile } from "./domicile";

/**
 * Returns `true` when running inside Piloti's simulated browser dev host
 * rather than a live Linux Domicile compositor session.
 */
export function isBrowserEngineRuntime(): boolean {
  return isWebEngine();
}

export const engineWeb = {
  createDomicile: createBrowserDomicile,
  isActive: isBrowserEngineRuntime,
} as const;

