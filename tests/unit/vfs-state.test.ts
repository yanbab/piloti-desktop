import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  clearAllWebVfsBackingStorage,
  getVfsEntry,
  listWebVfsBackingStorageEntries,
  writeVfsTextFile,
} from "@/lib/engine-web/web-vfs";
import {
  parseDesktopSettingsRaw,
  serializeDesktopSettingsIni,
} from "@/lib/config/piloti-settings-ini";
import {
  getVfsCacheFilePath,
  migrateLegacyConfigDir,
  migrateLegacyStateFilesToJson,
  readVfsStateJson,
  readVfsStateString,
  readVfsStateText,
  registerVfsHostSync,
  removeVfsStateFile,
  subscribeVfsPath,
  VFS_STATE_PATHS,
  writeVfsStateJson,
  writeVfsStateText,
} from "@/lib/engine/vfs-state";

describe("vfs-state", () => {
  const store = new Map<string, string>();
  let prevStorage: Storage | undefined;

  beforeEach(() => {
    prevStorage = globalThis.localStorage;
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        get length() {
          return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => {
          store.clear();
        },
      },
    });
    clearAllWebVfsBackingStorage();
    registerVfsHostSync(null);
  });

  afterEach(() => {
    registerVfsHostSync(null);
    clearAllWebVfsBackingStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: prevStorage,
    });
  });

  it("stores JSON and text state in VFS files inside the single web-vfs backing key", () => {
    expect(
      writeVfsStateJson(VFS_STATE_PATHS.settings, { themeMode: "light" })
    ).toBe(true);

    const entry = getVfsEntry(VFS_STATE_PATHS.settings);
    expect(entry?.kind).toBe("file");
    expect(readVfsStateJson<{ themeMode: string }>(VFS_STATE_PATHS.settings)).toEqual({
      themeMode: "light",
    });

    // Only piloti.web.vfs.v1 should be stored in localStorage, not per-setting keys
    const rawKeys = listWebVfsBackingStorageEntries().map((e) => e.key);
    expect(rawKeys).toEqual(["piloti.web.vfs.v1"]);
  });

  it("migrates legacy localStorage keys once into VFS and deletes the legacy key", () => {
    store.set("piloti.locale.v1", "fr");
    const migrated = readVfsStateText(VFS_STATE_PATHS.locale, "piloti.locale.v1");
    expect(migrated).toBe("fr");
    expect(store.has("piloti.locale.v1")).toBe(false);
    expect(getVfsEntry(VFS_STATE_PATHS.locale)?.content).toBe("fr");
  });

  it("migrates legacy .txt state files to .json once", () => {
    writeVfsTextFile(VFS_STATE_PATHS.legacySettingsPaneTxt, "dock\n");
    writeVfsTextFile(VFS_STATE_PATHS.legacyDevtoolsModuleTxt, "logs\n");
    writeVfsTextFile(VFS_STATE_PATHS.legacyWelcomeShown, "1");
    // Existing .json wins over the legacy .txt
    writeVfsTextFile(VFS_STATE_PATHS.devtoolsModule, '"storage"\n');

    migrateLegacyStateFilesToJson();

    expect(readVfsStateString(VFS_STATE_PATHS.settingsPane)).toBe("dock");
    expect(getVfsEntry(VFS_STATE_PATHS.settingsPane)?.content).toBe('"dock"\n');
    expect(readVfsStateString(VFS_STATE_PATHS.devtoolsModule)).toBe("storage");
    expect(
      readVfsStateJson<{ shown: boolean }>(VFS_STATE_PATHS.welcomeShown),
    ).toEqual({ shown: true });
    expect(getVfsEntry(VFS_STATE_PATHS.legacySettingsPaneTxt)).toBeUndefined();
    expect(getVfsEntry(VFS_STATE_PATHS.legacyDevtoolsModuleTxt)).toBeUndefined();
    expect(getVfsEntry(VFS_STATE_PATHS.legacyWelcomeShown)).toBeUndefined();
  });

  it("moves ~/.config/Piloti leftovers into ~/.config/piloti without overwriting", () => {
    writeVfsTextFile("/home/user/.config/Piloti/notepad.ini", "[General]\na=1\n");
    writeVfsTextFile("/home/user/.config/Piloti/settings.ini", "OLD");
    writeVfsTextFile("/home/user/.config/piloti/settings.ini", "NEW");

    migrateLegacyConfigDir();

    expect(getVfsEntry("/home/user/.config/piloti/notepad.ini")?.content).toBe(
      "[General]\na=1\n",
    );
    expect(getVfsEntry("/home/user/.config/piloti/settings.ini")?.content).toBe("NEW");
    expect(getVfsEntry("/home/user/.config/Piloti")).toBeUndefined();
    expect(getVfsEntry("/home/user/.config/Piloti/notepad.ini")).toBeUndefined();
  });

  it("fires subscribeVfsPath only on real content changes to the subscribed file", () => {
    writeVfsStateText(VFS_STATE_PATHS.settingsPane, "appearance\n");

    const updates: Array<string | null> = [];
    const unsub = subscribeVfsPath(VFS_STATE_PATHS.settingsPane, (content) => {
      updates.push(content);
    });

    // Identical write should be skipped
    expect(writeVfsStateText(VFS_STATE_PATHS.settingsPane, "appearance\n")).toBe(false);
    expect(updates).toEqual([]);

    // Unrelated VFS file change should not trigger subscriber
    writeVfsTextFile("/home/user/Documents/other.txt", "hello");
    expect(updates).toEqual([]);

    // Live edit simulating Text Editor / Files update triggers subscriber
    writeVfsTextFile(VFS_STATE_PATHS.settingsPane, "dock\n");
    expect(updates).toEqual(["dock\n"]);

    removeVfsStateFile(VFS_STATE_PATHS.settingsPane);
    expect(updates).toEqual(["dock\n", null]);
    unsub();
  });

  it("forwards writes and removals to an optional host mirror and sanitizes cache paths", () => {
    const ops: string[] = [];
    registerVfsHostSync({
      writeText: (path, content) => ops.push(`write:${path}:${content.trim()}`),
      removeFile: (path) => ops.push(`rm:${path}`),
    });

    const cachePath = getVfsCacheFilePath("piloti.web-app-meta:v1");
    expect(cachePath).toBe("/home/user/.cache/piloti/piloti.web-app-meta-v1.json");

    writeVfsStateJson(cachePath, { ok: true }, false);
    removeVfsStateFile(cachePath);
    expect(ops).toEqual([
      `write:${cachePath}:{"ok":true}`,
      `rm:${cachePath}`,
    ]);
  });

  it("serializes and parses desktop settings in GSettings-style .ini format", () => {
    const iniText = serializeDesktopSettingsIni({
      interfaceTheme: "adwaita",
      themeMode: "light",
      accentColor: "purple",
      customAccentHex: "",
      highContrast: false,
      wallpaperId: "piloti-aurora",
      customWallpaperUrl: "",
      gnomeBackground: {
        pictureUri: "",
        pictureUriDark: "",
        pictureOptions: "zoom",
        colorShadingType: "solid",
        primaryColor: "#000000",
        secondaryColor: "#000000",
        pictureOpacity: 100,
      },
      dockSize: 48,
      dockPosition: "left",
      dockMagnification: true,
      dockMagnificationSize: 72,
      dockAutoHide: false,
      clock24Hour: false,
      clockShowSeconds: true,
      clockShowDay: false,
      clockShowDate: true,
      showBatteryPercentage: true,
      reduceMotion: false,
      moreTransparency: true,
      windowDecorationMode: "auto",
      windowButtonLayout: ":close",
      showWindowMenu: true,
      iconTheme: "Piloti",
      syncGnomeSettings: true,
      preferGnomeControlCenter: false,
      hiddenGnomePanels: ["gnome-display-panel.desktop"],
      fontSansFamily: "Cantarell",
      fontMonoFamily: "Adwaita Mono",
      fontScale: 1,
      fontSansStyle: "regular",
      cssFontSmoothing: "antialiased",
      cssTextRendering: "auto",
      cssFontOpticalSizing: "auto",
      cssFontKerning: "auto",
      cssFontSynthesis: "auto",
      cssLetterSpacingEm: 0,
      cssTextStrokePx: 0,
      gtkFontName: "Adwaita Sans 11",
      gtkDocumentFontName: "Sans 11",
      gtkMonospaceFontName: "Adwaita Mono 11",
      gtkTextScalingFactor: 1,
      gtkFontAntialiasing: "grayscale",
      gtkFontHinting: "slight",
      gtkFontRgbaOrder: "rgb",
      volume: 80,
      muted: false,
      brightness: 95,
      nightLight: false,
      wifiEnabled: true,
      connectedWifi: "Test",
      bluetoothEnabled: true,
      doNotDisturb: false,
      notificationsEnabled: true,
      notificationBannersEnabled: true,
      notificationShowOnLockScreen: true,
      notificationShowPreviews: true,
      notificationAllowCriticalInDnd: true,
      notificationBannerTimeoutMs: 5000,
      notificationHistoryLimit: 50,
      powerMode: "balanced",
      activeWorkspace: 1,
      workspaceCount: 2,
      restoreWindowsOnLogin: true,
      desktopIconsEnabled: true,
      desktopIconAlign: "left",
      fileActivationMode: "double",
      showFileExtensionBadges: true,
      demoExtensionEnabled: true,
      enabledPluginIds: [],
      computerModel: "mac",
      desktopIconPositions: {},
      pinnedAppIds: ["nautilus", "terminal"],
      installedWebApps: [],
      savedWindowBounds: {},
    });

    expect(iniText).toContain("[org.piloti.desktop.interface]");
    expect(iniText).toContain("interface-theme=adwaita");
    expect(iniText).toContain("[org.piloti.desktop.dock]");
    expect(iniText).toContain("pinned-apps=nautilus;terminal");

    const reparsed = parseDesktopSettingsRaw(iniText);
    expect(reparsed?.interfaceTheme).toBe("adwaita");
    expect(reparsed?.dockPosition).toBe("left");
    expect(reparsed?.pinnedAppIds).toEqual(["nautilus", "terminal"]);
  });
});

