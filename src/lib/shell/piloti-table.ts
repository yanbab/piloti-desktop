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

export function formatTable(rows: Row[], columns = 80): string {
  const shown = rows.slice(0, MAX_ROWS);
  let keys = [...new Set(shown.flatMap((row) => Object.keys(row)))];
  const cells = shown.map((row) => keys.map((key) => cell(row[key])));
  const widths = keys.map((key, i) =>
    Math.min(MAX_CELL, Math.max(cell(key).length, ...cells.map((r) => r[i]!.length))),
  );
  const total = () => widths.reduce((sum, w) => sum + w + 1, -1);
  // Too wide: narrow the widest columns, then leave out the last ones.
  while (total() > columns) {
    const widest = widths.indexOf(Math.max(...widths));
    if (widths[widest]! <= MIN_CELL) break;
    widths[widest]! -= 1;
  }
  let hidden = 0;
  while (widths.length > 1 && total() > columns) {
    widths.pop();
    hidden += 1;
  }
  keys = keys.slice(0, widths.length);
  const line = (values: string[]) => widths.map((w, i) => fit(values[i]!, w)).join(" ");
  const notes = [
    rows.length > shown.length ? `… ${rows.length - shown.length} more rows` : "",
    hidden ? `… ${hidden} more columns` : "",
  ].filter(Boolean);
  // The header is in inverse video, over its whole width.
  const body = cells.map((row) => line(row).trimEnd());
  return [`\x1b[7m${line(keys.map(cell))}\x1b[0m`, ...body, ...notes].join("\n");
}
