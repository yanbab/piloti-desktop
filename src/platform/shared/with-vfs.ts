import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { shellApi } from "@/platform/shared/shell-api";
import type { PilotiShellApi } from "@/core/ports/shell-api";
import type { Vfs } from "@/core/ports/vfs";

/**
 * `piloti`: Domicile's desktop with `vfs`, which each entry point adds for its
 * engine, and what the shell adds. Domicile's own namespaces are left alone.
 */
export function withVfs(domicile: Domicile, vfs: Vfs): Domicile & PilotiShellApi & { readonly vfs: Vfs } {
  const added: Record<string | symbol, unknown> = { vfs, ...shellApi };
  return new Proxy(domicile, {
    get: (target, key) => (Object.hasOwn(added, key) ? added[key] : Reflect.get(target, key, target)),
  }) as Domicile & PilotiShellApi & { readonly vfs: Vfs };
}
