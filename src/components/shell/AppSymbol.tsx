import * as React from "react";
import { useOptionalApps } from "@/context/AppsContext";
import { cn } from "@/lib/utils";

/**
 * Renders an XDG-themed icon or raw web app favicon (`<img>`) with graceful
 * fallback to a browser or executable icon (no forced background or shadow on favicons).
 */
export function AppSquircleIcon({
  iconUrl,
  fallbackIconUrl,
  squircle = false,
  className,
}: {
  iconName?: string;
  iconUrl?: string;
  fallbackIconUrl?: string;
  squircle?: boolean;
  gradient?: string;
  className?: string;
  glyphClassName?: string;
}) {
  const apps = useOptionalApps();
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setImgFailed(false);
  }, [iconUrl]);

  const activePrimary = !imgFailed && iconUrl ? iconUrl : undefined;
  const resolvedUrl =
    activePrimary ?? fallbackIconUrl ?? apps?.fallbackAppIconUrl;

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        draggable={false}
        onError={() => {
          if (!imgFailed) setImgFailed(true);
        }}
        className={cn(
          "pointer-events-none shrink-0 object-contain select-none",
          !squircle && "drop-shadow-[0_2px_5px_rgba(0,0,0,0.28)]",
          className
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0", className)}
    />
  );
}
