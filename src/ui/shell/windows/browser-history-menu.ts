/** One row of the Back or Forward list. */
export type HistoryMenuEntry = {
  readonly id: number;
  readonly url: string;
  readonly title: string;
  /** A `data:image/` URL, or "" for none. */
  readonly favicon: string;
};

/** The list shows at most this many pages, as Chrome does. */
export const HISTORY_MENU_LIMIT = 15;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The rows for one side of `history()` (external data), nearest first: the
 * title, else the address; only favicons that are images; at most
 * {@link HISTORY_MENU_LIMIT}.
 */
export function historyMenuEntries(history: unknown, direction: "back" | "forward"): HistoryMenuEntry[] {
  const side = (history as Record<string, unknown> | null)?.[direction];
  if (!Array.isArray(side)) return [];
  const rows: HistoryMenuEntry[] = [];
  for (const raw of side) {
    const e = raw as Record<string, unknown> | null;
    if (!e || typeof e.id !== "number") continue;
    const url = str(e.url);
    const favicon = str(e.favicon);
    rows.push({
      id: e.id,
      url,
      title: str(e.title).trim() || url,
      favicon: favicon.startsWith("data:image/") ? favicon : "",
    });
    if (rows.length === HISTORY_MENU_LIMIT) break;
  }
  return rows;
}
