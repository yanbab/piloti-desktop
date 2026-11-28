/** What code is handed: all of Domicile's desktop, plus Piloti's additions. */
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { PilotiShellApi } from "@/core/ports/shell-api";
import type { Vfs } from "@/core/ports/vfs";

export type Piloti = Domicile & PilotiShellApi & { readonly vfs: Vfs };
