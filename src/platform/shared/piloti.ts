/**
 * `piloti` is Domicile's desktop plus what the Piloti shell adds to it.
 *
 * Code receives it as `piloti: Piloti` (`usePiloti()` in components, an
 * argument in engine code). Scripts, plugins and the console reach the same
 * object as `window.piloti`. What the shell adds: `ports/shell-api.ts`.
 */
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import type { Piloti } from "@/core/ports/piloti";

export type { Piloti };

export const usePiloti = (): Piloti => useDomicile() as Piloti;

declare global {
  interface Window {
    piloti?: Piloti;
  }
}
