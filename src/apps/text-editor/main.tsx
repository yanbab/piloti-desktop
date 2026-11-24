// Domicile app module: the Text Editor in its own document (own origin/process
// boundary). See docs/APP-MODULES.md. File to open: ~/.cache/piloti/text-editor-open
// (one path, consumed on start), until the shell can pass arguments.
import "@/styles/globals.css";
import type { AppMain } from "@domicile-desktop/sdk/app";
import { useAppDomicile } from "@domicile-desktop/react/domicile-provider";
import { mount } from "@domicile-desktop/react/mount";
import * as React from "react";
import { TextEditorApp } from "@/components/apps/TextEditorApp";
import { applyThemeToDocument } from "@/lib/engine/app-bridge";
import { TextEditorHostProvider, type TextEditorHost } from "@/lib/engine/text-editor-host";
import { createDomicileEditorHost } from "./host";

const OPEN_FILE = ".cache/piloti/text-editor-open";

const App = ({ host, path }: { host: TextEditorHost; path: string | null }) => (
  <TextEditorHostProvider value={host}>
    <TextEditorApp initialPath={path ?? undefined} windowId="" isCsd={false} leadingInset={96} trailingInset={110} />
  </TextEditorHostProvider>
);

const Boot = () => {
  const { files } = useAppDomicile();
  const [state, setState] = React.useState<
    { host: TextEditorHost; path: string | null } | undefined
  >();
  React.useEffect(() => {
    void (async () => {
      const raw = await files.readText(OPEN_FILE).then((r) => r.unwrapOr(""), () => "");
      const path = raw.trim() || null;
      if (path) void files.write(OPEN_FILE, "").catch(() => {});
      const { host, settings } = await createDomicileEditorHost(files, path);
      const iface = settings["org.piloti.desktop.interface"] ?? {};
      applyThemeToDocument(document, {
        themeMode: (iface["color-scheme"] as "dark" | "light" | "system") ?? "system",
        accentColor: (iface["accent-color"] ?? "blue") as never,
        fontSansFamily: "",
        fontMonoFamily: "",
        fontScale: 1,
      });
      setState({ host, path });
    })();
  }, [files]);
  return state ? <App host={state.host} path={state.path} /> : null;
};

export const main: AppMain = mount(Boot);
