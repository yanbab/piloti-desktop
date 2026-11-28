import { VFS_HOME } from "@/platform/shared/vfs-home";
/**
 * "Nice" human-readable file locations, Finder-style:
 *
 *   /home/user/Desktop/Screenshot.png  ->  Desktop ▸ Screenshot.png
 *   /etc/default                       ->  SSD ▸ etc ▸ default
 *   /media/user/PILOTI_USB/Doc.pdf     ->  USB ▸ Doc.pdf
 *
 * Pure (no DOM / engine access) so it can be unit tested and shared by
 * notifications, Folders' info pane and any other location label.
 */

export type NicePathDeviceKind = "home" | "trash" | "ssd" | "hdd" | "usb" | "optical" | "sd";

export interface NicePath {
  /** Device / root the path lives on. */
  device: NicePathDeviceKind;
  /** Short device label ("Home", "SSD", "USB", "CD-ROM", "SD Card", or volume name). */
  deviceLabel: string;
  /** Volume label for removable media (e.g. "PILOTI USB"), when known. */
  volumeLabel?: string;
  /** Path segments below the device root (no empty segments). */
  segments: readonly string[];
  /** Original absolute path. */
  path: string;
}

export const NICE_PATH_SEPARATOR = " ▸ ";

/** Shell icon-group key (see `SHELL_XDG_ICON_GROUPS` in AppsContext) for a device kind. */
export const NICE_PATH_DEVICE_ICON_KEY: Record<NicePathDeviceKind, string | null> = {
  home: null,
  trash: "__user_trash__",
  ssd: "__harddisk__",
  hdd: "__harddisk__",
  usb: "__usb_drive__",
  optical: "__optical_drive__",
  sd: "__sd_card__",
};

let systemDiskKind: "ssd" | "hdd" = "ssd";

/** Lets the native engine report a rotational system disk ("HDD"); defaults to "SSD". */
export function setSystemDiskKind(kind: "ssd" | "hdd"): void {
  systemDiskKind = kind;
}

const DEVICE_LABELS: Record<NicePathDeviceKind, string> = {
  home: "Home",
  trash: "Trash",
  ssd: "SSD",
  hdd: "HDD",
  usb: "USB",
  optical: "CD-ROM",
  sd: "SD Card",
};

/** Guesses the kind of removable media from its mount label. */
export function guessRemovableKind(label: string): "usb" | "optical" | "sd" {
  const l = label.toLowerCase();
  if (/(^|[^a-z])(cd|dvd|bd|cdrom|cd-rom|blu-?ray|iso9660|udf)([^a-z]|$)/.test(l) || /cdrom|dvdrom/.test(l)) {
    return "optical";
  }
  if (/(^|[^a-z])(sd|sdcard|sd-card|mmc|mmcblk\d*|microsd)([^a-z]|$)/.test(l) || /sdcard|mmcblk/.test(l)) {
    return "sd";
  }
  return "usb";
}

function splitSegments(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0 && s !== ".");
}

/** True when `text` looks like a single absolute (or `~`) file path. */
export function looksLikeAbsolutePath(text: string): boolean {
  const t = text.trim();
  if (!t || t.includes("\n")) return false;
  if (!(t.startsWith("/") || t.startsWith("~/"))) return false;
  if (t.startsWith("//")) return false;
  return splitSegments(t).length >= 1;
}

/**
 * Resolves an absolute path into a device + readable segments.
 * `homeDir` defaults to the VFS home (`/home/user`); any `/home/<name>` is also
 * treated as home so native (real-user) paths read nicely too.
 */
export function resolveNicePath(rawPath: string, homeDir = `${VFS_HOME}`): NicePath {
  let path = rawPath.trim();
  if (path.startsWith("file://")) {
    try {
      path = decodeURIComponent(new URL(path).pathname);
    } catch {
      path = path.slice("file://".length);
    }
  }
  if (path === "~" || path.startsWith("~/")) path = `${homeDir}${path.slice(1)}`;
  const segs = splitSegments(path);
  const home = splitSegments(homeDir);
  const make = (
    device: NicePathDeviceKind,
    segments: string[],
    volumeLabel?: string,
  ): NicePath => ({
    device,
    deviceLabel: volumeLabel && device !== "optical" && device !== "sd" && device !== "usb"
      ? volumeLabel
      : DEVICE_LABELS[device],
    volumeLabel,
    segments,
    path: rawPath,
  });

  // Home (exact VFS home, or any /home/<user>, or /root)
  let homeLen = 0;
  if (home.length > 0 && home.every((s, i) => segs[i] === s)) homeLen = home.length;
  else if (segs[0] === "home" && segs.length >= 2) homeLen = 2;
  else if (segs[0] === "root") homeLen = 1;
  if (homeLen > 0) {
    const rest = segs.slice(homeLen);
    if (rest[0] === ".local" && rest[1] === "share" && rest[2] === "Trash" && rest[3] === "files") {
      return make("trash", rest.slice(4));
    }
    return make("home", rest);
  }

  // Removable media: /media/<user>/<LABEL>/..., /run/media/<user>/<LABEL>/..., /media/<LABEL>/...
  if (segs[0] === "cdrom" || (segs[0] === "media" && segs[1] === "cdrom")) {
    const idx = segs[0] === "cdrom" ? 0 : 1;
    return make("optical", segs.slice(idx + 1), segs[idx]);
  }
  let mediaIdx = -1;
  if (segs[0] === "run" && segs[1] === "media" && segs.length >= 4) mediaIdx = 3;
  else if (segs[0] === "media" && segs.length >= 3) mediaIdx = 2;
  else if (segs[0] === "media" && segs.length === 2) mediaIdx = 1;
  if (mediaIdx >= 0) {
    const label = segs[mediaIdx] ?? "";
    return make(guessRemovableKind(label), segs.slice(mediaIdx + 1), label.replace(/_/g, " "));
  }

  // Extra internal/external disks mounted under /mnt
  if (segs[0] === "mnt" && segs.length >= 2) {
    const label = segs[1] ?? "";
    const kind = guessRemovableKind(label);
    if (kind !== "usb") return make(kind, segs.slice(2), label);
    return make("hdd", segs.slice(2), label.replace(/_/g, " "));
  }

  return make(systemDiskKind, segs);
}

/**
 * Plain-text nice path. `translate` localizes well-known labels and the
 * top-level XDG user dirs (e.g. pass `_` from `@/core/util/i18n`).
 */
export function formatNicePath(
  rawPath: string,
  options?: { homeDir?: string; translate?: (s: string) => string; includeHome?: boolean },
): string {
  const tr = options?.translate ?? ((s: string) => s);
  const nice = resolveNicePath(rawPath, options?.homeDir);
  const parts: string[] = [];
  if (nice.device !== "home" || options?.includeHome || nice.segments.length === 0) {
    parts.push(tr(nice.deviceLabel));
  }
  nice.segments.forEach((seg, i) => {
    parts.push(nice.device === "home" && i === 0 ? tr(seg) : seg);
  });
  return parts.join(NICE_PATH_SEPARATOR);
}
