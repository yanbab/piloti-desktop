import { beforeEach, describe, expect, test } from "bun:test";
import {
  executeTextPipeline,
  parseCommandPipeline,
} from "@/lib/shell/terminal-pipeline";
import { getVfsEntry, WEB_VFS_HOME, WEB_VFS_STORAGE_KEY } from "@/lib/engine-web/web-vfs";

describe("terminal-pipeline pipes, redirects, and grep", () => {
  beforeEach(() => {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem(WEB_VFS_STORAGE_KEY);
    }
  });

  test("parses pipes and overwrite/append redirects", () => {
    const p1 = parseCommandPipeline('echo "hello world" | grep world > out.txt');
    expect(p1.stages).toEqual([["echo", "hello world"], ["grep", "world"]]);
    expect(p1.redirect).toEqual({ mode: "overwrite", target: "out.txt" });

    const p2 = parseCommandPipeline("cat a.txt | grep -i foo >> log.txt");
    expect(p2.stages).toEqual([["cat", "a.txt"], ["grep", "-i", "foo"]]);
    expect(p2.redirect).toEqual({ mode: "append", target: "log.txt" });
  });

  test("executes pipes with grep and redirects output to VFS", () => {
    const p1 = parseCommandPipeline(
      "cat ~/Documents/Notes.txt | grep -i piloti > ~/filtered.txt",
    );
    const res1 = executeTextPipeline(p1, WEB_VFS_HOME, []);
    expect(res1.ok).toBe(true);
    expect(getVfsEntry(`${WEB_VFS_HOME}/filtered.txt`)?.content).toContain(
      "Piloti",
    );

    const p2 = parseCommandPipeline("echo appended line >> ~/filtered.txt");
    const res2 = executeTextPipeline(p2, WEB_VFS_HOME, []);
    expect(res2.ok).toBe(true);
    const content = getVfsEntry(`${WEB_VFS_HOME}/filtered.txt`)?.content ?? "";
    expect(content).toContain("Piloti");
    expect(content).toContain("appended line");
  });
});

