import * as React from "react";
import { useSettings } from "@/context/DesktopStateContext";
import { useOptionalPlugins } from "@/context/PluginsContext";
import {
  resolveBackgroundRenderSpec,
  type BackgroundRenderSpec,
} from "@/lib/gnome-background";
import type { WallpaperOption } from "@/data/catalog";

/**
 * Resolves the active `BackgroundRenderSpec`, honoring any CSS/HTML/image
 * wallpaper registered by enabled plugins (`pluginWallpapers`).
 */
export function useResolvedDesktopBackgroundSpec(): BackgroundRenderSpec {
  const { settings, resolvedTheme, backgroundSpec } = useSettings();
  const pluginsCtx = useOptionalPlugins();

  return React.useMemo(() => {
    const pluginWp = pluginsCtx?.pluginWallpapers.find(
      (w) => w.fullId === settings.wallpaperId || w.id === settings.wallpaperId
    );
    if (!pluginWp) return backgroundSpec;

    const option: WallpaperOption = {
      id: pluginWp.fullId,
      name: pluginWp.name,
      subtitle: pluginWp.subtitle ?? "Plugin Wallpaper",
      category: "Dynamic",
      backgroundCss:
        pluginWp.backgroundCss ??
        "linear-gradient(175deg, #050811 0%, #0c1424 100%)",
      backgroundCssDark: pluginWp.backgroundCssDark,
      kind: pluginWp.kind,
      cssAnimation: pluginWp.cssAnimation,
      cssAnimationDark: pluginWp.cssAnimationDark,
      htmlSrcDoc: pluginWp.htmlSrcDoc,
      htmlSrcDocDark: pluginWp.htmlSrcDocDark,
      imageUrl: pluginWp.imageUrl,
      imageUrlDark: pluginWp.imageUrlDark,
      pluginId: pluginWp.pluginId,
    };

    return resolveBackgroundRenderSpec({
      wallpaperId: option.id,
      gnomeBackground: settings.gnomeBackground,
      activeWallpaper: option,
      resolvedTheme,
    });
  }, [
    backgroundSpec,
    pluginsCtx?.pluginWallpapers,
    resolvedTheme,
    settings.gnomeBackground,
    settings.wallpaperId,
  ]);
}

function scopeWallpaperCss(scopeId: string, cssText: string): string {
  const safeId = scopeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cssText.replace(/\.piloti-wp-anim\b/g, `[data-wp-scope="${safeId}"] .piloti-wp-anim`);
}

/**
 * Renders the layered desktop background (shading/preset base + optional
 * dynamic mesh overlay + CSS/HTML animated layers + GNOME `picture-options` /
 * `picture-opacity` image layer) with smooth cross-fade transitions.
 */
export function DesktopBackgroundLayers({
  spec,
}: {
  spec?: BackgroundRenderSpec;
}) {
  const effectiveSpec = useResolvedDesktopBackgroundSpec();
  const { reducedMotion } = useSettings();
  const active = spec ?? effectiveSpec;
  const reactId = React.useId();
  const scopeId = `${active.animatedCss?.id ?? "bg"}-${reactId}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  const [previousLayer, setPreviousLayer] = React.useState<
    BackgroundRenderSpec["pictureLayer"] | undefined
  >(undefined);
  const currentUrlRef = React.useRef<string | undefined>(
    active.pictureLayer?.backgroundImage
  );
  const previousLayerSnapshotRef = React.useRef<
    BackgroundRenderSpec["pictureLayer"] | undefined
  >(active.pictureLayer);

  React.useEffect(() => {
    const nextUrl = active.pictureLayer?.backgroundImage;
    if (nextUrl === currentUrlRef.current) return;

    if (previousLayerSnapshotRef.current) {
      setPreviousLayer(previousLayerSnapshotRef.current);
    }
    currentUrlRef.current = nextUrl;
    previousLayerSnapshotRef.current = active.pictureLayer;

    const timer = window.setTimeout(() => {
      setPreviousLayer(undefined);
    }, nextUrl ? 350 : 50);
    return () => window.clearTimeout(timer);
  }, [active.pictureLayer]);

  const isDesktopRoot = !spec;
  const [mounted, setMounted] = React.useState(!isDesktopRoot);

  React.useEffect(() => {
    if (!isDesktopRoot) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [isDesktopRoot]);

  const htmlSrcDoc = React.useMemo(() => {
    if (!active.htmlLayer?.srcDoc) return undefined;
    if (!reducedMotion) return active.htmlLayer.srcDoc;
    return active.htmlLayer.srcDoc.replace(
      "</head>",
      "<style>*,*::before,*::after{animation-play-state:paused!important;transition:none!important;}</style></head>"
    );
  }, [active.htmlLayer?.srcDoc, reducedMotion]);

  return (
    <div
      aria-hidden
      className={
        isDesktopRoot
          ? `pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-500 ease-out ${
              mounted ? "opacity-100" : "opacity-0"
            }`
          : "pointer-events-none absolute inset-0 overflow-hidden"
      }
    >
      {active.baseCss !== "transparent" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: active.baseCss }}
        />
      )}
      {active.overlayCss && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: active.overlayCss }}
        />
      )}
      {active.animatedCss && (
        <div
          key={`css-${active.animatedCss.id}-${scopeId}`}
          data-wp-scope={scopeId}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <style>{scopeWallpaperCss(scopeId, active.animatedCss.cssText)}</style>
          <div
            className="piloti-wp-anim pointer-events-none absolute inset-0"
            style={reducedMotion ? { animationPlayState: "paused" } : undefined}
          />
        </div>
      )}
      {active.htmlLayer && (
        <iframe
          key={`html-${htmlSrcDoc ? active.htmlLayer.srcDoc?.slice(0, 64) : active.htmlLayer.src}`}
          title="Live Wallpaper"
          sandbox="allow-scripts"
          srcDoc={htmlSrcDoc}
          src={!htmlSrcDoc ? active.htmlLayer.src : undefined}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
        />
      )}
      {previousLayer && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={previousLayer}
        />
      )}
      {active.pictureLayer && (
        <div
          key={active.pictureLayer.backgroundImage}
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-in fade-in duration-300"
          style={active.pictureLayer}
        />
      )}
    </div>
  );
}
