import { VFS_HOME } from "@/lib/engine/vfs-home";
import {
  readVfsStateText,
  subscribeVfsPath,
  subscribeVfsStateDir,
  writeVfsStateText,
} from "@/lib/engine/vfs-state";
import { parseIniText, serializeIniText, type IniRecord } from "@/lib/config/ini";
import type { SettingValue, SettingsBackend } from "@/lib/ports/settings";

/**
 * Typed settings for one schema:
 *
 *   const calc = defineSettings("org.piloti.calculator", { scientific: false });
 *   calc.get("scientific");         // false until set
 *   calc.set("scientific", true);
 *   calc.subscribe("scientific", () => …);
 *
 * React: `useSetting(calc, "scientific")` (`hooks/use-setting.ts`).
 */
export interface Settings<T extends Record<string, SettingValue> = Record<string, SettingValue>> {
  readonly schema: string;
  readonly defaults: Readonly<T>;
  get<K extends keyof T & string>(key: K): T[K];
  set<K extends keyof T & string>(key: K, value: T[K]): void;
  reset<K extends keyof T & string>(key: K): void;
  /** `listener` runs when `key` changes (or any key, without one). */
  subscribe(listener: () => void): () => void;
  subscribe<K extends keyof T & string>(key: K, listener: () => void): () => void;
}

/* ------------------------------------------------------------------ */
/* Backends                                                            */
/* ------------------------------------------------------------------ */

export const SETTINGS_DIR = `${VFS_HOME}/.config/piloti/settings`;

export interface KeyfileLayout {
  /** Folder holding one `.ini` per schema. */
  dir: string;
  /** File name (without `.ini`) for a schema; the schema id by default. */
  fileName?: (schema: string) => string;
  /** Section holding the schema's keys; `[<schema id>]` by default. */
  section?: (schema: string) => string;
}

/**
 * One `.ini` file per schema, read through the state store. Other sections of
 * the file are kept as they are.
 */
export function keyfileSettingsBackend(
  layout: KeyfileLayout = { dir: SETTINGS_DIR },
): SettingsBackend {
  const fileName = layout.fileName ?? ((schema) => schema);
  const sectionOf = layout.section ?? ((schema) => schema);
  const pathOf = (schema: string) => `${layout.dir}/${fileName(schema)}.ini`;
  // Parsed once per file content: reads happen on every render.
  const parsed = new Map<string, { raw: string | null; ini: IniRecord }>();

  const load = (schema: string): IniRecord => {
    const raw = readVfsStateText(pathOf(schema));
    const hit = parsed.get(schema);
    if (hit && hit.raw === raw) return hit.ini;
    const ini = raw ? parseIniText(raw) : {};
    parsed.set(schema, { raw, ini });
    return ini;
  };

  const save = (schema: string, edit: (section: Record<string, string>) => void) => {
    const ini = { ...load(schema) };
    const name = sectionOf(schema);
    const section = { ...(ini[name] ?? {}) };
    edit(section);
    if (Object.keys(section).length > 0) ini[name] = section;
    else delete ini[name];
    writeVfsStateText(pathOf(schema), serializeIniText(ini));
  };

  return {
    read: (schema, key) => load(schema)[sectionOf(schema)]?.[key],
    write: (schema, key, value) => save(schema, (s) => void (s[key] = value)),
    reset: (schema, key) => save(schema, (s) => void delete s[key]),
    subscribe: (schema, listener) => subscribeVfsPath(pathOf(schema), () => listener()),
    subscribeAll: (listener) => subscribeVfsStateDir(layout.dir, listener),
  };
}

/** Keeps everything in memory. For tests. */
export function memorySettingsBackend(): SettingsBackend {
  const data = new Map<string, Map<string, string>>();
  const listeners = new Map<string, Set<() => void>>();
  const all = new Set<() => void>();
  const notify = (schema: string) => {
    listeners.get(schema)?.forEach((l) => l());
    all.forEach((l) => l());
  };
  return {
    read: (schema, key) => data.get(schema)?.get(key),
    write(schema, key, value) {
      if (data.get(schema)?.get(key) === value) return;
      if (!data.has(schema)) data.set(schema, new Map());
      data.get(schema)!.set(key, value);
      notify(schema);
    },
    reset(schema, key) {
      if (data.get(schema)?.delete(key)) notify(schema);
    },
    subscribe(schema, listener) {
      if (!listeners.has(schema)) listeners.set(schema, new Set());
      listeners.get(schema)!.add(listener);
      return () => listeners.get(schema)?.delete(listener);
    },
    subscribeAll(listener) {
      all.add(listener);
      return () => all.delete(listener);
    },
  };
}

let backend: SettingsBackend | null = null;

/** Entry points (or tests) pick the backend before settings are read. */
export function setSettingsBackend(next: SettingsBackend | null): void {
  backend = next;
}

function currentBackend(): SettingsBackend {
  return (backend ??= keyfileSettingsBackend());
}

/* ------------------------------------------------------------------ */
/* Values as text (the keyfile conventions settings.ini already uses)  */
/* ------------------------------------------------------------------ */

function encode(value: SettingValue): string {
  return Array.isArray(value) ? value.join(";") : String(value);
}

/** Parses `raw` as the type of `fallback`; a bad value reads as the default. */
function decode<V extends SettingValue>(raw: string, fallback: V): V {
  if (typeof fallback === "boolean") {
    if (raw === "true" || raw === "1") return true as V;
    if (raw === "false" || raw === "0") return false as V;
    return fallback;
  }
  if (typeof fallback === "number") {
    const n = Number(raw);
    return (raw.trim() && Number.isFinite(n) ? n : fallback) as V;
  }
  if (Array.isArray(fallback)) {
    return raw.split(";").map((s) => s.trim()).filter(Boolean) as V;
  }
  return raw as V;
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

/** `false` → `boolean`, `"dark"` → `string`: defaults give the type, not the value. */
type Widen<V> = V extends boolean
  ? boolean
  : V extends number
    ? number
    : V extends string
      ? string
      : V extends readonly string[]
        ? string[]
        : V;
export type SettingsOf<D> = { -readonly [K in keyof D]: Widen<D[K]> };

export function defineSettings<D extends Record<string, SettingValue>>(
  schema: string,
  initial: D,
): Settings<SettingsOf<D>> {
  type T = SettingsOf<D>;
  const defaults = initial as unknown as T;
  // Same raw text → same value object, so React snapshots stay stable.
  const cache = new Map<string, { raw: string | undefined; value: SettingValue }>();

  const get = <K extends keyof T & string>(key: K): T[K] => {
    const raw = currentBackend().read(schema, key);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value as T[K];
    const value = raw === undefined ? defaults[key] : decode(raw, defaults[key]);
    cache.set(key, { raw, value });
    return value;
  };

  return {
    schema,
    defaults,
    get,
    set(key, value) {
      currentBackend().write(schema, key, encode(value));
    },
    reset(key) {
      currentBackend().reset(schema, key);
    },
    subscribe(keyOrListener: string | (() => void), maybeListener?: () => void) {
      if (typeof keyOrListener === "function") {
        return currentBackend().subscribe(schema, keyOrListener);
      }
      const key = keyOrListener as keyof T & string;
      const listener = maybeListener!;
      let last = get(key);
      return currentBackend().subscribe(schema, () => {
        const next = get(key);
        if (next === last) return;
        last = next;
        listener();
      });
    },
  } as Settings<T>;
}
