// Domicile app module: the Texts in its own document (own origin/process
// boundary). See docs/ARCHITECTURE.md. File to open: ~/.cache/piloti/texts-open
// (one path, consumed on start), until the shell can pass arguments.
import "@/styles/globals.css";
import type { AppMain } from "@domicile-desktop/sdk/app";
import { useAppDomicile } from "@domicile-desktop/react/domicile-provider";
import { mount } from "@domicile-desktop/react/mount";
import * as React from "react";
import { AppChromeProvider, hostControlInsets, type AppChrome } from "@/components/elements/app-chrome";
import { TextsApp } from "@/apps/texts/TextsApp";
import { applyDesktopTheme } from "@/lib/engine/app-module-host";
import { TextsHostProvider, type TextsHost } from "@/lib/engine/texts-host";
import { createDomicileEditorHost } from "./host";

const OPEN_FILE = ".cache/piloti/texts-open";

// The shell lays the window controls over this module's header (`csd: true` in
// data/app-modules.ts).
const App = ({
  host,
  path,
  chrome,
  windowId,
}: {
  host: TextsHost;
  path: string | null;
  chrome: AppChrome;
  windowId: string;
}) => (
  <AppChromeProvider value={chrome}>
    <TextsHostProvider value={host}>
      <TextsApp initialPath={path ?? undefined} windowId={windowId} />
    </TextsHostProvider>
  </AppChromeProvider>
);

const Boot = () => {
  const domicile = useAppDomicile();
  const { files } = domicile;
  const [state, setState] = React.useState<
    { host: TextsHost; path: string | null; chrome: AppChrome; windowId: string } | undefined
  >();
  React.useEffect(() => {
    void (async () => {
      const raw = await files.readText(OPEN_FILE).then((r) => r.unwrapOr(""), () => "");
      const path = raw.trim() || null;
      if (path) void files.write(OPEN_FILE, "").catch(() => {});
      const { host, settings, instance, watchDesktopSettings } =
        await createDomicileEditorHost(domicile);
      watchDesktopSettings(applyDesktopTheme);
      const buttons = settings["org.piloti.desktop.wm"]?.["button-layout"];
      const chrome: AppChrome = {
        appId: "texts",
        decorations: "host",
        insets: hostControlInsets(typeof buttons === "string" ? buttons : undefined),
      };
      setState({ host, path, chrome, windowId: instance });
    })();
  }, [domicile, files]);
  return state ? <App {...state} /> : null;
};

export const main: AppMain = mount(Boot);
