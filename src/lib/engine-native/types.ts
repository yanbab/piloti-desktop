import type { AccentColorId } from "@/data/catalog";

/**
 * Environment variables injected when launching GNOME / GTK / XDG applications
 * under Domicile so tools like `gnome-control-center` activate all panels and
 * portal/dconf integrations work cleanly.
 */
export const GNOME_SESSION_ENV: Record<string, string> = {
  XDG_CURRENT_DESKTOP: "GNOME",
  XDG_SESSION_DESKTOP: "gnome",
};

export const GNOME_ENV_PREFIX: readonly string[] = [
  "env",
  "XDG_CURRENT_DESKTOP=GNOME",
  "XDG_SESSION_DESKTOP=gnome",
];

export type GnomeSettingsPanel =
  | "wifi"
  | "network"
  | "bluetooth"
  | "display"
  | "sound"
  | "power"
  | "appearance"
  | "background"
  | "notifications"
  | "applications"
  | "privacy"
  | "keyboard"
  | "mouse"
  | "printers"
  | "system"
  | "users"
  | "datetime";

export type GtkFontAntialiasing = "none" | "grayscale" | "rgba";
export type GtkFontHinting = "none" | "slight" | "medium" | "full";
export type GtkFontRgbaOrder = "rgb" | "bgr" | "vrgb" | "vbgr";

export interface GnomeInterfaceSnapshot {
  themeMode?: "dark" | "light" | "system";
  accentColor?: AccentColorId;
  iconTheme?: string;
  clock24Hour?: boolean;
  clockShowSeconds?: boolean;
  fontName?: string;
  documentFontName?: string;
  monospaceFontName?: string;
  textScalingFactor?: number;
  fontAntialiasing?: GtkFontAntialiasing;
  fontHinting?: GtkFontHinting;
  fontRgbaOrder?: GtkFontRgbaOrder;
}

export interface GnomeWmPreferencesSnapshot {
  buttonLayout?: string;
}

export interface GnomeSystemCapabilities {
  gsettings: boolean;
  gnomeControlCenter: boolean;
  pipewire: boolean;
  networkManager: boolean;
  powerProfiles: boolean;
  upower: boolean;
}

export interface AudioSinkInfo {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface BatteryInfo {
  present: boolean;
  percentage: number;
  charging: boolean;
}

export interface GnomeControlCenterPanelInfo {
  /** Desktop filename, e.g. `gnome-wifi-panel.desktop`. */
  desktopId: string;
  /** Panel CLI identifier, e.g. `wifi`. */
  panelId: string;
  /** Localized display name, e.g. `Wi-Fi`. */
  name: string;
  /** Optional subtitle / description. */
  comment?: string;
  /** Whether the panel relies on GNOME Mutter private D-Bus APIs. */
  mutterOnly?: boolean;
}

export interface GnomeNotificationSettings {
  doNotDisturb?: boolean;
  showInLockScreen?: boolean;
}

export interface MprisMediaInfo {
  status: "Playing" | "Paused" | "Stopped";
  title: string;
  artist: string;
  playerName?: string;
}


export interface BluetoothDeviceInfo {
  /** BlueZ object path; what requests address. */
  path: string;
  name: string;
  connected: boolean;
  /** 0 to 100, for a device that reports it. */
  battery?: number;
}
