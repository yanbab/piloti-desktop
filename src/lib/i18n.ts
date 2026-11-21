import {
  readVfsStateText,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateText,
} from "@/lib/vfs-state";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";

export type SupportedLocale = "en" | "fr" | "es";
export type LocalePreference = "default" | SupportedLocale;

const DICTIONARIES: Record<string, Record<string, string>> = {
  en,
  es,
  fr,
};

export const LOCALE_STORAGE_KEY = "piloti.locale.v1";
export const LOCALE_CHANGED_EVENT = "piloti:locale-changed";

function normalizeLocale(raw: string | null | undefined): SupportedLocale {
  if (!raw) return "en";
  const base = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (base === "fr") return "fr";
  if (base === "es") return "es";
  return "en";
}

export function getSystemLocale(): SupportedLocale {
  if (typeof navigator !== "undefined") {
    const langs =
      Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : [];
    for (const lang of langs) {
      const base = lang.trim().toLowerCase().split(/[-_]/)[0];
      if (base === "fr") return "fr";
      if (base === "es") return "es";
      if (base === "en") return "en";
    }
    if (navigator.language) {
      return normalizeLocale(navigator.language);
    }
  }
  return "en";
}

function detectInitialState(): {
  preference: LocalePreference;
  locale: SupportedLocale;
} {
  try {
    const saved = readVfsStateText(
      VFS_STATE_PATHS.locale,
      LOCALE_STORAGE_KEY,
    )?.trim();
    if (saved === "en" || saved === "fr" || saved === "es") {
      return { preference: saved, locale: saved };
    }
    if (saved && saved !== "default") {
      const norm = normalizeLocale(saved);
      return { preference: norm, locale: norm };
    }
  } catch {
    // ignore VFS read errors
  }
  return { preference: "default", locale: getSystemLocale() };
}

const initialState = detectInitialState();
let activePreference: LocalePreference = initialState.preference;
let activeLocale: SupportedLocale = initialState.locale;

function applyLocaleString(locale: string): {
  changed: boolean;
  preference: LocalePreference;
  locale: SupportedLocale;
} {
  const trimmed = locale.trim().toLowerCase();
  let nextPreference: LocalePreference;
  let nextLocale: SupportedLocale;
  if (trimmed === "default" || trimmed === "system" || trimmed === "auto" || !trimmed) {
    nextPreference = "default";
    nextLocale = getSystemLocale();
  } else {
    const norm = normalizeLocale(trimmed);
    nextPreference = norm;
    nextLocale = norm;
  }
  const changed =
    nextPreference !== activePreference || nextLocale !== activeLocale;
  activePreference = nextPreference;
  activeLocale = nextLocale;
  return { changed, preference: nextPreference, locale: nextLocale };
}

export function getLocale(): SupportedLocale {
  return activeLocale;
}

export function getLocalePreference(): LocalePreference {
  return activePreference;
}

export function setLocale(locale: string): SupportedLocale {
  applyLocaleString(locale);
  try {
    writeVfsStateText(VFS_STATE_PATHS.locale, `${activePreference}\n`);
  } catch {
    // ignore VFS write errors
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LOCALE_CHANGED_EVENT, {
        detail: { locale: activeLocale, preference: activePreference },
      }),
    );
  }
  return activeLocale;
}

if (typeof window !== "undefined") {
  subscribeVfsPath(VFS_STATE_PATHS.locale, (content) => {
    const { changed } = applyLocaleString(content ?? "default");
    if (changed) {
      window.dispatchEvent(
        new CustomEvent(LOCALE_CHANGED_EVENT, {
          detail: { locale: activeLocale, preference: activePreference },
        }),
      );
    }
  });
}

export function subscribeLocale(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCALE_STORAGE_KEY) {
      const next = detectInitialState();
      activePreference = next.preference;
      activeLocale = next.locale;
      listener();
    }
  };
  window.addEventListener(LOCALE_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LOCALE_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function formatTemplate(
  template: string,
  args: readonly (string | number)[]
): string {
  if (args.length === 0) return template;
  let argIndex = 0;
  return template.replace(/%%|%[sd]/g, (token) => {
    if (token === "%%") return "%";
    if (argIndex >= args.length) return token;
    const val = args[argIndex++];
    if (token === "%d") {
      const num = Number(val);
      return Number.isFinite(num) ? String(Math.trunc(num)) : String(val);
    }
    return String(val);
  });
}

/**
 * Translates an English-indexed string key using the active locale JSON
 * (falling back to the English key when `en.json` is empty) and formats
 * positional `%s` / `%d` placeholders.
 */
export function _(key: string, ...args: (string | number)[]): string {
  const dict = DICTIONARIES[activeLocale];
  const template = dict?.[key] ?? key;
  return formatTemplate(template, args);
}

