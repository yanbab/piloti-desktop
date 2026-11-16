import { describe, expect, test } from "bun:test";
import { resolveInlineCompletionSuffix } from "./inline-completion-input";

describe("resolveInlineCompletionSuffix", () => {
  test("returns suffix when query is a case-insensitive prefix of completion", () => {
    expect(resolveInlineCompletionSuffix("fi", "Firefox Nightly")).toBe(
      "refox Nightly"
    );
    expect(resolveInlineCompletionSuffix("Fi", "Firefox Nightly")).toBe(
      "refox Nightly"
    );
  });

  test("returns null when query is empty, exact match, or not a prefix", () => {
    expect(resolveInlineCompletionSuffix("", "Firefox Nightly")).toBeNull();
    expect(
      resolveInlineCompletionSuffix("Firefox Nightly", "Firefox Nightly")
    ).toBeNull();
    expect(resolveInlineCompletionSuffix("nightly", "Firefox Nightly")).toBeNull();
    expect(resolveInlineCompletionSuffix("fi", undefined)).toBeNull();
  });
});

