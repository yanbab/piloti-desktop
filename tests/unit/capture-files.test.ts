import { describe, expect, it } from "bun:test";
import {
  captureOpenAction,
  nextCaptureFilename,
  parseOpenAction,
} from "@/lib/files/capture-files";

describe("capture-files", () => {
  it("picks the first free numbered filename", () => {
    expect(nextCaptureFilename([], "Screenshot", "png")).toBe("Screenshot 1.png");
    expect(
      nextCaptureFilename(["Screenshot 1.png", "Screenshot 2.png"], "Screenshot", "png"),
    ).toBe("Screenshot 3.png");
    expect(nextCaptureFilename(["Screenshot 1.webm"], "Screenshot", "png")).toBe(
      "Screenshot 1.png",
    );
  });

  it("round-trips the open action key", () => {
    const action = captureOpenAction("/home/user/Desktop/Record 1.webm");
    expect(action.key).toBe("open:/home/user/Desktop/Record 1.webm");
    expect(parseOpenAction(action.key)).toBe("/home/user/Desktop/Record 1.webm");
  });

  it("ignores non-open actions and empty paths", () => {
    expect(parseOpenAction("launcher")).toBeNull();
    expect(parseOpenAction("open:   ")).toBeNull();
  });
});
