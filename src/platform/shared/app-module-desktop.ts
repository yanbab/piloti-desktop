/**
 * The desktop settings as an app module reads them: dconf (with its GNOME
 * links) when Piloti's schema is installed, as the shell does, else
 * `settings.ini`.
 */
import { DEFAULT_SETTINGS, type DesktopSettings } from "@/core/config/desktop-settings";
import {
  readDesktopSettingsRaw,
  subscribeDesktopSettings,
  writeDesktopSettings,
} from "@/core/config/desktop-settings-store";
import { parseDesktopSettingsRaw } from "@/core/config/piloti-settings-ini";
import { loadNativeDesktopBackend } from "@/platform/native/settings-backend";
import type { NativeVfsHost } from "@/platform/shared/app-module-vfs";
import type { Processes } from "@domicile-desktop/sdk/desktop/processes";

export type ModuleSettingsHost = {
  files: NativeVfsHost["files"];
  processes: Pick<Processes, "run" | "spawn">;
};

const SETTINGS_INI = ".config/piloti/settings.ini";
const DCONF_TIMEOUT_MS = 2000;

export const desktopSettingsFrom = (raw: string | null): DesktopSettings => ({
  ...DEFAULT_SETTINGS,
  ...(raw ? parseDesktopSettingsRaw(raw) : null),
});

export async function openDesktopSettings(
  domicile: ModuleSettingsHost,
  home: string,
  watchDir: (dir: string, onChange: () => void) => () => void,
) {
  const { files } = domicile;
  const readText = async (path: string) =>
    (await files.readText(path).catch(() => null))?.unwrapOr(null as unknown as string) ?? null;
  // A window must open even if dconf does not answer.
  const backend = await Promise.race([
    loadNativeDesktopBackend(domicile, {
      home,
      exists: async (path) => (await files.stat(path).catch(() => null))?.isOk() ?? false,
      readText,
    }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DCONF_TIMEOUT_MS)),
  ]);

  let raw = backend ? readDesktopSettingsRaw(backend) : await readText(SETTINGS_INI);
  return {
    current: () => desktopSettingsFrom(raw),
    /**
     * Changes desktop settings where the shell reads them (dconf); the shell
     * follows. `false` without dconf: the shell's `settings.ini` is its own.
     */
    update(patch: Partial<DesktopSettings>): boolean {
      if (!backend) return false;
      const current = desktopSettingsFrom(raw);
      writeDesktopSettings(backend, { ...current, ...patch }, current);
      return true;
    },
    /** Calls `onChange` when a desktop setting changes. Returns stop. */
    watch(onChange: (settings: DesktopSettings) => void): () => void {
      const apply = (next: string | null) => {
        if (next === raw) return;
        raw = next;
        onChange(desktopSettingsFrom(raw));
      };
      return backend
        ? subscribeDesktopSettings(backend, apply)
        : watchDir(".config/piloti", () => void readText(SETTINGS_INI).then(apply));
    },
  };
}
