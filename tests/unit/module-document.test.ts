import { describe, expect, test } from "bun:test";
import { documentHash, moduleDocument } from "@/data/app-modules";

describe("moduleDocument", () => {
  test("reads back the path a module put in its URL", () => {
    const path = "/home/u/Bureau/Untitled (1) #2.txt";
    expect(moduleDocument(`domicile://app-abc/${documentHash(path)}`)).toBe(path);
  });
  test("none for a new document or a broken hash", () => {
    expect(moduleDocument("domicile://app-abc/")).toBeNull();
    expect(moduleDocument("domicile://app-abc/#%E0%A4%A")).toBeNull();
  });
});
