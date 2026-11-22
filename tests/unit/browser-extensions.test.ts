import { describe, expect, it } from "bun:test";
import {
  RECOMMENDED_EXTENSIONS,
  SAMPLE_LOCAL_EXTENSION,
  isExtensionEnabled,
  normalizeExtensionsConfig,
  parseChromeWebStoreExtensionId,
  setExtensionEnabled,
} from "@/lib/engine/browser-extensions";

describe("browser extensions catalog", () => {
  it("lists uBlock Origin Lite and Dark Reader with Chrome Web Store IDs", () => {
    const byId = Object.fromEntries(RECOMMENDED_EXTENSIONS.map((e) => [e.id, e]));
    expect(byId["ublock-origin-lite"]?.webStoreId).toBe("ddkjiahejlhfcafbddmgiahcphecmpfh");
    expect(byId["dark-reader"]?.webStoreId).toBe("eimadpbcbfnmbkopoojfekhnkhdbieeh");
    for (const ext of RECOMMENDED_EXTENSIONS) {
      expect(ext.webStoreId).toMatch(/^[a-p]{32}$/);
      expect(ext.storeUrl).toContain(ext.webStoreId);
    }
  });

  it("ships the sample local extension under /usr/share/piloti", () => {
    expect(SAMPLE_LOCAL_EXTENSION.path).toBe("/usr/share/piloti/extensions/piloti-demo");
  });

  it("normalizes malformed config input", () => {
    expect(normalizeExtensionsConfig(undefined)).toEqual({ unpacked: [], web_store: [] });
    expect(
      normalizeExtensionsConfig({ unpacked: ["/a", 3, ""], web_store: "nope" }),
    ).toEqual({ unpacked: ["/a"], web_store: [] });
  });

  it("enables and disables entries idempotently", () => {
    let cfg = normalizeExtensionsConfig({});
    cfg = setExtensionEnabled(cfg, "web_store", "abc", true);
    cfg = setExtensionEnabled(cfg, "web_store", "abc", true);
    expect(cfg.web_store).toEqual(["abc"]);
    expect(isExtensionEnabled(cfg, "web_store", "abc")).toBe(true);
    cfg = setExtensionEnabled(cfg, "web_store", "abc", false);
    expect(isExtensionEnabled(cfg, "web_store", "abc")).toBe(false);
    expect(cfg.unpacked).toEqual([]);
  });

  it("extracts Chrome Web Store extension IDs from detail URLs", () => {
    expect(
      parseChromeWebStoreExtensionId(
        "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh",
      ),
    ).toBe("ddkjiahejlhfcafbddmgiahcphecmpfh");
    expect(
      parseChromeWebStoreExtensionId(
        "https://chrome.google.com/webstore/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh",
      ),
    ).toBe("eimadpbcbfnmbkopoojfekhnkhdbieeh");
    expect(
      parseChromeWebStoreExtensionId("https://chromewebstore.google.com/"),
    ).toBeNull();
    expect(
      parseChromeWebStoreExtensionId(
        "https://example.com/detail/foo/ddkjiahejlhfcafbddmgiahcphecmpfh",
      ),
    ).toBeNull();
  });
});
