export type IniRecord = Record<string, Record<string, string>>;

/**
 * Parses an XDG/GSettings-style INI keyfile into a section -> key -> string map.
 */
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

/**
 * Serializes a section -> key -> string map into deterministic INI text.
 */
export function serializeIniText(data: IniRecord): string {
  const sections: string[] = [];
  for (const [section, entries] of Object.entries(data)) {
    const lines = Object.entries(entries).map(
      ([k, v]) => `${k}=${String(v).replace(/[\r\n]+/g, " ")}`
    );
    sections.push(`[${section}]\n${lines.join("\n")}`);
  }
  return sections.join("\n\n") + (sections.length > 0 ? "\n" : "");
}

