import * as React from "react"

import { cn } from "@/lib/utils"

// A text entry field with 6px corners and a subtle surface fill.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-6 w-full min-w-0 rounded-[6px] bg-adw-field px-2 text-adw-body font-medium text-adw-label shadow-[0_0_0_1px_var(--adw-field-border)] transition-[box-shadow] outline-none selection:bg-adw-accent/30 file:inline-flex file:h-5 file:border-0 file:bg-transparent file:text-adw-body file:font-medium file:text-adw-label placeholder:font-normal placeholder:text-adw-label-tertiary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:shadow-[0_0_0_1px_var(--adw-field-border),0_0_0_3.5px_color-mix(in_srgb,var(--adw-accent)_50%,transparent),inset_0_0_0_1px_color-mix(in_srgb,var(--adw-accent)_50%,transparent)]",
        "aria-invalid:shadow-[0_0_0_3.5px_color-mix(in_srgb,var(--adw-red)_50%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
