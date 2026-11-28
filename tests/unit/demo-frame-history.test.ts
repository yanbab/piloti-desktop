import { beforeEach, describe, expect, it } from "bun:test";
import {
  canFrameGoBack,
  canFrameGoForward,
  framePushed,
  frameRemoved,
  frameStarted,
  resetFrameHistory,
  stepFrame,
} from "@/ui/shell/windows/demo-frame-history";

const steps: string[] = [];
const history = { back: () => steps.push("back"), forward: () => steps.push("forward") };

describe("demo frame history", () => {
  beforeEach(() => {
    resetFrameHistory();
    steps.length = 0;
  });

  it("steps through a frame's own entries, links included", () => {
    frameStarted("a", "https://one/");
    framePushed("a", null); // a link in the page
    framePushed("a", "https://two/");
    expect(stepFrame("a", -1, history)).toBeNull();
    expect(stepFrame("a", -1, history)).toBe("https://one/");
    expect(canFrameGoBack("a")).toBe(false);
    expect(stepFrame("a", 1, history)).toBeNull();
    expect(stepFrame("a", 1, history)).toBe("https://two/");
    expect(canFrameGoForward("a")).toBe(false);
    expect(steps).toEqual(["back", "back", "forward", "forward"]);
  });

  it("never steps another tab's entry", () => {
    frameStarted("a", "https://a/");
    frameStarted("b", "https://b/");
    framePushed("a", "https://a2/");
    framePushed("b", "https://b2/");
    expect(canFrameGoBack("a")).toBe(false);
    expect(stepFrame("a", -1, history)).toBeUndefined();
    expect(stepFrame("b", -1, history)).toBe("https://b/");
    expect(canFrameGoBack("a")).toBe(true);
    expect(steps).toEqual(["back"]);
  });

  it("drops a closed tab's entries", () => {
    frameStarted("a", "https://a/");
    frameStarted("b", "https://b/");
    framePushed("a", "https://a2/");
    framePushed("b", "https://b2/");
    frameRemoved("b");
    expect(canFrameGoBack("a")).toBe(true);
  });

  it("a new entry clears the forward ones", () => {
    frameStarted("a", "https://a/");
    framePushed("a", "https://a2/");
    stepFrame("a", -1, history);
    framePushed("a", "https://a3/");
    expect(canFrameGoForward("a")).toBe(false);
  });
});
