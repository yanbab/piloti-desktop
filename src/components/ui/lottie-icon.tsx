import * as React from "react";
import lottie, { type AnimationItem } from "lottie-web/build/player/lottie_light";
import { cn } from "@/lib/utils";

const parsedAnimationCache = new Map<string, Record<string, unknown>>();

export function isLottieIconUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.startsWith("data:application/json") ||
    lower.endsWith(".json") ||
    lower.includes(".json?")
  );
}

function decodeLottieDataUrl(src: string): Record<string, unknown> | null {
  const cached = parsedAnimationCache.get(src);
  if (cached) return cached;

  try {
    let jsonText: string | null = null;
    if (src.startsWith("data:application/json;base64,")) {
      const b64 = src.slice("data:application/json;base64,".length);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      jsonText = new TextDecoder().decode(bytes);
    } else if (src.startsWith("data:application/json")) {
      const comma = src.indexOf(",");
      if (comma >= 0) {
        jsonText = decodeURIComponent(src.slice(comma + 1));
      }
    }
    if (!jsonText) return null;
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    parsedAnimationCache.set(src, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function isReducedMotionActive(): boolean {
  if (typeof document !== "undefined") {
    if (document.documentElement.dataset.reducedMotion === "true") return true;
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

/**
 * Renders a Lottie `.json` animated icon using `lottie-web` SVG renderer.
 * Plays smoothly when hovered (or `playing` becomes true) and rests cleanly
 * at frame 0 when idle or when reduced-motion is enabled.
 */
export function LottieIcon({
  src,
  playing = false,
  loop = false,
  className,
}: {
  src: string;
  playing?: boolean;
  loop?: boolean;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const animRef = React.useRef<AnimationItem | null>(null);
  const [loadedData, setLoadedData] = React.useState<Record<string, unknown> | null>(
    () => decodeLottieDataUrl(src)
  );

  React.useEffect(() => {
    const syncData = decodeLottieDataUrl(src);
    if (syncData) {
      setLoadedData(syncData);
      return;
    }
    let cancelled = false;
    fetch(src)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === "object") {
          parsedAnimationCache.set(src, data as Record<string, unknown>);
          setLoadedData(data as Record<string, unknown>);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !loadedData) return;

    const anim = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop,
      autoplay: false,
      animationData: structuredClone(loadedData),
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
      },
    });
    animRef.current = anim;
    anim.goToAndStop(0, true);

    const onComplete = () => {
      if (!loop) {
        anim.goToAndStop(0, true);
      }
    };
    anim.addEventListener("complete", onComplete);

    const triggerTarget =
      container.closest("button, [role='button'], [data-dock-tile], [role='option']") ??
      container;
    const handleEnter = () => {
      if (isReducedMotionActive()) return;
      anim.goToAndPlay(0, true);
    };
    triggerTarget.addEventListener("pointerenter", handleEnter);

    return () => {
      triggerTarget.removeEventListener("pointerenter", handleEnter);
      anim.removeEventListener("complete", onComplete);
      anim.destroy();
      if (animRef.current === anim) {
        animRef.current = null;
      }
    };
  }, [loadedData, loop]);

  React.useEffect(() => {
    const anim = animRef.current;
    if (!anim || !playing || isReducedMotionActive()) return;
    anim.goToAndPlay(0, true);
  }, [playing]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none flex shrink-0 items-center justify-center select-none [&_svg]:size-full",
        className
      )}
    />
  );
}

