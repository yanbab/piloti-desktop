import { describe, expect, it } from "bun:test";
import { addressSuggestions, withVisit, type BrowserHistoryEntry } from "@/core/address/web-history";

const now = 1_800_000_000_000;
const day = 86_400_000;

describe("browser history", () => {
  it("counts visits once per page and keeps the newest first", () => {
    let h: BrowserHistoryEntry[] = [];
    h = withVisit(h, "https://a.org/", "", now);
    h = withVisit(h, "https://b.org/", "B", now + 1);
    h = withVisit(h, "https://a.org", "A", now + 2);
    expect(h.map((e) => [e.url, e.visits])).toEqual([["https://a.org", 2], ["https://b.org/", 1]]);
    h = withVisit(h, "https://b.org/", "Better B", now + 3, false);
    expect(h[0]).toMatchObject({ title: "Better B", visits: 1, last: now + 1 });
  });

  it("suggests host matches first, then words, favouring bookmarks and visits", () => {
    const history: BrowserHistoryEntry[] = [
      { url: "https://news.example.com/", title: "Example News", visits: 9, last: now },
      { url: "https://www.wikipedia.org/wiki/Linux", title: "Linux - Wikipedia", visits: 1, last: now - 3 * day },
      { url: "https://linuxfoundation.org/", title: "The Linux Foundation", visits: 2, last: now },
    ];
    const bookmarks = [{ url: "https://lwn.net/", title: "LWN.net", added: now - day }];
    expect(addressSuggestions("lin", bookmarks, history, now).map((s) => s.key)).toEqual([
      "https://linuxfoundation.org/",
      "https://www.wikipedia.org/wiki/Linux",
    ]);
    expect(addressSuggestions("wiki", bookmarks, history, now)[0].key).toBe(
      "https://www.wikipedia.org/wiki/Linux"
    );
    expect(addressSuggestions("", bookmarks, history, now)).toEqual([
      {
        key: "https://lwn.net/",
        title: "LWN.net",
        detail: "lwn.net",
        completion: "lwn.net",
        icon: "bookmark",
        target: { kind: "url", url: "https://lwn.net/" },
      },
    ]);
    expect(addressSuggestions("zzz", bookmarks, history, now)).toEqual([]);
  });
});
