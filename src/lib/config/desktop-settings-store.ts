import type { DesktopSettings } from "@/context/SettingsContext";
import type { SettingChange, SettingsBackend } from "@/lib/ports/settings";
import { parseIniText, serializeIniText, type IniRecord } from "./ini";
import { desktopSchemaKeys, serializeDesktopSettingsIni } from "./piloti-settings-ini";

/**
 * The desktop settings (`org.piloti.desktop.*`) through the settings backend,
 * as the settings.ini text `parseDesktopSettingsRaw` reads: the same text
 * whether the backend is the keyfile (settings.ini itself) or gsettings.
 */
export function readDesktopSettingsRaw(backend: SettingsBackend): string | null {
  const ini: IniRecord = {};
  for (const { schema, key } of desktopSchemaKeys()) {
    const value = backend.read(schema, key);
    if (value === undefined) continue;
    (ini[schema] ??= {})[key] = value;
  }
  return Object.keys(ini).length > 0 ? serializeIniText(ini) : null;
}

/** Writes the keys whose value changed, in one batch. Keys it doesn't know stay. */
export function writeDesktopSettings(backend: SettingsBackend, settings: DesktopSettings): number {
  const changes: SettingChange[] = [];
  for (const [schema, entries] of Object.entries(parseIniText(serializeDesktopSettingsIni(settings)))) {
    for (const [key, value] of Object.entries(entries)) {
      if (backend.read(schema, key) !== value) changes.push({ schema, key, value });
    }
  }
  if (changes.length > 0) backend.writeBatch(changes);
  return changes.length;
}

/** Calls `onChange` with the new text when a desktop setting changed, here or elsewhere. */
export function subscribeDesktopSettings(
  backend: SettingsBackend,
  onChange: (raw: string | null) => void,
): () => void {
  let last = readDesktopSettingsRaw(backend);
  return backend.subscribeAll(() => {
    const next = readDesktopSettingsRaw(backend);
    if (next === last) return;
    last = next;
    onChange(next);
  });
}
