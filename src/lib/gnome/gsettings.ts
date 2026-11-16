import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { AccentColorId } from "@/data/catalog";
import {
  type GnomeBackgroundSettings,
  parseGnomeBackgroundKeyVal,
} from "../gnome-background";
import { runText } from "./exec";
import type {
  GnomeInterfaceSnapshot,
  GnomeNotificationSettings,
  GtkFontAntialiasing,
  GtkFontHinting,
  GtkFontRgbaOrder,
} from "./types";

const GNOME_ACCENT_TO_PILOTI: Record<string, AccentColorId> = {
  blue: "blue",
  teal: "teal",
  green: "green",
  yellow: "yellow",
  orange: "orange",
  red: "red",
  pink: "pink",
  purple: "purple",
  slate: "graphite",
};

const PILOTI_ACCENT_TO_GNOME: Record<AccentColorId, string> = {
  blue: "blue",
  teal: "teal",
  green: "green",
  yellow: "yellow",
  orange: "orange",
  red: "red",
  pink: "pink",
  purple: "purple",
  graphite: "slate",
};

function stripGVariantQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseGSettingsKeyVal(
  key: string,
  rawVal: string
): Partial<GnomeInterfaceSnapshot> {
  const val = stripGVariantQuotes(rawVal);
  switch (key) {
    case "color-scheme": {
      if (val === "prefer-dark") return { themeMode: "dark" };
      if (val === "prefer-light" || val === "default") {
        return { themeMode: "light" };
      }
      return {};
    }
    case "accent-color": {
      const mapped = GNOME_ACCENT_TO_PILOTI[val];
      return mapped ? { accentColor: mapped } : {};
    }
    case "icon-theme": {
      return val ? { iconTheme: val } : {};
    }
    case "clock-format": {
      if (val === "24h") return { clock24Hour: true };
      if (val === "12h") return { clock24Hour: false };
      return {};
    }
    case "clock-show-seconds": {
      if (val === "true") return { clockShowSeconds: true };
      if (val === "false") return { clockShowSeconds: false };
      return {};
    }
    case "font-name": {
      return val ? { fontName: val } : {};
    }
    case "document-font-name": {
      return val ? { documentFontName: val } : {};
    }
    case "monospace-font-name": {
      return val ? { monospaceFontName: val } : {};
    }
    case "text-scaling-factor": {
      const n = Number(val);
      return Number.isFinite(n) && n > 0 ? { textScalingFactor: n } : {};
    }
    case "font-antialiasing": {
      return val === "none" || val === "grayscale" || val === "rgba"
        ? { fontAntialiasing: val }
        : {};
    }
    case "font-hinting": {
      return val === "none" ||
        val === "slight" ||
        val === "medium" ||
        val === "full"
        ? { fontHinting: val }
        : {};
    }
    case "font-rgba-order": {
      return val === "rgb" || val === "bgr" || val === "vrgb" || val === "vbgr"
        ? { fontRgbaOrder: val }
        : {};
    }
    default:
      return {};
  }
}

async function readGSettingsSchema<T extends object>(
  domicile: Domicile,
  schema: string,
  parseEntry: (key: string, rawVal: string) => Partial<T>
): Promise<Partial<T>> {
  const stdout = await runText(domicile, [
    "gsettings",
    "list-recursively",
    schema,
  ]);
  if (!stdout) return {};

  const snapshot: Partial<T> = {};
  const prefix = `${schema} `;
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const rest = trimmed.slice(prefix.length).trim();
    const spaceIdx = rest.search(/\s/);
    if (spaceIdx <= 0) continue;
    const key = rest.slice(0, spaceIdx);
    const rawVal = rest.slice(spaceIdx).trim();
    Object.assign(snapshot, parseEntry(key, rawVal));
  }
  return snapshot;
}

function monitorGSettingsSchema<T extends object>(
  domicile: Domicile,
  schema: string,
  parseEntry: (key: string, rawVal: string) => Partial<T>,
  onChange: (patch: Partial<T>) => void
): () => void {
  let stopped = false;
  let killFn: (() => void) | undefined;

  (async () => {
    try {
      const res = await domicile.processes.spawn([
        "gsettings",
        "monitor",
        schema,
      ]);
      const proc = res.match({
        Ok: (p) => p,
        Err: () => undefined,
      });
      if (!proc || stopped) {
        proc?.kill();
        return;
      }
      killFn = () => proc.kill();

      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done || stopped) break;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const sepIdx = line.indexOf(":");
          if (sepIdx <= 0) continue;
          const key = line.slice(0, sepIdx).trim();
          const rawVal = line.slice(sepIdx + 1).trim();
          const patch = parseEntry(key, rawVal);
          if (Object.keys(patch).length > 0) {
            onChange(patch);
          }
        }
      }
    } catch {
      // ignore if gsettings monitor is unavailable
    }
  })();

  return () => {
    stopped = true;
    killFn?.();
  };
}

export function readGnomeInterfaceSettings(
  domicile: Domicile
): Promise<GnomeInterfaceSnapshot> {
  return readGSettingsSchema<GnomeInterfaceSnapshot>(
    domicile,
    "org.gnome.desktop.interface",
    parseGSettingsKeyVal
  );
}

