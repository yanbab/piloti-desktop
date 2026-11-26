import * as React from "react";
import { cn } from "@/lib/core/utils";

/**
 * The surface an app draws inside its window: a header bar above content. The
 * frame around it (move, resize, minimize) is `ui/window`, owned by the shell.
 */
export function AppWindow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-window"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[inherit] bg-ui-window text-ui-label",
        className,
      )}
      {...props}
    />
  );
}

/** The scrolling body under a header bar.  */
export function AppContent({
  className,
  scroll = true,
  padded = false,
  ...props
}: React.ComponentProps<"div"> & { scroll?: boolean; padded?: boolean }) {
  return (
    <div
      data-slot="app-content"
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        scroll ? "overflow-auto" : "overflow-hidden",
        padded && "p-4",
        className,
      )}
      {...props}
    />
  );
}
