import * as React from "react";
import { useSettings } from "@/context/DesktopStateContext";
import type { BackgroundRenderSpec } from "@/lib/gnome-background";

/**
 * Renders the layered desktop background (shading/preset base + optional
 * dynamic mesh overlay + GNOME `picture-options` / `picture-opacity` image
 * layer) with smooth cross-fade from transparent or the previous wallpaper.
 */
export function DesktopBackgroundLayers({
  spec,
}: {
  spec?: BackgroundRenderSpec;
}) {
  const { backgroundSpec } = useSettings();
  const active = spec ?? backgroundSpec;

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

  return (
    <>
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
    </>
  );
}
