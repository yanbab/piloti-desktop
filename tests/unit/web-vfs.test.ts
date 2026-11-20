import { beforeEach, describe, expect, it } from "bun:test";
import {
  copyVfsEntry,
  createVfsFolder,
  createVfsTextFile,
  duplicateVfsEntry,
  emptyVfsTrash,
  getVfsClipboard,
  getVfsEmblems,
  getVfsEntry,
  hasVfsEmblem,
  isVfsFavorite,
  listVfsDir,
  moveVfsEntry,
  renameVfsEntry,
  resolveVfsPath,
  restoreVfsEntry,
  setVfsClipboard,
  setVfsEmblem,
  toggleVfsEmblem,
  toggleVfsFavorite,
  trashVfsEntry,
  VFS_EMBLEMS_STORAGE_KEY,
  WEB_VFS_FAVORITES_STORAGE_KEY,
  WEB_VFS_HOME,
  WEB_VFS_STORAGE_KEY,
  WEB_VFS_TRASH,
  writeVfsTextFile,
} from "@/lib/web-vfs";

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
    localStorage.removeItem(VFS_EMBLEMS_STORAGE_KEY);
    localStorage.removeItem(WEB_VFS_FAVORITES_STORAGE_KEY);
    setVfsClipboard(null);
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

  it("resolves /, /home, .., and ~ for Terminal navigation", () => {
    expect(getVfsEntry("/")?.kind).toBe("directory");
    expect(getVfsEntry("/home")?.kind).toBe("directory");
    expect(listVfsDir("/").some((e) => e.name === "home")).toBe(true);
    expect(listVfsDir("/home").some((e) => e.name === "user")).toBe(true);
    expect(
      listVfsDir("/home/user", { includeHidden: true }).some(
        (e) => e.name === ".local"
      )
    ).toBe(true);
    expect(resolveVfsPath("/home/user/Desktop")).toBe("/home/user/Desktop");
    expect(resolveVfsPath("/home/user/Desktop", "~")).toBe("/home/user");
    expect(resolveVfsPath("/home/user", "Desktop")).toBe("/home/user/Desktop");
  });

  it("manages generalized emblems, favorites compatibility, and migrates across moves/trash/restore", () => {
    const file = createVfsTextFile(`${WEB_VFS_HOME}/Documents`, "Report.md", "v1");
    expect(getVfsEmblems(file.path)).toEqual([]);

    toggleVfsFavorite(file.path);
    expect(isVfsFavorite(file.path)).toBe(true);
    expect(hasVfsEmblem(file.path, "favorite")).toBe(true);

    toggleVfsEmblem(file.path, "important");
    setVfsEmblem(file.path, "work", true);
    expect(getVfsEmblems(file.path)).toEqual(["favorite", "important", "work"]);
    expect(getVfsEntry(file.path)?.metadata?.["metadata::emblems"]).toEqual([
      "emblem-favorite",
      "emblem-important",
      "emblem-work",
    ]);

    const renamed = renameVfsEntry(file.path, "AnnualReport.md");
    expect(renamed).not.toBeNull();
    expect(getVfsEmblems(file.path)).toEqual([]);
    expect(getVfsEmblems(renamed!.path)).toEqual(["favorite", "important", "work"]);

    const moved = moveVfsEntry(renamed!.path, `${WEB_VFS_HOME}/Desktop`);
    expect(moved).not.toBeNull();
    expect(getVfsEmblems(moved!.path)).toEqual(["favorite", "important", "work"]);

    trashVfsEntry(moved!.path);
    const trashedPath = `${WEB_VFS_TRASH}/${moved!.name}`;
    expect(getVfsEmblems(moved!.path)).toEqual([]);
    expect(getVfsEmblems(trashedPath)).toEqual(["favorite", "important", "work"]);

    const restored = restoreVfsEntry(trashedPath);
    expect(restored?.path).toBe(`${WEB_VFS_HOME}/Desktop/${moved!.name}`);
    expect(getVfsEmblems(restored!.path)).toEqual(["favorite", "important", "work"]);

    trashVfsEntry(restored!.path);
    emptyVfsTrash();
    expect(getVfsEmblems(`${WEB_VFS_TRASH}/${moved!.name}`)).toEqual([]);
  });

  it("duplicates files and folders recursively and manages shared clipboard", () => {
    const folder = createVfsFolder(`${WEB_VFS_HOME}/Desktop`, "Bundle");
    writeVfsTextFile(`${folder.path}/README`, "no-ext");

    const dup1 = duplicateVfsEntry(`${folder.path}/README`);
    expect(dup1?.name).toBe("README Copy");
    expect(dup1?.content).toBe("no-ext");

    const dup2 = duplicateVfsEntry(`${folder.path}/README`);
    expect(dup2?.name).toBe("README Copy 2");

    const dupFolder = duplicateVfsEntry(folder.path);
    expect(dupFolder?.name).toBe("Bundle Copy");
    expect(getVfsEntry(`${dupFolder!.path}/README`)?.content).toBe("no-ext");

    const copiedToDocs = copyVfsEntry(`${folder.path}/README`, `${WEB_VFS_HOME}/Documents`);
    expect(copiedToDocs?.name).toBe("README");

    expect(getVfsClipboard()).toBeNull();
    setVfsClipboard({ mode: "copy", paths: [folder.path, dup1!.path, folder.path] });
    expect(getVfsClipboard()).toEqual({
      mode: "copy",
      paths: [folder.path, dup1!.path],
    });
    setVfsClipboard(null);
    expect(getVfsClipboard()).toBeNull();
  });
});

