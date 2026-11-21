import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { readVfsStateText, writeVfsStateText } from "@/lib/vfs-state";

const PILOTI_INI_DIR = ".config/Piloti";
const LOCAL_CACHE_PREFIX = "piloti.app-ini.v1.";

export function getPilotiAppIniVfsPath(appName: string): string {
  return `/home/user/${PILOTI_INI_DIR}/${appName}.ini`;
}

export type IniRecord = Record<string, Record<string, string>>;

export function parseIniText(raw: string): IniRecord {
  const result: IniRecord = {};
  let currentSection = "General";
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1).trim() || "General";
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!result[currentSection]) result[currentSection] = {};
      result[currentSection][key] = val;
    }
  }
  return result;
}

export function serializeIniText(data: IniRecord): string {
  const sections: string[] = [];
  for (const [section, entries] of Object.entries(data)) {
    const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
    sections.push(`[${section}]\n${lines.join("\n")}`);
  }
  return sections.join("\n\n") + (sections.length > 0 ? "\n" : "");
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
  return (
    typeof window !== "undefined" &&
    Boolean((window as { __PILOTI_BROWSER_HOST__?: boolean }).__PILOTI_BROWSER_HOST__)
  );
}

export async function readPilotiAppIni(
  domicile: Domicile | null | undefined,
  appName: string
): Promise<IniRecord> {
  const relPath = `${PILOTI_INI_DIR}/${appName}.ini`;
  const vfsPath = getPilotiAppIniVfsPath(appName);
  if (domicile && !isBrowserHostRuntime()) {
    try {
      const res = await domicile.files.readText(relPath);
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
  domicile: Domicile | null | undefined,
  appName: string,
  section: string,
  values: Record<string, string | number | boolean>
): Promise<void> {
  const cached = getCachedPilotiAppIni(appName);
  const current =
    Object.keys(cached).length > 0
      ? cached
      : await readPilotiAppIni(domicile, appName);
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
  if (domicile && !isBrowserHostRuntime()) {
    try {
      if (!ensuredIniDirs.has(PILOTI_INI_DIR)) {
        await domicile.files.createDir(".config").catch(() => undefined);
        await domicile.files.createDir(PILOTI_INI_DIR).catch(() => undefined);
        ensuredIniDirs.add(PILOTI_INI_DIR);
      }
      await domicile.files.write(`${PILOTI_INI_DIR}/${appName}.ini`, serialized);
    } catch {
      ensuredIniDirs.delete(PILOTI_INI_DIR);
    }
  }
}
