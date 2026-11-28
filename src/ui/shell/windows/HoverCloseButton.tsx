import * as React from "react";
import { XIcon } from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { WindowControlButton } from "@/ui/components/ui/window";
import { cn } from "@/core/util/utils";

/**
 * Round close button shown when hovering a `group`: Overview windows and
 * desktops, picture-in-picture windows. Sits on the Close side of the
 * window button layout.
 */
export function HoverCloseButton({
  closeOnLeft,
  inset = false,
  className,
  ...props
}: React.ComponentProps<typeof WindowControlButton> & {
  closeOnLeft: boolean;
  /** Inside the corner instead of straddling it. */
  inset?: boolean;
}) {
  return (
    <WindowControlButton
      {...props}
      className={cn(
        "absolute bg-ui-window/85 opacity-0 shadow-md backdrop-blur-md transition-opacity group-hover:opacity-100",
        inset ? "top-1.5" : "-top-2",
        inset
          ? closeOnLeft ? "left-1.5" : "right-1.5"
          : closeOnLeft ? "-left-2" : "-right-2",
        className
      )}
    >
      <SymbolicIcon name="window-close" fallback={XIcon} strokeWidth={2.25} />
    </WindowControlButton>
  );
}
