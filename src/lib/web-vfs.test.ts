import { beforeEach, describe, expect, it } from "bun:test";
import {
  createVfsFolder,
  createVfsTextFile,
  emptyVfsTrash,
  getVfsEntry,
  listVfsDir,
  renameVfsEntry,
  trashVfsEntry,
  WEB_VFS_HOME,
  WEB_VFS_STORAGE_KEY,
  WEB_VFS_TRASH,
  writeVfsTextFile,
} from "./web-vfs";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

describe("web-vfs", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    localStorage.removeItem(WEB_VFS_STORAGE_KEY);
  });

  it("seeds XDG folders and starter Desktop files", () => {
    const desktopItems = listVfsDir(`${WEB_VFS_HOME}/Desktop`);
    expect(desktopItems.some((e) => e.name === "Welcome.html")).toBe(true);
    expect(desktopItems.some((e) => e.name === "Projects")).toBe(true);
  });

  it("creates unique folders and text files, renames recursively, and trashes", () => {
    const dir = createVfsFolder(`${WEB_VFS_HOME}/Desktop`);
    expect(dir.name).toBe("New Folder");

    const dir2 = createVfsFolder(`${WEB_VFS_HOME}/Desktop`);
    expect(dir2.name).toBe("New Folder 2");

    const file = createVfsTextFile(dir.path);
    expect(file.name).toBe("Untitled.txt");
    writeVfsTextFile(file.path, "hello world");
    expect(getVfsEntry(file.path)?.content).toBe("hello world");

    const renamed = renameVfsEntry(dir.path, "Work");
    expect(renamed?.path).toBe(`${WEB_VFS_HOME}/Desktop/Work`);
    expect(getVfsEntry(`${WEB_VFS_HOME}/Desktop/Work/Untitled.txt`)?.content).toBe(
      "hello world"
    );

    trashVfsEntry(`${WEB_VFS_HOME}/Desktop/Work`);
    expect(getVfsEntry(`${WEB_VFS_HOME}/Desktop/Work`)).toBeUndefined();
    expect(listVfsDir(WEB_VFS_TRASH).some((e) => e.name === "Work")).toBe(true);

    emptyVfsTrash();
    expect(listVfsDir(WEB_VFS_TRASH)).toHaveLength(0);
  });
});

