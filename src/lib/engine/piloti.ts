/**
 * `piloti` is Domicile's desktop plus what the Piloti shell adds to it.
 *
 * Code receives it as `piloti: Piloti` (`usePiloti()` in components, an
 * argument in engine code). Scripts, plugins and the console reach the same
 * object, with the shell's own calls, as `window.piloti`.
 */
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { Vfs } from "@/lib/ports/vfs";
import type { SettingValue } from "@/lib/ports/settings";

/** What engine and UI code are handed: all of Domicile's desktop, plus `vfs`. */
export type Piloti = Domicile & { readonly vfs: Vfs };

export const usePiloti = (): Piloti => useDomicile() as Piloti;

/** What the shell adds. `windows` stays Domicile's (the Linux client windows). */
export interface PilotiShellApi {
  /** The shell's own windows, built-in apps included. */
  desktop: {
    readonly list: unknown[];
    openWebUrl: (url: string, title?: string) => void;
    launchApp: (appId: string) => void;
    focus: (id: string) => void;
    close: (id: string) => void;
    minimize: (id: string) => void;
    toggleMaximize: (id: string) => void;
  };
  /**
   * Settings as schema + key (`get("org.piloti.desktop.dock", "icon-size")`),
   * see `engine/settings.ts`. `get()` and `update(patch)` without a schema are
   * the older whole-desktop object, kept for existing scripts.
   */
  settings: {
    get(): unknown;
    get(schema: string, key: string): SettingValue | undefined;
    set: (schema: string, key: string, value: SettingValue) => void;
    reset: (schema: string, key: string) => void;
    /** Calls `onChange` with the new value when the key changes. Returns stop. */
    watch: (schema: string, key: string, onChange: (value: SettingValue | undefined) => void) => () => void;
    /** The schemas defined so far. */
    readonly schemas: string[];
    update: (patch: Record<string, unknown>) => void;
  };
  plugins: {
    readonly list: unknown[];
  };
  notifications: {
    push: (options: {
      summary: string;
      body?: string;
      urgency?: "low" | "normal" | "critical";
    }) => void;
  };
}

export type PilotiGlobal = Omit<Piloti, "notifications"> &
  Omit<PilotiShellApi, "notifications"> & {
    notifications: Piloti["notifications"] & PilotiShellApi["notifications"];
  };

declare global {
  interface Window {
    piloti?: PilotiGlobal;
  }
}

/** Adds the shell's calls to Domicile's desktop, leaving the original as it is. */
export function extendDomicile(domicile: Piloti, shell: PilotiShellApi): PilotiGlobal {
  // A child object, so Domicile's `notifications.list` stays live.
  const notifications = Object.assign(
    Object.create(domicile.notifications) as Piloti["notifications"],
    shell.notifications,
  );
  // `vfs` is not an own property (see `with-vfs.ts`), so the spread skips it.
  return { ...domicile, vfs: domicile.vfs, ...shell, notifications };
}
