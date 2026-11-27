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

/** Local "YYYY-MM-DD HH:mm" stamp used in capture file names ("/" is not allowed in file names). */
export function captureStamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** "2 min. 23s" / "45s" / "1 h 02 min. 03s". */
export function formatCaptureDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min. ${String(sec).padStart(2, "0")}s`;
  if (m > 0) return `${m} min. ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** `"<base>.<ext>"`, or `"<base> (2).<ext>"`… when the name is taken. */
export function uniqueCaptureName(existingNames: Iterable<string>, base: string, ext: string): string {
  const existing = new Set(existingNames);
  let name = `${base}.${ext}`;
  for (let n = 1; existing.has(name); n += 1) name = `${base} (${n}).${ext}`;
  return name;
}

/** "Screenshot 320x200 2026-11-23 15:34" */
export function screenshotBaseName(width: number, height: number, date = new Date()): string {
  return `Screenshot ${width}x${height} ${captureStamp(date)}`;
}

/** "Video recording - 2 min. 23s - 2026-11-23 15:34" */
export function videoBaseName(durationMs: number, date = new Date()): string {
  return `Video recording - ${formatCaptureDuration(durationMs)} - ${captureStamp(date)}`;
}

/** "Audio recording - 45s - 2026-11-23 15:34" */
export function audioBaseName(durationMs: number, date = new Date()): string {
  return `Audio recording - ${formatCaptureDuration(durationMs)} - ${captureStamp(date)}`;
}
