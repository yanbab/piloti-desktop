// Domicile app module: Selfies in its own process. See docs/ARCHITECTURE.md.
import * as React from "react";
import { mountModuleApp } from "@/ui/apps/module-app";
import { SelfiesApp } from "@/ui/apps/selfies/SelfiesApp";

// The shell draws this module's titlebar (`csd: false` in core/data/app-modules.ts).
export const main = mountModuleApp(
  { appId: "selfies", title: "Selfies", decorations: "server" },
  async (module) => {
    const host = { ...module.host, binaryFiles: true };
    return () => <SelfiesApp host={host} windowId={module.instance} />;
  },
);
