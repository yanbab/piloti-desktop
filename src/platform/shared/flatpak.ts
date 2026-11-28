/** Flatpak and package updates as UI code asks for them (`engine-native/flatpak.ts`). */
export {
  getFlatpakPermissions,
  listInstalledFlatpaks,
  setFlatpakPermissionOverride,
  ensureFlathubRemote,
  getPopularFlathubApps,
  loadPopularFlathubHits,
  installFlatpakApp,
  listAptUpdates,
  listFlatpakUpdates,
  probeFlatpakCapabilities,
  runAptUpdateAndFlatpakRefresh,
  runAptUpgrade,
  installDebPackage,
  installFlatpakFile,
  searchFlatpaks,
  uninstallFlatpakApp,
  updateAllFlatpaks,
  updateFlatpakApp,
} from "@/platform/native/flatpak";
export type {
  AptUpdatePackage,
  FlatpakAppEntry,
  FlatpakCapabilities,
  FlatpakUpdateEntry,
} from "@/platform/native/flatpak";
