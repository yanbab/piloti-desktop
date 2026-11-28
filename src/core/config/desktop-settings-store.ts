import type { DesktopSettings } from "@/ui/context/SettingsContext";
import type { SettingChange, SettingsBackend } from "@/core/ports/settings";
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

/**
 * Writes, in one batch, the keys whose value changed. With `previous`, only
 * those the caller changed: the others are not sent to linked GNOME keys.
 * Keys it doesn't know stay.
 */
export function writeDesktopSettings(
  backend: SettingsBackend,
  settings: DesktopSettings,
  previous?: DesktopSettings,
): number {
  const before = previous && parseIniText(serializeDesktopSettingsIni(previous));
  const changes: SettingChange[] = [];
  for (const [schema, entries] of Object.entries(parseIniText(serializeDesktopSettingsIni(settings)))) {
    for (const [key, value] of Object.entries(entries)) {
      if (before && before[schema]?.[key] === value) continue;
      if (backend.read(schema, key) !== value) changes.push({ schema, key, value });
    }
  }
  if (changes.length > 0) backend.writeBatch(changes);
  return changes.length;
}

/** First run or migration: stores every value, without touching GNOME's. */
export function seedDesktopSettings(backend: SettingsBackend, settings: DesktopSettings): void {
  const changes: SettingChange[] = [];
  for (const [schema, entries] of Object.entries(parseIniText(serializeDesktopSettingsIni(settings)))) {
    for (const [key, value] of Object.entries(entries)) changes.push({ schema, key, value });
  }
  if (backend.seed) backend.seed(changes);
  else backend.writeBatch(changes);
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
