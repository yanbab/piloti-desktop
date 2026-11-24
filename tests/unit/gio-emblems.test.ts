import { describe, expect, test } from "bun:test";
import { parseGioInfoEmblems, parseGioListEmblems } from "@/lib/engine-native/native-file-store";
import { createFileService } from "@/lib/core/file-service";
import type { FileStore } from "@/lib/ports/file-store";

describe("gio emblems", () => {
  test("parses `gio list -a` and `gio info` output", () => {
    expect(
      parseGioListEmblems(
        "a.txt\t0\t(regular)\tmetadata::emblems=[emblem-favorite, emblem-important]\nb.txt\t3\t(regular)\nDocs\t0\t(directory)\tmetadata::emblems=[emblem-work]\n",
      ),
    ).toEqual({ "a.txt": ["emblem-favorite", "emblem-important"], Docs: ["emblem-work"] });
    expect(parseGioInfoEmblems("attributs :\n  metadata::emblems: [emblem-favorite, emblem-x]\n")).toEqual([
      "emblem-favorite",
      "emblem-x",
    ]);
    expect(parseGioInfoEmblems("attributs :\n")).toEqual([]);
  });

  test("syncEmblems hands each listed entry's disk emblems to the cache", async () => {
    const seen: Array<[string, string[]]> = [];
    const store = {
      list: async () => [
        { name: "a.txt", kind: "file" as const },
        { name: "b.txt", kind: "file" as const },
      ],
      emblems: async () => ({ "a.txt": ["emblem-favorite"] }),
    } as unknown as FileStore;
    const svc = createFileService({
      store,
      cache: { syncVfsEmblemsFromHost: (p: string, n: readonly string[]) => seen.push([p, [...n]]) } as never,
    });
    await svc.syncEmblems("/h");
    expect(seen).toEqual([
      ["/h/a.txt", ["emblem-favorite"]],
      ["/h/b.txt", []],
    ]);
  });
});
