import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_CATALOG } from "@/data/catalog";
import {
  getEngineOverride,
  hasNativeSystemHost,
  markNativeSystemHostAvailable,
  setEngineOverride,
} from "@/lib/engine-override";
import {
  isSimulatedUsbMounted,
  isSimulatedUsbPath,
  mountSimulatedUsb,
  SIMULATED_USB_PATH,
  toggleSimulatedUsb,
  unmountSimulatedUsb,
} from "@/lib/usb-drive";
import { getVfsEntry, listVfsDir } from "@/lib/web-vfs";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe("Simulated USB pen drive, Engine override & Folders rename", () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as Record<string, unknown>).window = {
      localStorage: storage,
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as Record<string, unknown>).Event =
      Event ?? class SimpleEvent { constructor(public type: string) {} };
  });

  test("mounts and unmounts simulated USB drive cleanly in VFS", () => {
    expect(isSimulatedUsbMounted()).toBe(false);
    expect(isSimulatedUsbPath(SIMULATED_USB_PATH)).toBe(true);
    expect(isSimulatedUsbPath(`${SIMULATED_USB_PATH}/Photos`)).toBe(true);
    expect(isSimulatedUsbPath("/home/user/Documents")).toBe(false);

    mountSimulatedUsb();
    expect(isSimulatedUsbMounted()).toBe(true);
    expect(getVfsEntry(SIMULATED_USB_PATH)?.kind).toBe("directory");
    const rootItems = listVfsDir(SIMULATED_USB_PATH).map((e) => e.name);
    expect(rootItems).toContain("README.txt");
    expect(rootItems).toContain("Photos");

    expect(toggleSimulatedUsb()).toBe(false);
    expect(isSimulatedUsbMounted()).toBe(false);
    expect(getVfsEntry(SIMULATED_USB_PATH)).toBeUndefined();

    unmountSimulatedUsb();
    expect(isSimulatedUsbMounted()).toBe(false);
  });

  test("stores runtime engine override and native host availability", () => {
    expect(getEngineOverride()).toBeNull();
    setEngineOverride("web");
    expect(getEngineOverride()).toBe("web");
    setEngineOverride("system");
    expect(getEngineOverride()).toBe("system");

    expect(hasNativeSystemHost()).toBe(false);
    markNativeSystemHostAvailable();
    expect(hasNativeSystemHost()).toBe(true);
  });

  test("renames Files catalog app to Folders and keeps Papirus inheritance", () => {
    const foldersApp = APP_CATALOG.find((app) => app.id === "nautilus");
    expect(foldersApp?.name).toBe("Folders");
    expect(foldersApp?.shortName).toBe("Folders");

    const pilotiThemePath = join(
      process.cwd(),
      "data/files/usr/share/icons/Piloti/index.theme"
    );
    const themeIni = readFileSync(pilotiThemePath, "utf-8");
    expect(themeIni).toContain("Inherits=Papirus,Adwaita,hicolor");
    expect(themeIni).not.toContain("animated/apps");
    expect(
      existsSync(
        join(
          process.cwd(),
          "data/files/usr/share/icons/Papirus/64x64/devices/drive-removable-media-usb.svg"
        )
      )
    ).toBe(true);
  });
});

