import type { SettingChange, SettingsBackend } from "@/core/ports/settings";
import type { GVariantKind } from "./gvariant";
import { parseIniText } from "./ini";

/** Where the links are listed (shipped from `data/files`). */
export const GSETTINGS_LINKS_PATH = "/usr/share/piloti/gsettings-links.ini";

export interface GSettingsLink {
  /** The Piloti key. */
  schema: string;
  key: string;
  /** The GNOME key it follows. */
  target: { schema: string; key: string; kind: GVariantKind };
  /** Sent to GNOME, never read back. */
  writeOnly: boolean;
  /** GNOME value → Piloti values; absent when both spell them alike. */
  values?: ReadonlyMap<string, readonly string[]>;
}

const KINDS: Record<string, GVariantKind> = { s: "string", b: "boolean", i: "int", d: "number" };
const id = (schema: string, key: string) => `${schema}/${key}`;

/** Reads `gsettings-links.ini` (its header explains the format). */
export function parseGSettingsLinks(text: string): GSettingsLink[] {
  const ini = parseIniText(text);
  const links: GSettingsLink[] = [];
  for (const [section, entries] of Object.entries(ini)) {
    if (section.startsWith("values:")) continue;
    for (const [key, spec] of Object.entries(entries)) {
      const [schema, gnomeKey, type, flag] = spec.split(/\s+/);
      const kind = KINDS[type];
      if (!schema || !gnomeKey || !kind) continue;
      const values = ini[`values:${id(section, key)}`];
      links.push({
        schema: section,
        key,
        target: { schema, key: gnomeKey, kind },
        writeOnly: flag === "write-only",
        values: values && new Map(Object.entries(values).map(([g, p]) => [g, p.split(";")])),
      });
    }
  }
  return links;
}

/** GNOME's spelling of a Piloti value; `undefined` when it has none. */
function toGnome(link: GSettingsLink, value: string): string | undefined {
  if (link.values) return [...link.values].find(([, own]) => own.includes(value))?.[0];
  if (link.target.kind === "int") return String(Math.round(Number(value)));
  // An empty font, colour or theme is "not chosen", not something to send.
  return value.trim() || (link.target.key.startsWith("picture-uri") ? "" : undefined);
}

const fromGnome = (link: GSettingsLink, raw: string) => (link.values ? link.values.get(raw)?.[0] : raw);

export interface LinkedSettingsOptions {
  /** Piloti's own settings (dconf or the keyfiles). */
  base: SettingsBackend;
  /** The GNOME keys. */
  gnome: SettingsBackend;
  links: readonly GSettingsLink[];
  /** The key that turns the links on (default on). */
  toggle: { schema: string; key: string };
}

/**
 * Piloti's settings with some keys linked to GNOME's. A linked key reads GNOME's
 * value when one is set there (keeping Piloti's own when both mean the same,
 * like "system" and "default"); writes go to both, so turning the links off
 * keeps the current values.
 */
export function linkSettingsBackend({ base, gnome, links, toggle }: LinkedSettingsOptions): SettingsBackend {
  const byKey = new Map(links.map((link) => [id(link.schema, link.key), link]));
  const linkedSchemas = new Set(links.map((link) => link.schema));
  const enabled = () => base.read(toggle.schema, toggle.key) !== "false";
  const linkedValue = (schema: string, key: string) => {
    const link = byKey.get(id(schema, key));
    if (!link || !enabled()) return undefined;
    const raw = gnome.read(link.target.schema, link.target.key);
    return raw === undefined ? undefined : fromGnome(link, raw);
  };

  // While writing, both sides change: listeners hear of it once, when both did.
  let writing = false;
  const pending = new Set<() => void>();
  const relay = (listener: () => void) => () => {
    if (writing) pending.add(listener);
    else listener();
  };

  const writeBatch = (changes: readonly SettingChange[]) => {
    const toggled = changes.find((c) => c.schema === toggle.schema && c.key === toggle.key);
    const on = toggled ? toggled.value !== "false" : enabled();
    const out: SettingChange[] = [];
    if (on) {
      for (const { schema, key, value } of changes) {
        const link = byKey.get(id(schema, key));
        if (!link) continue;
        const next = value === null ? null : toGnome(link, value);
        if (next !== undefined) out.push({ schema: link.target.schema, key: link.target.key, value: next });
      }
    }
    writing = true;
    try {
      if (out.length > 0) gnome.writeBatch(out);
      base.writeBatch(changes);
    } finally {
      writing = false;
      const listeners = [...pending];
      pending.clear();
      listeners.forEach((listener) => listener());
    }
  };

  return {
    read(schema, key) {
      const own = base.read(schema, key);
      const link = byKey.get(id(schema, key));
      if (!link || link.writeOnly || !enabled()) return own;
      const raw = gnome.read(link.target.schema, link.target.key);
      if (raw === undefined || (own !== undefined && toGnome(link, own) === raw)) return own;
      return fromGnome(link, raw) ?? own;
    },
    linkedValue,
    write: (schema, key, value) => writeBatch([{ schema, key, value }]),
    reset: (schema, key) => writeBatch([{ schema, key, value: null }]),
    writeBatch,
    seed: (changes) => base.writeBatch(changes),
    subscribe(schema, listener) {
      const heard = relay(listener);
      const stops = [base.subscribe(schema, heard)];
      if (linkedSchemas.has(schema)) stops.push(gnome.subscribeAll(heard));
      return () => stops.forEach((stop) => stop());
    },
    subscribeAll(listener) {
      const heard = relay(listener);
      const stops = [base.subscribeAll(heard), gnome.subscribeAll(heard)];
      return () => stops.forEach((stop) => stop());
    },
  };
}
