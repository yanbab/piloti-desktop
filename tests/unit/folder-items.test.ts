import { describe, expect, test } from "bun:test";
import { vfsEntryToGridItem } from "@/lib/files/folder-items";

describe("folder entries as icons", () => {
  // On Linux the listing is all there is: no file content to read these from.
  test("keep the size and thumbnail the listing found", () => {
    const item = vfsEntryToGridItem(
      {
        id: "/p/a.png",
        name: "a.png",
        kind: "file",
        path: "/p/a.png",
        parentPath: "/p",
        updatedAt: 0,
        size: 1234,
        metadata: { "metadata::thumbnail": "data:image/png;base64,AA==" },
      },
      () => undefined,
    );
    expect(item.size).toBe(1234);
    expect(item.thumbnailUrl).toBe("data:image/png;base64,AA==");
  });
});
