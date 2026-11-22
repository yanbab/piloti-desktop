import { describe, expect, it } from "bun:test";
import { parseIniText, serializeIniText } from "@/lib/config/ini";

describe("ini preview conversion", () => {
  it("converts INI text to a section/key object for the JSON viewer", () => {
    const parsed = parseIniText("[Editor]\nlineNumbers=true\n# c\n[Other]\nk = v\n");
    expect(parsed).toEqual({ Editor: { lineNumbers: "true" }, Other: { k: "v" } });
    expect(parseIniText(serializeIniText(parsed))).toEqual(parsed);
  });

  it("places keys without a section under General", () => {
    expect(parseIniText("a=1")).toEqual({ General: { a: "1" } });
  });
});
