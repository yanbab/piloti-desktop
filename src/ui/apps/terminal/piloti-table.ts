/** JSON arrays of objects, drawn as a table in piloti-shell. */

const MAX_CELL = 48;
const MIN_CELL = 6;
const MAX_ROWS = 500;

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The rows of an array of objects, or of its JSON text; else `null`. */
export function tableRows(value: unknown): Row[] | null {
  let data = value;
  if (typeof data === "string") {
    if (!/^\s*\[\s*\{/.test(data)) return null;
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return Array.isArray(data) && data.length > 0 && data.every(isRow) ? data : null;
}

/** One line of text: data must not move the cursor or recolor the terminal. */
function cell(value: unknown): string {
  if (value === undefined) return "";
  const text = typeof value === "string" ? value : (JSON.stringify(value) ?? String(value));
  return text.replace(/[\x00-\x1f\x7f-\x9f]+/g, " ");
}

const fit = (text: string, width: number) =>
  text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);

export interface TableOptions {
  columns?: number;
  /** Every column, even past the terminal's width. */
  all?: boolean;
  maxCell?: number;
  /** Colors a cell's text, already cut to size. */
  paint?: (text: string, row: number, key: string) => string;
}

const MAX_COLUMNS = 6;
/** Shown first, as they say what a row is. */
const LEADING = ["id", "name", "title"];

export function formatTable(rows: Row[], options: TableOptions = {}): string {
  const { columns = 80, all = false, maxCell = MAX_CELL, paint } = options;
  const shown = rows.slice(0, MAX_ROWS);
  const found = [...new Set(shown.flatMap((row) => Object.keys(row)))];
  let keys = found;
  if (!all && found.length > MAX_COLUMNS) {
    const rank = (key: string) => (LEADING.includes(key) ? LEADING.indexOf(key) : LEADING.length);
    keys = found
      .filter((key) => shown.some((row) => cell(row[key]) !== ""))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, MAX_COLUMNS);
  }
  const cells = shown.map((row) => keys.map((key) => cell(row[key])));
  const widths = keys.map((key, i) =>
    Math.min(maxCell, Math.max(cell(key).length, ...cells.map((r) => r[i]!.length))),
  );
  const total = () => widths.reduce((sum, w) => sum + w + 1, -1);
  // Too wide: narrow the widest columns, then leave out the last ones.
  while (total() > columns) {
    const widest = widths.indexOf(Math.max(...widths));
    if (widths[widest]! <= MIN_CELL) break;
    widths[widest]! -= 1;
  }
  while (!all && widths.length > 1 && total() > columns) widths.pop();
  keys = keys.slice(0, widths.length);
  const line = (values: string[], row?: number) =>
    widths
      .map((w, i) => {
        const text = fit(values[i]!, w);
        if (row === undefined || !paint) return text;
        const body = text.trimEnd();
        return paint(body, row, keys[i]!) + text.slice(body.length);
      })
      .join(" ")
      .trimEnd();
  const hidden = found.length - keys.length;
  const notes = [
    rows.length > shown.length ? `… ${rows.length - shown.length} more rows` : "",
    hidden && !all ? `… ${hidden} more columns (-a shows all)` : "",
  ].filter(Boolean);
  return [
    line(keys.map(cell)),
    "─".repeat(Math.min(total(), columns)),
    ...cells.map((row, i) => line(row, i)),
    ...notes,
  ].join("\n");
}