export function monitorGnomeInterfaceSettings(
  domicile: Domicile,
  onChange: (patch: GnomeInterfaceSnapshot) => void
): () => void {
  return monitorGSettingsSchema<GnomeInterfaceSnapshot>(
    domicile,
    "org.gnome.desktop.interface",
    parseGSettingsKeyVal,
    onChange
  );
}

export function readGnomeBackgroundSettings(
  domicile: Domicile
): Promise<Partial<GnomeBackgroundSettings>> {
  return readGSettingsSchema<GnomeBackgroundSettings>(
    domicile,
    "org.gnome.desktop.background",
    parseGnomeBackgroundKeyVal
  );
}

export function monitorGnomeBackgroundSettings(
  domicile: Domicile,
  onChange: (patch: Partial<GnomeBackgroundSettings>) => void
): () => void {
  return monitorGSettingsSchema<GnomeBackgroundSettings>(
    domicile,
    "org.gnome.desktop.background",
    parseGnomeBackgroundKeyVal,
    onChange
  );
}

export async function syncGnomeBackgroundSettings(
  domicile: Domicile,
  patch: Partial<GnomeBackgroundSettings>
): Promise<void> {
  const pairs: [string, string][] = [];

  if (patch.pictureUri !== undefined) {
    pairs.push(["picture-uri", patch.pictureUri]);
  }
  if (patch.pictureUriDark !== undefined) {
    pairs.push(["picture-uri-dark", patch.pictureUriDark]);
  }
  if (patch.pictureOptions !== undefined) {
    pairs.push(["picture-options", patch.pictureOptions]);
  }
  if (patch.colorShadingType !== undefined) {
    pairs.push(["color-shading-type", patch.colorShadingType]);
  }
  if (patch.primaryColor !== undefined && patch.primaryColor.trim()) {
    pairs.push(["primary-color", patch.primaryColor.trim()]);
  }
  if (patch.secondaryColor !== undefined && patch.secondaryColor.trim()) {
    pairs.push(["secondary-color", patch.secondaryColor.trim()]);
  }
  if (patch.pictureOpacity !== undefined) {
    pairs.push([
      "picture-opacity",
      String(Math.max(0, Math.min(100, Math.round(patch.pictureOpacity)))),
    ]);
  }

  await Promise.allSettled(
    pairs.map(([key, value]) =>
      runText(domicile, [
        "gsettings",
        "set",
        "org.gnome.desktop.background",
        key,
        value,
      ])
    )
  );
}

export async function syncGnomeInterfaceKey(
  domicile: Domicile,
  patch: {
    themeMode?: "dark" | "light" | "system";
    accentColor?: AccentColorId;
    clock24Hour?: boolean;
    clockShowSeconds?: boolean;
    gtkFontName?: string;
    gtkDocumentFontName?: string;
    gtkMonospaceFontName?: string;
    gtkTextScalingFactor?: number;
    gtkFontAntialiasing?: GtkFontAntialiasing;
    gtkFontHinting?: GtkFontHinting;
    gtkFontRgbaOrder?: GtkFontRgbaOrder;
  }
): Promise<void> {
  const pairs: [string, string][] = [];

  if (patch.themeMode !== undefined) {
    pairs.push([
      "color-scheme",
      patch.themeMode === "dark" ? "prefer-dark" : "default",
    ]);
  }
  if (patch.accentColor !== undefined) {
    const gnomeAccent = PILOTI_ACCENT_TO_GNOME[patch.accentColor];
    if (gnomeAccent) pairs.push(["accent-color", gnomeAccent]);
  }
  if (patch.clock24Hour !== undefined) {
    pairs.push(["clock-format", patch.clock24Hour ? "24h" : "12h"]);
  }
  if (patch.clockShowSeconds !== undefined) {
    pairs.push(["clock-show-seconds", patch.clockShowSeconds ? "true" : "false"]);
  }
  if (patch.gtkFontName !== undefined && patch.gtkFontName.trim()) {
    pairs.push(["font-name", patch.gtkFontName.trim()]);
  }
  if (patch.gtkDocumentFontName !== undefined && patch.gtkDocumentFontName.trim()) {
    pairs.push(["document-font-name", patch.gtkDocumentFontName.trim()]);
  }
  if (
    patch.gtkMonospaceFontName !== undefined &&
    patch.gtkMonospaceFontName.trim()
  ) {
    pairs.push(["monospace-font-name", patch.gtkMonospaceFontName.trim()]);
  }
  if (patch.gtkTextScalingFactor !== undefined) {
    pairs.push([
      "text-scaling-factor",
      String(Number(patch.gtkTextScalingFactor.toFixed(2))),
    ]);
  }
  if (patch.gtkFontAntialiasing !== undefined) {
    pairs.push(["font-antialiasing", patch.gtkFontAntialiasing]);
  }
  if (patch.gtkFontHinting !== undefined) {
    pairs.push(["font-hinting", patch.gtkFontHinting]);
  }
  if (patch.gtkFontRgbaOrder !== undefined) {
    pairs.push(["font-rgba-order", patch.gtkFontRgbaOrder]);
  }

  await Promise.allSettled(
    pairs.map(([key, value]) =>
      runText(domicile, [
        "gsettings",
        "set",
        "org.gnome.desktop.interface",
        key,
        value,
      ])
    )
  );
}

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

