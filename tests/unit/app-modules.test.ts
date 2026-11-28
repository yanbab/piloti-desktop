import { createHash } from "node:crypto";
import { beforeAll, describe, expect, test } from "bun:test";
import { APP_MODULES, initAppModules, webViewAppId } from "@/core/data/app-modules";

const moduleUrl = (id: string) => {
  const dir = APP_MODULES.find((m) => m.id === id)!.dir;
  return `domicile://app-${createHash("sha256").update(dir).digest("hex").slice(0, 32)}/`;
};

describe("web view windows", () => {
  beforeAll(initAppModules);

  test("an app module's window is its app, however it is listed", () => {
    const url = moduleUrl("texts");
    expect(webViewAppId({ id: 1, url })).toBe("texts");
    expect(webViewAppId({ id: 1, url, isApp: true, appId: "browser" })).toBe("texts");
  });

  test("other pages keep their web app, or belong to the browser", () => {
    const url = "https://example.org/";
    expect(webViewAppId({ id: 2, url })).toBe("browser");
    expect(webViewAppId({ id: 2, url, isApp: true })).toBe("webview:2");
    expect(webViewAppId({ id: 2, url }, "webapp-mail")).toBe("webapp-mail");
  });
});
