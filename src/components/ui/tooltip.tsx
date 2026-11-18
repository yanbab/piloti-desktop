import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

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
            "flex items-center rounded-[9px] px-3 py-1.5 text-[12.5px] font-medium text-adw-label shadow-adw-dock-label adw-material-dock-label animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none dark:text-white/95",
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

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

