import type { DesktopKeyKind } from "./piloti-settings-ini";

/**
 * GVariant text (what `gsettings` and `dconf` print and read) to and from the
 * settings layer's text (keyfile style: `true`, `52`, `a;b`). Only the types
 * Piloti's schemas use: `s`, `b`, `d`, `as`.
 */
/** `int` is only for GNOME keys Piloti links to. */
export type GVariantKind = DesktopKeyKind | "int";

export const GVARIANT_TYPE: Record<GVariantKind, string> = {
  string: "s",
  boolean: "b",
  number: "d",
  int: "i",
  "string[]": "as",
};

function quote(text: string): string {
  return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Reads one GVariant string literal (`'…'` or `"…"`) at the start of `raw`. */
function readQuoted(raw: string): { value: string; rest: string } | null {
  const q = raw[0];
  if (q !== "'" && q !== '"') return null;
  let value = "";
  for (let i = 1; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) {
      value += raw[++i];
    } else if (c === q) {
      return { value, rest: raw.slice(i + 1) };
    } else {
      value += c;
    }
  }
  return null;
}

/** Layer text → GVariant text. */
export function toGVariant(text: string, kind: GVariantKind): string {
  if (kind === "boolean") return text === "true" || text === "1" ? "true" : "false";
  if (kind === "int") return String(Math.round(Number(text)) || 0);
  if (kind === "number") {
    const n = Number(text);
    const v = Number.isFinite(n) ? n : 0;
    return Number.isInteger(v) ? `${v}.0` : String(v);
  }
  if (kind === "string[]") {
    const items = text.split(";").map((s) => s.trim()).filter(Boolean);
    return items.length === 0 ? "@as []" : `[${items.map(quote).join(", ")}]`;
  }
  return quote(text);
}

/** GVariant text → layer text; `undefined` when it can't be read. */
export function fromGVariant(raw: string, kind?: GVariantKind): string | undefined {
  let text = raw.trim();
  if (text.startsWith("@")) text = text.replace(/^@\S+\s*/, "");
  if (kind === "string[]" || text.startsWith("[")) {
    if (!text.startsWith("[")) return undefined;
    const items: string[] = [];
    let rest = text.slice(1).trim();
    while (rest && !rest.startsWith("]")) {
      const item = readQuoted(rest);
      if (!item) return undefined;
      items.push(item.value);
      rest = item.rest.trim().replace(/^,/, "").trim();
    }
    return items.join(";");
  }
  const quoted = readQuoted(text);
  if (quoted) return quoted.value;
  if (kind === "string") return text;
  if (text === "true" || text === "false") return text;
  const n = Number(text);
  return Number.isFinite(n) ? String(n) : undefined;
}
