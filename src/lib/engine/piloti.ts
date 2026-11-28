/**
 * `piloti` is Domicile's desktop plus what the Piloti shell adds to it.
 *
 * Code receives it as `piloti: Piloti` (`usePiloti()` in components, an
 * argument in engine code). Scripts, plugins and the console reach the same
 * object as `window.piloti`. What the shell adds: `ports/shell-api.ts`.
 */
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { Vfs } from "@/lib/ports/vfs";
import type { PilotiShellApi } from "@/lib/ports/shell-api";

/** What code is handed: all of Domicile's desktop, plus Piloti's additions. */
export type Piloti = Domicile & PilotiShellApi & { readonly vfs: Vfs };

export const usePiloti = (): Piloti => useDomicile() as Piloti;

declare global {
  interface Window {
    piloti?: Piloti;
  }
}
