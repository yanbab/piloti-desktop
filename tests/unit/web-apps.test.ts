import { describe, expect, it } from "bun:test";
import {
  canonicalizeWebUrl,
  DEFAULT_BROWSER_WEB_APPS,
  DEFAULT_LAUNCHER_WEB_APPS,
  fetchWebPageMetadata,
  fetchWebPageTitle,
  getCachedWebDescription,
  getContrastForeground,
  getWebAppFaviconUrl,
  parseHtmlDescription,
  parseHtmlThemeColor,
  parseHtmlTitle,
  resolveWebAppTitle,
} from "@/data/web-apps";
import {
  resolveInitialSettings,
  WEB_DEFAULTS_VERSION,
} from "@/context/SettingsContext";

describe("DEFAULT_BROWSER_WEB_APPS", () => {
  it("contains 50 unique, valid https entries (including Games) excluding iframe-blocked origins", () => {
    expect(DEFAULT_BROWSER_WEB_APPS).toHaveLength(50);
    expect(
      DEFAULT_BROWSER_WEB_APPS.filter((a) => a.category === "Games").length
    ).toBeGreaterThanOrEqual(9);

    const ids = new Set<string>();
    const urls = new Set<string>();
    const blockedHosts = new Set([
      "cryptpad.fr",
      "vscode.dev",
      "kleki.com",
      "www.piskelapp.com",
      "app.diagrams.net",
      "open.spotify.com",
      "music.youtube.com",
    ]);

    for (const app of DEFAULT_BROWSER_WEB_APPS) {
      expect(ids.has(app.id)).toBe(false);
      expect(urls.has(app.url)).toBe(false);
      ids.add(app.id);
      urls.add(app.url);

      const parsed = new URL(app.url);
      expect(parsed.protocol).toBe("https:");
      expect(blockedHosts.has(parsed.hostname)).toBe(false);
    }
  });

  it("builds favicon URLs for public web apps and ignores local/non-http origins", () => {
    expect(getWebAppFaviconUrl("https://excalidraw.com/")).toBe(
      "https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Fexcalidraw.com%2F&sz=128"
    );
    expect(getWebAppFaviconUrl("http://localhost:5173/")).toBeUndefined();
    expect(getWebAppFaviconUrl("about:blank")).toBeUndefined();
    expect(getWebAppFaviconUrl(undefined)).toBeUndefined();
  });
});

describe("resolveInitialSettings web defaults and seeding", () => {
  it("keeps native defaults untouched outside the web backend", () => {
    const nativeFresh = resolveInitialSettings(null, false);
    expect(nativeFresh.installedWebApps).toEqual([]);
    expect(nativeFresh.pinnedAppIds).toEqual([
      "settings",
      "nautilus",
      "terminal",
      "text-editor",
      "app-store",
      "calculator",
      "piloti-demo",
      "camera",
      "browser",
    ]);
    expect(nativeFresh.webDefaultsVersion).toBeUndefined();

    const nativeSaved = resolveInitialSettings(
      JSON.stringify({ installedWebApps: [] }),
      false
    );
    expect(nativeSaved.installedWebApps).toEqual([]);
    expect(nativeSaved.webDefaultsVersion).toBeUndefined();
  });

  it("pins our apps (not Console or Image Viewer) and populates 11 launcher web apps on fresh web startup", () => {
    expect(DEFAULT_LAUNCHER_WEB_APPS).toHaveLength(11);
    const webFresh = resolveInitialSettings(null, true);
    expect(webFresh.pinnedAppIds).toEqual([
      "nautilus",
      "browser",
      "terminal",
      "text-editor",
      "calculator",
      "camera",
      "piloti-demo",
      "app-store",
      "settings",
    ]);
    expect(webFresh.installedWebApps).toEqual([...DEFAULT_LAUNCHER_WEB_APPS]);
    expect(webFresh.webAppsSeeded).toBe(true);
    expect(webFresh.webDefaultsVersion).toBe(WEB_DEFAULTS_VERSION);
  });

  it("cleans fake launchers and merges defaults once on unseeded web storage", () => {
    const customApp = {
      id: "web:https://example.com/",
      title: "Example",
      url: "https://example.com/",
    };

    const upgraded = resolveInitialSettings(
      JSON.stringify({
        pinnedAppIds: ["settings", "terminal", "browser", "kitty.desktop"],
        installedWebApps: [customApp],
      }),
      true
    );

    expect(upgraded.webAppsSeeded).toBe(true);
    expect(upgraded.webDefaultsVersion).toBe(WEB_DEFAULTS_VERSION);
    expect(upgraded.pinnedAppIds).toEqual([
      "settings",
      "terminal",
      "browser",
      "nautilus",
      "text-editor",
      "calculator",
      "camera",
      "piloti-demo",
      "app-store",
    ]);
    expect(upgraded.installedWebApps).toHaveLength(
      DEFAULT_LAUNCHER_WEB_APPS.length + 1
    );
    expect(upgraded.installedWebApps[0]).toEqual(customApp);
  });

  it("upgrades legacy seeded web apps to the 10 curated launcher defaults", () => {
    const v1Upgraded = resolveInitialSettings(
      JSON.stringify({
        webAppsSeeded: true,
        installedWebApps: Array.from({ length: 40 }, (_, i) => ({
          id: `web:https://legacy-${i}.example/`,
          title: `Legacy ${i}`,
          url: `https://legacy-${i}.example/`,
        })),
      }),
      true
    );

    expect(v1Upgraded.webDefaultsVersion).toBe(WEB_DEFAULTS_VERSION);
    expect(v1Upgraded.installedWebApps).toEqual([...DEFAULT_LAUNCHER_WEB_APPS]);
    expect(v1Upgraded.pinnedAppIds).toEqual([
      "nautilus",
      "browser",
      "terminal",
      "text-editor",
      "calculator",
      "camera",
      "piloti-demo",
      "app-store",
      "settings",
    ]);
  });

  it("preserves user web app and dock edits once webDefaultsVersion is current", () => {
    const currentByUser = resolveInitialSettings(
      JSON.stringify({
        pinnedAppIds: ["nautilus"],
        installedWebApps: [],
        webAppsSeeded: true,
        webDefaultsVersion: WEB_DEFAULTS_VERSION,
      }),
      true
    );

    expect(currentByUser.pinnedAppIds).toEqual(["nautilus"]);
    expect(currentByUser.installedWebApps).toEqual([]);
    expect(currentByUser.webDefaultsVersion).toBe(WEB_DEFAULTS_VERSION);
  });
});

