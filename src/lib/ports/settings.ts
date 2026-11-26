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
}
