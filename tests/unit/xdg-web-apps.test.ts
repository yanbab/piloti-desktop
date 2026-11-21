import { beforeEach, describe, expect, test } from "bun:test";
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type { InstalledWebApp } from "@/data/web-apps";
import { getVfsEntry, WEB_VFS_STORAGE_KEY } from "@/lib/web-vfs";
import {
  installWebAppDesktopEntry,
  loadWebAppsFromDesktopEntries,
  parseWebAppDesktopEntry,
  removeWebAppDesktopEntry,
  serializeWebAppDesktopEntry,
  WEB_APPS_XDG_DIR,
  webAppDesktopFileName,
} from "@/lib/xdg/xdg-web-apps";

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

const memStorage = createMemoryStorage();
if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: memStorage,
    configurable: true,
  });
}

const SAMPLE_APP: InstalledWebApp = {
  id: "excalidraw",
  title: "Excalidraw",
  url: "https://excalidraw.com/",
  category: "Graphics",
  iconUrl: "https://excalidraw.com/favicon.ico",
  keywords: "whiteboard diagram",
};

const DUMMY_DOMICILE = {} as Domicile;

describe("xdg-web-apps FreeDesktop .desktop persistence", () => {
  beforeEach(() => {
    globalThis.localStorage.removeItem(WEB_VFS_STORAGE_KEY);
  });

  test("serializes and parses a FreeDesktop .desktop web app entry", () => {
    const ini = serializeWebAppDesktopEntry(SAMPLE_APP);
    expect(ini).toContain("[Desktop Entry]");
    expect(ini).toContain("Type=Application");
    expect(ini).toContain("Name=Excalidraw");
    expect(ini).toContain("Exec=piloti-webapp https://excalidraw.com/");
    expect(ini).toContain("X-Piloti-WebApp-URL=https://excalidraw.com/");

    const parsed = parseWebAppDesktopEntry(
      ini,
      `${WEB_APPS_XDG_DIR}/${webAppDesktopFileName(SAMPLE_APP)}`,
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe("excalidraw");
    expect(parsed?.title).toBe("Excalidraw");
    expect(parsed?.url).toBe("https://excalidraw.com/");
    expect(parsed?.category).toBe("Graphics");
  });

  test("installs, loads, and removes web apps in ~/.local/share/applications on web VFS", async () => {
    await installWebAppDesktopEntry(DUMMY_DOMICILE, true, SAMPLE_APP);

    const filePath = `${WEB_APPS_XDG_DIR}/${webAppDesktopFileName(SAMPLE_APP)}`;
    const vfsEntry = getVfsEntry(filePath);
    expect(vfsEntry?.kind).toBe("file");
    expect(vfsEntry?.content).toContain("X-Piloti-WebApp-Id=excalidraw");

    const loaded = await loadWebAppsFromDesktopEntries(DUMMY_DOMICILE, true);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("excalidraw");
    expect(loaded[0]?.title).toBe("Excalidraw");

    await removeWebAppDesktopEntry(DUMMY_DOMICILE, true, SAMPLE_APP);
    expect(getVfsEntry(filePath)).toBeUndefined();
    const afterRemove = await loadWebAppsFromDesktopEntries(
      DUMMY_DOMICILE,
      true,
    );
    expect(afterRemove).toHaveLength(0);
  });
});