describe("HTML page title helpers for web apps", () => {
  it("canonicalizes http(s) URLs and ignores non-http schemes", () => {
    expect(canonicalizeWebUrl("https://excalidraw.com")).toBe(
      "https://excalidraw.com/"
    );
    expect(canonicalizeWebUrl("https://notse.github.io/Calculator/")).toBe(
      "https://notse.github.io/Calculator/"
    );
    expect(canonicalizeWebUrl("javascript:alert(1)")).toBeUndefined();
    expect(canonicalizeWebUrl("not a url")).toBeUndefined();
  });

  it("parses HTML titles, collapses whitespace, and decodes entities", () => {
    expect(
      parseHtmlTitle(
        "<!doctype html><html><head><title>\n  Excalidraw &amp; Friends &#x2014; Canvas\n</title></head></html>"
      )
    ).toBe("Excalidraw & Friends — Canvas");
    expect(parseHtmlTitle("<html><head><title>   </title></head></html>")).toBeNull();
    expect(parseHtmlTitle("<html><body>No title</body></html>")).toBeNull();
  });

  it("prioritizes live HTML titles over compositor, curated defaults, and hostnames", () => {
    const legacyHostnameApps = [
      {
        id: "web:https://excalidraw.com/",
        title: "excalidraw.com",
        url: "https://excalidraw.com",
      },
      {
        id: "web:https://notse.github.io/Calculator/",
        title: "notse.github.io",
        url: "https://notse.github.io/Calculator/",
      },
    ];

    expect(
      resolveWebAppTitle({
        rawUrl: "https://excalidraw.com",
        installedApps: legacyHostnameApps,
      })
    ).toBe("Excalidraw");

    expect(
      resolveWebAppTitle({
        rawUrl: "https://notse.github.io/Calculator/",
        liveTitle: "Calculator",
        hostTitle: "notse.github.io",
        installedApps: legacyHostnameApps,
      })
    ).toBe("Calculator");

    expect(
      resolveWebAppTitle({
        rawUrl: "https://www.unknown-example.test/app",
      })
    ).toBe("unknown-example.test");
  });

  it("fetches and parses CORS-accessible HTML titles while rejecting local/error responses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "https://notse.github.io/Calculator/") {
        return new Response(
          "<!doctype html><html><head><title>Calculator</title></head></html>",
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          }
        );
      }
      if (url === "https://example.com/data.json") {
        return new Response('{"title":"ignored"}', {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new TypeError("CORS blocked");
    }) as typeof fetch;

    try {
      expect(
        await fetchWebPageTitle("https://notse.github.io/Calculator/")
      ).toBe("Calculator");
      expect(
        await fetchWebPageTitle("https://example.com/data.json")
      ).toBeNull();
      expect(
        await fetchWebPageTitle("https://cors-restricted.example/")
      ).toBeNull();
      expect(await fetchWebPageTitle("http://localhost:3000/")).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses <meta name='theme-color'> including prefers-color-scheme and computes contrast foreground", () => {
    const html = `
      <html><head>
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f5f4" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a5fb4" />
      </head></html>
    `;
    expect(parseHtmlThemeColor(html, false)).toBe("#f6f5f4");
    expect(parseHtmlThemeColor(html, true)).toBe("#1a5fb4");
    expect(getContrastForeground("#f6f5f4")).toBe("#1d1d20");
    expect(getContrastForeground("#1a5fb4")).toBe("#ffffff");
    expect(getContrastForeground("rgb(20, 20, 20)")).toBe("#ffffff");
    expect(getContrastForeground("rgba(0, 0, 0, 0)")).toBeNull();
  });

  it("parses <meta name='description'> (and og:description fallback) and caches via fetchWebPageMetadata", async () => {
    const html = `
      <html><head>
        <title>Example App</title>
        <meta name="description" content="  Fast &amp; collaborative   whiteboard  " />
      </head></html>
    `;
    expect(parseHtmlDescription(html)).toBe("Fast & collaborative whiteboard");
    expect(
      parseHtmlDescription(
        `<meta property="og:description" content="OpenGraph fallback desc" />`
      )
    ).toBe("OpenGraph fallback desc");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      })) as unknown as typeof fetch;

    try {
      const meta = await fetchWebPageMetadata("https://cached-desc.example/");
      expect(meta.title).toBe("Example App");
      expect(meta.description).toBe("Fast & collaborative whiteboard");
      expect(getCachedWebDescription("https://cached-desc.example/")).toBe(
        "Fast & collaborative whiteboard"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
