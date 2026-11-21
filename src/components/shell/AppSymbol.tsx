import * as React from "react";
import { AppWindowIcon, GlobeIcon } from "lucide-react";
import { isLottieIconUrl, LottieIcon } from "@/components/ui/lottie-icon";
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
    if (isLottieIconUrl(resolvedUrl)) {
      const lottieNode = (
        <LottieIcon
          src={resolvedUrl}
          className={cn(
            "pointer-events-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] select-none",
            squircle ? "size-[87.5%] overflow-hidden rounded-[14%]" : className
          )}
        />
      );
      return squircle ? (
        <span className={cn("flex size-full items-center justify-center", className)}>
          {lottieNode}
        </span>
      ) : (
        lottieNode
      );
    }
    const imgEl = (
      <img
        src={resolvedUrl}
        alt=""
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => {
          if (!imgFailed) setImgFailed(true);
        }}
        className={cn(
          "pointer-events-none shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] select-none",
          squircle ? "size-[87.5%] overflow-hidden rounded-[14%]" : className
        )}
      />
    );
    return squircle ? (
      <span className={cn("flex size-full items-center justify-center", className)}>
        {imgEl}
      </span>
    ) : (
      imgEl
    );
  }

  if (squircle) {
    return (
      <GlobeIcon
        aria-hidden="true"
        className={cn("shrink-0 text-adw-label-secondary", className)}
      />
    );
  }

  return (
    <AppWindowIcon
      aria-hidden="true"
      className={cn("shrink-0 text-adw-label-secondary", className)}
    />
  );
}
