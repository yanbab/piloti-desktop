import * as React from "react";
import lottie, { type AnimationItem } from "lottie-web/build/player/lottie_light";
import { cn } from "@/lib/core/utils";

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
 * - For stateless icons (`open === undefined`, e.g. text documents), plays on
 *   hover or whenever `playNonce` / `playing` triggers and rests at frame 0.
 * - For stateful icons (`open !== undefined`, e.g. folders), frame 0..`openFrame`
 *   opens cleanly on hover, drag-over, or when `open` is true, and smoothly
 *   reverses to closed on mouseout/close; `playNonce` plays a drop-accept pulse.
 */
export function LottieIcon({
  src,
  playing = false,
  loop = false,
  open,
  openFrame = 24,
  dropRange = [24, 44],
  playNonce = 0,
  animateOnHover,
  className,
}: {
  src: string;
  playing?: boolean;
  loop?: boolean;
  open?: boolean;
  openFrame?: number;
  dropRange?: readonly [number, number];
  playNonce?: number;
  animateOnHover?: boolean;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const animRef = React.useRef<AnimationItem | null>(null);
  const hoveredRef = React.useRef(false);
  const openPropRef = React.useRef(open);
  openPropRef.current = open;
  const animateOnHoverRef = React.useRef(
    animateOnHover ?? open !== undefined
  );
  animateOnHoverRef.current = animateOnHover ?? open !== undefined;
  const openFrameRef = React.useRef(openFrame);
  openFrameRef.current = openFrame;
  const dropRangeRef = React.useRef(dropRange);
  dropRangeRef.current = dropRange;
  const prevPlayingRef = React.useRef(playing);
  const prevPlayNonceRef = React.useRef(playNonce);
  const initialMountPlayNonceRef = React.useRef(playNonce);
  const desiredOpenRef = React.useRef(Boolean(open));
  desiredOpenRef.current = Boolean(open) || (open !== undefined && hoveredRef.current);

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

  const syncStatefulAnimation = React.useCallback((shouldBeOpen: boolean) => {
    const anim = animRef.current;
    if (!anim) return;
    const targetOpenFrame = openFrameRef.current;
    const rawAbs = Math.round((anim.firstFrame ?? 0) + (anim.currentFrame ?? 0));
    const currentAbs = Math.min(targetOpenFrame, Math.max(0, rawAbs));

    if (isReducedMotionActive()) {
      anim.resetSegments(true);
      anim.goToAndStop(shouldBeOpen ? targetOpenFrame : 0, true);
      return;
    }
    if (shouldBeOpen) {
      if (currentAbs < targetOpenFrame) {
        anim.playSegments([currentAbs, targetOpenFrame], true);
      }
    } else if (currentAbs > 0) {
      anim.playSegments([currentAbs, 0], true);
    }
  }, []);

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

    const isStateful = openPropRef.current !== undefined;
    if (isStateful) {
      const initOpen = Boolean(openPropRef.current) || hoveredRef.current;
      anim.goToAndStop(initOpen ? openFrameRef.current : 0, true);
      if (playNonce > initialMountPlayNonceRef.current && !isReducedMotionActive()) {
        initialMountPlayNonceRef.current = playNonce;
        const [dStart, dEnd] = dropRangeRef.current;
        anim.playSegments([dStart, dEnd], true);
      }
    } else {
      anim.goToAndStop(0, true);
      if (
        (playing || playNonce > 0) &&
        !isReducedMotionActive()
      ) {
        anim.goToAndPlay(0, true);
      }
    }

    const onComplete = () => {
      if (loop) return;
      if (openPropRef.current !== undefined) {
        const shouldOpen = Boolean(openPropRef.current) || hoveredRef.current;
        const rawAbs = Math.round((anim.firstFrame ?? 0) + (anim.currentFrame ?? 0));
        if (!shouldOpen && rawAbs > 0) {
          anim.playSegments([Math.min(openFrameRef.current, rawAbs), 0], true);
        }
        return;
      }
      anim.goToAndStop(0, true);
    };
    anim.addEventListener("complete", onComplete);

    const triggerTarget =
      container.closest(
        "button, [role='button'], [data-dock-tile], [data-slot='dock-item'], [role='option']"
      ) ?? container;
    const handleEnter = () => {
      // `animateOnHover={false}`: hovering does nothing, not even for
      // stateful icons (folders open on drag-over or when opened, not hover).
      if (!animateOnHoverRef.current) return;
      hoveredRef.current = true;
      if (openPropRef.current !== undefined) {
        syncStatefulAnimation(true);
        return;
      }
      if (isReducedMotionActive()) return;
      anim.goToAndPlay(0, true);
    };
    const handleLeave = () => {
      if (!hoveredRef.current) return;
      hoveredRef.current = false;
      if (openPropRef.current !== undefined) {
        syncStatefulAnimation(Boolean(openPropRef.current));
      }
    };
    triggerTarget.addEventListener("pointerenter", handleEnter);
    triggerTarget.addEventListener("pointerleave", handleLeave);

    return () => {
      triggerTarget.removeEventListener("pointerenter", handleEnter);
      triggerTarget.removeEventListener("pointerleave", handleLeave);
      anim.removeEventListener("complete", onComplete);
      anim.destroy();
      if (animRef.current === anim) {
        animRef.current = null;
      }
    };
  }, [loadedData, loop, syncStatefulAnimation]);

  React.useEffect(() => {
    if (open === undefined) return;
    syncStatefulAnimation(Boolean(open) || hoveredRef.current);
  }, [open, syncStatefulAnimation]);

  React.useEffect(() => {
    const anim = animRef.current;
    const playingRose = playing && !prevPlayingRef.current;
    const nonceRose = playNonce !== prevPlayNonceRef.current && playNonce > 0;
    prevPlayingRef.current = playing;
    prevPlayNonceRef.current = playNonce;
    if (!anim || isReducedMotionActive()) return;
    if (!playingRose && !nonceRose) return;

    if (openPropRef.current !== undefined) {
      const [dStart, dEnd] = dropRangeRef.current;
      anim.playSegments([dStart, dEnd], true);
      return;
    }
    anim.goToAndPlay(0, true);
  }, [playing, playNonce]);

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

