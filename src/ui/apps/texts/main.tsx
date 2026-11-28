// Domicile app module: Texts in its own process. See docs/ARCHITECTURE.md.
import * as React from "react";
import { mountModuleApp } from "@/ui/apps/module-app";
import { createDomicileEditorHost } from "@/ui/apps/texts/host";
import { TextsApp } from "@/ui/apps/texts/TextsApp";
import { TextsHostProvider } from "@/ui/apps/texts/texts-host";

// The shell lays the window controls over this module's header (`csd: true` in
// core/data/app-modules.ts).
export const main = mountModuleApp(
  { appId: "texts", title: "Texts", stateKeys: ["editor-state"], decorations: "host" },
  async (module) => {
    const path = await module.takeOpenFile();
    const host = await createDomicileEditorHost(module, module.files);
    return () => (
      <TextsHostProvider value={host}>
        <TextsApp initialPath={path ?? undefined} windowId={module.instance} />
      </TextsHostProvider>
    );
  },
);
