// Spike: a Domicile app module (see _docs/APP-ARCHITECTURE.md). Reports what an
// isolated app can see, and writes the report to ~/piloti-appmodule-test.json.
import { useAppDomicile } from "@domicile-desktop/react/domicile-provider";
import { mount } from "@domicile-desktop/react/mount";
import { useEffect, useState } from "react";

const REPORT = "piloti-appmodule-test.json";

const Hello = () => {
  const { files } = useAppDomicile();
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    document.title = "App Module Test";
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
    <div style={{ font: "13px system-ui", padding: 16, colorScheme: "light dark", background: "Canvas", color: "CanvasText", minBlockSize: "100vh" }}>
      <h2 style={{ margin: "0 0 8px" }}>Piloti app module test</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>{lines.join("\n")}</pre>
    </div>
  );
};

export const main = mount(Hello);
