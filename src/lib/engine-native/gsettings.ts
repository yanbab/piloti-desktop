import type { Piloti } from "@/lib/engine/piloti";
import { runText } from "./exec";

export function parseGtk4HintFontMetrics(content: string): boolean {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const match = /^gtk-hint-font-metrics\s*=\s*(.+)$/i.exec(line);
    if (match) {
      const val = match[1].trim().toLowerCase();
      return val === "true" || val === "1" || val === "yes";
    }
  }
  return false;
}

export function upsertGtkSettingsIni(
  existing: string,
  key: string,
  value: string
): string {
  const lines = existing ? existing.split(/\r?\n/) : [];
  let inSettings = false;
  let settingsHeaderIdx = -1;
  let lastSettingsLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inSettings = trimmed.toLowerCase() === "[settings]";
      if (inSettings) {
        settingsHeaderIdx = i;
        lastSettingsLineIdx = i;
      }
      continue;
    }
    if (!inSettings) continue;
    lastSettingsLineIdx = i;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0 && trimmed.slice(0, eqIdx).trim() === key) {
      lines[i] = `${key}=${value}`;
      return `${lines.join("\n").replace(/\n+$/, "")}\n`;
    }
  }

  if (settingsHeaderIdx === -1) {
    const prefix =
      lines.filter(Boolean).length > 0
        ? `${lines.join("\n").replace(/\n+$/, "")}\n\n`
        : "";
    return `${prefix}[Settings]\n${key}=${value}\n`;
  }

  lines.splice(lastSettingsLineIdx + 1, 0, `${key}=${value}`);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export async function syncGtkIconTheme(
  piloti: Piloti,
  iconTheme: string
): Promise<boolean> {
  const clean = iconTheme.trim();
  if (!clean) return false;
  try {
    let ok = true;
    for (const dir of [".config/gtk-4.0", ".config/gtk-3.0"]) {
      const iniPath = `${dir}/settings.ini`;
      await piloti.files.createDir(dir).catch(() => undefined);
      const readRes = await piloti.files.readText(iniPath);
      const current = readRes.match({ Ok: (t) => t, Err: () => "" });
      const updated = upsertGtkSettingsIni(
        current,
        "gtk-icon-theme-name",
        clean
      );
      if (updated === current) continue;
      const writeRes = await piloti.files.write(iniPath, updated);
      ok = ok && writeRes.match({ Ok: () => true, Err: () => false });
    }
    return ok;
  } catch {
    return false;
  }
}

export async function listInstalledFontFamilies(
  piloti: Piloti
): Promise<string[]> {
  const out = await runText(piloti, ["fc-list", "--format=%{family[0]}\n"]);
  if (!out) return [];
  const unique = new Set<string>();
  for (const raw of out.split(/\r?\n/)) {
    const name = raw.split(",")[0]?.trim();
    if (name) unique.add(name);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}
