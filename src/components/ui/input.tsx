import * as React from "react"

import { cn } from "@/lib/core/utils"

// A text entry field. The look is plain CSS: styles/components/input.css.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("shell-input", className)}
      {...props}
    />
  )
}

export { Input }
