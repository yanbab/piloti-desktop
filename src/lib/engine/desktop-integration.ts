/** GNOME settings, autostart and app modules as the contexts ask for them (`engine-native/`). */
export {
  readGnomeBackgroundBlob,
  syncGtkIconTheme,
  DEFAULT_HIDDEN_GNOME_PANELS,
  DEFAULT_GNOME_PANELS,
  discoverGnomeControlCenterPanels,
  probeGnomeCapabilities,
  syncGnomePanelOverrides,
  runXdgAutostartOnce,
  ensurePolkitAgent,
  openAppModule,
  tellModulesMoved,
  openGnomeControlCenter,
} from "@/lib/engine-native";
export type {
  GtkFontAntialiasing,
  GtkFontHinting,
  GtkFontRgbaOrder,
  GnomeControlCenterPanelInfo,
  GnomeSystemCapabilities,
  GnomeSettingsPanel,
} from "@/lib/engine-native";
