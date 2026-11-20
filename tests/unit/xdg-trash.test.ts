import { describe, expect, test } from "bun:test";
import {
  inspectXdgTrash,
  parseTrashInfo,
  resolveXdgTrashPaths,
} from "@/lib/xdg-trash";

describe("xdg-trash", () => {
  test("resolves default and overridden XDG Trash paths", () => {
    expect(resolveXdgTrashPaths("/home/alice", {})).toEqual({
      trashDir: "/home/alice/.local/share/Trash",
      filesDir: "/home/alice/.local/share/Trash/files",
      infoDir: "/home/alice/.local/share/Trash/info",
    });

    expect(
      resolveXdgTrashPaths("/home/alice", { XDG_DATA_HOME: "/custom/data" })
    ).toEqual({
      trashDir: "/custom/data/Trash",
      filesDir: "/custom/data/Trash/files",
      infoDir: "/custom/data/Trash/info",
    });
  });

  test("parses .trashinfo metadata per FreeDesktop spec", () => {
    const parsed = parseTrashInfo(
      `[Trash Info]\nPath=/home/alice/My%20File.txt\nDeletionDate=2026-11-13T12:00:00\n`
    );
    expect(parsed).toEqual({
      originalPath: "/home/alice/My File.txt",
      deletionDate: "2026-11-13T12:00:00",
    });
  });

  test("inspects empty vs non-empty Trash directory", async () => {
    const emptyFiles = {
      readDir: async () => ({
        match: <U>(m: {
          Ok: (entries: { name: string; fileType: number }[]) => U;
          Err: () => U;
        }) => m.Ok([{ name: ".", fileType: 1 }, { name: "..", fileType: 1 }]),
      }),
    };
    expect(await inspectXdgTrash(emptyFiles)).toEqual({
      empty: true,
      itemCount: 0,
    });

    const fullFiles = {
      readDir: async () => ({
        match: <U>(m: {
          Ok: (entries: { name: string; fileType: number }[]) => U;
          Err: () => U;
        }) =>
          m.Ok([
            { name: "report.pdf", fileType: 0 },
            { name: "notes.txt", fileType: 0 },
          ]),
      }),
    };
    expect(await inspectXdgTrash(fullFiles)).toEqual({
      empty: false,
      itemCount: 2,
    });
  });
});

