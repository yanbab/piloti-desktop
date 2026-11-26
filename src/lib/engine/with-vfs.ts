import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { Vfs } from "@/lib/ports/vfs";

/** Domicile's desktop with `vfs`, which each entry point adds for its engine. */
export function withVfs(domicile: Domicile, vfs: Vfs): Domicile & { readonly vfs: Vfs } {
  return new Proxy(domicile, {
    get: (target, key) => (key === "vfs" ? vfs : Reflect.get(target, key, target)),
  }) as Domicile & { readonly vfs: Vfs };
}
