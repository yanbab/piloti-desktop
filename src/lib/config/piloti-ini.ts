import { hostFiles } from "@/lib/engine/host-files";
import { VFS_HOME } from "@/lib/engine/vfs-home";
import type { Piloti } from "@/lib/engine/piloti";
import { type IniRecord, parseIniText, serializeIniText } from "@/lib/config/ini";
import { readVfsStateText, writeVfsStateText } from "@/lib/engine/vfs-state";
import { isWebEngine } from "@/lib/engine/engine";

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

const ensuredIniDirs = new Set<string>();

function isBrowserHostRuntime(): boolean {
  return isWebEngine();
}

export async function readPilotiAppIni(
  piloti: Piloti | null | undefined,
  appName: string
): Promise<IniRecord> {
  const relPath = `${PILOTI_INI_DIR}/${appName}.ini`;
  const vfsPath = getPilotiAppIniVfsPath(appName);
  if (piloti && !isBrowserHostRuntime()) {
    try {
      const res = await hostFiles(piloti).readText(relPath);
      return res.match({
        Ok: (text) => {
          try {
            writeVfsStateText(vfsPath, text);
          } catch {
            // ignore
          }
          return parseIniText(text);
        },
        Err: () => getCachedPilotiAppIni(appName),
      });
    } catch {
      return getCachedPilotiAppIni(appName);
    }
  }
  return getCachedPilotiAppIni(appName);
}

export async function writePilotiAppIni(
  piloti: Piloti | null | undefined,
  appName: string,
  section: string,
  values: Record<string, string | number | boolean>
): Promise<void> {
  const cached = getCachedPilotiAppIni(appName);
  const current =
    Object.keys(cached).length > 0
      ? cached
      : await readPilotiAppIni(piloti, appName);
  const next: IniRecord = {
    ...current,
    [section]: {
      ...(current[section] ?? {}),
      ...Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v)])
      ),
    },
  };
  const serialized = serializeIniText(next);
  try {
    writeVfsStateText(getPilotiAppIniVfsPath(appName), serialized);
  } catch {
    // ignore
  }
  if (piloti && !isBrowserHostRuntime()) {
    try {
      if (!ensuredIniDirs.has(PILOTI_INI_DIR)) {
        await hostFiles(piloti).createDir(".config").catch(() => undefined);
        await hostFiles(piloti).createDir(PILOTI_INI_DIR).catch(() => undefined);
        ensuredIniDirs.add(PILOTI_INI_DIR);
      }
      await hostFiles(piloti).write(`${PILOTI_INI_DIR}/${appName}.ini`, serialized);
    } catch {
      ensuredIniDirs.delete(PILOTI_INI_DIR);
    }
  }
}

/**
 * Hidden general preferences (`~/.config/piloti/general.ini`, no Settings UI).
 *
 *   [Windows]
 *   confirm-unsaved-on-close=false
 *
 * Spatial apps (Text Editor, Image Viewer) persist unsaved state across
 * close/reopen, so the Save / Discard / Cancel prompt is off by default.
 */
export function shouldConfirmUnsavedOnClose(): boolean {
  const value = getCachedPilotiAppIni("general").Windows?.["confirm-unsaved-on-close"];
  return value === "true" || value === "1";
}
