import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { nativeEngine, setEngine, webEngine } from "@/lib/engine/engine";
import {
  copyFsEntry,
  createFsFolder,
  createFsTextFile,
  listFsDir,
  moveFsEntry,
  readFsTextFile,
  renameFsEntry,
  trashFsEntry,
} from "@/lib/engine/fs-bridge";
import {
  clearFileUndoHistory,
  moveWithUndo,
  redoFileOperation,
  renameWithUndo,
  trashWithUndo,
  undoFileOperation,
} from "@/lib/engine/fs-undo";
import type { Piloti } from "@/lib/engine/piloti";
import { createNativeVfs } from "@/lib/engine-native/vfs";
import { createFakeDomicile } from "../helpers/fake-domicile";

const HOME = "/home/user";
const D = `${HOME}/ops`;

/** The shell's file operations on Linux, over a fake disk. */
let piloti: Piloti;
beforeEach(async () => {
  setEngine(nativeEngine);
  const { domicile } = createFakeDomicile();
  piloti = { ...domicile, vfs: createNativeVfs(domicile as never) } as unknown as Piloti;
  await piloti.vfs.createDir(D);
  await piloti.vfs.createDir(`${D}/sub`);
  clearFileUndoHistory();
});
afterEach(() => setEngine(webEngine));

const names = async (dir: string) => ((await piloti.vfs.list(dir)) ?? []).map((e) => e.name).sort();
const read = (path: string) => piloti.vfs.readText(path);

describe("file operations on a real disk", () => {
  // The disk, not what the shell happens to have listed, decides what is taken.
  test("new files and folders never take a name already on disk", async () => {
    await piloti.vfs.write(`${D}/Untitled.txt`, "precious");
    await piloti.vfs.createDir(`${D}/New Folder`);
    expect((await createFsTextFile(piloti, D)).name).toBe("Untitled 2.txt");
    expect((await createFsFolder(piloti, D)).name).toBe("New Folder 2");
    expect(await read(`${D}/Untitled.txt`)).toBe("precious");
  });

  test("move, copy and rename keep what is already there", async () => {
    await piloti.vfs.write(`${D}/a.txt`, "A");
    await piloti.vfs.write(`${D}/sub/a.txt`, "other");
    await piloti.vfs.write(`${D}/b.txt`, "B");
    expect(await renameFsEntry(piloti, `${D}/a.txt`, "b.txt")).toBeNull();
    expect(await copyFsEntry(piloti, `${D}/a.txt`, `${D}/sub`)).toBe(`${D}/sub/a 2.txt`);
    expect((await moveFsEntry(piloti, `${D}/a.txt`, `${D}/sub`))?.path).toBe(`${D}/sub/a 3.txt`);
    expect(await read(`${D}/sub/a.txt`)).toBe("other");
    expect(await read(`${D}/b.txt`)).toBe("B");
    expect(await moveFsEntry(piloti, `${D}/sub`, `${D}/sub`)).toBeNull();
    expect((await listFsDir(piloti, D)).map((e) => e.name).sort()).toEqual(["b.txt", "sub"]);
    expect(await readFsTextFile(piloti, `${D}/none`)).toBe("");
  });

  test("move and rename undo and redo", async () => {
    await piloti.vfs.write(`${D}/a.txt`, "A");
    await moveWithUndo({ piloti }, [`${D}/a.txt`], `${D}/sub`);
    await renameWithUndo({ piloti }, `${D}/sub/a.txt`, "z.txt");
    await undoFileOperation();
    await undoFileOperation();
    expect(await names(D)).toEqual(["a.txt", "sub"]);
    await redoFileOperation();
    await redoFileOperation();
    expect(await names(`${D}/sub`)).toEqual(["z.txt"]);
  });

  test("Move to Trash undoes to the same place, even with namesakes in the Trash", async () => {
    await piloti.vfs.write(`${D}/a.txt`, "older");
    await trashFsEntry(piloti, `${D}/a.txt`);
    await piloti.vfs.write(`${D}/a.txt`, "newer");
    await trashWithUndo({ piloti }, [`${D}/a.txt`]);
    expect(await names(D)).toEqual(["sub"]);
    await undoFileOperation();
    expect(await read(`${D}/a.txt`)).toBe("newer");
    await redoFileOperation();
    expect(await names(D)).toEqual(["sub"]);
  });

  test("trashing from the Trash deletes for good", async () => {
    await piloti.vfs.write(`${D}/a.txt`, "x");
    const trashed = await trashFsEntry(piloti, `${D}/a.txt`);
    expect(trashed).toBe(`${HOME}/.local/share/Trash/files/a.txt`);
    await trashFsEntry(piloti, trashed!);
    expect(await names(`${HOME}/.local/share/Trash/files`)).toEqual([]);
    expect(await names(`${HOME}/.local/share/Trash/info`)).toEqual([]);
  });
});