export async function readGtk4HintFontMetrics(
  domicile: Domicile
): Promise<boolean> {
  try {
    const res = await domicile.files.readText(".config/gtk-4.0/settings.ini");
    return res.match({
      Ok: (text) => parseGtk4HintFontMetrics(text),
      Err: () => false,
    });
  } catch {
    return false;
  }
}

export async function syncGtkIconTheme(
  domicile: Domicile,
  iconTheme: string
): Promise<boolean> {
  const clean = iconTheme.trim();
  if (!clean) return false;
  try {
    let ok = true;
    for (const dir of [".config/gtk-4.0", ".config/gtk-3.0"]) {
      const iniPath = `${dir}/settings.ini`;
      await domicile.files.createDir(dir).catch(() => undefined);
      const readRes = await domicile.files.readText(iniPath);
      const current = readRes.match({ Ok: (t) => t, Err: () => "" });
      const updated = upsertGtkSettingsIni(
        current,
        "gtk-icon-theme-name",
        clean
      );
      if (updated === current) continue;
      const writeRes = await domicile.files.write(iniPath, updated);
      ok = ok && writeRes.match({ Ok: () => true, Err: () => false });
    }
    return ok;
  } catch {
    return false;
  }
}

export async function setGtk4HintFontMetrics(
  domicile: Domicile,
  enabled: boolean
): Promise<boolean> {
  try {
    await domicile.files.createDir(".config/gtk-4.0").catch(() => undefined);
    const readRes = await domicile.files.readText(".config/gtk-4.0/settings.ini");
    const current = readRes.match({ Ok: (t) => t, Err: () => "" });
    const updated = upsertGtkSettingsIni(
      current,
      "gtk-hint-font-metrics",
      enabled ? "true" : "false"
    );
    const writeRes = await domicile.files.write(
      ".config/gtk-4.0/settings.ini",
      updated
    );
    return writeRes.match({ Ok: () => true, Err: () => false });
  } catch {
    return false;
  }
}

export async function listInstalledFontFamilies(
  domicile: Domicile
): Promise<string[]> {
  const out = await runText(domicile, ["fc-list", "--format=%{family[0]}\n"]);
  if (!out) return [];
  const unique = new Set<string>();
  for (const raw of out.split(/\r?\n/)) {
    const name = raw.split(",")[0]?.trim();
    if (name) unique.add(name);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export async function readGtk4CustomCss(domicile: Domicile): Promise<string> {
  try {
    const res = await domicile.files.readText(".config/gtk-4.0/gtk.css");
    return res.match({ Ok: (t) => t, Err: () => "" });
  } catch {
    return "";
  }
}

export async function writeGtk4CustomCss(
  domicile: Domicile,
  css: string
): Promise<boolean> {
  try {
    await domicile.files.createDir(".config/gtk-4.0").catch(() => undefined);
    const writeRes = await domicile.files.write(".config/gtk-4.0/gtk.css", css);
    return writeRes.match({ Ok: () => true, Err: () => false });
  } catch {
    return false;
  }
}

export async function readGnomeNotificationSettings(
  domicile: Domicile
): Promise<GnomeNotificationSettings> {
  const [bannersRaw, lockRaw] = await Promise.all([
    runText(domicile, [
      "gsettings",
      "get",
      "org.gnome.desktop.notifications",
      "show-banners",
    ]),
    runText(domicile, [
      "gsettings",
      "get",
      "org.gnome.desktop.notifications",
      "show-in-lock-screen",
    ]),
  ]);

  const result: GnomeNotificationSettings = {};
  if (bannersRaw) {
    const trimmed = bannersRaw.trim();
    if (trimmed === "true" || trimmed === "false") {
      result.doNotDisturb = trimmed !== "true";
    }
  }
  if (lockRaw) {
    const trimmed = lockRaw.trim();
    if (trimmed === "true" || trimmed === "false") {
      result.showInLockScreen = trimmed === "true";
    }
  }
  return result;
}

export async function syncGnomeNotificationSettings(
  domicile: Domicile,
  patch: GnomeNotificationSettings
): Promise<void> {
  const pairs: [string, string][] = [];
  if (patch.doNotDisturb !== undefined) {
    pairs.push(["show-banners", patch.doNotDisturb ? "false" : "true"]);
  }
  if (patch.showInLockScreen !== undefined) {
    pairs.push([
      "show-in-lock-screen",
      patch.showInLockScreen ? "true" : "false",
    ]);
  }
  await Promise.allSettled(
    pairs.map(([key, value]) =>
      runText(domicile, [
        "gsettings",
        "set",
        "org.gnome.desktop.notifications",
        key,
        value,
      ])
    )
  );
}

