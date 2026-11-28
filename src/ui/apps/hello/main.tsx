// Spike: a Domicile app module (see docs/ARCHITECTURE.md). Reports what an
// isolated app can see, and writes the report to ~/piloti-appmodule-test.json.
import { useAppDomicile } from "@domicile-desktop/react/domicile-provider";
import { mount } from "@domicile-desktop/react/mount";
import { Bus } from "@domicile-desktop/sdk/system";
import { useEffect, useState } from "react";
import "@/ui/styles/globals.css";
import { AppChromeProvider, type AppChrome } from "@/ui/components/elements/app-chrome";
import { AppContent, AppWindow } from "@/ui/components/elements/app-window";
import { HeaderBar } from "@/ui/components/elements/header-bar";

const REPORT = "piloti-appmodule-test.json";

// The shell draws this module's titlebar (`csd: false` in data/app-modules.ts).
const CHROME: AppChrome = { appId: "hello", decorations: "server" };

const Hello = () => {
  const { files, dbus } = useAppDomicile();
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    document.title = "App Module Test";
    document.documentElement.classList.toggle("dark", matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    const out: Record<string, unknown> = {
      origin: location.origin,
      href: location.href,
      userAgent: navigator.userAgent,
      darkScheme: matchMedia("(prefers-color-scheme: dark)").matches,
      crossOriginIsolated: self.crossOriginIsolated,
      size: `${innerWidth}x${innerHeight}`,
      hasShellGlobal: Object.keys(window).filter((k) => /piloti|domicile/i.test(k)),
    };
    const run = async () => {
      try {
        localStorage.setItem("hello-runs", String(Number(localStorage.getItem("hello-runs") ?? "0") + 1));
        out.localStorageRuns = localStorage.getItem("hello-runs");
      } catch (e) {
        out.localStorageError = String(e);
      }
      // Settings portal over D-Bus: the standard way to follow dark/light and accent.
      const read = async (key: string) => {
        try {
          const r = await dbus.call({
            bus: Bus.Session,
            destination: "org.freedesktop.portal.Desktop",
            path: "/org/freedesktop/portal/desktop",
            interface: "org.freedesktop.portal.Settings",
            member: "Read",
            signature: "ss",
            body: ["org.freedesktop.appearance", key],
          });
          return r.isOk() ? JSON.stringify(r.unwrapOr(undefined as never)) : `err: ${JSON.stringify(r)}`;
        } catch (e) {
          return `throw: ${String(e)}`;
        }
      };
      out.portalColorScheme = await read("color-scheme");
      out.portalAccent = await read("accent-color");
      const ini = await files.readText(".config/piloti/settings.ini");
      out.settingsIniReadable = ini.isOk?.() ?? "n/a";
      const entries = await files.readDir?.(".");
      out.homeListing = entries ? "ok" : "no readDir";
      const w = await files.write(REPORT, JSON.stringify(out, null, 2));
      out.reportWritten = w.isOk?.() ?? "n/a";
      setLines(Object.entries(out).map(([k, v]) => `${k}: ${JSON.stringify(v)}`));
    };
    run().catch((e) => setLines([`error: ${String(e)}`]));
  }, [files]);

  return (
    <AppChromeProvider value={CHROME}>
      <AppWindow className="h-screen">
        <HeaderBar>
          <HeaderBar.Title>Piloti app module test</HeaderBar.Title>
        </HeaderBar>
        <AppContent padded>
          <pre className="text-ui-body whitespace-pre-wrap">{lines.join("\n")}</pre>
        </AppContent>
      </AppWindow>
    </AppChromeProvider>
  );
};

export const main = mount(Hello);
