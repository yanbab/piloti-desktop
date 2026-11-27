import { describe, expect, test } from "bun:test";
import { mayHaveThumbnail } from "@/lib/engine/fs-bridge";

describe("folder listing", () => {
  test("only pictures, videos and PDFs are looked up for thumbnails", () => {
    for (const name of ["a.png", "b.JPG", "c.mp4", "d.pdf"]) expect(mayHaveThumbnail(name)).toBe(true);
    for (const name of ["a.txt", "b.zip", "c", "d.deb"]) expect(mayHaveThumbnail(name)).toBe(false);
  });
});
