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
import { _, ensureLocale, followLocale } from "@/core/util/i18n";
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
import { installWindowControlsOverlay, watchDragRegions } from "@/ui/apps/module-overlay";

/** A titlebar's height when the page has none to measure. */
const DEFAULT_TITLEBAR_HEIGHT = 36;

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
    // The shell's window controls over our titlebar (not when we are a tab).
    const [overlay, setOverlay] = React.useState({ visible: true, layout: undefined as string | undefined });

    React.useEffect(() => {
      void (async () => {
        const { files } = domicile;
        const module = await createAppModuleHost(domicile, options);
        const readLocale = () => readModuleText(files, LOCALE_INI);
        followLocale(await readLocale());
        await ensureLocale();
        module.watchDir(".config/piloti", () => {
          void readLocale().then(async (raw) => {
            if (!followLocale(raw)) return;
            await ensureLocale();
            setLocale((n) => n + 1);
          });
        });
        let settings = module.desktop.current();
        applyLook(settings, files);
        let visible = true;
        const host = options.decorations === "host";
        // Window Controls Overlay: the page knows the free part of its titlebar,
        // the shell where it drags the window.
        let titlebarHeight = DEFAULT_TITLEBAR_HEIGHT;
        const geometry = () => ({
          visible,
          insets: visible ? hostControlInsets(settings.windowButtonLayout) : { left: 0, right: 0 },
          height: titlebarHeight,
        });
        const wco = host ? installWindowControlsOverlay(geometry()) : null;
        if (host) {
          watchDragRegions((regions) => {
            const bar = document.querySelector<HTMLElement>('[data-slot="window-titlebar"]');
            if (bar?.offsetHeight) titlebarHeight = bar.offsetHeight;
            wco?.set(geometry());
            module.publish({ dragRegions: regions });
          });
          module.onOverlay((next) => {
            visible = next;
            wco?.set(geometry());
            setOverlay({ visible, layout: settings.windowButtonLayout });
          });
        }
        setOverlay({ visible, layout: settings.windowButtonLayout });
        module.desktop.watch((next) => {
          applyLook((settings = next), files);
          wco?.set(geometry());
          setOverlay({ visible, layout: settings.windowButtonLayout });
        });
        // "System" follows the time of day.
        window.setInterval(() => applyLook(settings, files), 60_000);
        document.title = _(options.title);
        const render = await setup({ ...module, files });
        setApp({
          render,
          drawn: () => module.publish({ ready: true }),
          chrome: { appId: options.appId, decorations: options.decorations },
        });
      })().catch((error) => console.error(`[piloti] ${options.appId} could not start`, error));
    }, [domicile]);

    const chrome = React.useMemo<AppChrome | undefined>(
      () =>
        app && {
          ...app.chrome,
          ...(options.decorations === "host"
            ? { insets: overlay.visible ? hostControlInsets(overlay.layout) : hostControlInsets("") }
            : null),
        },
      [app, overlay]
    );
    return app && chrome ? (
      <AppChromeProvider value={chrome}>
        <div key={locale} className="flex h-screen flex-col overflow-hidden">
          <Drawn onDrawn={app.drawn} />
          {app.render()}
        </div>
      </AppChromeProvider>
    ) : null;
  };
  return mount(Boot);
}
