// Domicile app module: the Calculator in its own process. See docs/ARCHITECTURE.md.
import * as React from "react";
import { onAppAction, publishWindowMenuState } from "@/platform/shared/app-bridge";
import { CalculatorApp } from "@/ui/apps/calculator/CalculatorApp";
import type { CalculatorHost } from "@/ui/apps/calculator/host";
import { mountModuleApp } from "@/ui/apps/module-app";

// The shell draws this module's titlebar (`csd: false` in core/data/app-modules.ts).
export const main = mountModuleApp(
  { appId: "calculator", title: "Calculator", stateKeys: ["calculator"], decorations: "server" },
  async ({ host, instance, publish }) => {
    const calculator: CalculatorHost = {
      ...host,
      publishMenu: publishWindowMenuState,
      onMenuAction: onAppAction,
      resize: (_id, size) => publish({ size }),
    };
    return () => <CalculatorApp host={calculator} windowId={instance} />;
  },
);
