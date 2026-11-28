import { describe, expect, test } from "bun:test";
import { insertionIndex, insertionX } from "@/ui/shell/windows/browser-tab-drop";

const tabs = [
  { left: 0, right: 100 },
  { left: 102, right: 202 },
  { left: 204, right: 304 },
];

describe("tab drop slot", () => {
  test("the slot follows tab middles", () => {
    expect(insertionIndex(tabs, 10)).toBe(0);
    expect(insertionIndex(tabs, 60)).toBe(1);
    expect(insertionIndex(tabs, 160)).toBe(2);
    expect(insertionIndex(tabs, 400)).toBe(3);
  });
  test("the line sits between tabs, or at an end", () => {
    expect(insertionX(tabs, 0, 0)).toBe(-1);
    expect(insertionX(tabs, 1, 0)).toBe(101);
    expect(insertionX(tabs, 3, 0)).toBe(305);
    expect(insertionX([], 0, 42)).toBe(42);
  });
});
