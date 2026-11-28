/**
 * Back and Forward in the web demo, where a page is an iframe of another
 * origin: the shell cannot read its address or its history, and a click on
 * one of its links never reaches the shell. What it can do is step the
 * document's joint session history (`history.back()`), which holds every
 * iframe's navigations in order. This log mirrors that list with the iframe
 * each entry belongs to, so a tab only steps through its own entries.
 *
 * Limits: a page's own `pushState` or `#anchor` steps add entries the shell
 * does not see; the log then lags one step behind until the next load.
 */

interface Entry {
  frame: string;
  /** null for a link followed inside the page: the address is not readable. */
  url: string | null;
}

let entries: Entry[] = [];
let index = -1;
const initialUrls = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  for (const l of listeners) l();
}

export function subscribeFrameHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function frameHistoryVersion(): number {
  return version;
}

/** The address a frame starts with (its first load adds no entry). */
export function frameStarted(frame: string, url: string): void {
  if (!initialUrls.has(frame)) initialUrls.set(frame, url);
}

/** A navigation of `frame` added an entry after the current one. */
export function framePushed(frame: string, url: string | null): void {
  entries = entries.slice(0, index + 1);
  entries.push({ frame, url });
  index = entries.length - 1;
  changed();
}

export function canFrameGoBack(frame: string): boolean {
  return index >= 0 && entries[index].frame === frame;
}

export function canFrameGoForward(frame: string): boolean {
  return entries[index + 1]?.frame === frame;
}

/** The address `frame` shows at the current entry, when known. */
function frameUrlAt(frame: string, at: number): string | null {
  for (let i = at; i >= 0; i--) if (entries[i].frame === frame) return entries[i].url;
  return initialUrls.get(frame) ?? null;
}

/** The address `frame` shows now; null after a link followed in the page. */
export function frameCurrentUrl(frame: string): string | null {
  return frameUrlAt(frame, index);
}

/**
 * Steps back (-1) or forward (1) in `frame`. Returns the address it lands on
 * (null when unknown), or undefined when the step is not the frame's.
 */
export function stepFrame(
  frame: string,
  direction: -1 | 1,
  history: Pick<History, "back" | "forward"> = window.history
): string | null | undefined {
  if (direction < 0 ? !canFrameGoBack(frame) : !canFrameGoForward(frame)) return undefined;
  index += direction;
  if (direction < 0) history.back();
  else history.forward();
  changed();
  return frameUrlAt(frame, index);
}

/** A removed iframe takes its entries out of the joint history. */
export function frameRemoved(frame: string): void {
  const before = entries.slice(0, index + 1).filter((e) => e.frame === frame).length;
  entries = entries.filter((e) => e.frame !== frame);
  index -= before;
  initialUrls.delete(frame);
  changed();
}

/** Tests only. */
export function resetFrameHistory(): void {
  entries = [];
  index = -1;
  initialUrls.clear();
  changed();
}
