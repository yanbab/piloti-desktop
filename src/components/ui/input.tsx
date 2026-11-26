import * as React from "react"

import { cn } from "@/lib/core/utils"

// A text entry field with 6px corners and a subtle surface fill.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-shell-control-small w-full min-w-0 rounded-shell-control bg-shell-field px-2 text-shell-body font-medium text-shell-label shadow-[0_0_0_1px_var(--shell-field-border)] transition-[box-shadow] outline-none selection:bg-shell-accent/30 file:inline-flex file:h-5 file:border-0 file:bg-transparent file:text-shell-body file:font-medium file:text-shell-label placeholder:font-normal placeholder:text-shell-label-tertiary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:shadow-[0_0_0_1px_var(--shell-field-border),0_0_0_3.5px_color-mix(in_srgb,var(--shell-accent)_50%,transparent),inset_0_0_0_1px_color-mix(in_srgb,var(--shell-accent)_50%,transparent)]",
        "aria-invalid:shadow-[0_0_0_3.5px_color-mix(in_srgb,var(--shell-red)_50%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
