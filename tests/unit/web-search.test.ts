import { describe, expect, it } from "bun:test";
import { looksLikeUrl, webSearchHome, webSearchUrl } from "@/lib/shell/web-search";

describe("web search", () => {
  it("tells addresses from searches", () => {
    for (const url of ["example.com", "https://a.b/c d", "www.debian.org/doc", "localhost:5173", "192.168.1.2/x", "about:blank", "fr.wikipedia.org"])
      expect(looksLikeUrl(url)).toBe(!url.includes(" "));
    for (const query of ["piloti desktop", "wayland", "how to use gnome", "node.js tutorial"])
      expect(looksLikeUrl(query)).toBe(false);
  });

  it("builds DuckDuckGo Lite URLs, Wikipedia in an iframe", () => {
    expect(webSearchUrl("a b&c")).toBe("https://lite.duckduckgo.com/lite/?q=a%20b%26c");
    expect(webSearchHome()).toBe("https://lite.duckduckgo.com/lite/");
    expect(webSearchUrl("x", true)).toContain("wikipedia.org");
  });
});
