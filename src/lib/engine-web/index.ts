import { createBrowserDomicile } from "./domicile";

export { createBrowserDomicile } from "./domicile";

/**
 * Returns `true` when running inside Piloti's simulated browser dev host
 * rather than a live Linux Domicile compositor session.
 */
export function isBrowserEngineRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as { __PILOTI_BROWSER_HOST__?: boolean }).__PILOTI_BROWSER_HOST__)
  );
}

export const engineWeb = {
  createDomicile: createBrowserDomicile,
  isActive: isBrowserEngineRuntime,
} as const;

