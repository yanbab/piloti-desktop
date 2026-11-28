import { beforeEach, describe, expect, it } from "bun:test";
import { parseGioMetadataInfo } from "@/platform/native/gio";
import { inferFileVisual } from "@/core/files/desktop-icons";
import {
  clearAllWebVfsBackingStorage,
  copyVfsEntry,
  createVfsFileFromTemplate,
  createVfsFolder,
  createVfsTextFile,
  duplicateVfsEntry,
  emptyVfsTrash,
  getVfsAccessCount,
  getVfsClipboard,
  getVfsContentType,
  getVfsEntry,
  getVfsImageThumbnailUrl,
  incrementVfsAccessCount,
  listVfsDir,
  listVfsTemplates,
  moveVfsEntry,
  renameVfsEntry,
  resolveVfsPath,
  restoreVfsEntry,
  setVfsClipboard,
  trashVfsEntry,
  VFS_EMBLEMS_STORAGE_KEY,
  WEB_VFS_FAVORITES_STORAGE_KEY,
  WEB_VFS_HOME,
  WEB_VFS_STORAGE_KEY,
  WEB_VFS_TRASH,
  writeVfsTextFile,
} from "@/platform/web/web-vfs";
import { getEmblems, hasEmblem, setEmblem, toggleEmblem } from "@/platform/shared/emblems";

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
    // Drop the in-memory cache/pending flush left by other test files in the same process.
    clearAllWebVfsBackingStorage();
    localStorage.removeItem(WEB_VFS_STORAGE_KEY);
    localStorage.removeItem(VFS_EMBLEMS_STORAGE_KEY);
    localStorage.removeItem(WEB_VFS_FAVORITES_STORAGE_KEY);
    setVfsClipboard(null);
  });

  it("seeds XDG folders and starter Desktop files", () => {
    const desktopItems = listVfsDir(`${WEB_VFS_HOME}/Desktop`);
    expect(desktopItems.map((e) => e.name)).toEqual(["Welcome.html"]);
  });

  it("creates unique folders and text files, renames recursively, and trashes", () => {
    const dir = createVfsFolder(`${WEB_VFS_HOME}/Desktop`);
    expect(dir.name).toBe("New Folder");

    const dir2 = createVfsFolder(`${WEB_VFS_HOME}/Desktop`);
    expect(dir2.name).toBe("New Folder (1)");

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
    // expect(
    //   listVfsDir("/home/user", { includeHidden: true }).some(
    //     (e) => e.name === ".local"
    //   )
    // ).toBe(true);
    expect(resolveVfsPath("/home/user/Desktop")).toBe("/home/user/Desktop");
    expect(resolveVfsPath("/home/user/Desktop", "~")).toBe("/home/user");
    expect(resolveVfsPath("/home/user", "Desktop")).toBe("/home/user/Desktop");
  });

  it("manages generalized emblems, favorites compatibility, and migrates across moves/trash/restore", () => {
    const file = createVfsTextFile(`${WEB_VFS_HOME}/Documents`, "Report.md", "v1");
    expect(getEmblems(file.path)).toEqual([]);

    toggleEmblem(file.path, "favorite");
    expect(hasEmblem(file.path, "favorite")).toBe(true);
    expect(hasEmblem(file.path, "favorite")).toBe(true);

    toggleEmblem(file.path, "important");
    setEmblem(file.path, "work", true);
    expect(getEmblems(file.path)).toEqual(["favorite", "important", "work"]);
    expect(getVfsEntry(file.path)?.metadata?.["metadata::emblems"]).toEqual([
      "emblem-favorite",
      "emblem-important",
      "emblem-work",
    ]);

    const renamed = renameVfsEntry(file.path, "AnnualReport.md");
    expect(renamed).not.toBeNull();
    expect(getEmblems(file.path)).toEqual([]);
    expect(getEmblems(renamed!.path)).toEqual(["favorite", "important", "work"]);

    const moved = moveVfsEntry(renamed!.path, `${WEB_VFS_HOME}/Desktop`);
    expect(moved).not.toBeNull();
    expect(getEmblems(moved!.path)).toEqual(["favorite", "important", "work"]);

    trashVfsEntry(moved!.path);
    const trashedPath = `${WEB_VFS_TRASH}/${moved!.name}`;
    expect(getEmblems(moved!.path)).toEqual([]);
    expect(getEmblems(trashedPath)).toEqual(["favorite", "important", "work"]);

    const restored = restoreVfsEntry(trashedPath);
    expect(restored?.path).toBe(`${WEB_VFS_HOME}/Desktop/${moved!.name}`);
    expect(getEmblems(restored!.path)).toEqual(["favorite", "important", "work"]);

    trashVfsEntry(restored!.path);
    emptyVfsTrash();
    expect(getEmblems(`${WEB_VFS_TRASH}/${moved!.name}`)).toEqual([]);
  });

  it("duplicates files and folders recursively and manages shared clipboard", () => {
    const folder = createVfsFolder(`${WEB_VFS_HOME}/Desktop`, "Bundle");
    writeVfsTextFile(`${folder.path}/README`, "no-ext");

    const dup1 = duplicateVfsEntry(`${folder.path}/README`);
    expect(dup1?.name).toBe("README Copy");
    expect(dup1?.content).toBe("no-ext");

    const dup2 = duplicateVfsEntry(`${folder.path}/README`);
    expect(dup2?.name).toBe("README Copy (1)");

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

  it("stores standard::content-type and metadata::thumbnail for webm audio/video", () => {
    const audio = writeVfsTextFile(
      `${WEB_VFS_HOME}/Desktop/Record.webm`,
      "data:audio/webm;codecs=opus;base64,GkXf",
      { metadata: { "standard::content-type": "audio/webm" } }
    );
    expect(audio.metadata?.["standard::content-type"]).toBe("audio/webm");
    expect(getVfsContentType(audio)).toBe("audio/webm");
    expect(inferFileVisual(audio.name, audio.kind, getVfsContentType(audio)).iconCandidates[0]).toBe(
      "audio-x-generic"
    );

    const video = writeVfsTextFile(
      `${WEB_VFS_HOME}/Desktop/Screencast.webm`,
      "data:video/webm;base64,GkXf",
      {
        metadata: {
          "standard::content-type": "video/webm",
          "metadata::thumbnail": "data:image/jpeg;base64,/9j/4AAQ",
        },
      }
    );
    expect(getVfsContentType(video)).toBe("video/webm");
    expect(getVfsImageThumbnailUrl(video.name, video.content, video.metadata)).toBe(
      "data:image/jpeg;base64,/9j/4AAQ"
    );
    expect(inferFileVisual(video.name, video.kind, getVfsContentType(video)).iconCandidates[0]).toBe(
      "video-x-generic"
    );
  });

  it("tracks VFS file accessCount across opens", () => {
    const notePath = `${WEB_VFS_HOME}/Documents/Notes.txt`;
    expect(getVfsAccessCount(notePath)).toBe(0);
    expect(incrementVfsAccessCount(notePath)).toBe(1);
    expect(incrementVfsAccessCount(notePath)).toBe(2);
    expect(getVfsEntry(notePath)?.accessCount).toBe(2);
    expect(incrementVfsAccessCount(`${WEB_VFS_HOME}/Missing.txt`)).toBe(0);
  });

  it("supports .hidden file filtering and XDG Templates file creation", () => {
    // /home/user/.hidden hides Templates by default unless includeHidden is true
    const homeVisible = listVfsDir(WEB_VFS_HOME).map((e) => e.name);
    expect(homeVisible).not.toContain("Templates");
    const homeAll = listVfsDir(WEB_VFS_HOME, { includeHidden: true }).map(
      (e) => e.name
    );
    expect(homeAll).toContain("Templates");

    const templates = listVfsTemplates();
    expect(templates.map((t) => t.name)).toContain("Markdown Document.md");
    const created = createVfsFileFromTemplate(
      `${WEB_VFS_HOME}/Documents`,
      "Markdown Document.md"
    );
    expect(created?.name).toBe("Markdown Document.md");
    expect(created?.content).toContain("# Untitled");
  });

  it("parses gio info metadata::* output for gvfsd-metadata persistence", () => {
    const sample = `attributes:
  metadata::piloti-cursor: 142
  metadata::piloti-scroll: 320
  metadata::emblems: [favorite]
`;
    expect(parseGioMetadataInfo(sample)).toEqual({
      "metadata::piloti-cursor": "142",
      "metadata::piloti-scroll": "320",
      "metadata::emblems": "[favorite]",
    });
  });

  it("keeps large file content out of the localStorage JSON but readable in memory", () => {
    const big = "data:video/webm;base64," + "A".repeat(300 * 1024);
    writeVfsTextFile(`${WEB_VFS_HOME}/Desktop/Big.webm`, big);
    expect(getVfsEntry(`${WEB_VFS_HOME}/Desktop/Big.webm`)?.content).toBe(big);
    const raw = localStorage.getItem(WEB_VFS_STORAGE_KEY) ?? "";
    expect(raw.length).toBeLessThan(big.length);
    expect(raw).toContain("externalContent");
  });

  it("keeps the VFS usable in memory when localStorage rejects writes", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      },
    });
    try {
      writeVfsTextFile(`${WEB_VFS_HOME}/Desktop/Quota.txt`, "still here");
      expect(getVfsEntry(`${WEB_VFS_HOME}/Desktop/Quota.txt`)?.content).toBe("still here");
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });
});

