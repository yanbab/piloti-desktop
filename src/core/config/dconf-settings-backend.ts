import type { SettingChange, SettingsBackend } from "@/core/ports/settings";
import { fromGVariant, toGVariant, type GVariantKind } from "./gvariant";
import { parseIniText, serializeIniText, type IniRecord } from "./ini";
import { schemaPath } from "./piloti-gschema";

/** What the backend needs from the system: dconf's command line. */
export interface DconfHost {
  /** `dconf dump <dir>`: keyfile text of what is set under `dir`. */
  dump(dir: string): Promise<string | null>;
  /** `dconf load <dir>` with keyfile text (several keys, one process). */
  load(dir: string, keyfile: string): Promise<boolean>;
  /** `dconf reset <path>`. */
  reset(path: string): Promise<boolean>;
  /** `dconf read <path>`: GVariant text, or null when unset. */
  read(path: string): Promise<string | null>;
  /** `dconf watch <dir>`: calls `onPath` with each changed key's path. Returns stop. */
  watch(dir: string, onPath: (path: string) => void): () => void;
}

export interface DconfBackendOptions {
  /** dconf folder holding the schemas, such as `/org/piloti/desktop/`. */
  root: string;
  /** The kind of each `schema` + `key`, to convert GVariant text. */
  kindOf: (schema: string, key: string) => GVariantKind | undefined;
  /** Writes made in this window are sent together. */
  flushMs?: number;
}

/**
 * Settings kept in dconf (what GSettings uses), read synchronously from a
 * cache loaded before the shell renders (`preload`). Writes update the cache at
 * once and reach dconf shortly after, several in one `dconf load`; changes made
 * elsewhere (`gsettings set`, dconf-editor, GNOME Settings) arrive through
 * `dconf watch`. Only values that were set are cached: the rest reads as the
 * shell's own defaults, as with the keyfile.
 */
export function createDconfSettingsBackend(host: DconfHost, options: DconfBackendOptions) {
  const { root, kindOf, flushMs = 150 } = options;
  const schemaRoot = root.replace(/^\//, "").replace(/\/$/, "").split("/").join(".");
  const cache = new Map<string, Map<string, string>>();
  const listeners = new Map<string, Set<() => void>>();
  const all = new Set<() => void>();
  const pending = new Map<string, { schema: string; key: string; value: string | null }>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let stopWatch: (() => void) | null = null;
  // Bumped on each local change of a path: a read-back started before it is stale.
  const localVersion = new Map<string, number>();

  const notify = (schema: string) => {
    listeners.get(schema)?.forEach((l) => l());
    all.forEach((l) => l());
  };
  const keyPath = (schema: string, key: string) => `${schemaPath(schema)}${key}`;
  /** `/org/piloti/desktop/dock/icon-size` → schema + key, when under `root`. */
  const splitPath = (path: string) => {
    if (!path.startsWith(root)) return null;
    const slash = path.lastIndexOf("/");
    const key = path.slice(slash + 1);
    const schema = path.slice(1, slash).split("/").join(".");
    return key && schema ? { schema, key } : null;
  };
  const toText = (schema: string, key: string, raw: string) => fromGVariant(raw, kindOf(schema, key));

  const set = (schema: string, key: string, value: string | null): boolean => {
    const current = cache.get(schema)?.get(key);
    if (value === null) {
      if (current === undefined) return false;
      cache.get(schema)!.delete(key);
      return true;
    }
    if (current === value) return false;
    if (!cache.has(schema)) cache.set(schema, new Map());
    cache.get(schema)!.set(key, value);
    return true;
  };

  const flush = async () => {
    flushTimer = null;
    const batch = [...pending.values()];
    pending.clear();
    const loads: IniRecord = {};
    for (const { schema, key, value } of batch) {
      if (value === null) {
        await host.reset(keyPath(schema, key));
        continue;
      }
      const kind = kindOf(schema, key) ?? "string";
      const section = schema.startsWith(`${schemaRoot}.`) ? schema.slice(schemaRoot.length + 1).split(".").join("/") : "/";
      (loads[section] ??= {})[key] = toGVariant(value, kind);
    }
    if (Object.keys(loads).length > 0) await host.load(root, serializeIniText(loads));
  };

  const queue = (changes: readonly SettingChange[]) => {
    const touched = new Set<string>();
    for (const change of changes) {
      if (!set(change.schema, change.key, change.value)) continue;
      const path = keyPath(change.schema, change.key);
      localVersion.set(path, (localVersion.get(path) ?? 0) + 1);
      pending.set(path, change);
      touched.add(change.schema);
    }
    if (pending.size > 0 && !flushTimer) flushTimer = setTimeout(() => void flush(), flushMs);
    for (const schema of touched) notify(schema);
  };

  const backend: SettingsBackend & {
    preload(): Promise<boolean>;
    flushNow(): Promise<void>;
    stop(): void;
  } = {
    /** Loads what is set; false when dconf can't be read. */
    async preload() {
      const dump = await host.dump(root);
      if (dump === null) return false;
      cache.clear();
      for (const [section, entries] of Object.entries(parseIniText(dump))) {
        const schema = section === "/" ? schemaRoot : `${schemaRoot}.${section.split("/").join(".")}`;
        for (const [key, raw] of Object.entries(entries)) {
          const text = toText(schema, key, raw);
          if (text !== undefined) set(schema, key, text);
        }
      }
      stopWatch ??= host.watch(root, (path) => {
        const at = splitPath(path);
        if (!at || pending.has(path)) return;
        const version = localVersion.get(path) ?? 0;
        void host.read(path).then((raw) => {
          if ((localVersion.get(path) ?? 0) !== version || pending.has(path)) return;
          const text = raw === null || raw.trim() === "" ? null : (toText(at.schema, at.key, raw) ?? null);
          if (set(at.schema, at.key, text)) notify(at.schema);
        });
      });
      return true;
    },
    async flushNow() {
      if (flushTimer) clearTimeout(flushTimer);
      await flush();
    },
    stop() {
      stopWatch?.();
      stopWatch = null;
    },
    read: (schema, key) => cache.get(schema)?.get(key),
    write: (schema, key, value) => queue([{ schema, key, value }]),
    reset: (schema, key) => queue([{ schema, key, value: null }]),
    writeBatch: (changes) => queue(changes),
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
  return backend;
}

/** Sends each schema to one of two backends (dconf for some, the keyfile for the rest). */
export function routeSettingsBackend(
  pick: (schema: string) => "primary" | "fallback",
  primary: SettingsBackend,
  fallback: SettingsBackend,
): SettingsBackend {
  const of = (schema: string) => (pick(schema) === "primary" ? primary : fallback);
  return {
    read: (schema, key) => of(schema).read(schema, key),
    write: (schema, key, value) => of(schema).write(schema, key, value),
    reset: (schema, key) => of(schema).reset(schema, key),
    subscribe: (schema, listener) => of(schema).subscribe(schema, listener),
    subscribeAll(listener) {
      const a = primary.subscribeAll(listener);
      const b = fallback.subscribeAll(listener);
      return () => {
        a();
        b();
      };
    },
    writeBatch(changes) {
      const toPrimary = changes.filter((c) => pick(c.schema) === "primary");
      const toFallback = changes.filter((c) => pick(c.schema) === "fallback");
      if (toPrimary.length > 0) primary.writeBatch(toPrimary);
      if (toFallback.length > 0) fallback.writeBatch(toFallback);
    },
  };
}
