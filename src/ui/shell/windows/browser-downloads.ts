/**
 * Web Browser downloads on the desktop: the Dock shows their progress on the
 * Web Browser and on the docked folder they land in, and a finished download
 * marks that folder and sends a notification. Pages save without asking, to
 * the download folder, under a name that is free.
 */
import { DownloadState, type Download } from "@domicile-desktop/sdk/desktop/downloads";
import type { Piloti } from "@/core/ports/piloti";
import { setXdgAppBadgeCount, setXdgAppProgress, setXdgAppUrgent } from "@/core/xdg/xdg-badge-count";

export function downloadFileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1) || path;
}

export function downloadFolder(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "/";
}

/** "report.pdf", then "report (1).pdf", "report (2).pdf"… */
export function numberedFileName(name: string, n: number): string {
  if (n <= 0) return name;
  const dot = name.lastIndexOf(".");
  // A leading dot is a hidden file, not an extension; keep ".tar.gz" whole.
  const tar = /\.tar\.[a-z0-9]+$/i.exec(name);
  const at = tar ? tar.index : dot > 0 ? dot : name.length;
  return `${name.slice(0, at)} (${n})${name.slice(at)}`;
}

/** A name no file in `folder` has yet (and no download in progress claims). */
export async function freeDownloadPath(
  folder: string,
  suggested: string,
  exists: (path: string) => Promise<boolean>,
  claimed: ReadonlySet<string> = new Set()
): Promise<string> {
  const base = (suggested.replace(/[/\0]/g, "_").trim() || "download").slice(0, 200);
  const dir = folder.replace(/\/+$/, "");
  for (let n = 0; n < 1000; n++) {
    const path = `${dir}/${numberedFileName(base, n)}`;
    if (!claimed.has(path) && !(await exists(path))) return path;
  }
  return `${dir}/${Date.now()}-${base}`;
}

/** Overall progress of the running downloads: 0..1, null when a size is unknown. */
export function downloadsProgress(list: readonly Download[]): number | null | undefined {
  const running = list.filter((d) => d.state === DownloadState.InProgress);
  if (running.length === 0) return undefined;
  if (running.some((d) => d.totalBytes <= 0)) return null;
  const total = running.reduce((sum, d) => sum + d.totalBytes, 0);
  const received = running.reduce((sum, d) => sum + d.receivedBytes, 0);
  return total > 0 ? received / total : null;
}

export interface DownloadsBridgeOptions {
  /** A download finished (or failed). */
  onFinished?: (download: Download) => void;
}

let bridgeStarted = false;

/**
 * Follows `piloti.downloads` for the whole session, once, whatever window
 * started it: closing the browser window does not stop a download.
 */
export function startDownloadsBridge(piloti: Piloti, options: DownloadsBridgeOptions = {}): void {
  if (bridgeStarted) return;
  bridgeStarted = true;
  const states = new Map<string, DownloadState>();
  let folders = new Set<string>();
  let frame: ReturnType<typeof setTimeout> | null = null;
  let first = true;
  const sync = () => {
    frame = null;
    const list = piloti.downloads.list ?? [];
    const running = list.filter((d) => d.state === DownloadState.InProgress);
    setXdgAppProgress("browser", downloadsProgress(list));
    setXdgAppBadgeCount("browser", running.length);

    const nextFolders = new Set<string>();
    for (const folder of new Set(running.map((d) => downloadFolder(d.path)))) {
      nextFolders.add(folder);
      setXdgAppProgress(
        `folder:${folder}`,
        downloadsProgress(running.filter((d) => downloadFolder(d.path) === folder))
      );
    }
    for (const folder of folders) {
      if (!nextFolders.has(folder)) setXdgAppProgress(`folder:${folder}`, undefined);
    }
    folders = nextFolders;

    for (const d of list) {
      const before = states.get(d.id);
      states.set(d.id, d.state);
      // Unseen and already over: it finished between two looks (not at start).
      const wasRunning = before === DownloadState.InProgress || (before === undefined && !first);
      if (wasRunning && d.state !== DownloadState.InProgress) {
        if (d.state === DownloadState.Complete) setXdgAppUrgent(`folder:${downloadFolder(d.path)}`, true);
        options.onFinished?.(d);
      }
    }
    for (const id of states.keys()) {
      if (!list.some((d) => d.id === id)) states.delete(id);
    }
    first = false;
  };
  // Progress events come many times a second: the Dock needs a few.
  piloti.downloads.on("change", () => {
    frame ??= setTimeout(sync, 250);
  });
  sync();
}

/** "740 KB", "12.4 MB". */
export function formatDownloadSize(bytes: number): string {
  if (bytes < 1000) return `${Math.max(0, Math.round(bytes))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
