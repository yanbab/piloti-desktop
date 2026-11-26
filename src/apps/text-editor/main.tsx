// Domicile app module: the Text Editor in its own document (own origin/process
// boundary). See docs/ARCHITECTURE.md. File to open: ~/.cache/piloti/text-editor-open
// (one path, consumed on start), until the shell can pass arguments.
import "@/styles/globals.css";
import type { AppMain } from "@domicile-desktop/sdk/app";
import { useAppDomicile } from "@domicile-desktop/react/domicile-provider";
import { mount } from "@domicile-desktop/react/mount";
import * as React from "react";
import { AppChromeProvider, hostControlInsets, type AppChrome } from "@/components/elements/app-chrome";
import { TextEditorApp } from "@/components/apps/TextEditorApp";
import { applyThemeToDocument } from "@/lib/engine/app-bridge";
import { TextEditorHostProvider, type TextEditorHost } from "@/lib/engine/text-editor-host";
import { createDomicileEditorHost } from "./host";

const OPEN_FILE = ".cache/piloti/text-editor-open";

// The shell lays the window controls over this module's header (`csd: true` in
// data/app-modules.ts).
const App = ({ host, path, chrome }: { host: TextEditorHost; path: string | null; chrome: AppChrome }) => (
  <AppChromeProvider value={chrome}>
    <TextEditorHostProvider value={host}>
      <TextEditorApp initialPath={path ?? undefined} windowId="" />
    </TextEditorHostProvider>
  </AppChromeProvider>
);

const Boot = () => {
  const domicile = useAppDomicile();
  const { files } = domicile;
  const [state, setState] = React.useState<
    { host: TextEditorHost; path: string | null; chrome: AppChrome } | undefined
  >();
  React.useEffect(() => {
    void (async () => {
      const raw = await files.readText(OPEN_FILE).then((r) => r.unwrapOr(""), () => "");
      const path = raw.trim() || null;
      if (path) void files.write(OPEN_FILE, "").catch(() => {});
      const { host, settings } = await createDomicileEditorHost(domicile);
      const iface = settings["org.piloti.desktop.interface"] ?? {};
      applyThemeToDocument(document, {
        themeMode: (iface["color-scheme"] as "dark" | "light" | "system") ?? "system",
        accentColor: (iface["accent-color"] ?? "blue") as never,
        fontSansFamily: "",
        fontMonoFamily: "",
        fontScale: 1,
      });
      const buttons = settings["org.piloti.desktop.wm"]?.["button-layout"];
      const chrome: AppChrome = {
        appId: "text-editor",
        decorations: "host",
        insets: hostControlInsets(typeof buttons === "string" ? buttons : undefined),
      };
      setState({ host, path, chrome });
    })();
  }, [domicile, files]);
  return state ? <App {...state} /> : null;
};

export const main: AppMain = mount(Boot);
