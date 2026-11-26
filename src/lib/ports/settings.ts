/**
 * Where settings live, modelled on GSettings: a schema id (`org.piloti.calculator`)
 * holds typed keys. Only the keys someone set are stored; the rest come from the
 * schema's defaults. Backends: a keyfile (`engine/settings.ts`, what Piloti uses
 * now), memory (tests), later gsettings/dconf on Linux.
 *
 * Settings are preferences the user chose. Things the shell remembers by itself
 * (window bounds, history, caches) are state and stay files (`engine/vfs-state.ts`).
 */
export type SettingValue = string | number | boolean | string[];

/** One change of a batch: `value` null resets the key. */
export interface SettingChange {
  schema: string;
  key: string;
  value: string | null;
}

export interface SettingsBackend {
  /** The stored value as text, or `undefined` when the key was never set. */
  read(schema: string, key: string): string | undefined;
  write(schema: string, key: string, value: string): void;
  /** Forgets the key, so it reads as its default again. */
  reset(schema: string, key: string): void;
  /** `listener` runs when any key of `schema` may have changed, here or elsewhere. */
  subscribe(schema: string, listener: () => void): () => void;
  /** The same for every schema this backend holds. */
  subscribeAll(listener: () => void): () => void;
  /** Several changes at once (one file write, one notification per schema). */
  writeBatch(changes: readonly SettingChange[]): void;
  /** First-run values: stored by Piloti only. `writeBatch` when absent. */
  seed?(changes: readonly SettingChange[]): void;
  /** The linked system value of a key (`config/gsettings-links.ts`), if any. */
  linkedValue?(schema: string, key: string): string | undefined;
}
