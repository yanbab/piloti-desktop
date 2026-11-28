// Domicile app module: the Calculator in its own process. See docs/ARCHITECTURE.md.
import "@/ui/styles/globals.css";
import type { AppMain } from "@domicile-desktop/sdk/app";
import { useAppDomicile } from "@domicile-desktop/react/domicile-provider";
import { mount } from "@domicile-desktop/react/mount";
import * as React from "react";
import { CalculatorApp } from "@/ui/apps/calculator/CalculatorApp";
import type { CalculatorHost } from "@/ui/apps/calculator/host";
import { AppChromeProvider, type AppChrome } from "@/ui/components/elements/app-chrome";
import { applyDesktopTheme, createAppModuleHost } from "@/platform/shared/app-module-host";
import { onAppAction, publishWindowMenuState } from "@/platform/shared/app-bridge";

// The shell draws this module's titlebar (`csd: false` in data/app-modules.ts).
const CHROME: AppChrome = { appId: "calculator", decorations: "server" };

const Boot = () => {
  const domicile = useAppDomicile();
  const [app, setApp] = React.useState<{ host: CalculatorHost; windowId: string }>();
  React.useEffect(() => {
    void createAppModuleHost(domicile, { appId: "calculator", stateKeys: ["calculator"] }).then(
      ({ host, instance, publish, watchDesktopSettings }) => {
        watchDesktopSettings(applyDesktopTheme);
        document.title = "Calculator";
        setApp({
          windowId: instance,
          host: {
            ...host,
            publishMenu: publishWindowMenuState,
            onMenuAction: onAppAction,
            resize: (_id, size) => publish({ size }),
          },
        });
      },
    );
  }, [domicile]);
  return app ? (
    <AppChromeProvider value={CHROME}>
      <div className="flex h-screen flex-col">
        <CalculatorApp {...app} />
      </div>
    </AppChromeProvider>
  ) : null;
};

export const main: AppMain = mount(Boot);
