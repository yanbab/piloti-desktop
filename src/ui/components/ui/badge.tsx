import * as React from "react";
import { cn } from "@/core/util/utils";

/** A small rounded label, such as a state or a kind. */
export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: "neutral" | "accent" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-ui-caption font-medium whitespace-nowrap",
        tone === "accent"
          ? "bg-ui-accent/15 text-ui-accent"
          : "bg-black/6 text-ui-label-secondary dark:bg-white/10",
        className,
      )}
      {...props}
    />
  );
}
