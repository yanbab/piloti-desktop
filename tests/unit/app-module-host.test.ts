import { beforeAll, describe, expect, test } from "bun:test";
import { Ok } from "@cprussin/option-result";
import { createAppModuleHost } from "@/platform/shared/app-module-host";
import { defineSettings, setSettingsBackend } from "@/platform/shared/settings";
import { createFakeDomicile } from "../helpers/fake-domicile";

beforeAll(() => {
  // The module registers a pagehide handler; there is no window in the test runner.
  (globalThis as { addEventListener?: unknown }).addEventListener ??= () => {};
});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

describe("app module host", () => {
  test("keeps state and settings in the same files as the shell", async () => {
    const fake = createFakeDomicile().domicile;
    // A bus nobody speaks on.
    const domicile = Object.assign(fake, { dbus: { match: async () => Ok({ items: new ReadableStream() }) } });
    const start = () =>
      createAppModuleHost(domicile as never, { appId: "calculator", stateKeys: ["calculator"] });
    const settings = defineSettings("org.piloti.calculator", { scientific: false }, { register: false });
    try {
      const { host } = await start();
      expect(host.readState("calculator", isRecord)).toBeNull();
      host.writeState("calculator", { display: "42" });
      settings.set("scientific", true);
      await new Promise((r) => setTimeout(r, 500));

      const read = async (path: string) =>
        (await domicile.files.readText(path)).unwrapOr("" as never) as string;
      expect(await read(".local/state/piloti/calculator.json")).toContain('"42"');
      expect(await read(".config/piloti/apps/calculator.ini")).toContain("scientific=true");

      const again = await start();
      expect(again.host.readState("calculator", isRecord)).toEqual({ display: "42" });
      expect(settings.get("scientific")).toBe(true);
    } finally {
      setSettingsBackend(null);
    }
  });
});
