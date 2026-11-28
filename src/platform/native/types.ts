import type {
  GtkFontAntialiasing,
  GtkFontHinting,
  GtkFontRgbaOrder,
} from "@/core/config/desktop-settings";

export type { GtkFontAntialiasing, GtkFontHinting, GtkFontRgbaOrder };

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


export interface GnomeSystemCapabilities {
  gsettings: boolean;
  gnomeControlCenter: boolean;
  pipewire: boolean;
  networkManager: boolean;
  powerProfiles: boolean;
  upower: boolean;
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

export type {
  AudioSinkInfo,
  BatteryInfo,
  BluetoothDeviceInfo,
  MprisMediaInfo,
} from "@/core/ports/hardware";
