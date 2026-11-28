import { VFS_HOME } from "@/platform/shared/vfs-home";
import type { Piloti } from "@/core/ports/piloti";
import { type IniRecord, parseIniText, serializeIniText } from "@/core/config/ini";
import { readVfsStateText, writeVfsStateText } from "@/platform/shared/vfs-state";

export { type IniRecord, parseIniText, serializeIniText };

const PILOTI_INI_DIR = ".config/piloti";
const LOCAL_CACHE_PREFIX = "piloti.app-ini.v1.";

export function getPilotiAppIniVfsPath(appName: string): string {
  return `${VFS_HOME}/${PILOTI_INI_DIR}/${appName}.ini`;
}

export function getCachedPilotiAppIni(appName: string): IniRecord {
  try {
    const raw = readVfsStateText(
      getPilotiAppIniVfsPath(appName),
      `${LOCAL_CACHE_PREFIX}${appName}`,
    );
    return raw ? parseIniText(raw) : {};
  } catch {
    return {};
  }
}

/** The same as `getCachedPilotiAppIni`: the state store follows the disk. */
export async function readPilotiAppIni(
  _piloti: Piloti | null | undefined,
  appName: string
): Promise<IniRecord> {
  return getCachedPilotiAppIni(appName);
}

export async function writePilotiAppIni(
  _piloti: Piloti | null | undefined,
  appName: string,
  section: string,
  values: Record<string, string | number | boolean>
): Promise<void> {
  const current = getCachedPilotiAppIni(appName);
  const next: IniRecord = {
    ...current,
    [section]: {
      ...(current[section] ?? {}),
      ...Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v)])
      ),
    },
  };
  try {
    writeVfsStateText(getPilotiAppIniVfsPath(appName), serializeIniText(next));
  } catch {
    // ignore
  }
}

/** Texts keeps its settings in its own folder; `notepad.ini` is where they were. */
export const TEXTS_SETTINGS_PATH = ".config/piloti-texts/settings.ini";

export function readTextsSettings(): IniRecord {
  const raw =
    readVfsStateText(`${VFS_HOME}/${TEXTS_SETTINGS_PATH}`) ??
    readVfsStateText(getPilotiAppIniVfsPath("notepad"));
  return raw ? parseIniText(raw) : {};
}

export function writeTextsSettings(section: string, values: Record<string, string | number | boolean>): void {
  const current = readTextsSettings();
  const next: IniRecord = {
    ...current,
    [section]: {
      ...(current[section] ?? {}),
      ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])),
    },
  };
  try {
    writeVfsStateText(`${VFS_HOME}/${TEXTS_SETTINGS_PATH}`, serializeIniText(next));
  } catch {
    // ignore
  }
}

/**
 * Hidden general preferences (`~/.config/piloti/general.ini`, no Settings UI).
 *
 *   [Windows]
 *   confirm-unsaved-on-close=false
 *
 * Spatial apps (Texts, Image Viewer) persist unsaved state across
 * close/reopen, so the Save / Discard / Cancel prompt is off by default.
 */
export function shouldConfirmUnsavedOnClose(): boolean {
  const value = getCachedPilotiAppIni("general").Windows?.["confirm-unsaved-on-close"];
  return value === "true" || value === "1";
}
