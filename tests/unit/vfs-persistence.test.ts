import { afterAll, describe, expect, test } from "bun:test";
import { browserPersistence } from "@/lib/engine-web/vfs-persistence-browser";
import { memoryPersistence } from "@/lib/ports/vfs-persistence";
import {
  getVfsEntry,
  setVfsPersistence,
  writeVfsTextFile,
  WEB_VFS_STORAGE_KEY,
} from "@/lib/engine-web/web-vfs";
import { VFS_HOME } from "@/lib/engine/vfs-home";

describe("VFS persistence port", () => {
  afterAll(() => setVfsPersistence(browserPersistence()));

  test("an injected store receives the VFS and isolates runs", () => {
    const first = memoryPersistence();
    setVfsPersistence(first);
    writeVfsTextFile(`${VFS_HOME}/Documents/port.txt`, "via port");
    expect(getVfsEntry(`${VFS_HOME}/Documents/port.txt`)?.content).toBe("via port");
    expect(first.kv?.getItem(WEB_VFS_STORAGE_KEY)).not.toBeNull();

    // A fresh store starts from the seeded defaults, with no trace of the first run.
    setVfsPersistence(memoryPersistence());
    expect(getVfsEntry(`${VFS_HOME}/Documents/port.txt`)).toBeUndefined();
  });
});
