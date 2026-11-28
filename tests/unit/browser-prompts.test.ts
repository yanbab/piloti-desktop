import { describe, expect, it } from "bun:test";
import { describePermissions } from "@/ui/shell/windows/BrowserPagePrompts";

describe("permission request text", () => {
  it("joins camera and microphone, and names the others", () => {
    expect(describePermissions(["camera", "microphone"])).toBe("use your camera and microphone");
    expect(describePermissions(["location"])).toBe("know your location");
    expect(describePermissions(["camera"])).toBe("use your camera");
    expect(describePermissions(["something-new"])).toBe("something-new");
  });
});
