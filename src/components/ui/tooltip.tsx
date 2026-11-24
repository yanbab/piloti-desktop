import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/core/utils";

const TooltipProvider = TooltipPrimitive.Provider;
function Tooltip({
  disableHoverablePopup = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Root
      disableHoverablePopup={disableHoverablePopup}
      {...props}
    />
  );
}
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  side = "top",
  sideOffset = 8,
  align = "center",
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  align?: "start" | "center" | "end";
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="pointer-events-none z-[500]"
      >
        <TooltipPrimitive.Popup
          className={cn(
            "flex items-center rounded-adw-item px-3 py-1.5 text-adw-callout font-medium text-adw-label shadow-adw-dock-label adw-material-dock-label animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none dark:text-white/95",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Intercepts native `[title]` hover/focus across the desktop and apps so every
 * tooltip renders with the shared Dock-style `adw-material-dock-label` popup.
 */
function GlobalTitleTooltip() {
  const [state, setState] = React.useState<{
    anchor: HTMLElement;
    text: string;
  } | null>(null);
  const activeElRef = React.useRef<HTMLElement | null>(null);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const restoreTitle = (el: HTMLElement | null) => {
      if (!el) return;
      const saved = el.getAttribute("data-piloti-title");
      if (saved !== null) {
        if (!el.hasAttribute("title")) {
          el.setAttribute("title", saved);
        }
        el.removeAttribute("data-piloti-title");
      }
    };

    const hide = () => {
      clearTimer();
      restoreTitle(activeElRef.current);
      activeElRef.current = null;
      setState(null);
    };

    const showFor = (el: HTMLElement, delayMs: number) => {
      if (activeElRef.current === el) return;
      hide();
      if (el.closest("[data-slot='dock-item']")) return;
      const text = el.getAttribute("title")?.trim();
      if (!text) return;
      el.setAttribute("data-piloti-title", text);
      el.removeAttribute("title");
      activeElRef.current = el;
      timerRef.current = window.setTimeout(() => {
        if (activeElRef.current === el && el.isConnected) {
          setState({ anchor: el, text });
        }
      }, delayMs);
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target as Element | null;
      const el = target?.closest?.("[title], [data-piloti-title]") as HTMLElement | null;
      if (!el) {
        hide();
        return;
      }
      if (el === activeElRef.current) return;
      showFor(el, 320);
    };

    const onPointerOut = (e: PointerEvent) => {
      const cur = activeElRef.current;
      if (!cur) return;
      const related = e.relatedTarget as Node | null;
      if (related && cur.contains(related)) return;
      hide();
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("blur", hide);
    window.addEventListener("scroll", hide, true);

    return () => {
      hide();
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!state) return null;

  return (
    <TooltipPrimitive.Root open>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          anchor={state.anchor}
          side="top"
          sideOffset={8}
          className="pointer-events-none z-[500]"
        >
          <TooltipPrimitive.Popup className="flex max-w-xs items-center rounded-adw-item px-3 py-1.5 text-adw-callout font-medium text-adw-label shadow-adw-dock-label adw-material-dock-label animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none dark:text-white/95">
            {state.text}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export {
  GlobalTitleTooltip,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
};

