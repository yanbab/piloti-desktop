import { _ } from "@/lib/core/i18n";

/** Notification action key prefix used to open a captured file. */
export const OPEN_ACTION_PREFIX = "open:";

/** Returns the first free `"<prefix> N.<ext>"` name not present in `existingNames`. */
export function nextCaptureFilename(
  existingNames: Iterable<string>,
  prefix: string,
  ext: string,
): string {
  const existing = new Set(existingNames);
  let n = 1;
  while (existing.has(`${prefix} ${n}.${ext}`)) n += 1;
  return `${prefix} ${n}.${ext}`;
}

/** Builds the "Open" notification action for a captured file path. */
export function captureOpenAction(path: string): { key: string; label: string } {
  return { key: `${OPEN_ACTION_PREFIX}${path}`, label: _("Open") };
}

/** Extracts the file path from an `open:<path>` action key, or null for other actions. */
export function parseOpenAction(action: string): string | null {
  if (!action.startsWith(OPEN_ACTION_PREFIX)) return null;
  const path = action.slice(OPEN_ACTION_PREFIX.length).trim();
  return path || null;
}
