"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/core/util/utils"

// A toggle switch. The look is plain CSS: styles/components/switch.css.
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "mini" | "sm" | "default" | "lg"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={
        typeof className === "function"
          ? (state) => cn("ui-switch", className(state))
          : cn("ui-switch", className)
      }
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="ui-switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
