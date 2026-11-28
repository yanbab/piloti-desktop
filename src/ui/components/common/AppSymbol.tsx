import * as React from "react";
import { AppWindowIcon, GlobeIcon } from "@/ui/components/ui/symbols";
import { isLottieIconUrl, LottieIcon } from "@/ui/components/ui/lottie-icon";
import { useAppIcons } from "@/ui/components/app-icons";
import { cn } from "@/core/util/utils";

/**
 * Renders an XDG-themed icon or raw web app favicon (`<img>`) with graceful
 * fallback to a browser or executable icon (no forced background or shadow on favicons).
 */
export function AppSquircleIcon({
  iconUrl,
  fallbackIconUrl,
  squircle = false,
  open,
  animateOnHover,
  playNonce,
  className,
}: {
  iconName?: string;
  iconUrl?: string;
  fallbackIconUrl?: string;
  squircle?: boolean;
  open?: boolean;
  animateOnHover?: boolean;
  playNonce?: number;
  className?: string;
  glyphClassName?: string;
}) {
  const apps = useAppIcons();
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
          open={open}
          animateOnHover={animateOnHover}
          playNonce={playNonce}
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
        className={cn("shrink-0 text-ui-label-secondary", className)}
      />
    );
  }

  return (
    <AppWindowIcon
      aria-hidden="true"
      className={cn("shrink-0 text-ui-label-secondary", className)}
    />
  );
}
