import { describe, expect, test } from "bun:test";
import { parseGioInfoEmblems, parseGioListEmblems } from "@/lib/engine-native/gio";

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
});
