/**
 * The runtime of every Domicile app module: the desktop's look and language,
 * followed as they change, the app's host, and its window chrome. A module's
 * `main.tsx` says what to draw.
 */
import "@/ui/styles/globals.css";
import { mount } from "@domicile-desktop/react/mount";
import { useAppDomicile } from "@domicile-desktop/react/domicile-provider";
import type { AppMain } from "@domicile-desktop/sdk/app";
import * as React from "react";
import { applyColors, applyFonts, applyInterface, resolveTheme } from "@/core/config/appearance";
import type { DesktopSettings } from "@/core/config/desktop-settings";
import { setSymbolicIconResolver } from "@/core/icons/symbolic-icons";
import { _, followLocale } from "@/core/util/i18n";
import {
  buildXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgSymbolicIconPath,
} from "@/core/xdg/xdg-icon-theme";
import { createAppModuleHost, readModuleText, type ModuleFiles } from "@/platform/shared/app-module-host";
import {
  AppChromeProvider,
  hostControlInsets,
  type AppChrome,
} from "@/ui/components/elements/app-chrome";

export type ModuleRuntime = Awaited<ReturnType<typeof createAppModuleHost>> & {
  files: ModuleFiles;
};

export interface ModuleAppOptions {
  appId: string;
  /** The app's name, in English. */
  title: string;
  stateKeys?: readonly string[];
  /** `host`: the shell lays its window controls over the app's header bar. */
  decorations: "server" | "host";
}

function applyLook(settings: DesktopSettings, files: ModuleFiles): void {
  const root = document.documentElement;
  applyInterface(root, settings, settings.reduceMotion);
  applyFonts(root, settings);
  applyColors(root, settings, resolveTheme(settings.themeMode, { hour: new Date().getHours() }));
  // As in the shell: only Adwaita draws the interface with its symbolic icons.
  if (settings.interfaceTheme !== "adwaita") return void setSymbolicIconResolver(null);
  const index = buildXdgIconThemeIndex(files, ["Adwaita"]);
  void setSymbolicIconResolver(async (candidates) => {
    const path = lookupXdgSymbolicIconPath(await index, candidates);
    return path ? loadXdgIconDataUrl(files, path) : undefined;
  });
}

const LOCALE_INI = ".config/piloti/locale.ini";

/** Tells the shell once the app's first drawing is on screen. */
function Drawn({ onDrawn }: { onDrawn: () => void }) {
  React.useEffect(() => {
    const frame = requestAnimationFrame(onDrawn);
    return () => cancelAnimationFrame(frame);
  }, [onDrawn]);
  return null;
}

export function mountModuleApp(
  options: ModuleAppOptions,
  setup: (runtime: ModuleRuntime) => Promise<() => React.ReactNode>,
): AppMain {
  const Boot = () => {
    const domicile = useAppDomicile();
    const [app, setApp] = React.useState<{
      render: () => React.ReactNode;
      chrome: AppChrome;
      drawn: () => void;
    }>();
    // A new language draws the app again.
    const [locale, setLocale] = React.useState(0);

    React.useEffect(() => {
      void (async () => {
        const { files } = domicile;
        const module = await createAppModuleHost(domicile, options);
        const readLocale = () => readModuleText(files, LOCALE_INI);
        followLocale(await readLocale());
        module.watchDir(".config/piloti", () => {
          void readLocale().then((raw) => {
            if (followLocale(raw)) setLocale((n) => n + 1);
          });
        });
        let settings = module.desktop.current();
        applyLook(settings, files);
        module.desktop.watch((next) => applyLook((settings = next), files));
        // "System" follows the time of day.
        window.setInterval(() => applyLook(settings, files), 60_000);
        document.title = _(options.title);
        const render = await setup({ ...module, files });
        setApp({
          render,
          drawn: () => module.publish({ ready: true }),
          chrome: {
            appId: options.appId,
            decorations: options.decorations,
            ...(options.decorations === "host"
              ? { insets: hostControlInsets(settings.windowButtonLayout) }
              : null),
          },
        });
      })().catch((error) => console.error(`[piloti] ${options.appId} could not start`, error));
    }, [domicile]);

    return app ? (
      <AppChromeProvider value={app.chrome}>
        <div key={locale} className="flex h-screen flex-col overflow-hidden">
          <Drawn onDrawn={app.drawn} />
          {app.render()}
        </div>
      </AppChromeProvider>
    ) : null;
  };
  return mount(Boot);
}
