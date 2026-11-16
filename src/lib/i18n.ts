import en from "../locales/en.json";
import fr from "../locales/fr.json";

export type SupportedLocale = "en" | "fr";

const DICTIONARIES: Record<string, Record<string, string>> = {
  en,
  fr,
};

const LOCALE_STORAGE_KEY = "piloti.locale.v1";

function normalizeLocale(raw: string | null | undefined): SupportedLocale {
  if (!raw) return "en";
  const base = raw.trim().toLowerCase().split(/[-_]/)[0];
  return base === "fr" ? "fr" : "en";
}

function detectInitialLocale(): SupportedLocale {
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved) return normalizeLocale(saved);
    } catch {
      // ignore storage errors
    }
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return normalizeLocale(navigator.language);
  }
  return "en";
}

let activeLocale: SupportedLocale = detectInitialLocale();

export function getLocale(): SupportedLocale {
  return activeLocale;
}

export function setLocale(locale: string): SupportedLocale {
  activeLocale = normalizeLocale(locale);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, activeLocale);
    } catch {
      // ignore storage errors
    }
  }
  return activeLocale;
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

