import { VFS_HOME } from "@/platform/shared/vfs-home";
import {
  readVfsStateText,
  subscribeVfsPath,
  subscribeVfsStateDir,
  writeVfsStateText,
} from "@/platform/shared/vfs-state";
import { parseIniText, serializeIniText, type IniRecord } from "@/core/config/ini";
import type { SettingChange, SettingValue, SettingsBackend } from "@/core/ports/settings";

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

const CONFIG_DIR = `${VFS_HOME}/.config/piloti`;
/** The shell's own schemas (`org.piloti.desktop.*`). */
export const SHELL_SETTINGS_PATH = `${CONFIG_DIR}/settings.ini`;
/** One file per app: its own schemas plus the keys the shell applies to it. */
export const APP_SETTINGS_DIR = `${CONFIG_DIR}/apps`;

const safeFileName = (id: string) => id.replace(/[^A-Za-z0-9._-]/g, "_");

/** The file holding an app's settings, built-in (`calculator`) or not. */
export function appSettingsPath(appId: string): string {
  return `${APP_SETTINGS_DIR}/${safeFileName(appId)}.ini`;
}

/**
 * One file per owner, chosen from the schema id:
 * - `org.piloti.desktop[.*]` → `settings.ini` (the shell);
 * - `org.piloti.<app>[.*]` → `apps/<app>.ini` (a built-in app, e.g. `calculator`);
 * - anything else (`org.gnome.TextEditor`) → `apps/<schema>.ini`.
 */
export function settingsPathForSchema(schema: string): string {
  if (schema === "org.piloti.desktop" || schema.startsWith("org.piloti.desktop.")) {
    return SHELL_SETTINGS_PATH;
  }
  const builtIn = /^org\.piloti\.([^.]+)/.exec(schema);
  return appSettingsPath(builtIn ? builtIn[1] : schema);
}

export interface KeyfileLayout {
  /** The `.ini` file holding a schema. */
  path: (schema: string) => string;
  /** Section holding the schema's keys; `[<schema id>]` by default. */
  section?: (schema: string) => string;
  /** Folders to watch for `subscribeAll`. */
  dirs: readonly string[];
}

export const PILOTI_SETTINGS_LAYOUT: KeyfileLayout = {
  path: settingsPathForSchema,
  dirs: [CONFIG_DIR, APP_SETTINGS_DIR],
};

/**
 * Keyfiles read through the state store, several schemas per file if the
 * layout says so. Other sections of a file are kept as they are.
 */
export function keyfileSettingsBackend(
  layout: KeyfileLayout = PILOTI_SETTINGS_LAYOUT,
): SettingsBackend {
  const sectionOf = layout.section ?? ((schema) => schema);
  const pathOf = layout.path;
  // Parsed once per file content: reads happen on every render.
  const parsed = new Map<string, { raw: string | null; ini: IniRecord }>();

  const load = (schema: string): IniRecord => {
    const path = pathOf(schema);
    const raw = readVfsStateText(path);
    const hit = parsed.get(path);
    if (hit && hit.raw === raw) return hit.ini;
    const ini = raw ? parseIniText(raw) : {};
    parsed.set(path, { raw, ini });
    return ini;
  };

  /** Applies changes to one file's schemas, then writes it once. */
  const saveFile = (path: string, changes: readonly SettingChange[]) => {
    const ini = { ...load(changes[0].schema) };
    for (const { schema, key, value } of changes) {
      const name = sectionOf(schema);
      const section = { ...(ini[name] ?? {}) };
      if (value === null) delete section[key];
      else section[key] = value;
      if (Object.keys(section).length > 0) ini[name] = section;
      else delete ini[name];
    }
    writeVfsStateText(path, serializeIniText(ini));
  };
  const save = (schema: string, edit: (section: Record<string, string>) => void) => {
    const section: Record<string, string> = { ...(load(schema)[sectionOf(schema)] ?? {}) };
    const before = { ...section };
    edit(section);
    const changes: SettingChange[] = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(section)])) {
      if (before[key] !== section[key]) changes.push({ schema, key, value: section[key] ?? null });
    }
    if (changes.length > 0) saveFile(pathOf(schema), changes);
  };

  return {
    read: (schema, key) => load(schema)[sectionOf(schema)]?.[key],
    write: (schema, key, value) => save(schema, (s) => void (s[key] = value)),
    reset: (schema, key) => save(schema, (s) => void delete s[key]),
    subscribe: (schema, listener) => subscribeVfsPath(pathOf(schema), () => listener()),
    subscribeAll(listener) {
      const stops = layout.dirs.map((dir) => subscribeVfsStateDir(dir, listener));
      return () => stops.forEach((stop) => stop());
    },
    writeBatch(changes) {
      const byFile = new Map<string, SettingChange[]>();
      for (const change of changes) {
        const path = pathOf(change.schema);
        if (!byFile.has(path)) byFile.set(path, []);
        byFile.get(path)!.push(change);
      }
      for (const [path, fileChanges] of byFile) saveFile(path, fileChanges);
    },
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
    writeBatch(changes) {
      const touched = new Set<string>();
      for (const { schema, key, value } of changes) {
        const current = data.get(schema)?.get(key);
        if (value === null) {
          if (data.get(schema)?.delete(key)) touched.add(schema);
        } else if (current !== value) {
          if (!data.has(schema)) data.set(schema, new Map());
          data.get(schema)!.set(key, value);
          touched.add(schema);
        }
      }
      for (const schema of touched) notify(schema);
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

/** The backend in use (keyfile unless an entry point picked another). */
export function settingsBackend(): SettingsBackend {
  return currentBackend();
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

const registry = new Map<string, Settings>();

/** The schema defined under `schema`, if any. */
export function findSettings(schema: string): Settings | undefined {
  return registry.get(schema);
}

/** Every schema defined so far, for scripts and the Console. */
export function listSettingsSchemas(): string[] {
  return [...registry.keys()].sort();
}

/**
 * A defined schema, or untyped access to an unknown one: its keys read as
 * stored text, `undefined` when unset. For `window.piloti.settings` and plugins.
 */
export function settingsFor(schema: string): Settings {
  return registry.get(schema) ?? defineSettings(schema, {}, { register: false });
}

export function defineSettings<D extends Record<string, SettingValue>>(
  schema: string,
  initial: D,
  options: { register?: boolean } = {},
): Settings<SettingsOf<D>> {
  type T = SettingsOf<D>;
  const defaults = initial as unknown as T;
  // Same raw text → same value object, so React snapshots stay stable.
  const cache = new Map<string, { raw: string | undefined; value: SettingValue }>();

  const get = <K extends keyof T & string>(key: K): T[K] => {
    const raw = currentBackend().read(schema, key);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value as T[K];
    const fallback = defaults[key];
    // A key with no default (untyped access) reads as its stored text.
    const value = (
      raw === undefined ? fallback : fallback === undefined ? raw : decode(raw, fallback)
    ) as T[K];
    cache.set(key, { raw, value });
    return value;
  };

  const settings = {
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
  if (options.register !== false) registry.set(schema, settings as unknown as Settings);
  return settings;
}
