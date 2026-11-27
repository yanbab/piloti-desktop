/** What Piloti shows and sets for a Flatpak app (`engine-native/flatpak.ts` reads it). */
export interface FlatpakPermissionsState {
  network: boolean;
  homeFiles: boolean;
  hostFiles: boolean;
  wayland: boolean;
  audio: boolean;
  devices: boolean;
}

export const DEFAULT_FLATPAK_PERMISSIONS: FlatpakPermissionsState = {
  network: true,
  homeFiles: false,
  hostFiles: false,
  wayland: true,
  audio: true,
  devices: false,
};
