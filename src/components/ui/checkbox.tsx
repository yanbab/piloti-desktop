"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/core/utils";

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "inline-flex size-4 shrink-0 cursor-default items-center justify-center rounded-[4px] border border-black/25 bg-white/80 text-white shadow-2xs transition-colors outline-none focus-visible:adw-focus-ring disabled:pointer-events-none disabled:opacity-45 data-checked:border-adw-accent data-checked:bg-adw-accent dark:border-white/25 dark:bg-white/10 dark:data-checked:border-adw-accent dark:data-checked:bg-adw-accent",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="size-3" strokeWidth={2.75} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

