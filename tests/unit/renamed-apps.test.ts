import { describe, expect, test } from "bun:test";
import { currentAppId, formerAppId, renameBoundsKeys } from "@/core/config/renamed-apps";

describe("renamed apps", () => {
  test("old ids read as new ones, others as they are", () => {
    expect(["text-editor", "camera", "terminal"].map(currentAppId)).toEqual(["texts", "selfies", "terminal"]);
    expect(formerAppId("texts")).toBe("text-editor");
    expect(formerAppId("terminal")).toBeUndefined();
  });

  test("window bounds keys keep their document", () => {
    expect(renameBoundsKeys({ "text-editor:/home/user/a:b.md": 1, camera: 2 })).toEqual({
      "texts:/home/user/a:b.md": 1,
      selfies: 2,
    });
  });
});
