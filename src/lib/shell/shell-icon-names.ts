/**
 * XDG icon names the shell asks the icon theme for, outside app entries:
 * the app grid button, folders, trash, drives and file types. Each key lists
 * candidate names, most specific first.
 */

export const APP_GRID_ICON_CANDIDATES: readonly string[] = [
  "view-app-grid",
  "show-applications",
  "applications-all",
  "view-app-grid-symbolic",
  "view-grid-symbolic",
  "view-grid",
];

export const SHELL_XDG_ICON_GROUPS: Record<string, readonly string[]> = {
  folder: ["folder", "inode-directory"],
  "folder-open": ["folder-open", "folder"],
  __user_trash__: ["user-trash", "trash-empty", "gnome-fs-trash-empty"],
  __user_trash_full__: [
    "user-trash-full",
    "trash-full",
    "gnome-fs-trash-full",
  ],
  __usb_drive__: [
    "drive-removable-media-usb",
    "drive-removable-media",
  ],
  __harddisk__: ["drive-harddisk-solidstate", "drive-harddisk"],
  __optical_drive__: ["media-optical", "drive-optical"],
  __sd_card__: ["media-flash-sd-mmc", "media-flash"],
  __fallback_app__: [
    "application-x-executable",
    "system-run",
    "applications-other",
    "package-x-generic",
    "org.gnome.Console",
  ],
  "image-x-generic": ["image-x-generic", "gnome-mime-image"],
  "video-x-generic": ["video-x-generic", "gnome-mime-video"],
  "audio-x-generic": ["audio-x-generic", "gnome-mime-audio"],
  "application-pdf": ["application-pdf", "x-office-document"],
  "text-x-script": ["text-x-script"],
  "package-x-generic": ["package-x-generic", "application-x-archive"],
  "text-x-generic": ["text-x-generic"],
  "application-x-zerosize": [
    "application-x-zerosize",
    "text-x-generic-empty",
    "text-x-generic",
  ],
  "text-x-markdown": ["text-x-markdown", "text-markdown", "text-x-generic"],
  "text-html": ["text-html"],
};

/**
 * Symbolic icons of the shell's own UI (`<SymbolicIcon>`): the standard name,
 * then the names to try when a theme lacks it. Written without `-symbolic`.
 * See docs/SYMBOLIC-ICONS.md for the Lucide glyph each one replaces.
 */
export const SYMBOLIC_ICONS = {
  "pan-down": [],
  "pan-end": [],
  "go-previous": [],
  "window-close": [],
  "window-minimize": [],
  "object-select": ["emblem-ok"],
  "system-search": ["edit-find"],
  "list-add": [],
  "view-app-grid": ["view-grid"],
  "media-playback-start": [],
  "media-playback-pause": [],
  "media-playback-stop": [],
  "media-skip-backward": [],
  "media-skip-forward": [],
  "preferences-system-notifications": ["notification"],
  "notifications-disabled": [],
  "network-wireless-signal-excellent": ["network-wireless"],
  "network-wireless-disabled": ["network-wireless-offline"],
  "bluetooth-active": ["bluetooth"],
  "bluetooth-disabled": [],
  "audio-volume-high": [],
  "audio-volume-muted": [],
  "audio-speakers": [],
  "audio-x-generic": [],
  "battery-good": ["battery"],
  "battery-good-charging": ["battery-full-charging"],
  "battery-caution": ["battery-low"],
  "display-brightness": [],
  "weather-clear-night": ["dark-mode"],
  "night-light": ["weather-clear-night"],
  "power-profile-power-saver": [],
  "camera-photo": [],
  "camera-video": [],
  "network-wireless-encrypted": ["channel-secure", "system-lock-screen"],
  "dialog-warning": [],
  "mail-send": ["document-send"],
  "emblem-system": ["preferences-system"],
  "input-keyboard": [],
  "web-browser": ["internet-web-browser"],
  folder: [],
  "utilities-terminal": [],
  "folder-download": [],
  starred: [],
  "non-starred": [],
  "application-x-addon": [],
  "application-x-executable": [],
  "preferences-desktop-appearance": ["applications-graphics"],
  "preferences-desktop-font": ["font-x-generic"],
  "preferences-system": ["emblem-system"],
  "video-display": [],
  "security-high": [],
  "image-x-generic": [],
  "applications-utilities": ["applications-engineering"],
} as const satisfies Record<string, readonly string[]>;

export type SymbolicIconName = keyof typeof SYMBOLIC_ICONS;
