import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_CATALOG } from "@/core/data/catalog";
import {
  getEngine,
  nativeEngine,
  setEngine,
  webEngine,
} from "@/core/ports/engine";
import { webDemoUsb } from "@/platform/web/usb-drive";
import {
  isSimulatedUsbPath,
  SIMULATED_USB_PATH,
  toggleSimulatedUsb,
  unmountSimulatedUsb,
} from "@/core/ports/demo-usb";
import { getVfsEntry, listVfsDir } from "@/platform/web/web-vfs";

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
  const globals = globalThis as Record<string, unknown>;
  let prevWindow: unknown;
  let hasPrevWindow = false;

  beforeEach(() => {
    hasPrevWindow = "window" in globals;
    prevWindow = globals.window;
    const storage = createMemoryStorage();
    globals.window = {
      localStorage: storage,
      location: { hostname: "example.test" },
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    globals.Event =
      Event ?? class SimpleEvent { constructor(public type: string) {} };
  });

  afterEach(() => {
    if (hasPrevWindow) {
      globals.window = prevWindow;
    } else {
      delete globals.window;
    }
  });

  test("mounts and unmounts simulated USB drive cleanly in VFS", () => {
    expect(webDemoUsb.mounted()).toBe(false);
    expect(isSimulatedUsbPath(SIMULATED_USB_PATH)).toBe(true);
    expect(isSimulatedUsbPath(`${SIMULATED_USB_PATH}/Photos`)).toBe(true);
    expect(isSimulatedUsbPath("/home/user/Documents")).toBe(false);

    webDemoUsb.mount();
    expect(webDemoUsb.mounted()).toBe(true);
    expect(getVfsEntry(SIMULATED_USB_PATH)?.kind).toBe("directory");
    const rootItems = listVfsDir(SIMULATED_USB_PATH).map((e) => e.name);
    expect(rootItems).toContain("README.txt");
    expect(rootItems).toContain("Photos");

    toggleSimulatedUsb();
    expect(webDemoUsb.mounted()).toBe(false);
    expect(getVfsEntry(SIMULATED_USB_PATH)).toBeUndefined();

    unmountSimulatedUsb();
    expect(webDemoUsb.mounted()).toBe(false);
  });

  test("an entry point picks the engine; capabilities say what it can do", () => {
    setEngine(webEngine);
    expect(getEngine().capabilities.realFilesystem).toBe(false);
    setEngine(nativeEngine);
    expect(getEngine().capabilities.systemServices).toBe(true);
    setEngine(webEngine); // the rest of the suite runs as the browser demo
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
    expect(themeIni).toContain("animated/apps");
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

